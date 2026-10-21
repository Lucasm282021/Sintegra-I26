const express = require('express');
const { validarCuit } = require('../validate');
const { authRequired, adminRequired } = require('./auth');
const router = express.Router();
const states = ['borrador','pendiente_revision','observado','aprobado','activo','inactivo'];
const json = (value, fallback = []) => { try { return JSON.parse(value || ''); } catch { return fallback; } };
const stamp = () => new Date().toISOString();
function audit(db, actor, action, row, previous, next, detail = {}) {
  db.prepare('INSERT INTO auditoria_sujetos (actor_id,accion,tipo_sujeto,sujeto_cuit,estado_anterior,estado_posterior,fecha,detalle_json) VALUES (?,?,?,?,?,?,?,?)')
    .run(actor.id, action, row.tipo_titular, row.cuit, previous || null, next || null, stamp(), JSON.stringify(detail));
}
function publicSubject(row) {
  return { ...row, actividades_secundarias: json(row.actividades_secundarias), domicilios_actividad: json(row.domicilios_actividad), jurisdicciones: json(row.jurisdicciones), aplicaciones: json(row.aplicaciones, {}), alicuota: row.alicuota == null ? null : row.alicuota };
}
function validate(body) {
  if (!body || !validarCuit(body.cuit) || !['persona_humana','persona_juridica'].includes(body.tipo_titular)) return 'CUIT o tipo de titular inválido';
  const name = body.tipo_titular === 'persona_humana' ? body.apellido_nombres : body.razon_social;
  if (typeof name !== 'string' || !name.trim() || typeof body.actividad !== 'string' || !body.actividad.trim()) return 'nombre legal y actividad principal requeridos';
  if (body.fecha_inicio && Number.isNaN(Date.parse(body.fecha_inicio))) return 'fecha de inicio inválida';
  return null;
}
router.use(authRequired);
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const where = req.user.rol === 'admin' ? '' : 'WHERE creado_por = ?';
  const rows = req.user.rol === 'admin' ? db.prepare(`SELECT * FROM padron ORDER BY actualizado_en DESC, cuit`).all()
    : db.prepare(`SELECT * FROM padron ${where} ORDER BY actualizado_en DESC, cuit`).all(req.user.id);
  return res.json({ items: rows.map(publicSubject) });
});
router.get('/:cuit', (req, res) => {
  if (!validarCuit(req.params.cuit)) return res.status(400).json({ error: 'cuit invalido' });
  const row = req.app.locals.db.prepare('SELECT * FROM padron WHERE cuit = ?').get(req.params.cuit);
  if (!row) return res.status(404).json({ error: 'sujeto no encontrado' });
  if (req.user.rol !== 'admin' && row.creado_por !== req.user.id) return res.status(403).json({ error: 'permiso denegado' });
  return res.json(publicSubject(row));
});
router.post('/', (req, res) => {
  const error = validate(req.body); if (error) return res.status(400).json({ error });
  const db = req.app.locals.db; const b = req.body; const current = stamp();
  const status = b.estado_tramite === 'borrador' ? 'borrador' : 'borrador';
  const legalName = b.tipo_titular === 'persona_humana' ? b.apellido_nombres.trim() : b.razon_social.trim();
  const permittedApps = req.user.rol === 'admin' && b.aplicaciones ? JSON.stringify(b.aplicaciones) : '{"arba_iibb":false,"arca_facturacion":false}';
  try {
    db.prepare(`INSERT INTO padron (cuit,razon_social,actividad,alicuota,condicion,estado,aplicaciones,tipo_titular,nombre_fantasia,actividad_codigo,actividades_secundarias,fecha_inicio,domicilio_fiscal,domicilios_actividad,jurisdicciones,email_contacto,telefono,estado_tramite,estado_fiscal,creado_por,creado_en,actualizado_en,apellido_nombres,tipo_documento,numero_documento,apoderado,forma_juridica,fecha_constitucion,domicilio_legal,representante_legal,dato_registral)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(b.cuit, legalName, b.actividad.trim(), req.user.rol === 'admin' && Number.isFinite(b.alicuota) ? b.alicuota : 0,
        'contribuyente', 'inactivo', permittedApps, b.tipo_titular, b.nombre_fantasia || null, b.actividad_codigo || null,
        JSON.stringify(b.actividades_secundarias || []), b.fecha_inicio || null, b.domicilio_fiscal || null,
        JSON.stringify(b.domicilios_actividad || []), JSON.stringify(b.jurisdicciones || []), b.email_contacto || null, b.telefono || null,
        status, 'pendiente_consulta', req.user.id, current, current, b.apellido_nombres || null, b.tipo_documento || null,
        b.numero_documento || null, b.apoderado || null, b.forma_juridica || null, b.fecha_constitucion || null,
        b.domicilio_legal || null, b.representante_legal || null, b.dato_registral || null);
  } catch (err) { if (err.code?.startsWith('SQLITE_CONSTRAINT')) return res.status(409).json({ error: 'cuit ya registrado' }); throw err; }
  const row = db.prepare('SELECT * FROM padron WHERE cuit = ?').get(b.cuit); audit(db, req.user, 'crear_sujeto', row, null, status);
  return res.status(201).json(publicSubject(row));
});
router.put('/:cuit', (req, res) => {
  const error = validate({ ...req.body, cuit: req.params.cuit }); if (error) return res.status(400).json({ error });
  const db = req.app.locals.db; const row = db.prepare('SELECT * FROM padron WHERE cuit=?').get(req.params.cuit);
  if (!row) return res.status(404).json({ error: 'sujeto no encontrado' });
  if (req.user.rol !== 'admin' && (row.creado_por !== req.user.id || !['borrador','pendiente_revision'].includes(row.estado_tramite))) return res.status(403).json({ error: 'permiso denegado' });
  const b = req.body; const legalName = b.tipo_titular === 'persona_humana' ? b.apellido_nombres.trim() : b.razon_social.trim(); const updated = stamp();
  db.prepare(`UPDATE padron SET razon_social=?,actividad=?,tipo_titular=?,nombre_fantasia=?,actividad_codigo=?,actividades_secundarias=?,fecha_inicio=?,domicilio_fiscal=?,domicilios_actividad=?,jurisdicciones=?,email_contacto=?,telefono=?,apellido_nombres=?,forma_juridica=?,fecha_constitucion=?,domicilio_legal=?,representante_legal=?,dato_registral=?,tipo_documento=?,numero_documento=?,apoderado=?,actualizado_en=? WHERE cuit=?`)
    .run(legalName,b.actividad.trim(),b.tipo_titular,b.nombre_fantasia||null,b.actividad_codigo||null,JSON.stringify(b.actividades_secundarias||[]),b.fecha_inicio||null,b.domicilio_fiscal||null,JSON.stringify(b.domicilios_actividad||[]),JSON.stringify(b.jurisdicciones||[]),b.email_contacto||null,b.telefono||null,b.apellido_nombres||null,b.forma_juridica||null,b.fecha_constitucion||null,b.domicilio_legal||null,b.representante_legal||null,b.dato_registral||null,b.tipo_documento||null,b.numero_documento||null,b.apoderado||null,updated,req.params.cuit);
  const updatedRow = db.prepare('SELECT * FROM padron WHERE cuit=?').get(req.params.cuit); audit(db,req.user,'editar_sujeto',updatedRow,row.estado_tramite,row.estado_tramite);
  return res.json(publicSubject(updatedRow));
});
router.post('/:cuit/enviar-revision', (req,res) => transition(req,res,'pendiente_revision',['borrador','observado'],'enviar_revision'));
router.post('/:cuit/aprobar', adminRequired, (req,res) => transition(req,res,'aprobado',['pendiente_revision','observado'],'aprobar'));
router.post('/:cuit/observar', adminRequired, (req,res) => transition(req,res,'observado',['pendiente_revision'],'observar'));
router.patch('/:cuit/estado-operativo', adminRequired, (req,res) => {
  const db=req.app.locals.db; const row=db.prepare('SELECT * FROM padron WHERE cuit=?').get(req.params.cuit);
  if(!row) return res.status(404).json({error:'sujeto no encontrado'});
  const {estado,alicuota,aplicaciones}=req.body||{}; if(!['activo','inactivo'].includes(estado)||!Number.isFinite(alicuota)||alicuota<0||alicuota>1||!aplicaciones||typeof aplicaciones.arba_iibb!=='boolean'||typeof aplicaciones.arca_facturacion!=='boolean') return res.status(400).json({error:'configuracion operativa invalida'});
  if(estado==='activo'&&!['aprobado','inactivo'].includes(row.estado_tramite)) return res.status(409).json({error:'el sujeto debe estar aprobado'});
  db.prepare('UPDATE padron SET estado=?,alicuota=?,aplicaciones=?,estado_tramite=?,actualizado_en=?,revisado_por=? WHERE cuit=?').run(estado,alicuota,JSON.stringify(aplicaciones),estado==='activo'?'activo':'inactivo',stamp(),req.user.id,req.params.cuit);
  const next=db.prepare('SELECT * FROM padron WHERE cuit=?').get(req.params.cuit);audit(db,req.user,'configurar_estado_operativo',next,row.estado_tramite,next.estado_tramite);return res.json(publicSubject(next));
});
function transition(req,res,next,allowed,action) {
  const db=req.app.locals.db; const row=db.prepare('SELECT * FROM padron WHERE cuit=?').get(req.params.cuit);
  if(!row) return res.status(404).json({error:'sujeto no encontrado'});
  if(req.user.rol!=='admin'&&(row.creado_por!==req.user.id||!['borrador','pendiente_revision'].includes(row.estado_tramite))) return res.status(403).json({error:'permiso denegado'});
  if(!allowed.includes(row.estado_tramite)) return res.status(409).json({error:'transicion de estado invalida'});
  db.prepare('UPDATE padron SET estado_tramite=?,actualizado_en=?,revisado_por=? WHERE cuit=?').run(next,stamp(),req.user.rol==='admin'?req.user.id:null,req.params.cuit);
  const changed=db.prepare('SELECT * FROM padron WHERE cuit=?').get(req.params.cuit);audit(db,req.user,action,changed,row.estado_tramite,next);return res.json(publicSubject(changed));
}
module.exports = router;

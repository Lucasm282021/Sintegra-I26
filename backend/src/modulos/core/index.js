// CORE de comercios: identidad única (commerce_id), sucursales, usuarios y
// estado de cada sistema con evidencia. Ver doc/ARQUITECTURA-COMERCIOS.md.
const express = require('express');
const { query, tx } = require('../../db');
const { falla, cuitValido, cuitChecksumValido, uuidValido, ruta } = require('../../http');
const { crearUsuario, iniciarSesion, requiereSesion } = require('./auth');
const { ADAPTADORES } = require('./adaptadores');
const { abrirCuenta } = require('../banco');

const router = express.Router();
const SISTEMAS = ['arca', 'arba', 'municipio', 'banco', 'tpv'];
const EVENTO = {
  arca: ['verificado', 'commerce.fiscal_verified'], arba: ['verificado', 'commerce.provincial_verified'],
  banco: ['vinculado', 'commerce.bank_linked'], tpv: ['configurado', 'commerce.pos_activated'],
};
const RESULTADOS_MANUALES = {
  arca: ['verificado', 'observado', 'pendiente'],
  arba: ['verificado', 'observado', 'pendiente', 'no_aplicable'],
  municipio: ['habilitado', 'en_tramite', 'observado', 'no_aplicable'],
  banco: ['vinculado', 'pendiente', 'rechazado'],
};
const ACCIONES = {
  arca: { observado: 'Inscribir el CUIT en ARCA (sandbox) y reverificar', no_disponible: 'Reintentar la verificación' },
  arba: { pendiente: 'Inscribir en IIBB o registrar "no aplica" con evidencia', observado: 'Revisar la inscripción en ARBA' },
  municipio: { pendiente: 'Iniciar el trámite de habilitación en Municipio', en_tramite: 'Esperar la resolución municipal', observado: 'Regularizar la habilitación' },
  banco: { pendiente: 'Vincular una cuenta bancaria', rechazado: 'Revisar la cuenta con el Banco' },
  tpv: { pendiente: 'Activar el TPV cuando se cumplan los requisitos' },
};

const texto = (v, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const evento = (c, comercioId, tipo, datos, actor) => c.query(
  'insert into core.eventos (comercio_id, tipo, datos, actor) values ($1, $2, $3, $4)',
  [comercioId, tipo, JSON.stringify(datos || {}), actor || null]);

// ---------- Usuarios y sesión ----------
router.post('/cuit/validar', ruta(async (req) => {
  const cuit = String(req.body?.cuit || '').replace(/\D/g, '');
  if (!cuitValido(cuit)) return { body: { cuit, valido: false, motivo: 'debe tener 11 dígitos' } };
  const valido = cuitChecksumValido(cuit);
  return { body: { cuit, valido, motivo: valido ? null : 'el dígito verificador no coincide' } };
}));
router.post('/usuarios', ruta(async (req) => ({ status: 201, body: await crearUsuario(req.body || {}) })));
router.post('/sesiones', ruta(async (req) => ({ body: await iniciarSesion(req.body || {}) })));

router.use(requiereSesion);

router.get('/yo', ruta(async (req) => {
  const { rows } = await query(
    `select k.id, k.cuit, k.razon_social, k.nombre_fantasia, k.estado_registro, m.rol, m.estado as membresia
     from core.membresias m join core.comercios k on k.id = m.comercio_id
     where m.usuario_id = $1 and m.estado in ('activa', 'pendiente') order by k.razon_social`, [req.usuario.id]);
  return { body: { usuario: req.usuario, comercios: rows } };
}));

// ---------- Acceso por comercio ----------
async function membresia(comercioId, usuarioId) {
  return (await query('select * from core.membresias where comercio_id = $1 and usuario_id = $2', [comercioId, usuarioId])).rows[0];
}
// Carga el comercio y exige membresía activa (y rol si se indica).
function conAcceso(...roles) {
  return async (req, _res, next) => {
    try {
      if (!uuidValido(req.params.id)) throw falla(404, 'comercio no encontrado');
      const comercio = (await query('select * from core.comercios where id = $1', [req.params.id])).rows[0];
      if (!comercio) throw falla(404, 'comercio no encontrado');
      const m = await membresia(comercio.id, req.usuario.id);
      if (!m || m.estado !== 'activa') throw falla(403, 'no tenés acceso a este comercio');
      if (roles.length && !roles.includes(m.rol)) throw falla(403, 'tu rol no permite esta acción');
      req.comercio = comercio;
      req.membresia = m;
      next();
    } catch (err) { next(err); }
  };
}
const ADMIN = ['titular', 'administrador'];

// ---------- Verificaciones ----------
async function sucursalesDe(comercioId) {
  return (await query('select * from core.sucursales where comercio_id = $1 order by creado_en, id', [comercioId])).rows;
}
async function ultima(comercioId, sistema, sucursalId) {
  return (await query(
    `select * from core.verificaciones where comercio_id = $1 and sistema = $2
       and sucursal_id is not distinct from $3 order by creado_en desc limit 1`,
    [comercioId, sistema, sucursalId || null])).rows[0];
}
async function guardarVerificacion(comercio, sistema, r, { sucursalId, origen = 'sandbox', usuarioId } = {}) {
  const previa = await ultima(comercio.id, sistema, sucursalId);
  const fila = (await query(
    `insert into core.verificaciones (comercio_id, sucursal_id, sistema, resultado, origen, referencia_evidencia,
       detalle, error, vigencia_hasta, verificado_por)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [comercio.id, sucursalId || null, sistema, r.resultado, origen, r.referencia_evidencia || null,
      JSON.stringify(r.detalle || {}), r.error || null, r.vigencia_hasta || null, usuarioId || null])).rows[0];
  if (!previa || previa.resultado !== fila.resultado) {
    const tipo = sistema === 'municipio' ? 'commerce.municipal_status_changed'
      : EVENTO[sistema] && EVENTO[sistema][0] === fila.resultado ? EVENTO[sistema][1] : 'commerce.updated';
    await evento({ query }, comercio.id, tipo, { sistema, resultado: fila.resultado, origen, sucursal_id: sucursalId || null }, usuarioId);
  }
  return fila;
}
// Ejecuta un adaptador aislado: un error deja "no_disponible" y no corta nada más.
async function verificar(comercio, sistema, usuarioId) {
  const correr = async (sucursal, principal) => {
    let r;
    try {
      r = await ADAPTADORES[sistema](comercio, sucursal, principal);
    } catch (err) {
      r = { resultado: 'no_disponible', error: `consulta fallida: ${err.message}`.slice(0, 300), detalle: {} };
    }
    return guardarVerificacion(comercio, sistema, r, { sucursalId: sucursal?.id, usuarioId });
  };
  if (sistema !== 'municipio') return [await correr()];
  const sucursales = await sucursalesDe(comercio.id);
  const filas = [];
  for (const [i, s] of sucursales.entries()) filas.push(await correr(s, i === 0));
  return filas;
}
async function verificarTodo(comercio, usuarioId) {
  for (const s of SISTEMAS) await verificar(comercio, s, usuarioId);
}

const filaVerif = (v) => v && ({
  resultado: v.resultado, origen: v.origen, fecha: new Date(v.creado_en).toISOString(),
  evidencia: v.referencia_evidencia, detalle: v.detalle, error: v.error, vigencia_hasta: v.vigencia_hasta,
});

async function panel(comercio) {
  const sucursales = await sucursalesDe(comercio.id);
  const estado = { identidad: filaVerif(await ultima(comercio.id, 'identidad')) };
  for (const s of SISTEMAS) {
    if (s === 'municipio') continue;
    const v = filaVerif(await ultima(comercio.id, s));
    estado[s] = v ? { ...v, accion: ACCIONES[s]?.[v.resultado] || null } : null;
  }
  estado.municipio = [];
  for (const s of sucursales) {
    const v = filaVerif(await ultima(comercio.id, 'municipio', s.id));
    estado.municipio.push({ sucursal_id: s.id, sucursal: s.nombre,
      ...(v ? { ...v, accion: ACCIONES.municipio[v.resultado] || null } : { resultado: null }) });
  }
  return estado;
}

const filaComercio = (k) => ({
  id: k.id, cuit: k.cuit, razon_social: k.razon_social, nombre_fantasia: k.nombre_fantasia,
  tipo_persona: k.tipo_persona, email_contacto: k.email_contacto, telefono_contacto: k.telefono_contacto,
  domicilio_fiscal: k.domicilio_fiscal, estado_registro: k.estado_registro, origen: k.origen,
  creado_en: new Date(k.creado_en).toISOString(),
});
const filaSucursal = (s) => ({
  id: s.id, nombre: s.nombre, domicilio_comercial: s.domicilio_comercial, localidad: s.localidad,
  provincia: s.provincia, codigo_postal: s.codigo_postal, municipio: s.municipio, estado: s.estado,
});
async function ficha(comercio) {
  // Comercios importados sin verificaciones previas se verifican al abrirlos.
  const hay = (await query("select 1 from core.verificaciones where comercio_id = $1 and sistema <> 'identidad' limit 1", [comercio.id])).rows[0];
  if (!hay) await verificarTodo(comercio);
  return { comercio: filaComercio(comercio), sucursales: (await sucursalesDe(comercio.id)).map(filaSucursal), estado: await panel(comercio) };
}

function validarSucursal(s) {
  if (!s || typeof s !== 'object') throw falla(400, 'los datos de la sucursal son obligatorios');
  const out = {
    nombre: texto(s.nombre, 120) || 'Casa central',
    domicilio_comercial: texto(s.domicilio_comercial),
    localidad: texto(s.localidad, 120), provincia: texto(s.provincia, 120),
    codigo_postal: texto(s.codigo_postal, 12), municipio: texto(s.municipio, 120),
  };
  if (!out.domicilio_comercial) throw falla(400, 'el domicilio comercial de la sucursal es obligatorio');
  return out;
}
const insertarSucursal = (c, comercioId, s) => c.query(
  `insert into core.sucursales (comercio_id, nombre, domicilio_comercial, localidad, provincia, codigo_postal, municipio)
   values ($1,$2,$3,$4,$5,$6,$7) returning *`,
  [comercioId, s.nombre, s.domicilio_comercial, s.localidad, s.provincia, s.codigo_postal, s.municipio]);

// ---------- Paso 1: alta ----------
router.post('/comercios', ruta(async (req) => {
  const b = req.body || {};
  const cuit = String(b.cuit || '').replace(/\D/g, '');
  if (!cuitValido(cuit)) throw falla(400, 'el CUIT debe tener 11 dígitos');
  if (!cuitChecksumValido(cuit)) throw falla(400, 'CUIT inválido: el dígito verificador no coincide');
  const razon = texto(b.razon_social);
  if (!razon) throw falla(400, 'la razón social o nombre comercial es obligatorio');
  const email = texto(b.email_contacto, 254);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw falla(400, 'correo de contacto inválido');
  if (b.acepta_condiciones !== true) throw falla(400, 'hay que aceptar las condiciones y el tratamiento de datos');
  if (b.declara_representacion !== true) throw falla(400, 'hay que declarar que representás al comercio');
  if (b.tipo_persona && !['fisica', 'juridica'].includes(b.tipo_persona)) throw falla(400, 'tipo_persona inválido');
  const sucursal = validarSucursal(b.sucursal);

  const existente = (await query('select * from core.comercios where cuit = $1', [cuit])).rows[0];
  if (existente) {
    const m = await membresia(existente.id, req.usuario.id);
    if (m?.estado === 'activa') return { status: 200, body: await ficha(existente) };
    throw falla(409, m?.estado === 'pendiente'
      ? 'el comercio ya existe y tu solicitud de acceso está pendiente'
      : 'el comercio ya está registrado: podés solicitar acceso a su titular');
  }

  let comercio;
  try {
    comercio = await tx(async (c) => {
      const k = (await c.query(
        `insert into core.comercios (cuit, razon_social, nombre_fantasia, tipo_persona, email_contacto, telefono_contacto, domicilio_fiscal)
         values ($1,$2,$3,$4,$5,$6,$7) returning *`,
        [cuit, razon, texto(b.nombre_fantasia), b.tipo_persona || (cuit.startsWith('3') ? 'juridica' : 'fisica'),
          email, texto(b.telefono_contacto, 40), texto(b.domicilio_fiscal)])).rows[0];
      await insertarSucursal(c, k.id, sucursal);
      await c.query(`insert into core.membresias (comercio_id, usuario_id, rol, estado) values ($1,$2,'titular','activa')`, [k.id, req.usuario.id]);
      await c.query(
        `insert into core.verificaciones (comercio_id, sistema, resultado, origen, referencia_evidencia, detalle, verificado_por)
         values ($1,'identidad','declarado','declaracion',$2,$3,$4)`,
        [k.id, `core.membresias:${req.usuario.id}`,
          JSON.stringify({ representacion: 'declarada por el titular', acepta_condiciones: true, fecha: new Date().toISOString() }), req.usuario.id]);
      await evento(c, k.id, 'commerce.created', { cuit, origen: 'alta' }, req.usuario.id);
      return k;
    });
  } catch (err) {
    if (err.code === '23505' || /duplicate|unique/i.test(err.message)) throw falla(409, 'el comercio ya está registrado: podés solicitar acceso a su titular');
    throw err;
  }
  // Pasos 2 a 6: cada sistema se consulta por separado.
  await verificarTodo(comercio, req.usuario.id);
  return { status: 201, body: await ficha(comercio) };
}));

// Solicitud de acceso de un usuario que no es miembro (nunca da acceso directo).
router.post('/comercios/acceso', ruta(async (req) => {
  const cuit = String(req.body?.cuit || '').replace(/\D/g, '');
  if (!cuitValido(cuit)) throw falla(400, 'el CUIT debe tener 11 dígitos');
  const k = (await query('select id from core.comercios where cuit = $1', [cuit])).rows[0];
  if (!k) throw falla(404, 'no hay un comercio registrado con ese CUIT');
  const rol = req.body?.rol === 'administrador' ? 'administrador' : 'operador';
  const m = await membresia(k.id, req.usuario.id);
  if (m?.estado === 'activa') throw falla(409, 'ya tenés acceso a este comercio');
  if (m?.estado === 'pendiente') return { status: 202, body: { comercio_id: k.id, estado: 'pendiente' } };
  await tx(async (c) => {
    await c.query(
      `insert into core.membresias (comercio_id, usuario_id, rol, estado, motivo) values ($1,$2,$3,'pendiente',$4)
       on conflict (comercio_id, usuario_id) do update set estado = 'pendiente', rol = excluded.rol, motivo = excluded.motivo, resuelta_por = null`,
      [k.id, req.usuario.id, rol, texto(req.body?.motivo, 500)]);
    await evento(c, k.id, 'commerce.access_requested', { rol }, req.usuario.id);
  });
  return { status: 202, body: { comercio_id: k.id, estado: 'pendiente' } };
}));

// ---------- Paso 7: ficha y panel ----------
router.get('/comercios/:id', conAcceso(), ruta(async (req) => ({ body: await ficha(req.comercio) })));
router.get('/comercios/:id/estado', conAcceso(), ruta(async (req) => ({ body: await panel(req.comercio) })));

// Actualiza datos propios del CORE. Lo que informa ARCA no se pisa una vez verificado.
router.patch('/comercios/:id', conAcceso(...ADMIN), ruta(async (req) => {
  const b = req.body || {};
  if (b.cuit !== undefined) throw falla(400, 'el CUIT no se puede modificar');
  const arca = await ultima(req.comercio.id, 'arca');
  if ((b.razon_social !== undefined || b.domicilio_fiscal !== undefined) && arca?.resultado === 'verificado') {
    throw falla(409, 'la razón social y el domicilio fiscal los informa ARCA: no se modifican desde el CORE');
  }
  const campos = ['razon_social', 'nombre_fantasia', 'email_contacto', 'telefono_contacto', 'domicilio_fiscal'].filter((k) => b[k] !== undefined);
  if (!campos.length) throw falla(400, 'no hay datos para actualizar');
  if (b.email_contacto !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.email_contacto))) throw falla(400, 'correo de contacto inválido');
  const sets = campos.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const k = (await query(`update core.comercios set ${sets} where id = $1 returning *`,
    [req.comercio.id, ...campos.map((c) => texto(b[c], 254))])).rows[0];
  await evento({ query }, k.id, 'commerce.updated', { campos }, req.usuario.id);
  return { body: filaComercio(k) };
}));

router.post('/comercios/:id/verificaciones/:sistema', conAcceso(), ruta(async (req) => {
  if (!SISTEMAS.includes(req.params.sistema)) throw falla(404, 'sistema desconocido');
  await verificar(req.comercio, req.params.sistema, req.usuario.id);
  return { body: await panel(req.comercio) };
}));

// Verificación manual: exige evidencia (p. ej. número de constancia o expediente).
router.post('/comercios/:id/verificaciones/:sistema/manual', conAcceso(...ADMIN), ruta(async (req) => {
  const sistema = req.params.sistema;
  const b = req.body || {};
  if (!RESULTADOS_MANUALES[sistema]) throw falla(404, 'sistema sin verificación manual');
  if (!RESULTADOS_MANUALES[sistema].includes(b.resultado)) throw falla(400, `resultado inválido para ${sistema}`);
  const evidencia = texto(b.referencia_evidencia, 300);
  const motivo = texto(b.motivo, 500);
  if (!evidencia || evidencia.length < 3) throw falla(400, 'la verificación manual necesita una referencia de evidencia');
  if (!motivo) throw falla(400, 'indicá el motivo de la verificación manual');
  let sucursalId = null;
  if (sistema === 'municipio') {
    sucursalId = b.sucursal_id;
    if (!uuidValido(sucursalId) || !(await query('select 1 from core.sucursales where id = $1 and comercio_id = $2', [sucursalId, req.comercio.id])).rows[0]) {
      throw falla(400, 'sucursal_id inválido');
    }
  }
  if (b.vigencia_hasta && !/^\d{4}-\d{2}-\d{2}$/.test(String(b.vigencia_hasta))) throw falla(400, 'vigencia_hasta debe tener formato AAAA-MM-DD');
  await guardarVerificacion(req.comercio, sistema,
    { resultado: b.resultado, referencia_evidencia: evidencia, detalle: { motivo }, vigencia_hasta: b.vigencia_hasta || null },
    { sucursalId, origen: 'manual', usuarioId: req.usuario.id });
  return { status: 201, body: await panel(req.comercio) };
}));

router.get('/comercios/:id/verificaciones', conAcceso(), ruta(async (req) => {
  const sistema = req.query.sistema;
  const { rows } = await query(
    `select * from core.verificaciones where comercio_id = $1 and ($2::text is null or sistema = $2)
     order by creado_en desc limit 100`, [req.comercio.id, sistema || null]);
  return { body: rows.map((v) => ({ id: v.id, sistema: v.sistema, sucursal_id: v.sucursal_id, ...filaVerif(v) })) };
}));

// ---------- Sucursales ----------
router.get('/comercios/:id/sucursales', conAcceso(), ruta(async (req) => ({ body: (await sucursalesDe(req.comercio.id)).map(filaSucursal) })));
router.post('/comercios/:id/sucursales', conAcceso(...ADMIN), ruta(async (req) => {
  const s = validarSucursal(req.body);
  if (!texto(req.body?.nombre)) throw falla(400, 'el nombre de la sucursal es obligatorio');
  const fila = (await insertarSucursal({ query }, req.comercio.id, s)).rows[0];
  await evento({ query }, req.comercio.id, 'commerce.updated', { sucursal_creada: fila.id }, req.usuario.id);
  await verificar(req.comercio, 'municipio', req.usuario.id);
  return { status: 201, body: filaSucursal(fila) };
}));

// ---------- Usuarios del comercio ----------
router.get('/comercios/:id/membresias', conAcceso(...ADMIN), ruta(async (req) => {
  const { rows } = await query(
    `select m.id, m.rol, m.estado, m.motivo, m.creado_en, u.email, u.nombre
     from core.membresias m join core.usuarios u on u.id = m.usuario_id
     where m.comercio_id = $1 order by m.estado, m.creado_en`, [req.comercio.id]);
  return { body: rows };
}));
router.post('/comercios/:id/membresias/:mid/resolver', conAcceso(...ADMIN), ruta(async (req) => {
  if (!uuidValido(req.params.mid)) throw falla(404, 'solicitud no encontrada');
  const decision = req.body?.decision;
  if (!['aprobar', 'rechazar', 'revocar'].includes(decision)) throw falla(400, 'decision debe ser aprobar, rechazar o revocar');
  const m = (await query('select * from core.membresias where id = $1 and comercio_id = $2', [req.params.mid, req.comercio.id])).rows[0];
  if (!m) throw falla(404, 'solicitud no encontrada');
  if (m.rol === 'titular') throw falla(409, 'la membresía del titular no se modifica desde aquí');
  const rol = req.body?.rol === 'administrador' ? 'administrador' : m.rol;
  if (rol === 'administrador' && req.membresia.rol !== 'titular') throw falla(403, 'solo el titular puede otorgar el rol administrador');
  if (decision !== 'revocar' && m.estado !== 'pendiente') throw falla(409, 'la solicitud ya fue resuelta');
  const estado = { aprobar: 'activa', rechazar: 'rechazada', revocar: 'revocada' }[decision];
  const fila = (await query('update core.membresias set estado = $2, rol = $3, resuelta_por = $4 where id = $1 returning *',
    [m.id, estado, rol, req.usuario.id])).rows[0];
  await evento({ query }, req.comercio.id, 'commerce.membership_changed', { membresia_id: m.id, estado }, req.usuario.id);
  return { body: { id: fila.id, rol: fila.rol, estado: fila.estado } };
}));

// ---------- Paso 5: Banco ----------
router.post('/comercios/:id/banco/vincular', conAcceso(...ADMIN), ruta(async (req) => {
  try {
    await tx((c) => abrirCuenta(c, { cuit: req.comercio.cuit, titular: req.comercio.razon_social }));
  } catch (err) {
    if (err.status === 409) {
      await guardarVerificacion(req.comercio, 'banco', { resultado: 'pendiente', referencia_evidencia: `banco.cuentas:${req.comercio.cuit}`,
        detalle: { motivo: err.message, accion: 'verificar el CUIT en ARCA y volver a vincular' } }, { usuarioId: req.usuario.id });
      throw err;
    }
    throw err;
  }
  await verificar(req.comercio, 'banco', req.usuario.id);
  return { body: await panel(req.comercio) };
}));

// ---------- Paso 6: activación del TPV ----------
router.post('/comercios/:id/tpv/activar', conAcceso(...ADMIN), ruta(async (req) => {
  const terminal = String(req.body?.terminal_id || '');
  if (!/^[a-z0-9-]+$/.test(terminal)) throw falla(400, 'terminal_id inválido');
  // Requisitos evaluados con datos frescos de cada sistema.
  for (const s of ['arca', 'banco', 'municipio']) await verificar(req.comercio, s, req.usuario.id);
  const estado = await panel(req.comercio);
  const faltantes = [];
  if (estado.arca?.resultado !== 'verificado') faltantes.push('ARCA: el CUIT debe estar verificado');
  if (estado.banco?.resultado !== 'vinculado') faltantes.push('Banco: falta una cuenta bancaria vinculada');
  if (estado.municipio.some((m) => m.resultado === 'observado')) faltantes.push('Municipio: hay una habilitación observada (suspendida o dada de baja)');
  if (faltantes.length) {
    await guardarVerificacion(req.comercio, 'tpv', { resultado: 'pendiente', referencia_evidencia: `core.comercios:${req.comercio.id}`,
      detalle: { motivo: 'activación parcial: faltan requisitos', faltantes } }, { origen: 'sistema', usuarioId: req.usuario.id });
    const err = falla(409, 'faltan requisitos para activar el TPV');
    err.detalle = { faltantes };
    throw err;
  }
  const advertencias = estado.municipio.filter((m) => m.resultado !== 'habilitado' && m.resultado !== 'no_aplicable')
    .map((m) => `Municipio: la sucursal ${m.sucursal} está ${m.resultado || 'sin verificar'}`);
  if (!estado.arca?.detalle?.puntos_venta) {
    advertencias.push('ARCA: no hay punto de venta dado de alta; las ventas no se podrán facturar hasta registrarlo');
  }
  const tpv = require('../tpv');
  await tx((c) => tpv.vincularComercio(c, { terminal_id: terminal, cuit: req.comercio.cuit, rubro: texto(req.body?.rubro, 80) || 'Comercio' }));
  await verificar(req.comercio, 'tpv', req.usuario.id);
  return { body: { advertencias, estado: await panel(req.comercio) } };
}));

module.exports = router;

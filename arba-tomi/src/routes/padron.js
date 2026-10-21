const express = require('express');
const { validarCuit } = require('../validate');
const { publicPadron } = require('../db');
const { authRequired, adminRequired } = require('./auth');

const router = express.Router();

const DEFAULT_APPS = { arba_iibb: true, arca_facturacion: false };

function normalizeComercio(body) {
  if (!body || typeof body.razon_social !== 'string' || !body.razon_social.trim()
    || typeof body.actividad !== 'string' || !body.actividad.trim()
    || typeof body.alicuota !== 'number' || !Number.isFinite(body.alicuota)
    || body.alicuota < 0 || body.alicuota > 1) return null;
  return {
    razon_social: body.razon_social.trim(),
    actividad: body.actividad.trim(),
    alicuota: body.alicuota,
    estado: body.estado === 'inactivo' ? 'inactivo' : 'activo',
    aplicaciones: {
      arba_iibb: body.aplicaciones?.arba_iibb !== false,
      arca_facturacion: body.aplicaciones?.arca_facturacion === true,
    },
  };
}

function comercioDesdeFila(row) {
  let aplicaciones = DEFAULT_APPS;
  try { aplicaciones = { ...DEFAULT_APPS, ...JSON.parse(row.aplicaciones || '{}') }; } catch { /* use defaults */ }
  return {
    cuit: row.cuit,
    razon_social: row.razon_social,
    actividad: row.actividad,
    alicuota: row.alicuota,
    estado: row.estado || 'activo',
    aplicaciones,
  };
}

function auditCommerce(db, user, action, cuit, before, after) {
  db.prepare('INSERT INTO auditoria_sujetos (actor_id,accion,tipo_sujeto,sujeto_cuit,estado_anterior,estado_posterior,fecha,detalle_json) VALUES (?,?,?,?,?,?,?,?)')
    .run(user.id, action, 'persona_juridica', cuit, before?.estado || null, after?.estado || null,
      new Date().toISOString(), JSON.stringify({ legacy_comercio: true, alicuota_anterior: before?.alicuota, alicuota_posterior: after?.alicuota }));
}

// Panel de administración de comercios, separado del contrato público del padrón ARBA.
router.get('/comercios', authRequired, adminRequired, (req, res) => {
  const page = Number.parseInt(req.query.page || '1', 10);
  const limit = Number.parseInt(req.query.limit || '100', 10);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'paginacion invalida' });
  }
  const db = req.app.locals.db;
  const total = db.prepare('SELECT COUNT(*) AS total FROM padron').get().total;
  const rows = db.prepare('SELECT * FROM padron ORDER BY razon_social LIMIT ? OFFSET ?')
    .all(limit, (page - 1) * limit);
  return res.status(200).json({ page, limit, total, items: rows.map(comercioDesdeFila) });
});

router.post('/comercios', authRequired, adminRequired, (req, res) => {
  const { cuit } = req.body || {};
  const comercio = normalizeComercio(req.body);
  if (!validarCuit(cuit) || !comercio) return res.status(400).json({ error: 'datos de comercio invalidos' });
  const db = req.app.locals.db;
  const before = db.prepare('SELECT estado, alicuota FROM padron WHERE cuit = ?').get(cuit);
  try {
    db.prepare('INSERT INTO padron (cuit, razon_social, actividad, alicuota, condicion, estado, aplicaciones) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(cuit, comercio.razon_social, comercio.actividad, comercio.alicuota, 'contribuyente', comercio.estado, JSON.stringify(comercio.aplicaciones));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'cuit ya registrado' });
    }
    throw err;
  }
  auditCommerce(db, req.user, 'crear_comercio', cuit, null, comercio);
  return res.status(201).json({ cuit, ...comercio });
});

router.put('/comercios/:cuit', authRequired, adminRequired, (req, res) => {
  const comercio = normalizeComercio(req.body);
  if (!validarCuit(req.params.cuit) || !comercio) return res.status(400).json({ error: 'datos de comercio invalidos' });
  const db = req.app.locals.db;
  const before = db.prepare('SELECT estado, alicuota FROM padron WHERE cuit = ?').get(req.params.cuit);
  const result = db.prepare('UPDATE padron SET razon_social = ?, actividad = ?, alicuota = ?, estado = ?, aplicaciones = ? WHERE cuit = ?')
    .run(comercio.razon_social, comercio.actividad, comercio.alicuota, comercio.estado, JSON.stringify(comercio.aplicaciones), req.params.cuit);
  if (!result.changes) return res.status(404).json({ error: 'comercio no encontrado' });
  auditCommerce(db, req.user, 'editar_comercio', req.params.cuit, before, comercio);
  return res.status(200).json({ cuit: req.params.cuit, ...comercio });
});

router.delete('/comercios/:cuit', authRequired, adminRequired, (req, res) => {
  if (!validarCuit(req.params.cuit)) return res.status(400).json({ error: 'cuit invalido' });
  const db = req.app.locals.db;
  const before = db.prepare('SELECT estado, alicuota FROM padron WHERE cuit = ?').get(req.params.cuit);
  const result = db.prepare('DELETE FROM padron WHERE cuit = ?').run(req.params.cuit);
  if (!result.changes) return res.status(404).json({ error: 'comercio no encontrado' });
  auditCommerce(db, req.user, 'eliminar_comercio', req.params.cuit, before, null);
  return res.status(200).json({ cuit: req.params.cuit });
});

// GET /arba/padron?page=1&limit=10
router.get('/', (req, res) => {
  const page = Number.parseInt(req.query.page || '1', 10);
  const limit = Number.parseInt(req.query.limit || '10', 10);

  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'paginacion invalida' });
  }

  const db = req.app.locals.db;
  const total = db.prepare('SELECT COUNT(*) AS total FROM padron').get().total;
  const rows = db.prepare(
    'SELECT cuit, actividad, alicuota FROM padron ORDER BY cuit LIMIT ? OFFSET ?'
  ).all(limit, (page - 1) * limit);

  return res.status(200).json({
    page,
    limit,
    total,
    items: rows.map(publicPadron)
  });
});

// GET /arba/padron/{cuit}
router.get('/:cuit', (req, res) => {
  const { cuit } = req.params;
  if (!validarCuit(cuit)) return res.status(400).json({ error: 'cuit invalido' });

  const row = req.app.locals.db
    .prepare('SELECT cuit, actividad, alicuota FROM padron WHERE cuit = ?')
    .get(cuit);

  if (!row) return res.status(404).json({ error: 'cuit no encontrado en padron' });
  return res.status(200).json(publicPadron(row));
});

module.exports = router;

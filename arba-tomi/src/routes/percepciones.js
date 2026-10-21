const express = require('express');
const {
  validarCuit,
  validarMonto,
  validarIdVenta,
  round2
} = require('../validate');
const { publicPercepcion } = require('../db');

const router = express.Router();

function mismaSolicitud(row, body) {
  return row.cuit === body.cuit && row.monto_venta === body.monto_venta;
}

// POST /arba/percepciones
router.post('/', (req, res) => {
  const { id_venta, cuit, monto_venta } = req.body || {};

  if (!validarIdVenta(id_venta)) {
    return res.status(400).json({ error: 'id_venta invalido' });
  }
  if (!validarCuit(cuit)) {
    return res.status(400).json({ error: 'cuit invalido' });
  }
  if (!validarMonto(monto_venta)) {
    return res.status(400).json({ error: 'monto_venta invalido' });
  }

  const db = req.app.locals.db;
  const existente = db.prepare(
    'SELECT * FROM percepciones WHERE id_venta = ?'
  ).get(id_venta);

  if (existente) {
    if (!mismaSolicitud(existente, { cuit, monto_venta })) {
      return res.status(409).json({ error: 'id_venta ya existe con otros datos' });
    }
    return res.status(200).json(publicPercepcion(existente));
  }

  const contribuyente = db.prepare(
    'SELECT cuit, actividad, alicuota, estado, aplicaciones, estado_tramite FROM padron WHERE cuit = ?'
  ).get(cuit);
  if (contribuyente && ['borrador','pendiente_revision','observado','aprobado','inactivo'].includes(contribuyente.estado_tramite)) {
    return res.status(403).json({ error: 'sujeto sin habilitacion operativa' });
  }
  if (!contribuyente) {
    return res.status(404).json({ error: 'cuit no encontrado en padron' });
  }
  let aplicaciones = { arba_iibb: true };
  try { aplicaciones = { ...aplicaciones, ...JSON.parse(contribuyente.aplicaciones || '{}') }; } catch { /* use defaults */ }
  if (contribuyente.estado === 'inactivo' || !aplicaciones.arba_iibb
    || ['borrador','pendiente_revision','observado','aprobado','inactivo'].includes(contribuyente.estado_tramite)) {
    return res.status(403).json({ error: 'comercio sin modulo arba iibb activo' });
  }

  const montoPercepcion = round2(monto_venta * contribuyente.alicuota);
  const fecha = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO percepciones
      (id_venta, cuit, monto_venta, alicuota_aplicada, monto_percepcion, fecha)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id_venta,
    cuit,
    round2(monto_venta),
    contribuyente.alicuota,
    montoPercepcion,
    fecha
  );

  const creada = db.prepare('SELECT * FROM percepciones WHERE id = ?').get(result.lastInsertRowid);
  return res.status(201).json(publicPercepcion(creada));
});

// Historial adicional para auditoría del módulo.
router.get('/:cuit', (req, res) => {
  const { cuit } = req.params;
  if (!validarCuit(cuit)) return res.status(400).json({ error: 'cuit invalido' });

  const rows = req.app.locals.db.prepare(
    'SELECT * FROM percepciones WHERE cuit = ? ORDER BY id DESC'
  ).all(cuit);

  return res.status(200).json({
    cuit,
    cantidad: rows.length,
    percepciones: rows.map(publicPercepcion)
  });
});

module.exports = router;

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db');
const { isValidCuit, isValidIdVenta, isValidMoney, round2 } = require('../validation');

const router = express.Router();

function toLegacyResponse(row) {
  return {
    id: row.id,
    id_venta: row.sale_id,
    cuit: row.cuit,
    monto_venta: row.base_amount_minor / 100,
    alicuota_aplicada: row.rate,
    monto_percepcion: row.tax_amount_minor / 100,
    fecha: row.created_at,
  };
}

router.post('/', (req, res) => {
  const { id_venta: idVenta, cuit, monto_venta: amount } = req.body || {};
  if (!isValidIdVenta(idVenta)) return res.status(400).json({ error: 'id_venta inválido' });
  if (!isValidCuit(cuit)) return res.status(400).json({ error: 'CUIT inválido' });
  if (!isValidMoney(amount)) return res.status(400).json({ error: 'monto_venta debe ser positivo y tener hasta dos decimales' });

  const baseMinor = Math.round(round2(amount) * 100);
  const existing = db.getPercepcionByIdVenta(idVenta);
  if (existing) {
    if (existing.cuit !== cuit || existing.base_amount_minor !== baseMinor || existing.currency !== 'ARS') {
      return res.status(409).json({ error: 'id_venta ya existe con otros datos' });
    }
    return res.status(200).json(toLegacyResponse(existing));
  }

  const enrollment = db.getInscription(cuit);
  if (!enrollment) return res.status(404).json({ error: 'CUIT no encontrado en el padrón' });
  if (enrollment.status === 'inactive' || enrollment.applications?.arba_iibb === false) {
    return res.status(403).json({ error: 'Comercio sin módulo ARBA IIBB activo' });
  }
  if (!enrollment.rate) return res.status(422).json({ error: 'No hay una alícuota vigente para la fecha de aplicación' });

  const rate = db.getRate(cuit, new Date().toISOString().slice(0, 10));
  if (!rate) return res.status(422).json({ error: 'No hay una alícuota vigente para la fecha de aplicación' });
  const createdAt = new Date().toISOString();
  const perception = {
    id: randomUUID(),
    sale_id: idVenta,
    idempotency_key: idVenta,
    cuit,
    commerce_id: enrollment.commerce_id,
    base_amount_minor: baseMinor,
    rate: rate.rate,
    rate_version: rate.version,
    rate_valid_from: rate.valid_from,
    rate_source: rate.source,
    tax_amount_minor: Math.round(baseMinor * rate.rate),
    currency: 'ARS',
    status: 'calculated',
    created_at: createdAt,
  };
  const created = db.createPercepcion(perception);
  if (!created) return res.status(409).json({ error: 'id_venta ya existe' });
  return res.status(201).json(toLegacyResponse(perception));
});

router.get('/:cuit', (req, res) => {
  const { cuit } = req.params;
  if (!isValidCuit(cuit)) return res.status(400).json({ error: 'CUIT inválido' });
  const percepciones = db.listPercepcionesByCuit(cuit);
  return res.status(200).json({ cuit, cantidad: percepciones.length, percepciones });
});

module.exports = router;

const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db');
const { isValidCuit, isValidIdVenta, isValidMoney, round2 } = require('../validation');

const router = express.Router();

router.post('/', (req, res) => {
  const { id_venta: idVenta, cuit, monto_venta: amount } = req.body || {};
  if (!isValidIdVenta(idVenta)) return res.status(400).json({ error: 'id_venta inválido' });
  if (!isValidCuit(cuit)) return res.status(400).json({ error: 'CUIT inválido' });
  if (!isValidMoney(amount)) return res.status(400).json({ error: 'monto_venta debe ser positivo y tener hasta dos decimales' });

  const existing = db.getPercepcionByIdVenta(idVenta);
  if (existing) {
    if (existing.cuit !== cuit || existing.monto_venta !== amount) {
      return res.status(409).json({ error: 'id_venta ya existe con otros datos' });
    }
    return res.status(200).json(existing);
  }

  const commerce = db.getComercioByCuit(cuit);
  if (!commerce) return res.status(404).json({ error: 'CUIT no encontrado en el padrón' });
  if (commerce.estado === 'inactivo' || commerce.aplicaciones.arba_iibb === false) {
    return res.status(403).json({ error: 'Comercio sin módulo ARBA IIBB activo' });
  }

  const alicuota = commerce.alicuota;
  const perception = {
    id: randomUUID(),
    id_venta: idVenta,
    cuit,
    monto_venta: round2(amount),
    alicuota_aplicada: alicuota,
    monto_percepcion: round2(amount * alicuota),
    fecha: new Date().toISOString(),
  };
  db.createPercepcion(perception);
  return res.status(201).json(perception);
});

router.get('/:cuit', (req, res) => {
  const { cuit } = req.params;
  if (!isValidCuit(cuit)) return res.status(400).json({ error: 'CUIT inválido' });
  const percepciones = db.listPercepcionesByCuit(cuit);
  return res.status(200).json({ cuit, cantidad: percepciones.length, percepciones });
});

module.exports = router;

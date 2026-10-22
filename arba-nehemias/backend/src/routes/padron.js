const express = require('express');
const db = require('../db');
const { isValidCuit, pageParameters } = require('../validation');

const router = express.Router();

router.get('/', (req, res) => {
  const paging = pageParameters(req.query, 10);
  if (!paging) return res.status(400).json({ error: 'Paginación inválida' });
  return res.status(200).json(db.listPadron(paging.page, paging.limit));
});

router.get('/:cuit', (req, res) => {
  const { cuit } = req.params;
  if (!isValidCuit(cuit)) return res.status(400).json({ error: 'CUIT inválido' });
  const contribuyente = db.getPadronByCuit(cuit);
  if (!contribuyente) return res.status(404).json({ error: 'CUIT no encontrado en el padrón' });
  return res.status(200).json(contribuyente);
});

module.exports = router;

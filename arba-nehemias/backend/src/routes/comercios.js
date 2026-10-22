const express = require('express');
const db = require('../db');
const { isValidCuit, normalizeComercio, normalizeComercioUpdate, pageParameters } = require('../validation');
const auth = require('../auth');

const router = express.Router();
router.use(auth.requireAuth, auth.requireRoles('admin', 'superadmin'));

router.get('/', (req, res) => {
  const paging = pageParameters(req.query, 100);
  if (!paging) return res.status(400).json({ error: 'Paginación inválida' });
  return res.status(200).json(db.listComercios(paging.page, paging.limit));
});

router.post('/', (req, res) => {
  const { cuit } = req.body || {};
  const comercio = normalizeComercio(req.body);
  if (!isValidCuit(cuit) || !comercio) {
    return res.status(400).json({ error: 'Datos de comercio inválidos' });
  }
  const resource = { cuit, ...comercio };
  if (!db.createComercio(resource)) return res.status(409).json({ error: 'CUIT ya registrado' });
  return res.status(201).json(resource);
});

router.put('/:cuit', (req, res) => {
  const { cuit } = req.params;
  if (req.body?.cuit !== undefined && req.body.cuit !== cuit) {
    return res.status(400).json({ error: 'El CUIT del cuerpo no coincide con el CUIT de la ruta' });
  }
  const comercio = normalizeComercioUpdate(req.body);
  if (!isValidCuit(cuit) || !comercio) {
    return res.status(400).json({ error: 'Datos de comercio inválidos' });
  }
  const updated = db.updateComercio(cuit, comercio);
  if (!updated) return res.status(404).json({ error: 'Comercio no encontrado' });
  return res.status(200).json(updated);
});

router.delete('/:cuit', (req, res) => {
  const { cuit } = req.params;
  if (!isValidCuit(cuit)) return res.status(400).json({ error: 'CUIT inválido' });
  if (!db.deleteComercio(cuit)) return res.status(404).json({ error: 'Comercio no encontrado' });
  return res.status(200).json({ cuit });
});

module.exports = router;

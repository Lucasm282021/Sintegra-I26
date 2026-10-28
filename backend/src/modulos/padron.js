// Padrón compartido: una sola ficha por CUIT con lo que sabe cada sistema.
const express = require('express');
const { query } = require('../db');
const { falla, cuitValido, num, ruta } = require('../http');

const router = express.Router();

router.get('/contribuyentes/:cuit', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'cuit debe tener 11 dígitos, sin puntos ni guiones');
  const { rows } = await query('select * from padron.ficha_contribuyente where cuit = $1', [req.params.cuit]);
  if (!rows[0]) throw falla(404, 'contribuyente no encontrado');
  const f = rows[0];
  return { body: { ...f, arba_alicuota: num(f.arba_alicuota), municipio_tasas_pendientes: num(f.municipio_tasas_pendientes) } };
}));

module.exports = router;

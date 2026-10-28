// ARBA: padrón de inscriptos en Ingresos Brutos y percepciones por venta.
const express = require('express');
const { query, tx } = require('../db');
const { falla, cuitValido, idValido, montoValido, num, hash, ruta } = require('../http');

const router = express.Router();
const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const filaPercepcion = (p) => ({
  id: p.id, id_venta: p.id_venta, cuit: p.cuit, monto_venta: num(p.monto_venta),
  alicuota: num(p.alicuota_aplicada), alicuota_aplicada: num(p.alicuota_aplicada),
  monto_percepcion: num(p.monto_percepcion), fecha: new Date(p.creado_en).toISOString(),
});

router.get('/padron/:cuit', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'cuit debe tener 11 dígitos, sin puntos ni guiones');
  const { rows } = await query(
    `select i.cuit, c.razon_social, i.actividad, i.alicuota, i.estado
     from arba.inscripciones i join padron.contribuyentes c on c.cuit = i.cuit where i.cuit = $1`, [req.params.cuit]);
  if (!rows[0]) throw falla(404, 'el cuit no está inscripto en ARBA');
  return { body: { ...rows[0], alicuota: num(rows[0].alicuota) } };
}));

// POST /arba/percepciones — acepta `monto` (TPV de David) o `monto_venta` (guía).
router.post('/percepciones', ruta(async (req) => {
  const b = req.body || {};
  const monto = b.monto_venta ?? b.monto;
  if (!idValido(b.id_venta)) throw falla(400, 'id_venta es obligatorio');
  if (!cuitValido(b.cuit)) throw falla(400, 'cuit debe tener 11 dígitos, sin puntos ni guiones');
  if (!montoValido(monto)) throw falla(400, 'monto_venta debe ser un número positivo de hasta dos decimales');
  const payload_hash = hash({ cuit: b.cuit, monto });
  return tx(async (c) => {
    const previa = (await c.query('select * from arba.percepciones where id_venta = $1', [b.id_venta])).rows[0];
    if (previa) {
      if (previa.payload_hash !== payload_hash) throw falla(409, 'id_venta ya fue utilizada con otros datos');
      return { status: 200, body: filaPercepcion(previa) };
    }
    const insc = (await c.query("select * from arba.inscripciones where cuit = $1 and estado = 'activa'", [b.cuit])).rows[0];
    if (!insc) throw falla(404, 'el cuit no está inscripto en ARBA');
    const alicuota = num(insc.alicuota);
    const p = (await c.query(
      `insert into arba.percepciones (id_venta, cuit, monto_venta, alicuota_aplicada, monto_percepcion, payload_hash)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [b.id_venta, b.cuit, monto, alicuota, redondear(monto * alicuota), payload_hash])).rows[0];
    return { status: 201, body: filaPercepcion(p) };
  });
}));

router.get('/percepciones/:cuit', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'cuit debe tener 11 dígitos, sin puntos ni guiones');
  const { rows } = await query(
    'select * from arba.percepciones where cuit = $1 order by creado_en desc limit 100', [req.params.cuit]);
  return { body: rows.map(filaPercepcion) };
}));

module.exports = { router };

// ARBA: padrón de inscriptos en Ingresos Brutos y percepciones por venta.
const express = require('express');
const { query, tx } = require('../db');
const { falla, cuitValido, idValido, montoValido, num, hash, ruta } = require('../http');

const router = express.Router();
const { calcularPercepcion } = require('./impuestos');
const redondear = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const filaPercepcion = (p) => ({
  id: p.id, id_venta: p.id_venta, cuit: p.cuit, monto_venta: num(p.monto_venta),
  alicuota: num(p.alicuota_aplicada), alicuota_aplicada: num(p.alicuota_aplicada),
  monto_percepcion: num(p.monto_percepcion), fecha: new Date(p.creado_en).toISOString(),
});

router.get('/padron', ruta(async (req) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 100);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw falla(400, 'page y limit deben ser enteros positivos; limit máximo 100');
  }
  const offset = (page - 1) * limit;
  const { rows } = await query(`select i.cuit,c.razon_social,i.actividad,i.alicuota,i.estado,
      i.vigente_desde as vigencia_desde
    from arba.inscripciones i join padron.contribuyentes c using(cuit)
    order by c.razon_social limit $1 offset $2`, [limit, offset]);
  const total = Number((await query('select count(*)::int total from arba.inscripciones')).rows[0].total);
  return { body: { page, limit, total, items: rows.map((r) => ({ ...r, alicuota: num(r.alicuota) })) } };
}));

router.get('/stats', ruta(async () => {
  const { rows } = await query(`select
    (select count(*)::int from arba.inscripciones where estado='activa') as total_contribuyentes,
    (select count(*)::int from arba.percepciones) as total_percepciones,
    coalesce((select sum(monto_percepcion) from arba.percepciones),0) as total_recaudado,
    coalesce((select sum(monto_venta) from arba.percepciones),0) as total_ventas,
    coalesce((select avg(alicuota) from arba.inscripciones where estado='activa'),0) as alicuota_promedio`);
  const r = rows[0];
  return { body: { totalContribuyentes: r.total_contribuyentes, totalPercepciones: r.total_percepciones,
    totalRecaudado: num(r.total_recaudado), totalVentas: num(r.total_ventas), alicuotaPromedio: num(r.alicuota_promedio) } };
}));

router.post('/padron', ruta(async (req) => {
  const b = req.body || {};
  if (!cuitValido(b.cuit) || typeof b.actividad !== 'string' || !b.actividad.trim()) throw falla(400, 'cuit y actividad son obligatorios');
  if (typeof b.alicuota !== 'number' || b.alicuota < 0 || b.alicuota >= 1) throw falla(400, 'alicuota debe ser una fracción entre 0 y 1');
  return tx(async (c) => {
    const contribuyente = (await c.query('select razon_social from padron.contribuyentes where cuit=$1', [b.cuit])).rows[0];
    if (!contribuyente) throw falla(404, 'el CUIT debe existir primero en el padrón central');
    const { rows } = await c.query(`insert into arba.inscripciones(cuit,actividad,alicuota,estado)
      values($1,$2,$3,'activa') on conflict(cuit) do update set actividad=excluded.actividad,alicuota=excluded.alicuota,estado='activa'
      returning cuit,actividad,alicuota,estado,vigente_desde as vigencia_desde`, [b.cuit,b.actividad.trim(),b.alicuota]);
    return { status: 201, body: { ...rows[0], razon_social: contribuyente.razon_social, alicuota: num(rows[0].alicuota) } };
  });
}));

router.put('/padron/:cuit', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'cuit inválido');
  const b = req.body || {};
  if (b.alicuota !== undefined && (typeof b.alicuota !== 'number' || b.alicuota < 0 || b.alicuota >= 1)) throw falla(400, 'alicuota inválida');
  const { rows } = await query(`update arba.inscripciones set actividad=coalesce(nullif($2,''),actividad),
    alicuota=coalesce($3,alicuota), estado=coalesce($4,estado),
    vigente_desde=case when $3 is not null and $3<>alicuota then current_date else vigente_desde end
    where cuit=$1 returning cuit,actividad,alicuota,estado,vigente_desde as vigencia_desde`,
    [req.params.cuit, String(b.actividad || '').trim(), b.alicuota ?? null, b.estado ?? null]);
  if (!rows[0]) throw falla(404, 'CUIT no inscripto en ARBA');
  return { body: { ...rows[0], alicuota: num(rows[0].alicuota) } };
}));

router.delete('/padron/:cuit', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'cuit inválido');
  const { rows } = await query(`update arba.inscripciones set estado='baja' where cuit=$1 returning cuit,estado`, [req.params.cuit]);
  if (!rows[0]) throw falla(404, 'CUIT no inscripto en ARBA');
  return { body: { ...rows[0], mensaje: 'inscripción dada de baja; se conservó el historial fiscal' } };
}));

router.get('/percepciones', ruta(async () => {
  const { rows } = await query('select * from arba.percepciones order by creado_en desc limit 100');
  return { body: rows.map(filaPercepcion) };
}));

router.get('/padron/:cuit', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'cuit debe tener 11 dígitos, sin puntos ni guiones');
  const { rows } = await query(
    `select i.cuit, c.razon_social, i.actividad, i.alicuota, i.estado
     from arba.inscripciones i join padron.contribuyentes c on c.cuit = i.cuit where i.cuit = $1`, [req.params.cuit]);
  if (!rows[0]) throw falla(404, 'el cuit no está inscripto en ARBA');
  return { body: { ...rows[0], alicuota: num(rows[0].alicuota) } };
}));

// POST /arba/percepciones — acepta `monto` (TPV de David) o `monto_venta` (guía).
// ---------- Régimen de percepción (configurable por ARBA) ----------
// Fechas como texto (AAAA-MM-DD) y vigencia calculada por la base, sin desfasajes de huso horario.
const SELECT_AGENTE = `select a.cuit, a.activo, a.vigente_desde::text as vigente_desde, a.vigente_hasta::text as vigente_hasta,
  (a.activo and current_date >= a.vigente_desde and (a.vigente_hasta is null or current_date <= a.vigente_hasta)) as vigente,
  c.razon_social from arba.agentes a join padron.contribuyentes c using (cuit)`;
const filaAgente = (a) => ({ cuit: a.cuit, razon_social: a.razon_social, activo: a.activo,
  vigente_desde: a.vigente_desde, vigente_hasta: a.vigente_hasta, vigente: a.vigente });

router.get('/agentes', ruta(async () => {
  const { rows } = await query(`${SELECT_AGENTE} order by c.razon_social`);
  return { body: rows.map(filaAgente) };
}));

// Designa (o modifica) un agente de percepción. Tiene que estar inscripto en IIBB.
router.put('/agentes/:cuit', ruta(async (req) => {
  const cuit = req.params.cuit;
  if (!cuitValido(cuit)) throw falla(400, 'cuit inválido');
  const b = req.body || {};
  const fecha = (v) => v === undefined || v === null || /^\d{4}-\d{2}-\d{2}$/.test(String(v));
  if (!fecha(b.vigente_desde) || !fecha(b.vigente_hasta)) throw falla(400, 'las fechas deben tener formato AAAA-MM-DD');
  const insc = (await query("select 1 from arba.inscripciones where cuit = $1 and estado = 'activa'", [cuit])).rows[0];
  if (!insc) throw falla(409, 'solo puede ser agente un contribuyente inscripto y activo en IIBB');
  const { rows } = await query(`insert into arba.agentes (cuit, activo, vigente_desde, vigente_hasta)
    values ($1, coalesce($2, true), coalesce($3::date, current_date), $4::date)
    on conflict (cuit) do update set activo = coalesce($2, arba.agentes.activo),
      vigente_desde = coalesce($3::date, arba.agentes.vigente_desde), vigente_hasta = $4::date, designado_en = now()
    returning cuit`, [cuit, typeof b.activo === 'boolean' ? b.activo : null, b.vigente_desde || null, b.vigente_hasta || null]);
  return { body: filaAgente((await query(`${SELECT_AGENTE} where a.cuit = $1`, [rows[0].cuit])).rows[0]) };
}));

router.get('/config-percepcion', ruta(async () => {
  const c = (await query('select * from arba.config_percepcion where id = 1')).rows[0];
  return { body: { alicuota_no_inscriptos: num(c.alicuota_no_inscriptos), monto_minimo: num(c.monto_minimo), actualizado_en: c.actualizado_en, simulacion: true } };
}));
router.put('/config-percepcion', ruta(async (req) => {
  const b = req.body || {};
  if (b.alicuota_no_inscriptos !== undefined && (typeof b.alicuota_no_inscriptos !== 'number' || b.alicuota_no_inscriptos < 0 || b.alicuota_no_inscriptos >= 1)) {
    throw falla(400, 'alicuota_no_inscriptos debe ser una fracción entre 0 y 1');
  }
  if (b.monto_minimo !== undefined && (typeof b.monto_minimo !== 'number' || b.monto_minimo < 0)) throw falla(400, 'monto_minimo inválido');
  const c = (await query(`update arba.config_percepcion set alicuota_no_inscriptos = coalesce($1, alicuota_no_inscriptos),
    monto_minimo = coalesce($2, monto_minimo), actualizado_en = now() where id = 1 returning *`,
    [b.alicuota_no_inscriptos ?? null, b.monto_minimo ?? null])).rows[0];
  return { body: { alicuota_no_inscriptos: num(c.alicuota_no_inscriptos), monto_minimo: num(c.monto_minimo), actualizado_en: c.actualizado_en, simulacion: true } };
}));

// Simula qué percepción correspondería, sin registrar nada.
router.get('/percepciones/simular', ruta(async (req) => {
  const { agente, sujeto } = req.query;
  const base = Number(req.query.base);
  if (!cuitValido(agente) || (sujeto && !cuitValido(sujeto)) || !(base > 0)) throw falla(400, 'agente, base y (opcional) sujeto válidos son obligatorios');
  return { body: await calcularPercepcion({ query }, { agenteCuit: agente, sujetoCuit: sujeto || null, base }) };
}));

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

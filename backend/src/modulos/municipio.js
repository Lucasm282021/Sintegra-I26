// API persistente del Municipio. Las obligaciones y pagos viven en Postgres.
const express = require('express');
const { query, tx } = require('../db');
const { falla, cuitValido, cuitChecksumValido, idValido, montoValido, num, hash, ruta } = require('../http');
const { transferir } = require('./banco');

const router = express.Router();
const CONDICIONES = { responsable_inscripto: 'Responsable Inscripto', monotributo: 'Monotributista', exento: 'Exento', consumidor_final: 'Consumidor Final' };
const estadoComercioDto = (estado) => estado === 'activa' ? 'habilitado' : estado;
const montoFila = (r) => num(r.monto);
const tasaDto = (r) => ({
  id_tributo: r.id_tributo, cuit: r.cuit, periodo: r.periodo,
  concepto_principal: r.concepto || 'Tasa de Seguridad e Higiene (TISH)',
  desglose: r.desglose || [{ concepto: r.concepto || 'Tasa de Seguridad e Higiene (TISH)', importe: montoFila(r) }],
  importe: montoFila(r), vencimiento: r.vencimiento ? new Date(r.vencimiento).toISOString().slice(0, 10) : null,
  estado: r.estado, fecha_pago: r.pagada_en ? new Date(r.pagada_en).toISOString() : null,
  id_comprobante: r.id_comprobante || null,
});
const comprobanteDto = (r) => ({
  id_comprobante: r.id_comprobante, numero_operacion: r.numero_operacion, cuit: r.cuit,
  razon_social: r.razon_social, periodo: r.periodo, conceptos: r.desglose || [],
  monto: num(r.monto), moneda: 'ARS', fecha_pago: new Date(r.pagada_en).toISOString(), estado: 'pagado',
});

router.get('/health', ruta(async () => ({ body: { status: 'ok', servicio: 'MUNICIPIO', modulo: 'municipio' } })));

router.get('/comercios', ruta(async () => {
  const { rows } = await query(`
    select h.cuit, c.razon_social, c.tipo_persona, c.condicion_iva, c.domicilio_fiscal,
      h.domicilio, h.rubro, h.estado, h.fecha_alta,
      coalesce(sum(t.monto) filter (where t.estado = 'pendiente'), 0) deuda_total,
      count(t.id) filter (where t.estado = 'pendiente') periodos_pendientes,
      count(t.id) filter (where t.estado = 'pagada') periodos_pagados
    from municipio.habilitaciones h join padron.contribuyentes c using (cuit)
    left join municipio.tasas t using (cuit)
    group by h.cuit, c.razon_social, c.tipo_persona, c.condicion_iva, c.domicilio_fiscal,
      h.domicilio, h.rubro, h.estado, h.fecha_alta order by h.fecha_alta desc, h.cuit`);
  return { body: rows.map((r) => ({
    cuit: r.cuit, razon_social: r.razon_social, condicion_fiscal: CONDICIONES[r.condicion_iva] || r.condicion_iva,
    direccion: r.domicilio || r.domicilio_fiscal || '', rubro_principal: r.rubro, rubro_secundario: '',
    estado: estadoComercioDto(r.estado), fecha_alta: new Date(r.fecha_alta).toISOString().slice(0, 10),
    deuda_total: num(r.deuda_total), periodos_pendientes: Number(r.periodos_pendientes), periodos_pagados: Number(r.periodos_pagados),
  })) };
}));

router.post('/comercios', ruta(async (req) => {
  const b = req.body || {};
  if (!cuitChecksumValido(b.cuit)) throw falla(400, 'CUIT_INVALIDO: se requieren 11 dígitos y un dígito verificador correcto');
  const razon = String(b.razon_social || '').trim();
  const condicion = String(b.condicion_fiscal || '').trim().toLowerCase().replaceAll(' ', '_');
  const direccion = String(b.direccion || '').trim();
  const rubro = String(b.rubro_principal || '').trim();
  const iva = ({ responsable_inscripto: 'responsable_inscripto', responsable_inscripto_: 'responsable_inscripto', monotributista: 'monotributo', monotributo: 'monotributo', exento: 'exento', consumidor_final: 'consumidor_final' })[condicion];
  if (!razon || !iva || !direccion || !rubro) throw falla(400, 'razon_social, condicion_fiscal, direccion y rubro_principal son obligatorios');
  return tx(async (c) => {
    if ((await c.query('select 1 from municipio.habilitaciones where cuit=$1', [b.cuit])).rows[0]) {
      throw falla(409, 'el comercio ya tiene un trámite de habilitación en el municipio');
    }
    // Como en la realidad, el municipio habilita a un contribuyente que ya tiene
    // CUIT en ARCA. Municipio no crea identidades fiscales ni pisa los datos de ARCA.
    const previo = (await c.query('select cuit from padron.contribuyentes where cuit=$1', [b.cuit])).rows[0];
    if (!previo) throw falla(409, 'el CUIT no está inscripto en ARCA: primero hay que inscribirlo en ARCA');
    const comercio = (await c.query(`insert into municipio.habilitaciones (cuit, rubro, domicilio, estado)
      values ($1,$2,$3,'pendiente') returning *`, [b.cuit, rubro, direccion])).rows[0];
    return { status: 201, body: { comercio: {
      cuit: b.cuit, razon_social: razon, condicion_fiscal: CONDICIONES[iva], direccion,
      rubro_principal: comercio.rubro, rubro_secundario: b.rubro_secundario || '',
      estado: estadoComercioDto(comercio.estado), fecha_alta: new Date(comercio.fecha_alta).toISOString().slice(0, 10),
    }, tributos_generados: [], mensaje: 'Solicitud registrada. La habilitación requiere revisión y resolución municipal.' } };
  });
}));

// Resolución del trámite (sandbox). En la realidad la dicta el municipio
// según su normativa; acá se simula y queda el expediente como evidencia.
router.post('/comercios/:cuit/resolucion', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'CUIT inválido');
  const estado = req.body?.estado;
  if (!['activa', 'suspendida', 'baja'].includes(estado)) throw falla(400, 'estado debe ser activa, suspendida o baja');
  const expediente = String(req.body?.expediente || '').trim();
  if (expediente.length < 3) throw falla(400, 'indicá el número de expediente o resolución');
  const { rows } = await query('update municipio.habilitaciones set estado=$2 where cuit=$1 returning *', [req.params.cuit, estado]);
  if (!rows[0]) throw falla(404, 'no hay trámite de habilitación para ese CUIT');
  return { body: { cuit: rows[0].cuit, estado: estadoComercioDto(rows[0].estado), expediente, simulacion: true } };
}));

router.get('/comercios/:cuit', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'CUIT inválido');
  const { rows } = await query(`select h.*, c.razon_social,c.tipo_persona,c.condicion_iva,c.domicilio_fiscal
    from municipio.habilitaciones h join padron.contribuyentes c using(cuit) where h.cuit=$1`, [req.params.cuit]);
  const r = rows[0]; if (!r) throw falla(404, 'comercio no encontrado');
  return { body: { cuit: r.cuit, razon_social: r.razon_social, condicion_fiscal: CONDICIONES[r.condicion_iva],
    direccion: r.domicilio || r.domicilio_fiscal || '', rubro_principal: r.rubro, rubro_secundario: '',
    estado: estadoComercioDto(r.estado), fecha_alta: new Date(r.fecha_alta).toISOString().slice(0, 10) } };
}));

router.get('/tributos/:cuit', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'CUIT inválido');
  const { rows } = await query(`select c.razon_social,h.estado estado_comercio,t.* from municipio.habilitaciones h
    join padron.contribuyentes c using(cuit) left join municipio.tasas t using(cuit)
    where h.cuit=$1 order by t.periodo`, [req.params.cuit]);
  if (!rows.length) throw falla(404, 'comercio no empadronado');
  const tributos = rows.filter((r) => r.id_tributo).map(tasaDto);
  return { body: { cuit: req.params.cuit, razon_social: rows[0].razon_social,
    estado_comercio: estadoComercioDto(rows[0].estado_comercio), moneda: 'ARS',
    deuda_total: tributos.filter((t) => t.estado === 'pendiente').reduce((s, t) => s + t.importe, 0),
    total_pagado: tributos.filter((t) => t.estado === 'pagada').reduce((s, t) => s + t.importe, 0),
    periodos_pendientes: tributos.filter((t) => t.estado === 'pendiente').length, tributos } };
}));

// ---------- Tasa de Seguridad e Higiene sobre las ventas (configurable) ----------
// Se liquida por período sobre lo facturado en el mes (neto + exento), con la
// alícuota del rubro de la habilitación o la general ('*'). Valores de prueba.
const filaAlicuota = (r) => ({ rubro: r.rubro, alicuota: num(r.alicuota), minimo: num(r.minimo), actualizado_en: r.actualizado_en });
router.get('/alicuotas', ruta(async () => ({
  body: (await query('select * from municipio.alicuotas_rubro order by rubro')).rows.map(filaAlicuota),
})));
router.put('/alicuotas/:rubro', ruta(async (req) => {
  const rubro = String(req.params.rubro || '').trim();
  const { alicuota, minimo } = req.body || {};
  if (!rubro) throw falla(400, 'rubro inválido');
  if (typeof alicuota !== 'number' || alicuota < 0 || alicuota >= 1) throw falla(400, 'alicuota debe ser una fracción entre 0 y 1');
  if (minimo !== undefined && (typeof minimo !== 'number' || minimo < 0)) throw falla(400, 'minimo inválido');
  const { rows } = await query(`insert into municipio.alicuotas_rubro (rubro, alicuota, minimo) values ($1, $2, coalesce($3, 0))
    on conflict (rubro) do update set alicuota = excluded.alicuota, minimo = coalesce($3, municipio.alicuotas_rubro.minimo), actualizado_en = now()
    returning *`, [rubro, alicuota, minimo ?? null]);
  return { body: filaAlicuota(rows[0]) };
}));

router.post('/tributos/liquidar', ruta(async (req) => {
  const { cuit, periodo } = req.body || {};
  if (!cuitValido(cuit)) throw falla(400, 'CUIT inválido');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(periodo || ''))) throw falla(400, 'periodo debe tener formato AAAA-MM');
  return tx(async (c) => {
    const hab = (await c.query('select * from municipio.habilitaciones where cuit = $1', [cuit])).rows[0];
    if (!hab) throw falla(404, 'el comercio no tiene habilitación municipal');
    const ali = (await c.query(`select * from municipio.alicuotas_rubro where rubro in ($1, '*')
      order by (rubro = '*') limit 1`, [hab.rubro])).rows[0];
    if (!ali) throw falla(409, 'no hay alícuota configurada para el rubro ni una general');
    const desde = `${periodo}-01`;
    const base = num((await c.query(`select coalesce(sum(coalesce(neto, subtotal) + coalesce(exento, 0)), 0) as base
      from arca.comprobantes where emisor_cuit = $1 and estado = 'emitido'
        and emitido_en >= $2::date and emitido_en < ($2::date + interval '1 month')`, [cuit, desde])).rows[0].base);
    const calculado = Math.round(base * num(ali.alicuota) * 100) / 100;
    const monto = Math.max(calculado, num(ali.minimo));
    if (!(monto > 0)) throw falla(409, 'el período no tiene base imponible ni mínimo para liquidar');
    const desglose = [
      { concepto: `Ventas del período ${periodo} (neto)`, importe: base },
      { concepto: `Alícuota rubro "${ali.rubro}" ${(num(ali.alicuota) * 100).toFixed(2)} %`, importe: calculado },
      ...(monto > calculado ? [{ concepto: 'Ajuste al mínimo del rubro', importe: Math.round((monto - calculado) * 100) / 100 }] : []),
    ];
    const previa = (await c.query("select * from municipio.tasas where cuit = $1 and periodo = $2 and tipo = 'TSYH'", [cuit, periodo])).rows[0];
    if (previa?.estado === 'pagada') throw falla(409, 'la tasa del período ya está pagada');
    const vencimiento = `${periodo}-01`;
    const { rows } = previa
      ? await c.query(`update municipio.tasas set monto = $2, desglose = $3 where id = $1 returning *`, [previa.id, monto, JSON.stringify(desglose)])
      : await c.query(`insert into municipio.tasas (id_tributo, cuit, periodo, tipo, monto, estado, concepto, desglose, vencimiento)
          values ($1, $2, $3, 'TSYH', $4, 'pendiente', 'Tasa de Seguridad e Higiene (TISH)', $5, ($6::date + interval '1 month 9 days')::date) returning *`,
          [`${cuit}-${periodo}`, cuit, periodo, monto, JSON.stringify(desglose), vencimiento]);
    return { status: previa ? 200 : 201, body: { ...tasaDto(rows[0]), base_imponible: base, alicuota: num(ali.alicuota), rubro_aplicado: ali.rubro, simulacion: true } };
  });
}));

router.post('/tributos/pagos', ruta(async (req) => {
  const b = req.body || {};
  if (!cuitValido(b.cuit)) throw falla(400, 'CUIT inválido');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.periodo || '')) throw falla(400, 'periodo debe tener formato YYYY-MM');
  if (!montoValido(b.monto)) throw falla(400, 'monto debe ser positivo y tener hasta dos decimales');
  return tx(async (c) => {
    const tasa = (await c.query(`select t.*,p.razon_social from municipio.tasas t join padron.contribuyentes p using(cuit)
      where t.cuit=$1 and t.periodo=$2 for update`, [b.cuit, b.periodo])).rows[0];
    if (!tasa) throw falla(404, 'período tributario no encontrado');
    const payloadHash = hash({ cuit: b.cuit, periodo: b.periodo, monto: b.monto });
    if (tasa.estado === 'pagada') {
      if (tasa.payload_hash === payloadHash) return { status: 200, body: { comprobante: comprobanteDto(tasa), tributo_actualizado: tasaDto(tasa), saldo_deuda_restante: 0, repetido: true } };
      throw falla(409, 'el tributo ya fue pagado con otros datos');
    }
    if (Math.abs(num(tasa.monto) - b.monto) > 0.01) throw falla(400, 'el monto no coincide con el importe liquidado');
    const cuenta = b.cuenta_origen || (await c.query('select id from banco.cuentas where cuit=$1 order by creado_en limit 1', [b.cuit])).rows[0]?.id;
    if (!cuenta) throw falla(404, 'el comercio no tiene cuenta bancaria; informe cuenta_origen');
    const movimiento = await transferir(c, { id_operacion: `municipio:${b.cuit}:${b.periodo}`, tipo: 'transferencia', origen: cuenta,
      destino: 'cuenta-municipio', monto: b.monto, payload: { tributo: tasa.id_tributo } });
    const idComprobante = `MUN-${b.periodo.replace('-', '')}-${b.cuit.slice(-4)}-${movimiento.movimiento.id.slice(0, 8)}`;
    const actualizado = (await c.query(`update municipio.tasas set estado='pagada',pagada_en=now(),payload_hash=$2,id_comprobante=$3,id_operacion_banco=$4
      where id=$1 returning *`, [tasa.id, payloadHash, idComprobante, movimiento.movimiento.id])).rows[0];
    actualizado.razon_social = tasa.razon_social;
    const pendientes = await c.query("select coalesce(sum(monto),0) total from municipio.tasas where cuit=$1 and estado='pendiente'", [b.cuit]);
    return { status: 201, body: { comprobante: { ...comprobanteDto({ ...actualizado, numero_operacion: movimiento.movimiento.id }), id_comprobante: idComprobante },
      tributo_actualizado: tasaDto(actualizado), saldo_deuda_restante: num(pendientes.rows[0].total) } };
  });
}));

router.get('/comprobantes', ruta(async (req) => {
  if (req.query.cuit !== undefined && !cuitValido(req.query.cuit)) throw falla(400, 'CUIT inválido');
  const { rows } = await query(`select t.*,p.razon_social,
    coalesce(t.id_comprobante,'MUN-'||replace(t.periodo,'-','')||'-'||right(t.cuit,4)||'-'||left(md5(t.id_tributo),8)) id_comprobante,
    coalesce(t.id_operacion_banco,'MIGRADO-DEMO:'||t.id_tributo) numero_operacion
    from municipio.tasas t join padron.contribuyentes p using(cuit) where t.estado='pagada'
    and ($1::text is null or t.cuit=$1) order by pagada_en desc limit 100`, [req.query.cuit || null]);
  return { body: rows.map(comprobanteDto) };
}));

router.get('/certificados/libre-deuda/:cuit', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'CUIT inválido');
  const c = (await query(`select h.*,p.razon_social,p.condicion_iva,p.domicilio_fiscal,
    coalesce(sum(t.monto) filter(where t.estado='pendiente'),0) deuda,
    count(t.id) filter(where t.estado='pendiente') pendientes,
    array_agg(t.periodo order by t.periodo) filter(where t.id is not null) periodos
    from municipio.habilitaciones h join padron.contribuyentes p using(cuit) left join municipio.tasas t using(cuit)
    where h.cuit=$1 group by h.cuit,p.razon_social,p.condicion_iva,p.domicilio_fiscal`, [req.params.cuit])).rows[0];
  if (!c) throw falla(404, 'comercio no empadronado');
  if (c.estado !== 'activa') throw falla(409, 'la habilitación municipal todavía no está vigente');
  if (num(c.deuda) > 0 || Number(c.pendientes) > 0) throw falla(409, `registra deuda pendiente de $${num(c.deuda).toFixed(2)} en ${c.pendientes} período(s)`);
  const emitida = new Date(); const vigencia = new Date(emitida.getTime() + 90 * 86400000);
  return { body: { id_certificado: `CLD-${c.cuit}-${emitida.toISOString().slice(0, 10)}`, codigo_verificacion: `MUN-${hash(c.cuit + emitida.toISOString().slice(0, 10)).slice(0, 12).toUpperCase()}`,
    cuit: c.cuit, razon_social: c.razon_social, condicion_fiscal: CONDICIONES[c.condicion_iva], direccion: c.domicilio || c.domicilio_fiscal || '',
    rubro_principal: c.rubro, fecha_emision: emitida.toISOString(), vigencia_hasta: vigencia.toISOString().slice(0, 10),
    deuda_total_ars: 0, periodos_auditados: c.periodos || [], estado_fiscal: 'LIBRE DE DEUDA', organismo: 'Dirección General de Rentas - Municipio' } };
}));

module.exports = router;

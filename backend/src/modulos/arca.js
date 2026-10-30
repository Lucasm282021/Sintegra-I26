// ARCA: condición fiscal y emisión de comprobantes con CAE ficticio.
const crypto = require('node:crypto');
const express = require('express');
const { query, tx } = require('../db');
const { falla, cuitValido, cuitChecksumValido, idValido, montoValido, num, hash, ruta } = require('../http');

const router = express.Router();
const TIPOS = { A: 'FACTURA_A', B: 'FACTURA_B', C: 'FACTURA_C' };
const CONDICION = {
  responsable_inscripto: 'Responsable Inscripto', monotributo: 'Monotributista',
  exento: 'Exento', consumidor_final: 'Consumidor Final',
};

const cae = () => Array.from(crypto.randomBytes(14), (x) => x % 10).join('');
const pad = (n, largo) => String(n).padStart(largo, '0');

const filaComprobante = (r) => ({
  id: r.id, id_venta: r.id_venta, cuit: r.emisor_cuit, emisor_cuit: r.emisor_cuit, receptor_cuit: r.receptor_cuit,
  tipo_comprobante: r.tipo_comprobante, punto_venta: pad(r.punto_venta, 5),
  numero: pad(r.numero, 8), numero_comprobante: pad(r.numero, 8),
  subtotal: num(r.subtotal), percepcion: num(r.percepcion), monto_total: num(r.monto_total),
  cae: `FICTICIO-${r.cae}`, vencimiento_cae: new Date(r.cae_vencimiento).toISOString().slice(0, 10),
  fecha_emision: new Date(r.emitido_en).toISOString(), estado: 'simulado', estado_registro: r.estado,
  ambiente: 'sandbox', validez_fiscal: false,
});

router.get('/contribuyentes/:cuit', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'cuit debe tener 11 dígitos, sin puntos ni guiones');
  const c = (await query('select * from padron.contribuyentes where cuit = $1', [req.params.cuit])).rows[0];
  if (!c) throw falla(404, 'contribuyente no encontrado');
  return { body: { cuit: c.cuit, razon_social: c.razon_social, condicion_fiscal: CONDICION[c.condicion_iva], condicion_iva: c.condicion_iva, estado: c.estado } };
}));

// Inscripción en el padrón fiscal (sandbox): simula el alta de CUIT ante ARCA.
// Es el dominio fiscal; la identidad del comercio la registra el CORE.
router.post('/contribuyentes', ruta(async (req) => {
  const b = req.body || {};
  if (!cuitChecksumValido(b.cuit)) throw falla(400, 'CUIT inválido: 11 dígitos con dígito verificador correcto');
  const razon = String(b.razon_social || '').trim();
  if (!razon) throw falla(400, 'la razón social es obligatoria');
  if (!CONDICION[b.condicion_iva]) throw falla(400, 'condicion_iva debe ser responsable_inscripto, monotributo, exento o consumidor_final');
  const tipo = b.tipo_persona || (b.cuit.startsWith('3') ? 'juridica' : 'fisica');
  if (!['fisica', 'juridica'].includes(tipo)) throw falla(400, 'tipo_persona inválido');
  try {
    const { rows } = await query(`insert into padron.contribuyentes (cuit, razon_social, tipo_persona, condicion_iva, domicilio_fiscal)
      values ($1,$2,$3,$4,$5) returning *`, [b.cuit, razon, tipo, b.condicion_iva, String(b.domicilio_fiscal || '').trim() || null]);
    const c = rows[0];
    return { status: 201, body: { cuit: c.cuit, razon_social: c.razon_social, condicion_fiscal: CONDICION[c.condicion_iva],
      condicion_iva: c.condicion_iva, estado: c.estado, simulacion: true } };
  } catch (err) {
    if (err.code === '23505' || /duplicate|unique/i.test(err.message)) throw falla(409, 'el CUIT ya está inscripto en ARCA');
    throw err;
  }
}));

router.get('/puntos-venta', ruta(async (req) => {
  const cuit = req.query.cuit;
  if (!cuitValido(cuit)) throw falla(400, 'cuit es obligatorio y debe tener 11 dígitos');
  const { rows } = await query(`select punto_venta,
      array_agg(tipo_comprobante order by tipo_comprobante) as tipos_comprobante,
      max(ultimo_numero) as ultimo_numero
    from arca.puntos_venta where emisor_cuit=$1 group by punto_venta order by punto_venta`, [cuit]);
  return { body: rows.map((r) => ({ punto_venta: r.punto_venta, numero: pad(r.punto_venta, 5),
    tipos_comprobante: r.tipos_comprobante, ultimo_numero: r.ultimo_numero })) };
}));

router.post('/puntos-venta', ruta(async (req) => {
  const b = req.body || {};
  const cuit = String(b.cuit || b.emisor_cuit || '');
  const puntoVenta = Number(b.punto_venta);
  if (!cuitValido(cuit)) throw falla(400, 'cuit del emisor debe tener 11 dígitos');
  if (!Number.isInteger(puntoVenta) || puntoVenta < 1 || puntoVenta > 99999) throw falla(400, 'punto_venta debe estar entre 1 y 99999');
  const emisor = (await query('select condicion_iva from padron.contribuyentes where cuit=$1', [cuit])).rows[0];
  if (!emisor) throw falla(404, 'contribuyente no encontrado en el padrón');
  const predeterminado = emisor.condicion_iva === 'responsable_inscripto' ? ['FACTURA_A','FACTURA_B'] : ['FACTURA_C'];
  const tipos = b.tipos_comprobante === undefined ? predeterminado : b.tipos_comprobante;
  if (!Array.isArray(tipos) || !tipos.length || tipos.some((t) => !Object.values(TIPOS).includes(TIPOS[t] || t))) {
    throw falla(400, 'tipos_comprobante debe contener FACTURA_A, FACTURA_B o FACTURA_C');
  }
  const unicos = [...new Set(tipos.map((t) => TIPOS[t] || t))];
  const out = await tx(async (c) => {
    for (const tipo of unicos) await c.query(`insert into arca.puntos_venta(emisor_cuit,punto_venta,tipo_comprobante)
      values($1,$2,$3) on conflict do nothing`, [cuit,puntoVenta,tipo]);
    const { rows } = await c.query(`select punto_venta,array_agg(tipo_comprobante order by tipo_comprobante) tipos_comprobante,
      max(ultimo_numero) ultimo_numero from arca.puntos_venta where emisor_cuit=$1 and punto_venta=$2 group by punto_venta`, [cuit,puntoVenta]);
    return rows[0];
  });
  return { status: 201, body: { emisor_cuit:cuit, punto_venta:out.punto_venta, numero:pad(out.punto_venta,5),
    tipos_comprobante:out.tipos_comprobante, ultimo_numero:out.ultimo_numero } };
}));

// POST /arca/comprobantes — `cuit` es el emisor (el comercio). Acepta
// `monto` (TPV de David) o `monto_total` (guía / ARCA de Mateo).
router.post('/comprobantes', ruta(async (req) => {
  const b = req.body || {};
  const total = b.monto_total ?? b.monto;
  const percepcion = b.percepcion ?? 0;
  if (!idValido(b.id_venta)) throw falla(400, 'id_venta es obligatorio');
  if (!cuitValido(b.cuit)) throw falla(400, 'cuit debe tener 11 dígitos, sin puntos ni guiones');
  if (!montoValido(total)) throw falla(400, 'monto_total debe ser un número positivo de hasta dos decimales');
  if (typeof percepcion !== 'number' || percepcion < 0 || percepcion >= total) throw falla(400, 'percepcion inválida');
  if (b.receptor_cuit !== undefined && b.receptor_cuit !== null && !cuitValido(b.receptor_cuit)) throw falla(400, 'receptor_cuit inválido');
  const puntoVenta = Number(b.punto_venta ?? 1);
  if (!Number.isInteger(puntoVenta) || puntoVenta < 1 || puntoVenta > 99999) throw falla(400, 'punto_venta inválido');

  return tx(async (c) => {
    const emisor = (await c.query('select * from padron.contribuyentes where cuit = $1', [b.cuit])).rows[0];
    if (!emisor) throw falla(404, 'contribuyente no encontrado');
    let tipo = b.tipo_comprobante ? (TIPOS[b.tipo_comprobante] || b.tipo_comprobante) : null;
    if (!tipo) tipo = emisor.condicion_iva === 'responsable_inscripto' ? 'FACTURA_B' : 'FACTURA_C';
    if (!Object.values(TIPOS).includes(tipo)) throw falla(400, 'tipo_comprobante debe ser FACTURA_A, FACTURA_B o FACTURA_C');
    const payload_hash = hash({ cuit: b.cuit, total, percepcion, tipo, puntoVenta, receptor: b.receptor_cuit || null });

    const previo = (await c.query('select * from arca.comprobantes where id_venta = $1', [b.id_venta])).rows[0];
    if (previo) {
      if (previo.payload_hash !== payload_hash) throw falla(409, 'id_venta ya fue utilizada con otros datos');
      return { status: 200, body: filaComprobante(previo) };
    }
    const { ultimo_numero: numero } = (await c.query(
      `update arca.puntos_venta set ultimo_numero = ultimo_numero + 1
       where emisor_cuit = $1 and punto_venta = $2 and tipo_comprobante = $3 returning ultimo_numero`,
      [b.cuit, puntoVenta, tipo])).rows[0] || {};
    if (!numero) throw falla(409, 'el punto de venta y tipo de comprobante deben estar configurados antes de emitir');
    const r = (await c.query(
      `insert into arca.comprobantes (id_venta, emisor_cuit, receptor_cuit, punto_venta, tipo_comprobante, numero,
         subtotal, percepcion, monto_total, cae, cae_vencimiento, payload_hash)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, current_date + 10, $11) returning *`,
      [b.id_venta, b.cuit, b.receptor_cuit || null, puntoVenta, tipo, numero,
        Math.round((total - percepcion) * 100) / 100, percepcion, total, cae(), payload_hash])).rows[0];
    return { status: 201, body: filaComprobante(r) };
  });
}));

// Búsqueda por número (con tipo, punto de venta y emisor opcionales). Si hay
// más de uno con ese número, pide más filtros (como el padrón de ARCA de Mateo).
router.get('/comprobantes/:numero', ruta(async (req) => {
  const numero = Number(req.params.numero);
  if (!Number.isInteger(numero) || numero < 1) throw falla(400, 'número de comprobante inválido');
  const tipo = req.query.tipo ? (TIPOS[req.query.tipo] || req.query.tipo) : null;
  const pv = req.query.pv ? Number(req.query.pv) : null;
  const cuit = req.query.cuit || null;
  if (cuit && !cuitValido(cuit)) throw falla(400, 'cuit inválido');
  const { rows } = await query(`select * from arca.comprobantes where numero = $1
    and ($2::text is null or tipo_comprobante = $2) and ($3::int is null or punto_venta = $3) and ($4::text is null or emisor_cuit = $4)
    order by emitido_en desc limit 2`, [numero, tipo, pv, cuit]);
  if (!rows.length) throw falla(404, 'comprobante no encontrado');
  if (rows.length > 1) throw falla(409, 'número ambiguo: indicá tipo, punto de venta o emisor');
  return { body: filaComprobante(rows[0]) };
}));

router.get('/comprobantes', ruta(async (req) => {
  const { cuit } = req.query;
  if (cuit !== undefined && !cuitValido(cuit)) throw falla(400, 'cuit debe tener 11 dígitos');
  const { rows } = cuit
    ? await query('select * from arca.comprobantes where emisor_cuit = $1 order by emitido_en desc limit 100', [cuit])
    : await query('select * from arca.comprobantes order by emitido_en desc limit 100');
  return { body: rows.map(filaComprobante) };
}));

module.exports = { router };

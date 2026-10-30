// Impuestos configurables que afectan la venta: IVA (ARCA), percepción IIBB
// (ARBA) y Tasa de Seguridad e Higiene (Municipio). PGlite; no toca Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');
const { calcularIva, tipoComprobante } = require('../src/modulos/impuestos');

let base; let server; let pg;
const COMERCIO = '30712345678';   // RI, inscripto en IIBB 3 %, agente (seed + migración 015)
const CLIENTE_RI = '30987654321'; // RI, padrón ARBA 3 %
const CLIENTE_MONO = '20345678901'; // Monotributo, padrón ARBA 2 %
const CLIENTE_FUERA = '27123456789'; // consumidor final, fuera del padrón ARBA

async function api(metodo, url, body) {
  const r = await fetch(`${base}${url}`, { method: metodo, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}
let n = 0;
async function vender(items, extra = {}) {
  return api('POST', '/tpv/ventas', { id_venta: `imp-${++n}`, terminal_id: 'david', comercio_cuit: COMERCIO, medio_pago: 'banco', items, ...extra });
}
let producto;

before(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  pg = new PGlite({ extensions: { pgcrypto } });
  await pg.exec('create schema if not exists extensions;');
  const dir = path.join(__dirname, '..', 'supabase');
  for (const f of fs.readdirSync(path.join(dir, 'migrations')).sort()) {
    await pg.exec(fs.readFileSync(path.join(dir, 'migrations', f), 'utf8'));
    if (f.startsWith('20261026000002')) await pg.exec(fs.readFileSync(path.join(dir, 'seed.sql'), 'utf8'));
  }
  require('../src/db').setDb(pg);
  server = require('../src/app').listen(0);
  await new Promise((ok) => server.once('listening', ok));
  base = `http://127.0.0.1:${server.address().port}`;
  producto = (await api('POST', '/tpv/productos', { terminal_id: 'david', comercio_cuit: COMERCIO, nombre: 'Producto IVA 21', precio: 12100, stock: 100 })).body;
});
after(() => server.close());

test('IVA: precio final con IVA incluido, alícuotas mixtas y exento', () => {
  const r = calcularIva([
    { precio: 1210, cantidad: 1, iva: '21' }, { precio: 1105, cantidad: 2, iva: '10.5' }, { precio: 500, cantidad: 1, iva: 'exento' },
  ], 'responsable_inscripto');
  assert.equal(r.neto, 3000);
  assert.equal(r.iva_total, 420);
  assert.equal(r.exento, 500);
  assert.deepEqual(r.iva_detalle.map((d) => [d.alicuota, d.base, d.importe]), [['21', 1000, 210], ['10.5', 2000, 210]]);
  const mono = calcularIva([{ precio: 1210, cantidad: 1, iva: '21' }], 'monotributo');
  assert.equal(mono.iva_total, 0);
  assert.equal(mono.neto, 1210);
});

test('tipo de comprobante según emisor y receptor', () => {
  assert.equal(tipoComprobante('responsable_inscripto', 'responsable_inscripto'), 'FACTURA_A');
  assert.equal(tipoComprobante('responsable_inscripto', 'monotributo'), 'FACTURA_B');
  assert.equal(tipoComprobante('responsable_inscripto', 'consumidor_final'), 'FACTURA_B');
  assert.equal(tipoComprobante('monotributo', 'responsable_inscripto'), 'FACTURA_C');
});

test('percepción con la alícuota del padrón del comprador, sobre el neto', async () => {
  const v = await vender([{ producto_id: producto.id, cantidad: 1 }], { cuit_cliente: CLIENTE_MONO });
  assert.equal(v.status, 201, JSON.stringify(v.body));
  assert.equal(v.body.impuestos.tipo_comprobante, 'FACTURA_B');
  assert.equal(v.body.impuestos.neto, 10000);
  assert.equal(v.body.impuestos.iva_total, 2100);
  assert.equal(v.body.percepcion, 200);              // 10.000 × 2 % del padrón del monotributista
  assert.equal(v.body.total, 12300);
  const p = await pg.query('select sujeto_cuit, base_imponible, origen_alicuota from arba.percepciones where id_venta = $1', [`imp-${n}`]);
  assert.deepEqual([p.rows[0].sujeto_cuit, Number(p.rows[0].base_imponible), p.rows[0].origen_alicuota], [CLIENTE_MONO, 10000, 'padron']);
});

test('comprador fuera del padrón: alícuota para no inscriptos, configurable a mano', async () => {
  let v = await vender([{ producto_id: producto.id, cantidad: 1 }], { cuit_cliente: CLIENTE_FUERA });
  assert.equal(v.body.impuestos.percepcion.origen, 'no_inscripto');
  assert.equal(v.body.percepcion, 500);               // 10.000 × 5 % (valor inicial)
  assert.equal((await api('PUT', '/arba/config-percepcion', { alicuota_no_inscriptos: 0.08 })).status, 200);
  v = await vender([{ producto_id: producto.id, cantidad: 1 }], { cuit_cliente: CLIENTE_FUERA });
  assert.equal(v.body.percepcion, 800);               // la nueva configuración afecta la venta
});

test('monto mínimo, consumidor final sin CUIT y agente dado de baja', async () => {
  assert.equal((await api('PUT', '/arba/config-percepcion', { monto_minimo: 20000 })).status, 200);
  let v = await vender([{ producto_id: producto.id, cantidad: 1 }], { cuit_cliente: CLIENTE_RI });
  assert.equal(v.body.percepcion, 0);
  assert.match(v.body.impuestos.percepcion.motivo, /mínimo/);
  await api('PUT', '/arba/config-percepcion', { monto_minimo: 500 });
  v = await vender([{ producto_id: producto.id, cantidad: 1 }]);
  assert.equal(v.body.percepcion, 0);
  assert.match(v.body.impuestos.percepcion.motivo, /consumidor final/);
  assert.equal((await api('PUT', `/arba/agentes/${COMERCIO}`, { activo: false })).status, 200);
  v = await vender([{ producto_id: producto.id, cantidad: 1 }], { cuit_cliente: CLIENTE_RI });
  assert.equal(v.body.percepcion, 0);
  assert.match(v.body.impuestos.percepcion.motivo, /no es agente/);
  const sim = await api('GET', `/arba/percepciones/simular?agente=${COMERCIO}&sujeto=${CLIENTE_RI}&base=10000`);
  assert.equal(sim.body.monto, 0);
  await api('PUT', `/arba/agentes/${COMERCIO}`, { activo: true });
  assert.equal((await api('GET', `/arba/percepciones/simular?agente=${COMERCIO}&sujeto=${CLIENTE_RI}&base=10000`)).body.monto, 300);
  // Solo puede ser agente quien está inscripto en IIBB.
  assert.equal((await api('PUT', '/arba/agentes/27123456789', {})).status, 409);
});

test('IVA configurable por producto cambia el comprobante', async () => {
  const p = (await api('POST', '/tpv/productos', { terminal_id: 'david', comercio_cuit: COMERCIO, nombre: 'Pan (10,5 %)', precio: 1105, stock: 10, iva: '10.5' })).body;
  assert.equal(p.iva, '10.5');
  assert.equal((await api('POST', '/tpv/productos', { terminal_id: 'david', comercio_cuit: COMERCIO, nombre: 'X', precio: 10, iva: '15' })).status, 400);
  const v = await vender([{ producto_id: p.id, cantidad: 1 }]);
  assert.deepEqual(v.body.impuestos.iva_detalle, [{ alicuota: '10.5', base: 1000, importe: 105 }]);
  const c = await pg.query('select neto, iva_total, receptor_condicion from arca.comprobantes where id_venta = $1', [`imp-${n}`]);
  assert.deepEqual([Number(c.rows[0].neto), Number(c.rows[0].iva_total), c.rows[0].receptor_condicion], [1000, 105, 'consumidor_final']);
});

test('Municipio liquida la Tasa de Seguridad e Higiene del período sobre las ventas', async () => {
  const periodo = new Date().toISOString().slice(0, 7);
  const alis = await api('GET', '/municipio/alicuotas');
  assert.ok(alis.body.some((a) => a.rubro === '*'));
  assert.equal((await api('PUT', '/municipio/alicuotas/Almacén%20%2F%20autoservicio', { alicuota: 0.01, minimo: 100 })).status, 200);
  const base = Number((await pg.query(`select sum(coalesce(neto, subtotal) + coalesce(exento,0)) b from arca.comprobantes
    where emisor_cuit = $1 and emitido_en >= date_trunc('month', now())`, [COMERCIO])).rows[0].b);
  const liq = await api('POST', '/municipio/tributos/liquidar', { cuit: COMERCIO, periodo });
  assert.equal(liq.status, 201, JSON.stringify(liq.body));
  assert.equal(liq.body.rubro_aplicado, 'Almacén / autoservicio');
  assert.equal(liq.body.importe, Math.max(Math.round(base * 0.01 * 100) / 100, 100));
  // Reliquidar actualiza la tasa pendiente; no duplica.
  assert.equal((await api('POST', '/municipio/tributos/liquidar', { cuit: COMERCIO, periodo })).status, 200);
  assert.equal((await api('POST', '/municipio/tributos/liquidar', { cuit: '27123456789', periodo })).status, 404);
});

test('el comprador se identifica por la cuenta bancaria de la que paga (alias o CBU)', async () => {
  const v = await vender([{ producto_id: producto.id, cantidad: 1 }], { cuenta_origen: 'kiosco.esquina.banco' });
  assert.equal(v.status, 201, JSON.stringify(v.body));
  assert.equal(v.body.impuestos.receptor_cuit, CLIENTE_RI);
  assert.equal(v.body.impuestos.tipo_comprobante, 'FACTURA_A');
  assert.equal(v.body.percepcion, 300);              // 10.000 × 3 % del padrón del Kiosco
  assert.equal((await vender([{ producto_id: producto.id, cantidad: 1 }], { cuenta_origen: 'no.existe.alias' })).status, 404);
});

test('ARCA: búsqueda de comprobante por número, tipo y punto de venta', async () => {
  const v = await vender([{ producto_id: producto.id, cantidad: 1 }]);
  const c = (await pg.query('select numero, tipo_comprobante, punto_venta from arca.comprobantes where id_venta = $1', [v.body.id_venta])).rows[0];
  const r = await api('GET', `/arca/comprobantes/${c.numero}?tipo=${c.tipo_comprobante}&pv=${c.punto_venta}&cuit=${COMERCIO}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.id_venta, v.body.id_venta);
  assert.equal((await api('GET', '/arca/comprobantes/99999999')).status, 404);
});

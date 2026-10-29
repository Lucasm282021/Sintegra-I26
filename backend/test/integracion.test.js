// Prueba los módulos contra una base Postgres en memoria (PGlite) con las
// mismas migraciones y datos de prueba que Supabase. No toca la base real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');

let base;
let server;

async function abrirBase() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const pg = new PGlite({ extensions: { pgcrypto } });
  await pg.exec('create schema if not exists extensions;');
  const dir = path.join(__dirname, '..', 'supabase');
  for (const f of fs.readdirSync(path.join(dir, 'migrations')).sort()) {
    await pg.exec(fs.readFileSync(path.join(dir, 'migrations', f), 'utf8'));
    if (f.startsWith('20261026000002')) await pg.exec(fs.readFileSync(path.join(dir, 'seed.sql'), 'utf8'));
  }
  return pg;
}

async function api(metodo, url, body) {
  const r = await fetch(`${base}${url}`, {
    method: metodo,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json() };
}

before(async () => {
  const pg = await abrirBase();
  require('../src/db').setDb(pg);
  const app = require('../src/app');
  server = app.listen(0);
  await new Promise((ok) => server.once('listening', ok));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('health y ficha del padrón compartido', async () => {
  assert.equal((await api('GET', '/health')).body.db, 'ok');
  const f = await api('GET', '/padron/contribuyentes/30712345678');
  assert.equal(f.status, 200);
  assert.equal(f.body.arba_alicuota, 0.03);
  assert.equal(f.body.tiene_cuenta_banco, true);
});

test('billetera: ingreso, carga desde el banco y pago QR entre billeteras', async () => {
  const mal = await api('POST', '/billetera/auth/login', { cuil: '20268326074', contrasena: 'otra-clave' });
  assert.equal(mal.status, 401);
  const login = await api('POST', '/billetera/auth/login', { cuil: '20268326074', contrasena: 'demo1234' });
  assert.equal(login.status, 200);
  const cuenta = login.body.billetera;
  assert.equal(cuenta.banco_cuenta_id, 'cuenta-demo');

  const bancoAntes = (await api('GET', '/banco/cuentas/cuenta-demo/saldo')).body.saldo;
  const carga = await api('POST', '/billetera/cargas', { id_venta: 'carga-1', cuit: '20268326074', monto: 1500 });
  assert.equal(carga.status, 201);
  assert.equal(carga.body.saldo, cuenta.saldo + 1500);
  assert.equal((await api('GET', '/banco/cuentas/cuenta-demo/saldo')).body.saldo, bancoAntes - 1500);
  assert.equal((await api('GET', '/banco/cuentas/cuenta-billetera/saldo')).body.saldo, 1500);
  // Reintento idéntico: no duplica.
  assert.equal((await api('POST', '/billetera/cargas', { id_venta: 'carga-1', cuit: '20268326074', monto: 1500 })).status, 200);
  assert.equal((await api('POST', '/billetera/cargas', { id_venta: 'carga-1', cuit: '20268326074', monto: 99 })).status, 409);

  const qr = await api('POST', '/billetera/qr/pagos', { id_venta: 'qr-1', cuit_origen: '20268326074', cuit_destino: '30000000001', monto: 500 });
  assert.equal(qr.status, 201);
  const movs = await api('GET', `/billetera/cuentas/${cuenta.id}/movimientos`);
  assert.deepEqual(movs.body.map((m) => m.tipo), ['pago', 'carga']);
  assert.equal((await api('POST', '/billetera/pagos', { id_venta: 'p-1', cuit: '30000000003', comercio_cuit: '30712345678', monto: 999999 })).status, 400);
});

test('billetera: registro nuevo queda en el padrón', async () => {
  const r = await api('POST', '/billetera/auth/registro', { titular: 'Prueba Alumno', cuil: '20999999991', alias: 'prueba.alumno', contrasena: 'clave-segura' });
  assert.equal(r.status, 201);
  assert.equal((await api('POST', '/billetera/auth/registro', { titular: 'X', cuil: '20999999991', alias: 'otro', contrasena: 'clave-segura' })).status, 409);
  assert.equal((await api('GET', '/padron/contribuyentes/20999999991')).body.tiene_billetera, true);
});

test('venta del TPV: cobro en el banco, percepción ARBA y factura ARCA', async () => {
  const saldo = (await api('GET', '/banco/cuentas/cuenta-mateo/saldo')).body.saldo;
  const pago = await api('POST', '/banco/pagos', { ventaId: 'tpv-1', cuit: '30712345678', monto: 4200, medioPago: 'tarjeta' });
  assert.equal(pago.status, 201);
  assert.equal((await api('GET', '/banco/cuentas/cuenta-mateo/saldo')).body.saldo, saldo + 4200);
  assert.equal((await api('POST', '/banco/pagos', { ventaId: 'tpv-1', cuit: '30712345678', monto: 4200, medioPago: 'tarjeta' })).status, 200);

  const perc = await api('POST', '/arba/percepciones', { id_venta: 'tpv-1', cuit: '30712345678', monto: 4200 });
  assert.equal(perc.status, 201);
  assert.equal(perc.body.monto_percepcion, 126);
  assert.equal((await api('POST', '/arba/percepciones', { id_venta: 'tpv-2', cuit: '27123456789', monto: 10 })).status, 404);

  const fac = await api('POST', '/arca/comprobantes', { id_venta: 'tpv-1', cuit: '30712345678', razonSocial: 'Almacén', monto: 4326, percepcion: 126 });
  assert.equal(fac.status, 201);
  assert.equal(fac.body.tipo_comprobante, 'FACTURA_B');
  assert.match(fac.body.cae, /^FICTICIO-\d{14}$/);
  const fac2 = await api('POST', '/arca/comprobantes', { id_venta: 'tpv-3', cuit: '30712345678', monto: 100 });
  assert.equal(Number(fac2.body.numero), Number(fac.body.numero) + 1);
  assert.equal((await api('GET', '/arca/comprobantes?cuit=30712345678')).body.length, 2);
});

test('Municipio: padrón, pago transaccional, comprobante e idempotencia', async () => {
  const listado = await api('GET', '/municipio/comercios');
  assert.equal(listado.status, 200);
  assert.ok(listado.body.some((c) => c.cuit === '30987654321'));
  const cuentaAntes = (await api('GET', '/banco/cuentas/cuenta-esquina/saldo')).body.saldo;
  const pago = await api('POST', '/municipio/tributos/pagos', { cuit: '30987654321', periodo: '2026-09', monto: 8400 });
  assert.equal(pago.status, 201);
  assert.equal(pago.body.comprobante.monto, 8400);
  assert.equal(pago.body.tributo_actualizado.estado, 'pagada');
  assert.equal((await api('GET', '/banco/cuentas/cuenta-esquina/saldo')).body.saldo, cuentaAntes - 8400);
  const repetido = await api('POST', '/municipio/tributos/pagos', { cuit: '30987654321', periodo: '2026-09', monto: 8400 });
  assert.equal(repetido.status, 200);
  assert.equal(repetido.body.repetido, true);
  assert.equal((await api('GET', '/municipio/certificados/libre-deuda/30987654321')).status, 200);
  const recibos = await api('GET', '/municipio/comprobantes?cuit=30987654321');
  assert.equal(recibos.body.length, 1);
  assert.equal(recibos.body[0].id_comprobante, pago.body.comprobante.id_comprobante);
  assert.equal(recibos.body[0].numero_operacion, pago.body.comprobante.numero_operacion);
});

test('alta Municipio y venta integral TPV idempotente sobre la base compartida', async () => {
  const alta = await api('POST', '/municipio/comercios', {
    cuit: '20123456789', razon_social: 'Comercio de integración', condicion_fiscal: 'Monotributista',
    direccion: 'Calle 1 123', rubro_principal: 'Servicios',
  });
  assert.equal(alta.status, 201);
  assert.equal(alta.body.tributos_generados.length, 1);
  assert.equal((await api('GET', '/padron/contribuyentes/20123456789')).status, 200);

  const productos = await api('GET', '/tpv/productos?terminal_id=david&cuit=30712345678');
  const producto = productos.body[0];
  assert.ok(producto);
  const saldoAntes = (await api('GET', '/banco/cuentas/cuenta-mateo/saldo')).body.saldo;
  const venta = await api('POST', '/tpv/ventas', { id_venta: 'integracion-tpv-01', terminal_id: 'david',
    comercio_cuit: '30712345678', medio_pago: 'banco', items: [{ producto_id: producto.id, cantidad: 1 }] });
  assert.equal(venta.status, 201);
  assert.equal(venta.body.estado, 'completada');
  assert.equal(venta.body.percepcion, Math.round(producto.precio * 0.03 * 100) / 100);
  assert.equal((await api('GET', '/banco/cuentas/cuenta-mateo/saldo')).body.saldo, saldoAntes + venta.body.total);
  assert.equal((await api('POST', '/tpv/ventas', { id_venta: 'integracion-tpv-01', terminal_id: 'david',
    comercio_cuit: '30712345678', medio_pago: 'banco', items: [{ producto_id: producto.id, cantidad: 1 }] })).status, 200);
  assert.equal((await api('GET', '/arca/comprobantes?cuit=30712345678')).body.some((f) => f.id_venta === 'integracion-tpv-01'), true);
});

test('TPV Brisa y Sebastián usan catálogos por terminal y la ficha Banco/Billetera es por CUIT', async () => {
  const perfil=await api('GET','/banco/clientes/30712345678');
  assert.equal(perfil.status,200);
  assert.equal(perfil.body.cliente.cuit,'30712345678');
  assert.equal(perfil.body.cuentas[0].id,'cuenta-mateo');
  const brisa=await api('GET','/tpv/productos?terminal_id=brisa&cuit=30712345678');
  const sebastian=await api('GET','/tpv/productos?terminal_id=sebastian&cuit=30712345678');
  assert.equal(brisa.body.length,8);
  assert.equal(sebastian.body.length,6);
  assert.notEqual(brisa.body[0].id,sebastian.body[0].id);
  const venta=await api('POST','/tpv/ventas',{id_venta:'sebastian-contract-01',terminal_id:'sebastian',comercio_cuit:'30712345678',medio_pago:'BANCO',items:[{producto_id:sebastian.body[0].id,cantidad:1}]});
  assert.equal(venta.status,201);
  const detalle=await api('GET','/tpv/ventas/sebastian-contract-01');
  assert.equal(detalle.body.estado,'COMPLETADA');
  assert.equal(detalle.body.lineas.length,1);
  assert.equal(detalle.body.pago.medio_pago,'banco');
  assert.match(detalle.body.comprobante.cae,/^\d{14}$/);
});

test('errores con formato {"error": "..."}', async () => {
  const r = await api('POST', '/banco/pagos', { id_venta: 'x', cuit: '123', monto: 1 });
  assert.equal(r.status, 400);
  assert.equal(typeof r.body.error, 'string');
  assert.equal((await api('GET', '/no-existe')).status, 404);
});

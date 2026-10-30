// Padrón general, precio desde costo, efectivo, transferencias de billetera,
// cuentas corrientes con cheques y compras a proveedores (PGlite).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');

let base; let server;
async function api(metodo, url, body) {
  const r = await fetch(`${base}${url}`, { method: metodo, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}
const saldo = async (id) => (await api('GET', `/banco/cuentas/${id}/saldo`)).body.saldo;
const RI = '30712345678'; // Almacén Don Mateo SRL (Responsable Inscripto)
const PROV = '30987654321'; // Kiosco La Esquina SA, como proveedor (RI)
const MONO = '20345678901'; // Juan Pérez (Monotributo)

before(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const pg = new PGlite({ extensions: { pgcrypto } });
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
});
after(() => server.close());

test('padrón general: una ficha por CUIT con el estado en cada organismo', async () => {
  const lista = (await api('GET', '/padron/general?buscar=Mateo')).body;
  const mateo = lista.find((x) => x.cuit === RI);
  assert.ok(mateo, 'debe encontrar al comercio por nombre');
  assert.equal(mateo.arca.inscripto, true);
  assert.equal(mateo.condicion_fiscal, 'Responsable Inscripto');
  assert.equal(mateo.arba.estado, 'activa');
  assert.ok(mateo.municipio);
  assert.ok(mateo.banco.length >= 1);
  const todos = (await api('GET', '/padron/general')).body.map((x) => x.cuit);
  assert.ok(!todos.includes('30000000097'), 'las cuentas internas no se listan');
  assert.equal((await api('GET', `/padron/general/${MONO}`)).body.condicion_iva, 'monotributo');
  assert.equal((await api('GET', '/padron/general/20111111112')).status, 404);
});

let galletitas;
test('producto desde costo: RI suma IVA al precio, monotributo no', async () => {
  const ri = await api('POST', '/tpv/productos', { terminal_id: 'david', comercio_cuit: RI, nombre: 'Galletitas', costo: 1000, margen: 0.3, iva: '21', stock: 10 });
  assert.equal(ri.status, 201, JSON.stringify(ri.body));
  assert.equal(ri.body.precio, 1573); // 1000 * 1,30 * 1,21
  assert.equal(ri.body.costo, 1000);
  galletitas = ri.body;
  const mono = await api('POST', '/tpv/productos', { terminal_id: 'sebastian', comercio_cuit: MONO, nombre: 'Artesanía', costo: 1000, margen: 0.3, iva: '21' });
  assert.equal(mono.body.precio, 1300);
  const red = await api('POST', '/tpv/productos', { terminal_id: 'david', comercio_cuit: RI, nombre: 'Libro', costo: 1000, margen: 0.5, iva: '10.5' });
  assert.equal(red.body.precio, 1657.5);
  assert.equal((await api('POST', '/tpv/productos', { terminal_id: 'david', comercio_cuit: RI, nombre: 'Sin precio' })).status, 400);
  const edit = await api('PUT', `/tpv/productos/${galletitas.id}`, { nombre: 'Galletitas', costo: 1000, margen: 0.5, stock: 10 });
  assert.equal(edit.body.precio, 1815);
});

test('venta en efectivo: factura y descuenta stock sin mover el banco', async () => {
  await api('POST', '/tpv/comercios', { terminal_id: 'david', cuit: RI, razon_social: 'Almacén Don Mateo SRL' });
  const antes = await saldo('cuenta-mateo');
  const v = await api('POST', '/tpv/ventas', { id_venta: 'efectivo-1', terminal_id: 'david', comercio_cuit: RI, medio_pago: 'efectivo',
    items: [{ producto_id: galletitas.id, cantidad: 2 }] });
  assert.equal(v.status, 201, JSON.stringify(v.body));
  assert.equal(v.body.medio_detalle, 'efectivo');
  assert.equal(v.body.ref_pago, null);
  assert.equal(v.body.impuestos.tipo_comprobante, 'FACTURA_B');
  assert.equal(await saldo('cuenta-mateo'), antes);
  const prod = (await api('GET', `/tpv/productos?terminal_id=david&comercio_cuit=${RI}`)).body.find((p) => p.id === galletitas.id);
  assert.equal(prod.stock, 8);
});

test('billetera: transferencia por alias de billetera, alias bancario o CUIT', async () => {
  const t = await api('POST', '/billetera/transferencias', { id_venta: 'tb-1', cuit_origen: '27123456789', destino: 'mateo.billetera', monto: 1000 });
  assert.equal(t.status, 201, JSON.stringify(t.body));
  const antesJuan = await saldo('cuenta-juan');
  const b = await api('POST', '/billetera/transferencias', { id_venta: 'tb-2', cuit_origen: '27123456789', destino: 'juan.perez.banco', monto: 500 });
  assert.equal(b.status, 201, JSON.stringify(b.body));
  assert.equal(await saldo('cuenta-juan'), antesJuan + 500);
  assert.equal((await api('POST', '/billetera/transferencias', { id_venta: 'tb-3', cuit_origen: '27123456789', destino: RI, monto: 100 })).status, 201);
  assert.equal((await api('POST', '/billetera/transferencias', { id_venta: 'tb-4', cuit_origen: '27123456789', destino: 'no.existe', monto: 1 })).status, 404);
  assert.equal((await api('POST', '/billetera/transferencias', { id_venta: 'tb-5', cuit_origen: '27123456789', destino: 'maria.billetera', monto: 1 })).status, 400);
});

test('cuenta corriente y cheques: emitir, depositar, acreditar, rechazar y anular', async () => {
  const cc = await api('POST', '/banco/cuentas', { cuit: RI, tipo: 'cuenta_corriente' });
  assert.equal(cc.status, 201, JSON.stringify(cc.body));
  assert.equal(cc.body.tipo, 'cuenta_corriente');
  await api('POST', `/banco/cuentas/cc-${RI}/depositos`, { id_operacion: 'dep-cc', monto: 10000 });
  assert.equal((await api('POST', '/banco/cheques', { cuenta_librador: 'cuenta-mateo', beneficiario: 'X', monto: 10 })).status, 409);
  const q = await api('POST', '/banco/cheques', { cuenta_librador: `cc-${RI}`, beneficiario: 'Kiosco La Esquina SA', monto: 3000 });
  assert.equal(q.status, 201, JSON.stringify(q.body));
  assert.equal((await api('POST', `/banco/cheques/${q.body.numero}/acreditar`)).status, 409);
  assert.equal((await api('POST', `/banco/cheques/${q.body.numero}/depositar`, { cuenta: 'kiosco.esquina.banco' })).body.estado, 'depositado');
  const antes = await saldo('cuenta-esquina');
  assert.equal((await api('POST', `/banco/cheques/${q.body.numero}/acreditar`)).body.estado, 'acreditado');
  assert.equal(await saldo('cuenta-esquina'), antes + 3000);
  assert.equal(await saldo(`cc-${RI}`), 7000);
  const sinFondos = await api('POST', '/banco/cheques', { cuenta_librador: `cc-${RI}`, beneficiario: 'Otro', monto: 50000 });
  await api('POST', `/banco/cheques/${sinFondos.body.numero}/depositar`, { cuenta: 'kiosco.esquina.banco' });
  const rech = await api('POST', `/banco/cheques/${sinFondos.body.numero}/acreditar`);
  assert.equal(rech.body.estado, 'rechazado');
  assert.equal(rech.body.motivo_rechazo, 'sin fondos suficientes');
  const diferido = await api('POST', '/banco/cheques', { cuenta_librador: `cc-${RI}`, beneficiario: 'Otro', monto: 100, fecha_pago: '2099-01-01' });
  await api('POST', `/banco/cheques/${diferido.body.numero}/depositar`, { cuenta: 'kiosco.esquina.banco' });
  assert.equal((await api('POST', `/banco/cheques/${diferido.body.numero}/acreditar`)).status, 409);
  const anular = await api('POST', '/banco/cheques', { cuenta_librador: `cc-${RI}`, beneficiario: 'Otro', monto: 100 });
  assert.equal((await api('POST', `/banco/cheques/${anular.body.numero}/anular`)).body.estado, 'anulado');
  assert.ok((await api('GET', `/banco/cheques?cuenta=cc-${RI}`)).body.length >= 4);
});

test('proveedores: alta, compra con Factura A, pagos y cuenta corriente', async () => {
  assert.equal((await api('POST', '/tpv/proveedores', { comercio_cuit: RI, proveedor_cuit: '20111111112' })).status, 409);
  const alta = await api('POST', '/tpv/proveedores', { comercio_cuit: RI, proveedor_cuit: PROV, rubro: 'Mayorista', plazo_dias: 15 });
  assert.equal(alta.status, 201, JSON.stringify(alta.body));
  const compra = { id_compra: 'compra-1', comercio_cuit: RI, proveedor_cuit: PROV, numero_factura: '0001-00000123',
    items: [{ producto_id: galletitas.id, cantidad: 5, costo_unitario: 1100 }] };
  const k = await api('POST', '/tpv/compras', compra);
  assert.equal(k.status, 201, JSON.stringify(k.body));
  assert.equal(k.body.tipo_comprobante, 'FACTURA_A');
  assert.deepEqual([k.body.neto, k.body.iva, k.body.total], [5500, 1155, 6655]);
  assert.equal((await api('POST', '/tpv/compras', compra)).status, 200);
  const prod = (await api('GET', `/tpv/productos?terminal_id=david&comercio_cuit=${RI}`)).body.find((p) => p.id === galletitas.id);
  assert.equal(prod.stock, 13);
  assert.equal(prod.costo, 1100);
  assert.equal(prod.precio, 1996.5); // 1100 * 1,50 * 1,21

  const antesProv = await saldo('cuenta-esquina');
  const t = await api('POST', `/tpv/proveedores/${PROV}/pagos`, { id_pago: 'pp-1', comercio_cuit: RI, medio: 'transferencia', monto: 2000 });
  assert.equal(t.status, 201, JSON.stringify(t.body));
  assert.equal(t.body.saldo, 4655);
  assert.equal(await saldo('cuenta-esquina'), antesProv + 2000);
  const ch = await api('POST', `/tpv/proveedores/${PROV}/pagos`, { id_pago: 'pp-2', comercio_cuit: RI, medio: 'cheque', monto: 1000 });
  assert.equal(ch.status, 201, JSON.stringify(ch.body));
  assert.ok(ch.body.cheque);
  assert.equal((await api('POST', `/tpv/proveedores/${PROV}/pagos`, { id_pago: 'pp-3', comercio_cuit: RI, medio: 'efectivo', monto: 99999 })).status, 409);
  const ctacte = (await api('GET', `/tpv/proveedores/${PROV}/cuenta-corriente?comercio_cuit=${RI}`)).body;
  assert.equal(ctacte.saldo, 3655);
  assert.equal(ctacte.movimientos.length, 3);
  const lista = (await api('GET', `/tpv/proveedores?comercio_cuit=${RI}`)).body;
  assert.equal(lista[0].saldo, 3655);
});

test('eCheq desde la billetera: solo con cuenta corriente; lo cobra el beneficiario', async () => {
  const sinCc = (await api('GET', '/billetera/echeqs?cuit=27123456789')).body;
  assert.equal(sinCc.disponible, false);
  assert.equal((await api('POST', '/billetera/echeqs', { cuit_origen: '27123456789', destino: RI, monto: 10 })).status, 409);
  const disp = (await api('GET', `/billetera/echeqs?cuit=${RI}`)).body;
  assert.equal(disp.disponible, true);
  const e = await api('POST', '/billetera/echeqs', { cuit_origen: RI, destino: 'juan.perez.banco', monto: 700 });
  assert.equal(e.status, 201, JSON.stringify(e.body));
  assert.equal(e.body.canal, 'echeq');
  assert.equal(e.body.beneficiario_cuit, MONO);
  assert.equal((await api('POST', `/billetera/echeqs/${e.body.numero}/cobrar`, { cuit: '27123456789' })).status, 403);
  const antes = await saldo('cuenta-juan');
  const cobro = await api('POST', `/billetera/echeqs/${e.body.numero}/cobrar`, { cuit: MONO });
  assert.equal(cobro.body.estado, 'acreditado', JSON.stringify(cobro.body));
  assert.equal(await saldo('cuenta-juan'), antes + 700);
  assert.equal((await api('GET', `/billetera/echeqs?cuit=${MONO}`)).body.recibidos.length, 1);
  const dif = await api('POST', '/billetera/echeqs', { cuit_origen: RI, destino: MONO, monto: 5, fecha_pago: '2099-01-01' });
  const c2 = await api('POST', `/billetera/echeqs/${dif.body.numero}/cobrar`, { cuit: MONO });
  assert.equal(c2.body.estado, 'depositado');
  assert.ok(c2.body.aviso);
  const an = await api('POST', '/billetera/echeqs', { cuit_origen: RI, destino: MONO, monto: 5 });
  assert.equal((await api('POST', `/billetera/echeqs/${an.body.numero}/anular`, { cuit: MONO })).status, 403);
  assert.equal((await api('POST', `/billetera/echeqs/${an.body.numero}/anular`, { cuit: RI })).body.estado, 'anulado');
});

test('homebanking: CUIT y clave demo, resumen con cuentas, movimientos y cheques', async () => {
  assert.equal((await api('POST', '/banco/homebanking/login', { cuit: RI, clave: 'mala' })).status, 401);
  const hb = await api('POST', '/banco/homebanking/login', { cuit: RI, clave: 'demo1234' });
  assert.equal(hb.status, 200, JSON.stringify(hb.body));
  assert.equal(hb.body.cliente.razon_social, 'Almacén Don Mateo SRL');
  assert.ok(hb.body.cuentas.some((x) => x.tipo === 'cuenta_corriente'));
  assert.ok(hb.body.movimientos.length > 0);
  assert.ok(hb.body.cheques.some((q) => q.rol === 'emitido'));
  assert.equal(hb.body.echeq_disponible, true);
  // Una cuenta nueva crea el acceso con la clave demo.
  await api('POST', '/banco/cuentas', { cuit: '30000000002' });
  assert.equal((await api('POST', '/banco/homebanking/login', { cuit: '30000000002', clave: 'demo1234' })).status, 200);
  assert.equal((await api('POST', '/banco/homebanking/clave', { cuit: RI, clave_actual: 'demo1234', clave_nueva: 'nueva123' })).status, 200);
  assert.equal((await api('POST', '/banco/homebanking/login', { cuit: RI, clave: 'nueva123' })).status, 200);
});

// Banco: apertura de cuenta, depósito, extracción y transferencia (PGlite).
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

test('apertura de cuenta: solo CUIT del padrón fiscal; idempotente', async () => {
  assert.equal((await api('POST', '/banco/cuentas', { cuit: '20111111112' })).status, 409);
  const a = await api('POST', '/banco/cuentas', { cuit: '23987654321' });
  assert.equal(a.status, 201);
  assert.equal(a.body.saldo, 0);
  assert.equal((await api('POST', '/banco/cuentas', { cuit: '23987654321' })).status, 200);
});

test('depósito y extracción por ventanilla, sin duplicar en reintentos', async () => {
  const id = 'cuenta-23987654321';
  const d = await api('POST', `/banco/cuentas/${id}/depositos`, { id_operacion: 'dep-1', monto: 5000 });
  assert.equal(d.status, 201);
  assert.equal(d.body.cuenta.saldo, 5000);
  assert.equal((await api('POST', `/banco/cuentas/${id}/depositos`, { id_operacion: 'dep-1', monto: 5000 })).status, 200);
  assert.equal(await saldo(id), 5000);
  assert.equal((await api('POST', `/banco/cuentas/${id}/depositos`, { id_operacion: 'dep-1', monto: 10 })).status, 409);
  assert.equal((await api('POST', `/banco/cuentas/${id}/extracciones`, { id_operacion: 'ext-1', monto: 9000 })).status, 402);
  const e = await api('POST', `/banco/cuentas/${id}/extracciones`, { id_operacion: 'ext-2', monto: 1500 });
  assert.equal(e.status, 201);
  assert.equal(e.body.cuenta.saldo, 3500);
  const movs = (await api('GET', `/banco/cuentas/${id}/movimientos`)).body.map((m) => m.tipo);
  assert.deepEqual(movs.sort(), ['deposito', 'extraccion']);
});

test('transferencia por alias o CBU', async () => {
  const antes = await saldo('cuenta-esquina');
  const t = await api('POST', '/banco/transferencias', { id_operacion: 'tr-1', origen: 'cuenta-23987654321', destino: 'kiosco.esquina.banco', monto: 1000, concepto: 'Pago proveedor' });
  assert.equal(t.status, 201, JSON.stringify(t.body));
  assert.equal(await saldo('cuenta-esquina'), antes + 1000);
  assert.equal(await saldo('cuenta-23987654321'), 2500);
  assert.equal((await api('POST', '/banco/transferencias', { id_operacion: 'tr-2', origen: 'cuenta-23987654321', destino: '0000000000000000000000', monto: 1 })).status, 404);
  assert.equal((await api('POST', '/banco/transferencias', { id_operacion: 'tr-3', origen: 'cuenta-23987654321', destino: 'caja.banco.m', monto: 1 })).status, 400);
});

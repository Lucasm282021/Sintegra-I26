const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arca-smoke-'));
process.env.ARCA_DATA_FILE = path.join(tempDir, 'arca.json');
process.env.ARCA_PUNTO_VENTA = '00001';

const servers = [];
let sessionCookie = '';
async function startServer(app) {
  const server = app.listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
async function request(baseUrl, url, options) {
  const headers = { ...(options?.headers || {}) };
  if (sessionCookie) headers.cookie = sessionCookie;
  const response = await fetch(`${baseUrl}${url}`, { ...options, headers });
  return { response, body: await response.json() };
}

let baseUrl;
let app;
before(async () => {
  ({ app } = require('../src/server'));
  baseUrl = await startServer(app);
  const setup = await fetch(`${baseUrl}/auth/setup`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@gmail.com', password: 'clave-propia-ARCA-123' })
  });
  assert.equal(setup.status, 201);
  sessionCookie = setup.headers.get('set-cookie').split(';')[0];
});
after(async () => {
  await Promise.all(servers.map((server) => new Promise((resolve, reject) => {
    server.close((err) => err ? reject(err) : resolve());
  })));
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('GET /health y consulta de contribuyente', async () => {
  const health = await request(baseUrl, '/health');
  assert.equal(health.response.status, 200);
  assert.deepEqual(health.body, { status: 'ok', servicio: 'arca' });

  const contributor = await request(baseUrl, '/arca/contribuyentes/30712345678');
  assert.equal(contributor.response.status, 200);
  assert.equal(contributor.body.cuit, '30712345678');

  const missing = await request(baseUrl, '/arca/contribuyentes/30712345679');
  assert.equal(missing.response.status, 404);
  assert.equal(typeof missing.body.error, 'string');
});

test('emisión idempotente, conflicto y consulta después de reiniciar el módulo', async () => {
  const payload = {
    id_venta: 'smoke-venta-1', cuit: '30712345678',
    monto_total: 10506.00, tipo_comprobante: 'FACTURA_B'
  };
  const options = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
  const created = await request(baseUrl, '/arca/comprobantes', options);
  assert.equal(created.response.status, 201);
  assert.match(created.body.cae, /^FICTICIO-/);
  assert.equal(created.body.numero_comprobante, '00000001');

  const repeated = await request(baseUrl, '/arca/comprobantes', options);
  assert.equal(repeated.response.status, 200);
  assert.deepEqual(repeated.body, created.body);

  const conflictPayload = { ...payload, monto_total: 10507.00 };
  const conflict = await request(baseUrl, '/arca/comprobantes', {
    ...options, body: JSON.stringify(conflictPayload)
  });
  assert.equal(conflict.response.status, 409);
  assert.equal(typeof conflict.body.error, 'string');

  delete require.cache[require.resolve('../src/server')];
  const restarted = require('../src/server');
  const restartedUrl = await startServer(restarted.app);
  baseUrl = restartedUrl;
  const login = await fetch(`${restartedUrl}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@gmail.com', password: 'clave-propia-ARCA-123' })
  });
  assert.equal(login.status, 200);
  sessionCookie = login.headers.get('set-cookie').split(';')[0];
  const consulted = await request(
    restartedUrl,
    `/arca/comprobantes/${created.body.numero_comprobante}?tipo=FACTURA_B&pv=00001`
  );
  assert.equal(consulted.response.status, 200);
  assert.deepEqual(consulted.body, created.body);
});

test('rechaza CUIT, monto y tipo inválidos con error JSON', async () => {
  const cases = [
    { id_venta: 'bad-cuit', cuit: '30-712345678', monto_total: 10, tipo_comprobante: 'FACTURA_B' },
    { id_venta: 'bad-amount', cuit: '30712345678', monto_total: 10.001, tipo_comprobante: 'FACTURA_B' },
    { id_venta: 'bad-type', cuit: '30712345678', monto_total: 10, tipo_comprobante: 'TICKET' }
  ];
  for (const body of cases) {
    const result = await request(baseUrl, '/arca/comprobantes', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal(result.response.status, 400);
    assert.equal(typeof result.body.error, 'string');
  }
});

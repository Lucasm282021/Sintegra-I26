const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initDb } = require('../src/db');

function appNueva() {
  return createApp(initDb(':memory:'));
}

const venta = {
  id_venta: 'venta-1',
  cuit: '30712345678',
  monto_venta: 10200.00
};

test('GET /health devuelve el estado del módulo', async () => {
  const res = await request(appNueva()).get('/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok', servicio: 'arba' });
});

test('POST calcula y registra la percepción con alícuota decimal', async () => {
  const res = await request(appNueva()).post('/arba/percepciones').send(venta);
  assert.equal(res.status, 201);
  assert.equal(res.body.id_venta, 'venta-1');
  assert.equal(res.body.cuit, '30712345678');
  assert.equal(res.body.monto_venta, 10200);
  assert.equal(res.body.alicuota_aplicada, 0.03);
  assert.equal(res.body.monto_percepcion, 306);
  assert.equal(typeof res.body.id, 'string');
  assert.ok(res.body.fecha);
});

test('repetición idéntica devuelve 200 sin duplicar', async () => {
  const app = appNueva();
  const primera = await request(app).post('/arba/percepciones').send(venta);
  const segunda = await request(app).post('/arba/percepciones').send(venta);

  assert.equal(primera.status, 201);
  assert.equal(segunda.status, 200);
  assert.deepEqual(segunda.body, primera.body);

  const historial = await request(app).get('/arba/percepciones/30712345678');
  assert.equal(historial.body.cantidad, 1);
});

test('misma id_venta con otros datos devuelve 409', async () => {
  const app = appNueva();
  await request(app).post('/arba/percepciones').send(venta);
  const res = await request(app).post('/arba/percepciones').send({
    ...venta,
    monto_venta: 9999
  });

  assert.equal(res.status, 409);
  assert.deepEqual(res.body, { error: 'id_venta ya existe con otros datos' });
});

test('CUIT inexistente devuelve 404', async () => {
  const res = await request(appNueva()).post('/arba/percepciones').send({
    ...venta,
    id_venta: 'venta-no-encontrada',
    cuit: '11111111111'
  });
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: 'cuit no encontrado en padron' });
});

test('datos inválidos devuelven 400', async () => {
  const res = await request(appNueva()).post('/arba/percepciones').send({
    id_venta: 'venta-invalida',
    cuit: '30-71234567-8',
    monto_venta: 100
  });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: 'cuit invalido' });
});

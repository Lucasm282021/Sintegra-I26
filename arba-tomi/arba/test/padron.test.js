const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initDb } = require('../src/db');

function appNueva() {
  return createApp(initDb(':memory:'));
}

test('GET /arba/padron/{cuit} devuelve el contribuyente conocido', async () => {
  const res = await request(appNueva()).get('/arba/padron/30712345678');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    cuit: '30712345678',
    actividad: 'Comercio minorista',
    alicuota: 0.03
  });
});

test('GET /arba/padron devuelve listado paginado', async () => {
  const res = await request(appNueva()).get('/arba/padron?page=1&limit=2');
  assert.equal(res.status, 200);
  assert.equal(res.body.page, 1);
  assert.equal(res.body.limit, 2);
  assert.equal(res.body.total, 5);
  assert.equal(res.body.items.length, 2);
  assert.deepEqual(Object.keys(res.body.items[0]), ['cuit', 'actividad', 'alicuota']);
});

test('CUIT no encontrado devuelve 404', async () => {
  const res = await request(appNueva()).get('/arba/padron/11111111111');
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: 'cuit no encontrado en padron' });
});

test('CUIT inválido devuelve 400', async () => {
  const res = await request(appNueva()).get('/arba/padron/30-71234567-8');
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: 'cuit invalido' });
});

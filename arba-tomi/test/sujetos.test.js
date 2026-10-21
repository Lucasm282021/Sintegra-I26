const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { initDb } = require('../src/db');
process.env.ADMIN_EMAIL = 'admin@example.test';
process.env.ADMIN_PASSWORD = 'admin-password-123';
process.env.AUTH_SECRET = 'test-session-secret-very-long';

function setup() {
  const db = initDb(':memory:');
  const app = createApp(db);
  return { app, db };
}
async function login(app, email, password) {
  const response = await request(app).post('/auth/login').send({ email, password });
  return response.headers['set-cookie']?.[0];
}

test('auth protege rutas, admite login y separa permisos de admin y convencional', async () => {
  const { app } = setup();
  const noAuth = await request(app).get('/arba/sujetos');
  assert.equal(noAuth.status, 401);
  const bad = await request(app).post('/auth/login').send({ email: 'missing@example.test', password: 'wrong' });
  assert.equal(bad.status, 401);
  const adminCookie = await login(app, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  assert.ok(adminCookie);
  const created = await request(app).post('/arba/usuarios').set('Cookie', adminCookie).send({ nombre: 'Convencional', email: 'c@example.test', password: 'convencional-123', rol: 'convencional' });
  assert.equal(created.status, 201);
  const conventionalCookie = await login(app, 'c@example.test', 'convencional-123');
  assert.equal((await request(app).get('/arba/usuarios').set('Cookie', conventionalCookie)).status, 403);
  assert.equal((await request(app).get('/arba/auditoria').set('Cookie', conventionalCookie)).status, 403);
});

test('convencional crea personas humanas y jurídicas, envía revisión y no altera alícuota', async () => {
  const { app } = setup();
  const adminCookie = await login(app, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  await request(app).post('/arba/usuarios').set('Cookie', adminCookie).send({ nombre: 'Usuario', email: 'user@example.test', password: 'usuario-12345', rol: 'convencional' });
  const cookie = await login(app, 'user@example.test', 'usuario-12345');
  const humana = await request(app).post('/arba/sujetos').set('Cookie', cookie).send({ cuit: '27123456789', tipo_titular: 'persona_humana', apellido_nombres: 'Ada Ejemplo', actividad: 'Servicios', alicuota: 0.5 });
  assert.equal(humana.status, 201);
  assert.equal(humana.body.alicuota, 0);
  assert.equal(humana.body.estado_fiscal, 'pendiente_consulta');
  assert.equal((await request(app).post('/arba/sujetos/27123456789/enviar-revision').set('Cookie', cookie)).status, 200);
  const juridica = await request(app).post('/arba/sujetos').set('Cookie', cookie).send({ cuit: '30765432109', tipo_titular: 'persona_juridica', razon_social: 'Ejemplo SRL', actividad: 'Comercio', forma_juridica: 'SRL' });
  assert.equal(juridica.status, 201);
});

test('CUIT, propiedad, aprobación, estado operativo, auditoría y percepción pendiente', async () => {
  const { app } = setup();
  const adminCookie = await login(app, process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  await request(app).post('/arba/usuarios').set('Cookie', adminCookie).send({ nombre: 'Uno', email: 'one@example.test', password: 'usuario-12345', rol: 'convencional' });
  await request(app).post('/arba/usuarios').set('Cookie', adminCookie).send({ nombre: 'Dos', email: 'two@example.test', password: 'usuario-12345', rol: 'convencional' });
  const one = await login(app, 'one@example.test', 'usuario-12345');
  const two = await login(app, 'two@example.test', 'usuario-12345');
  assert.equal((await request(app).post('/arba/sujetos').set('Cookie', one).send({ cuit: '123', tipo_titular: 'persona_humana', apellido_nombres: 'Inválido', actividad: 'X' })).status, 400);
  await request(app).post('/arba/sujetos').set('Cookie', one).send({ cuit: '20111111111', tipo_titular: 'persona_humana', apellido_nombres: 'Titular', actividad: 'X' });
  assert.equal((await request(app).post('/arba/percepciones').send({ id_venta: 'sujeto-pendiente', cuit: '20111111111', monto_venta: 100 })).status, 403);
  assert.equal((await request(app).put('/arba/sujetos/20111111111').set('Cookie', two).send({ cuit: '20111111111', tipo_titular: 'persona_humana', apellido_nombres: 'Otro', actividad: 'Y' })).status, 403);
  await request(app).post('/arba/sujetos/20111111111/enviar-revision').set('Cookie', one);
  assert.equal((await request(app).post('/arba/sujetos/20111111111/aprobar').set('Cookie', two)).status, 403);
  assert.equal((await request(app).post('/arba/sujetos/20111111111/aprobar').set('Cookie', adminCookie)).status, 200);
  assert.equal((await request(app).post('/arba/percepciones').send({ id_venta: 'sujeto-aprobado', cuit: '20111111111', monto_venta: 100 })).status, 403);
  const activation = await request(app).patch('/arba/sujetos/20111111111/estado-operativo').set('Cookie', adminCookie).send({ estado: 'activo', alicuota: 0.03, aplicaciones: { arba_iibb: true, arca_facturacion: false } });
  assert.equal(activation.status, 200);
  const perception = await request(app).post('/arba/percepciones').send({ id_venta: 'sujeto-activado', cuit: '20111111111', monto_venta: 100 });
  assert.equal(perception.status, 201);
  assert.equal((await request(app).get('/arba/auditoria').set('Cookie', adminCookie)).body.items.length >= 4, true);
});

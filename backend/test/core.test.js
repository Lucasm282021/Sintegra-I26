// CORE de comercios: los 14 casos mínimos del prompt maestro
// (doc/PRUEBAS-INTEGRACION.md). Base PGlite en memoria; no toca Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { before, after, test } = require('node:test');

let base;
let server;
let pg;

// Completa un CUIT con su dígito verificador (módulo 11).
function conDV(diez) {
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const r = pesos.reduce((t, p, i) => t + Number(diez[i]) * p, 0) % 11;
  const dv = r === 0 ? 0 : r === 1 ? 9 : 11 - r;
  return diez + dv;
}
const CUIT_NUEVO = conDV('3071234001');
const CUIT_CAIDA = conDV('3071234002');

async function abrirBase() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec('create schema if not exists extensions;');
  const dir = path.join(__dirname, '..', 'supabase');
  for (const f of fs.readdirSync(path.join(dir, 'migrations')).sort()) {
    await db.exec(fs.readFileSync(path.join(dir, 'migrations', f), 'utf8'));
    if (f.startsWith('20261026000002')) await db.exec(fs.readFileSync(path.join(dir, 'seed.sql'), 'utf8'));
  }
  return db;
}

async function api(metodo, url, body, token) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(`${base}${url}`, { method: metodo, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}

const alta = (cuit, extra = {}) => ({
  cuit, razon_social: 'Comercio de Prueba CORE SRL', nombre_fantasia: 'Prueba CORE', email_contacto: 'contacto@prueba.test',
  telefono_contacto: '011-5555-0000', domicilio_fiscal: 'Av. Siempre Viva 742',
  sucursal: { nombre: 'Casa central', domicilio_comercial: 'Belgrano 100', localidad: 'Morón', provincia: 'Buenos Aires', municipio: 'Morón' },
  acepta_condiciones: true, declara_representacion: true, ...extra,
});

let titular;   // token del titular
let otro;      // token de otro usuario
let comercioId;

before(async () => {
  pg = await abrirBase();
  require('../src/db').setDb(pg);
  const app = require('../src/app');
  server = app.listen(0);
  await new Promise((ok) => server.once('listening', ok));
  base = `http://127.0.0.1:${server.address().port}`;
  titular = (await api('POST', '/core/usuarios', { email: 'titular@prueba.test', nombre: 'Titular', password: 'clave-titular-123' })).body.token;
  otro = (await api('POST', '/core/usuarios', { email: 'otro@prueba.test', nombre: 'Otra Persona', password: 'clave-otro-1234' })).body.token;
});
after(() => server.close());

test('migración: importa los comercios existentes y marca los CUIT demo inválidos', async () => {
  const { rows } = await pg.query("select cuit, estado_registro, origen from core.comercios where cuit in ('30712345678','30987654321') order by cuit");
  assert.deepEqual(rows.map((r) => [r.cuit, r.estado_registro, r.origen]),
    [['30712345678', 'observado', 'importado'], ['30987654321', 'registrado', 'importado']]);
  const suc = await pg.query("select count(*)::int n from core.sucursales s join core.comercios k on k.id = s.comercio_id where k.origen = 'importado'");
  assert.ok(suc.rows[0].n >= 2);
});

test('1. alta de comercio nuevo con estados independientes', async () => {
  const r = await api('POST', '/core/comercios', alta(CUIT_NUEVO), titular);
  assert.equal(r.status, 201);
  comercioId = r.body.comercio.id;
  const e = r.body.estado;
  assert.equal(e.identidad.resultado, 'declarado');
  assert.equal(e.arca.resultado, 'observado');           // no figura en el padrón sandbox
  assert.equal(e.arba.resultado, 'pendiente');
  assert.equal(e.banco.resultado, 'pendiente');
  assert.equal(e.tpv.resultado, 'pendiente');
  assert.equal(e.municipio[0].resultado, 'pendiente');
  assert.equal(e.arca.origen, 'sandbox');
  const ev = await pg.query('select tipo from core.eventos where comercio_id = $1', [comercioId]);
  assert.ok(ev.rows.some((x) => x.tipo === 'commerce.created'));
});

test('2. CUIT inválido', async () => {
  const malDV = CUIT_NUEVO.slice(0, 10) + ((Number(CUIT_NUEVO[10]) + 1) % 10);
  assert.equal((await api('POST', '/core/comercios', alta(malDV), titular)).status, 400);
  assert.equal((await api('POST', '/core/comercios', alta('3071234'), titular)).status, 400);
  const v = await api('POST', '/core/cuit/validar', { cuit: malDV });
  assert.equal(v.body.valido, false);
  assert.equal((await api('POST', '/core/cuit/validar', { cuit: CUIT_NUEVO })).body.valido, true);
});

test('3. comercio existente: no se da acceso por conocer el CUIT', async () => {
  const r = await api('POST', '/core/comercios', alta(CUIT_NUEVO), otro);
  assert.equal(r.status, 409);
  assert.match(r.body.error, /solicitar acceso/);
  const importado = await api('POST', '/core/comercios', alta('30987654321'), otro);
  assert.equal(importado.status, 409);
});

test('4. solicitud de acceso de un nuevo usuario', async () => {
  const s = await api('POST', '/core/comercios/acceso', { cuit: CUIT_NUEVO, motivo: 'soy la encargada' }, otro);
  assert.equal(s.status, 202);
  assert.equal((await api('GET', `/core/comercios/${comercioId}`, null, otro)).status, 403);
  const lista = await api('GET', `/core/comercios/${comercioId}/membresias`, null, titular);
  const pendiente = lista.body.find((m) => m.estado === 'pendiente');
  assert.equal(pendiente.email, 'otro@prueba.test');
  const ok = await api('POST', `/core/comercios/${comercioId}/membresias/${pendiente.id}/resolver`, { decision: 'aprobar' }, titular);
  assert.equal(ok.body.estado, 'activa');
  assert.equal((await api('GET', `/core/comercios/${comercioId}`, null, otro)).status, 200);
  // Un operador no puede administrar.
  assert.equal((await api('POST', `/core/comercios/${comercioId}/banco/vincular`, {}, otro)).status, 403);
});

test('5. fallo de la consulta a ARCA', async () => {
  const { ADAPTADORES } = require('../src/modulos/core/adaptadores');
  const original = ADAPTADORES.arca;
  ADAPTADORES.arca = async () => { throw new Error('timeout de ARCA'); };
  try {
    const r = await api('POST', `/core/comercios/${comercioId}/verificaciones/arca`, {}, titular);
    assert.equal(r.status, 200);
    assert.equal(r.body.arca.resultado, 'no_disponible');
    assert.match(r.body.arca.error, /timeout/);
    assert.equal(r.body.arba.resultado, 'pendiente'); // los demás no cambian
  } finally { ADAPTADORES.arca = original; }
});

test('6. ARBA no aplicable solo con evidencia manual', async () => {
  const sin = await api('POST', `/core/comercios/${comercioId}/verificaciones/arba/manual`, { resultado: 'no_aplicable', motivo: 'CM' }, titular);
  assert.equal(sin.status, 400);
  const con = await api('POST', `/core/comercios/${comercioId}/verificaciones/arba/manual`,
    { resultado: 'no_aplicable', motivo: 'Convenio Multilateral con sede en otra jurisdicción', referencia_evidencia: 'CM05-0001-demo' }, titular);
  assert.equal(con.status, 201);
  assert.equal(con.body.arba.resultado, 'no_aplicable');
  assert.equal(con.body.arba.origen, 'manual');
});

test('8. cuenta bancaria no se abre sin CUIT verificado', async () => {
  const r = await api('POST', `/core/comercios/${comercioId}/banco/vincular`, {}, titular);
  assert.equal(r.status, 409);
  const e = await api('GET', `/core/comercios/${comercioId}/estado`, null, titular);
  assert.equal(e.body.banco.resultado, 'pendiente');
});

test('9. activación parcial del TPV informa faltantes', async () => {
  const r = await api('POST', `/core/comercios/${comercioId}/tpv/activar`, { terminal_id: 'david' }, titular);
  assert.equal(r.status, 409);
  assert.ok(r.body.faltantes.some((f) => f.startsWith('ARCA')));
  assert.ok(r.body.faltantes.some((f) => f.startsWith('Banco')));
  const e = await api('GET', `/core/comercios/${comercioId}/estado`, null, titular);
  assert.equal(e.body.tpv.resultado, 'pendiente');
});

test('10. reintento de alta sin duplicar', async () => {
  const r = await api('POST', '/core/comercios', alta(CUIT_NUEVO), titular);
  assert.equal(r.status, 200);
  assert.equal(r.body.comercio.id, comercioId);
  const n = await pg.query('select count(*)::int n from core.comercios where cuit = $1', [CUIT_NUEVO]);
  assert.equal(n.rows[0].n, 1);
});

test('11. un usuario no accede a otro comercio', async () => {
  const ajeno = (await api('POST', '/core/usuarios', { email: 'ajeno@prueba.test', nombre: 'Ajeno', password: 'clave-ajeno-123' })).body.token;
  assert.equal((await api('GET', `/core/comercios/${comercioId}`, null, ajeno)).status, 403);
  assert.equal((await api('POST', `/core/comercios/${comercioId}/verificaciones/arca`, {}, ajeno)).status, 403);
  assert.equal((await api('GET', `/core/comercios/${comercioId}`)).status, 401);
  assert.equal((await api('GET', `/core/comercios/${comercioId}`, null, 'token.falso')).status, 401);
});

test('12. la caída de un módulo no impide el registro central', async () => {
  const { ADAPTADORES } = require('../src/modulos/core/adaptadores');
  const original = ADAPTADORES.banco;
  ADAPTADORES.banco = async () => { throw new Error('Banco fuera de servicio'); };
  try {
    const r = await api('POST', '/core/comercios', alta(CUIT_CAIDA, { razon_social: 'Comercio Caída SA' }), titular);
    assert.equal(r.status, 201);
    assert.equal(r.body.estado.banco.resultado, 'no_disponible');
    assert.equal(r.body.estado.identidad.resultado, 'declarado');
    assert.equal(r.body.sucursales.length, 1);
  } finally { ADAPTADORES.banco = original; }
});

test('7, 13, 14. municipio en trámite, datos de ARCA protegidos y varias sucursales y cajas', async () => {
  // ARCA inscribe el CUIT en su padrón sandbox (dominio de ARCA, no del CORE).
  await pg.query(`insert into padron.contribuyentes (cuit, razon_social, tipo_persona, condicion_iva, domicilio_fiscal)
    values ($1, 'Comercio de Prueba CORE SRL', 'juridica', 'responsable_inscripto', 'Av. Siempre Viva 742')`, [CUIT_NUEVO]);
  const arca = await api('POST', `/core/comercios/${comercioId}/verificaciones/arca`, {}, titular);
  assert.equal(arca.body.arca.resultado, 'verificado');

  // 13: lo que informa ARCA no se pisa; lo propio del CORE sí se actualiza.
  assert.equal((await api('PATCH', `/core/comercios/${comercioId}`, { razon_social: 'Otro nombre' }, titular)).status, 409);
  assert.equal((await api('PATCH', `/core/comercios/${comercioId}`, { cuit: '20000000001' }, titular)).status, 400);
  const p = await api('PATCH', `/core/comercios/${comercioId}`, { nombre_fantasia: 'Prueba CORE II' }, titular);
  assert.equal(p.body.nombre_fantasia, 'Prueba CORE II');

  // Banco abre la cuenta.
  const b = await api('POST', `/core/comercios/${comercioId}/banco/vincular`, {}, titular);
  assert.equal(b.status, 200);
  assert.equal(b.body.banco.resultado, 'vinculado');
  assert.match(b.body.banco.detalle.cbu, /^••••\d{4}$/);

  // 7: trámite municipal pendiente → en trámite; el TPV se activa con advertencia.
  await pg.query(`insert into municipio.habilitaciones (cuit, rubro, domicilio, estado) values ($1, 'Almacén', 'Belgrano 100', 'pendiente')`, [CUIT_NUEVO]);
  const t = await api('POST', `/core/comercios/${comercioId}/tpv/activar`, { terminal_id: 'david' }, titular);
  assert.equal(t.status, 200);
  assert.equal(t.body.estado.municipio[0].resultado, 'en_tramite');
  assert.ok(t.body.advertencias.some((a) => a.includes('en_tramite')));
  assert.equal(t.body.estado.tpv.resultado, 'configurado');

  // 14: segunda sucursal y segunda caja.
  const s = await api('POST', `/core/comercios/${comercioId}/sucursales`,
    { nombre: 'Sucursal Haedo', domicilio_comercial: 'Rivadavia 500', localidad: 'Haedo', municipio: 'Morón' }, titular);
  assert.equal(s.status, 201);
  const t2 = await api('POST', `/core/comercios/${comercioId}/tpv/activar`, { terminal_id: 'sebastian' }, titular);
  assert.equal(t2.status, 200);
  assert.deepEqual(t2.body.estado.tpv.detalle.terminales, ['david', 'sebastian']);
  assert.equal(t2.body.estado.municipio.length, 2);
  assert.equal(t2.body.estado.municipio[1].resultado, 'pendiente');

  // Municipio suspende la habilitación: el TPV ya no se puede activar en otra caja.
  await pg.query("update municipio.habilitaciones set estado = 'suspendida' where cuit = $1", [CUIT_NUEVO]);
  const t3 = await api('POST', `/core/comercios/${comercioId}/tpv/activar`, { terminal_id: 'brisa' }, titular);
  assert.equal(t3.status, 409);
  assert.ok(t3.body.faltantes.some((f) => f.startsWith('Municipio')));
});

test('recorrido completo: cada sistema hace su trámite y el panel queda en verde', async () => {
  const yo = await api('GET', '/core/yo', null, titular);
  const k = yo.body.comercios.find((x) => x.cuit === CUIT_CAIDA);
  const id = k.id;
  // ARCA inscribe el CUIT (dominio fiscal); un CUIT con DV inválido se rechaza.
  assert.equal((await api('POST', '/arca/contribuyentes', { cuit: '30712345670', razon_social: 'X', condicion_iva: 'monotributo' })).status, 400);
  const insc = await api('POST', '/arca/contribuyentes', { cuit: CUIT_CAIDA, razon_social: 'Comercio Caída SA', condicion_iva: 'responsable_inscripto', domicilio_fiscal: 'Av. Siempre Viva 742' });
  assert.equal(insc.status, 201);
  assert.equal((await api('POST', '/arca/contribuyentes', { cuit: CUIT_CAIDA, razon_social: 'Otro', condicion_iva: 'monotributo' })).status, 409);
  // ARBA inscribe en IIBB; Municipio recibe el trámite sin duplicar el padrón.
  assert.equal((await api('POST', '/arba/padron', { cuit: CUIT_CAIDA, actividad: 'Comercio minorista', alicuota: 0.03 })).status, 201);
  const muni = await api('POST', '/municipio/comercios', { cuit: CUIT_CAIDA, razon_social: 'Comercio Caída SA', condicion_fiscal: 'Responsable Inscripto', direccion: 'Belgrano 100', rubro_principal: 'Almacén' });
  assert.equal(muni.status, 201);
  const padron = await pg.query('select razon_social, condicion_iva from padron.contribuyentes where cuit = $1', [CUIT_CAIDA]);
  assert.equal(padron.rows[0].condicion_iva, 'responsable_inscripto'); // Municipio no pisó a ARCA
  assert.equal((await api('POST', `/municipio/comercios/${CUIT_CAIDA}/resolucion`, { estado: 'activa' })).status, 400);
  assert.equal((await api('POST', `/municipio/comercios/${CUIT_CAIDA}/resolucion`, { estado: 'activa', expediente: 'EXP-2026-001' })).status, 200);
  // El CORE reverifica, el Banco abre la cuenta y se activa el TPV.
  assert.equal((await api('POST', '/arca/puntos-venta', { cuit: CUIT_CAIDA, punto_venta: 1 })).status, 201);
  for (const s of ['arca', 'arba', 'municipio']) await api('POST', `/core/comercios/${id}/verificaciones/${s}`, {}, titular);
  assert.equal((await api('POST', `/core/comercios/${id}/banco/vincular`, {}, titular)).status, 200);
  const t = await api('POST', `/core/comercios/${id}/tpv/activar`, { terminal_id: 'brisa' }, titular);
  assert.equal(t.status, 200);
  assert.deepEqual(t.body.advertencias, []);
  const e = t.body.estado;
  assert.deepEqual([e.arca.resultado, e.arba.resultado, e.municipio[0].resultado, e.banco.resultado, e.tpv.resultado],
    ['verificado', 'verificado', 'habilitado', 'vinculado', 'configurado']);
  const eventos = (await pg.query('select tipo from core.eventos where comercio_id = $1', [id])).rows.map((r) => r.tipo);
  for (const tipo of ['commerce.created', 'commerce.fiscal_verified', 'commerce.provincial_verified',
    'commerce.municipal_status_changed', 'commerce.bank_linked', 'commerce.pos_activated']) assert.ok(eventos.includes(tipo), tipo);
});

const express = require('express');
const { randomBytes, scryptSync, timingSafeEqual, createHash } = require('node:crypto');
const db = require('./db');
const demoClients = require('./demo-clients');

const app = express();
const PORT = process.env.PORT || 3006;

app.use(express.json());
app.use(express.static('public'));

// Contrato común: errores como {"error": "mensaje"}
const fail = (res, status, mensaje) => res.status(status).json({ error: mensaje });

app.get('/health', (_req, res) => res.json({ status: 'ok', servicio: 'billetera' }));

function ejecutarIdempotente(operacion, idVenta, payload, trabajo) {
  const payloadHash = createHash('sha256').update(JSON.stringify({ operacion, ...payload })).digest('hex');
  db.exec('BEGIN IMMEDIATE');
  try {
    const previo = db.prepare('SELECT payload_hash, respuesta_json FROM operaciones_idempotentes WHERE id_venta = ?').get(idVenta);
    if (previo) {
      if (previo.payload_hash !== payloadHash) {
        const error = new Error('id_venta ya fue utilizada con otro payload');
        error.status = 409;
        throw error;
      }
      db.exec('COMMIT');
      return { status: 200, body: JSON.parse(previo.respuesta_json) };
    }

    const body = trabajo();
    db.prepare('INSERT INTO operaciones_idempotentes (id_venta, operacion, payload_hash, respuesta_json) VALUES (?, ?, ?, ?)')
      .run(idVenta, operacion, payloadHash, JSON.stringify(body));
    db.exec('COMMIT');
    return { status: 201, body };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  }
}

const idVentaValido = (id) => typeof id === 'string' && id.trim().length > 0 && id.length <= 200;

function responderOperacion(res, fn) {
  try {
    const resultado = fn();
    res.status(resultado.status).json(resultado.body);
  } catch (error) {
    if (error.status) return fail(res, error.status, error.message);
    throw error;
  }
}

// El contrato pide cuit como string, sin puntos ni guiones
const cuitValido = (cuit) =>
  typeof cuit === 'string' && /^\d{11}$/.test(cuit);

const montoValido = (monto) =>
  typeof monto === 'number' && Number.isFinite(monto) && monto > 0 && Math.abs(monto * 100 - Math.round(monto * 100)) < 1e-7;

const aCentavos = (monto) => Math.round(monto * 100);
const fechaIso = (fecha) => new Date(`${fecha.replace(' ', 'T')}Z`).toISOString();

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

function passwordMatches(password, storedHash) {
  if (!storedHash) return false;
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function registrarMovimiento(billeteraId, tipo, monto, contraparte, saldoResultante) {
  db.prepare(`
    INSERT INTO movimientos (billetera_id, tipo, monto, contraparte, saldo_resultante)
    VALUES (?, ?, ?, ?, ?)
  `).run(billeteraId, tipo, monto, contraparte, saldoResultante);
}

const filaBilletera = (b) => ({
  id: String(b.id),
  titular: b.titular,
  cuit: b.cuit,
  alias: b.alias,
  saldo: b.saldo / 100,
  fecha_alta: fechaIso(b.fecha_alta),
});

const filaMovimiento = (m) => ({
  id: String(m.id),
  tipo: m.tipo,
  monto: m.monto / 100,
  contraparte: m.contraparte,
  saldo_resultante: m.saldo_resultante / 100,
  fecha: fechaIso(m.fecha),
});

function ensureDemoAccount(client) {
  let account = db.prepare('SELECT * FROM billeteras WHERE cuit = ?').get(client.cuit);
  if (account) {
    if (!account.password_hash) {
      db.prepare('UPDATE billeteras SET password_hash = ? WHERE id = ?')
        .run(hashPassword(client.contrasena_demo), account.id);
      account = db.prepare('SELECT * FROM billeteras WHERE id = ?').get(account.id);
    }
    return { account, created: false };
  }

  try {
    db.exec('BEGIN IMMEDIATE');
    const info = db.prepare(`
      INSERT INTO billeteras (titular, cuit, alias, saldo, password_hash)
      VALUES (?, ?, ?, ?, ?)
    `).run(client.titular, client.cuit, client.alias, aCentavos(client.saldo_inicial), hashPassword(client.contrasena_demo));
    registrarMovimiento(Number(info.lastInsertRowid), 'carga', aCentavos(client.saldo_inicial), 'Saldo inicial de prueba', aCentavos(client.saldo_inicial));
    db.exec('COMMIT');
    account = db.prepare('SELECT * FROM billeteras WHERE id = ?').get(info.lastInsertRowid);
    return { account, created: true };
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch {}
    account = db.prepare('SELECT * FROM billeteras WHERE cuit = ?').get(client.cuit);
    if (account) return { account, created: false };
    throw err;
  }
}

// POST /billetera/auth/login — acceso simulado con CUIL y contraseña
app.post('/billetera/auth/login', (req, res) => {
  const { cuil, contrasena } = req.body || {};
  if (!cuitValido(cuil)) return fail(res, 400, 'el CUIL debe tener 11 dígitos, sin puntos ni guiones');
  if (typeof contrasena !== 'string' || contrasena.length < 8) return fail(res, 400, 'la contraseña debe tener al menos 8 caracteres');

  const demoClient = demoClients.find(({ cuit }) => cuit === cuil);
  let account;
  if (demoClient) account = ensureDemoAccount(demoClient).account;
  else account = db.prepare('SELECT * FROM billeteras WHERE cuit = ?').get(cuil);

  if (!account || !passwordMatches(contrasena, account.password_hash)) {
    return fail(res, 401, 'CUIL o contraseña incorrectos');
  }
  res.json({ billetera: filaBilletera(account) });
});

// POST /billetera/auth/registro — crea una cuenta con acceso al panel
app.post('/billetera/auth/registro', (req, res) => {
  const { titular, cuil, alias, contrasena } = req.body || {};
  if (!titular || typeof titular !== 'string') return fail(res, 400, 'nombre y apellido son obligatorios');
  if (!cuitValido(cuil)) return fail(res, 400, 'el CUIL debe tener 11 dígitos, sin puntos ni guiones');
  if (!alias || typeof alias !== 'string') return fail(res, 400, 'el alias es obligatorio');
  if (typeof contrasena !== 'string' || contrasena.length < 8) return fail(res, 400, 'la contraseña debe tener al menos 8 caracteres');

  try {
    const info = db.prepare(`
      INSERT INTO billeteras (titular, cuit, alias, password_hash)
      VALUES (?, ?, ?, ?)
    `).run(titular, cuil, alias, hashPassword(contrasena));
    const account = db.prepare('SELECT * FROM billeteras WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ billetera: filaBilletera(account) });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return fail(res, 409, 'ya existe una billetera con ese CUIL o alias');
    throw err;
  }
});

// GET /billetera/demo/clientes — catálogo de clientes ficticios para pruebas
app.get('/billetera/demo/clientes', (_req, res) => {
  res.json(demoClients.map(({ codigo, titular, cuit, alias, saldo_inicial, perfil }) => ({
    codigo,
    titular,
    cuil: cuit,
    alias,
    saldo_inicial,
    perfil,
  })));
});

// POST /billetera/demo/clientes/{codigo}/activar — crea o abre la cuenta de prueba
app.post('/billetera/demo/clientes/:codigo/activar', (req, res) => {
  const client = demoClients.find(({ codigo }) => codigo === req.params.codigo);
  if (!client) return fail(res, 404, 'cliente de prueba no encontrado');
  const result = ensureDemoAccount(client);
  res.status(result.created ? 201 : 200).json({ billetera: filaBilletera(result.account), creada: result.created });
});

// GET /billetera/qr/{cuit} — vista pública mínima para identificar el QR local
app.get('/billetera/qr/:cuit', (req, res) => {
  if (!cuitValido(req.params.cuit)) return fail(res, 400, 'el QR debe tener un CUIL válido');
  const account = db.prepare('SELECT titular, cuit, alias FROM billeteras WHERE cuit = ?').get(req.params.cuit);
  if (!account) return fail(res, 404, 'el QR no corresponde a una billetera existente');
  res.json({ titular: account.titular, cuit: account.cuit, alias: account.alias });
});

// POST /billetera/cuentas — crea una billetera
app.post('/billetera/cuentas', (req, res) => {
  const { titular, cuit, alias, contrasena } = req.body || {};

  if (!titular || typeof titular !== 'string') return fail(res, 400, 'titular es obligatorio');
  if (!cuitValido(cuit)) return fail(res, 400, 'cuit debe ser un string de 11 dígitos, sin puntos ni guiones');
  if (!alias || typeof alias !== 'string') return fail(res, 400, 'alias es obligatorio');
  if (contrasena !== undefined && (typeof contrasena !== 'string' || contrasena.length < 8)) {
    return fail(res, 400, 'la contraseña debe tener al menos 8 caracteres');
  }

  try {
    const info = db.prepare(
      'INSERT INTO billeteras (titular, cuit, alias, password_hash) VALUES (?, ?, ?, ?)'
    ).run(titular, cuit, alias, contrasena ? hashPassword(contrasena) : null);
    const b = db.prepare('SELECT * FROM billeteras WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(filaBilletera(b));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return fail(res, 409, 'ya existe una billetera con ese cuit o alias');
    }
    throw err;
  }
});

// GET /billetera/cuentas/{id} — datos y saldo
app.get('/billetera/cuentas/:id', (req, res) => {
  const b = db.prepare('SELECT * FROM billeteras WHERE id = ?').get(req.params.id);
  if (!b) return fail(res, 404, 'billetera no encontrada');
  res.json(filaBilletera(b));
});

// GET /billetera/cuentas/{id}/movimientos — últimos movimientos
app.get('/billetera/cuentas/:id/movimientos', (req, res) => {
  const b = db.prepare('SELECT id FROM billeteras WHERE id = ?').get(req.params.id);
  if (!b) return fail(res, 404, 'billetera no encontrada');
  const rows = db.prepare(
    'SELECT * FROM movimientos WHERE billetera_id = ? ORDER BY id DESC LIMIT 50'
  ).all(b.id);
  res.json(rows.map(filaMovimiento));
});

// POST /billetera/cargas — acredita saldo
app.post('/billetera/cargas', (req, res) => {
  const { id_venta, cuit, monto } = req.body || {};

  if (!idVentaValido(id_venta)) return fail(res, 400, 'id_venta es obligatorio');
  if (!cuitValido(cuit)) return fail(res, 400, 'cuit debe ser un string de 11 dígitos, sin puntos ni guiones');
  if (!montoValido(monto)) return fail(res, 400, 'monto debe ser un número positivo de hasta dos decimales');

  responderOperacion(res, () => ejecutarIdempotente('carga', id_venta, { cuit, monto }, () => {
    const actual = db.prepare('SELECT * FROM billeteras WHERE cuit = ?').get(cuit);
    if (!actual) { const error = new Error('no existe billetera para ese cuit'); error.status = 404; throw error; }
    const montoCentavos = aCentavos(monto);
    const nuevoSaldo = actual.saldo + montoCentavos;
    db.prepare('UPDATE billeteras SET saldo = ? WHERE id = ?').run(nuevoSaldo, actual.id);
    registrarMovimiento(actual.id, 'carga', montoCentavos, 'carga de saldo', nuevoSaldo);
    const movimiento = db.prepare('SELECT * FROM movimientos WHERE id = last_insert_rowid()').get();
    return { ...filaBilletera(db.prepare('SELECT * FROM billeteras WHERE id = ?').get(actual.id)), id_venta, movimiento: filaMovimiento(movimiento), saldo_resultante: nuevoSaldo / 100 };
  }));
});

// POST /billetera/pagos — debita saldo hacia un comercio
app.post('/billetera/pagos', (req, res) => {
  const { id_venta, cuit, monto, comercio_cuit } = req.body || {};

  if (!idVentaValido(id_venta)) return fail(res, 400, 'id_venta es obligatorio');
  if (!cuitValido(cuit)) return fail(res, 400, 'cuit debe ser un string de 11 dígitos, sin puntos ni guiones');
  if (!montoValido(monto)) return fail(res, 400, 'monto debe ser un número positivo de hasta dos decimales');

  if (!cuitValido(comercio_cuit)) return fail(res, 400, 'comercio_cuit debe ser un string de 11 dígitos');
  responderOperacion(res, () => ejecutarIdempotente('pago', id_venta, { cuit, comercio_cuit: comercio_cuit || null, monto }, () => {
    const b = db.prepare('SELECT * FROM billeteras WHERE cuit = ?').get(cuit);
    if (!b) { const error = new Error('no existe billetera para ese cuit'); error.status = 404; throw error; }
    const montoCentavos = aCentavos(monto);
    if (b.saldo < montoCentavos) { const error = new Error('saldo insuficiente'); error.status = 400; throw error; }
    const contraparte = comercio_cuit;
    const nuevoSaldo = b.saldo - montoCentavos;
    db.prepare('UPDATE billeteras SET saldo = ? WHERE id = ?').run(nuevoSaldo, b.id);
    registrarMovimiento(b.id, 'pago', montoCentavos, contraparte, nuevoSaldo);
    const movimiento = db.prepare('SELECT * FROM movimientos WHERE id = last_insert_rowid()').get();
    return { ...filaBilletera(db.prepare('SELECT * FROM billeteras WHERE id = ?').get(b.id)), id_venta, movimiento: filaMovimiento(movimiento), saldo_resultante: nuevoSaldo / 100, estado: 'confirmado' };
  }));
});

// POST /billetera/qr/pagos — transferencia simulada entre billeteras por QR
app.post('/billetera/qr/pagos', (req, res) => {
  const { id_venta, cuit_origen, cuit_destino, monto } = req.body || {};
  if (!idVentaValido(id_venta)) return fail(res, 400, 'id_venta es obligatorio');
  if (!cuitValido(cuit_origen) || !cuitValido(cuit_destino)) {
    return fail(res, 400, 'el QR debe identificar dos CUIL de 11 dígitos');
  }
  if (!montoValido(monto)) return fail(res, 400, 'monto debe ser un número positivo de hasta dos decimales');
  if (cuit_origen === cuit_destino) return fail(res, 400, 'no podés pagarte a vos mismo');

  responderOperacion(res, () => ejecutarIdempotente('qr_pago', id_venta, { cuit_origen, cuit_destino, monto }, () => {
    const origen = db.prepare('SELECT * FROM billeteras WHERE cuit = ?').get(cuit_origen);
    const destino = db.prepare('SELECT * FROM billeteras WHERE cuit = ?').get(cuit_destino);
    if (!origen) { const error = new Error('no existe la billetera de origen'); error.status = 404; throw error; }
    if (!destino) { const error = new Error('el QR no corresponde a una billetera existente'); error.status = 404; throw error; }
    const montoCentavos = aCentavos(monto);
    if (origen.saldo < montoCentavos) { const error = new Error('saldo insuficiente'); error.status = 400; throw error; }

    const saldoOrigen = origen.saldo - montoCentavos;
    const saldoDestino = destino.saldo + montoCentavos;
    db.prepare('UPDATE billeteras SET saldo = ? WHERE id = ?').run(saldoOrigen, origen.id);
    db.prepare('UPDATE billeteras SET saldo = ? WHERE id = ?').run(saldoDestino, destino.id);
    registrarMovimiento(origen.id, 'pago', montoCentavos, `Pago QR a ${destino.alias}`, saldoOrigen);
    registrarMovimiento(destino.id, 'cobro', montoCentavos, `Cobro QR de ${origen.alias}`, saldoDestino);
    const movimiento = db.prepare('SELECT * FROM movimientos WHERE billetera_id = ? AND tipo = \'pago\' ORDER BY id DESC LIMIT 1').get(origen.id);
    return { ...filaBilletera(db.prepare('SELECT * FROM billeteras WHERE id = ?').get(origen.id)), id_venta, movimiento: filaMovimiento(movimiento), saldo_resultante: saldoOrigen / 100, estado: 'confirmado' };
  }));
});

app.use((_req, res) => fail(res, 404, 'ruta no encontrada'));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return fail(res, 400, 'JSON inválido');
  }
  console.error(error);
  return fail(res, 500, 'error interno del servidor');
});

app.listen(PORT, () => {
  console.log(`Billetera Virtual escuchando en http://localhost:${PORT}`);
});

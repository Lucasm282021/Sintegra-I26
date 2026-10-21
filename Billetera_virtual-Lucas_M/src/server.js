const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3006;

app.use(express.json());
app.use(express.static('public'));

// Contrato común: errores como {"error": "mensaje"}
const fail = (res, status, mensaje) => res.status(status).json({ error: mensaje });

// El contrato pide cuit como string, sin puntos ni guiones
const cuitValido = (cuit) =>
  typeof cuit === 'string' && /^\d{11}$/.test(cuit);

const montoValido = (monto) =>
  Number.isInteger(monto) && monto > 0;

function registrarMovimiento(billeteraId, tipo, monto, contraparte, saldoResultante) {
  db.prepare(`
    INSERT INTO movimientos (billetera_id, tipo, monto, contraparte, saldo_resultante)
    VALUES (?, ?, ?, ?, ?)
  `).run(billeteraId, tipo, monto, contraparte, saldoResultante);
}

const filaBilletera = (b) => ({
  id: b.id,
  titular: b.titular,
  cuit: b.cuit,
  alias: b.alias,
  saldo: b.saldo,
  fecha_alta: b.fecha_alta,
});

const filaMovimiento = (m) => ({
  id: m.id,
  tipo: m.tipo,
  monto: m.monto,
  contraparte: m.contraparte,
  saldo_resultante: m.saldo_resultante,
  fecha: m.fecha,
});

// POST /billetera/cuentas — crea una billetera
app.post('/billetera/cuentas', (req, res) => {
  const { titular, cuit, alias } = req.body || {};

  if (!titular || typeof titular !== 'string') return fail(res, 400, 'titular es obligatorio');
  if (!cuitValido(cuit)) return fail(res, 400, 'cuit debe ser un string de 11 dígitos, sin puntos ni guiones');
  if (!alias || typeof alias !== 'string') return fail(res, 400, 'alias es obligatorio');

  try {
    const info = db.prepare(
      'INSERT INTO billeteras (titular, cuit, alias) VALUES (?, ?, ?)'
    ).run(titular, cuit, alias);
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
  const { cuit, monto } = req.body || {};

  if (!cuitValido(cuit)) return fail(res, 400, 'cuit debe ser un string de 11 dígitos, sin puntos ni guiones');
  if (!montoValido(monto)) return fail(res, 400, 'monto debe ser un entero positivo');

  const b = db.prepare('SELECT * FROM billeteras WHERE cuit = ?').get(cuit);
  if (!b) return fail(res, 404, 'no existe billetera para ese cuit');

  const nuevoSaldo = b.saldo + monto;
  db.prepare('UPDATE billeteras SET saldo = ? WHERE id = ?').run(nuevoSaldo, b.id);
  registrarMovimiento(b.id, 'carga', monto, 'carga de saldo', nuevoSaldo);

  res.status(201).json(filaBilletera(db.prepare('SELECT * FROM billeteras WHERE id = ?').get(b.id)));
});

// POST /billetera/pagos — debita saldo hacia un comercio
app.post('/billetera/pagos', (req, res) => {
  const { cuit, monto, comercio_cuit, descripcion } = req.body || {};

  if (!cuitValido(cuit)) return fail(res, 400, 'cuit debe ser un string de 11 dígitos, sin puntos ni guiones');
  if (!montoValido(monto)) return fail(res, 400, 'monto debe ser un entero positivo');

  const b = db.prepare('SELECT * FROM billeteras WHERE cuit = ?').get(cuit);
  if (!b) return fail(res, 404, 'no existe billetera para ese cuit');

  if (b.saldo < monto) {
    return fail(res, 400, 'saldo insuficiente');
  }

  const contraparte = comercio_cuit || descripcion || 'pago';
  const nuevoSaldo = b.saldo - monto;
  db.prepare('UPDATE billeteras SET saldo = ? WHERE id = ?').run(nuevoSaldo, b.id);
  registrarMovimiento(b.id, 'pago', monto, contraparte, nuevoSaldo);

  res.status(201).json(filaBilletera(db.prepare('SELECT * FROM billeteras WHERE id = ?').get(b.id)));
});

app.listen(PORT, () => {
  console.log(`Billetera Virtual escuchando en http://localhost:${PORT}`);
});

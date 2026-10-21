const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'billetera.db');

const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS billeteras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titular TEXT NOT NULL,
    cuit TEXT NOT NULL UNIQUE,
    alias TEXT NOT NULL UNIQUE,
    saldo INTEGER NOT NULL DEFAULT 0,
    fecha_alta TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    billetera_id INTEGER NOT NULL REFERENCES billeteras(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('carga', 'pago', 'cobro')),
    monto INTEGER NOT NULL,
    contraparte TEXT NOT NULL,
    saldo_resultante INTEGER NOT NULL,
    fecha TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;

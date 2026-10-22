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
    password_hash TEXT,
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

  CREATE TABLE IF NOT EXISTS operaciones_idempotentes (
    id_venta TEXT PRIMARY KEY,
    operacion TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    respuesta_json TEXT NOT NULL,
    fecha TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS migraciones (nombre TEXT PRIMARY KEY);
`);

// Migración compatible con billeteras creadas antes de agregar el acceso con contraseña.
const columnasBilletera = db.prepare('PRAGMA table_info(billeteras)').all();
if (!columnasBilletera.some(({ name }) => name === 'password_hash')) {
  db.exec('ALTER TABLE billeteras ADD COLUMN password_hash TEXT');
}

// El modelo anterior guardaba pesos enteros. Convierte una sola vez todo el
// historial a centavos, manteniendo la API pública expresada en pesos.
if (!db.prepare("SELECT 1 FROM migraciones WHERE nombre = 'dinero_en_centavos'").get()) {
  db.exec(`
    BEGIN IMMEDIATE;
    UPDATE billeteras SET saldo = saldo * 100;
    UPDATE movimientos SET monto = monto * 100, saldo_resultante = saldo_resultante * 100;
    INSERT INTO migraciones (nombre) VALUES ('dinero_en_centavos');
    COMMIT;
  `);
}

module.exports = db;

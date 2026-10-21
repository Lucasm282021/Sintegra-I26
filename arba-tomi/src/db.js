const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'arba.db');

// Valores ficticios y deterministas para la actividad. No representan
// alícuotas fiscales reales.  Se pueden reemplazar con PADRON_SEED_JSON.
const DEFAULT_SEED = [
  { cuit: '30712345678', actividad: 'Comercio minorista', alicuota: 0.03, razon_social: 'Comercio Demo Uno', condicion: 'contribuyente' },
  { cuit: '27304567891', actividad: 'Servicios profesionales', alicuota: 0.02, razon_social: 'Servicios Demo Dos', condicion: 'contribuyente' },
  { cuit: '30556789012', actividad: 'Producción de alimentos', alicuota: 0.015, razon_social: 'Alimentos Demo Tres', condicion: 'contribuyente' },
  { cuit: '20123456789', actividad: 'Librería', alicuota: 0.03, razon_social: 'Librería Demo Cuatro', condicion: 'contribuyente' },
  { cuit: '30678901234', actividad: 'Comercio mayorista', alicuota: 0, razon_social: 'Mayorista Demo Cinco', condicion: 'exento' }
];

function seedPadron() {
  if (!process.env.PADRON_SEED_JSON) return DEFAULT_SEED;

  let seed;
  try {
    seed = JSON.parse(process.env.PADRON_SEED_JSON);
  } catch {
    throw new Error('PADRON_SEED_JSON debe ser JSON válido');
  }

  if (!Array.isArray(seed) || seed.some((item) => (
    !item || typeof item.cuit !== 'string' || !/^\d{11}$/.test(item.cuit)
    || typeof item.actividad !== 'string'
    || typeof item.alicuota !== 'number'
    || !Number.isFinite(item.alicuota) || item.alicuota < 0 || item.alicuota > 1
  ))) {
    throw new Error('PADRON_SEED_JSON tiene un formato inválido');
  }

  return seed;
}

function migratePercepciones(db) {
  const columns = db.prepare('PRAGMA table_info(percepciones)').all();
  if (!columns.some((column) => column.name === 'id_venta')) {
    db.exec('ALTER TABLE percepciones ADD COLUMN id_venta TEXT');
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_percepciones_id_venta
    ON percepciones (id_venta)
    WHERE id_venta IS NOT NULL
  `);
}

function migratePadron(db) {
  const columns = db.prepare('PRAGMA table_info(padron)').all();
  if (!columns.some((column) => column.name === 'estado')) {
    db.exec("ALTER TABLE padron ADD COLUMN estado TEXT NOT NULL DEFAULT 'activo'");
  }
  if (!columns.some((column) => column.name === 'aplicaciones')) {
    db.exec("ALTER TABLE padron ADD COLUMN aplicaciones TEXT NOT NULL DEFAULT '{\"arba_iibb\":true,\"arca_facturacion\":false}'");
  }
  const extra = [
    ['tipo_titular', "TEXT NOT NULL DEFAULT 'persona_juridica'"], ['nombre_fantasia', 'TEXT'],
    ['actividad_codigo', 'TEXT'], ['actividades_secundarias', "TEXT NOT NULL DEFAULT '[]'"],
    ['fecha_inicio', 'TEXT'], ['domicilio_fiscal', 'TEXT'], ['domicilios_actividad', "TEXT NOT NULL DEFAULT '[]'"],
    ['jurisdicciones', "TEXT NOT NULL DEFAULT '[]'"], ['email_contacto', 'TEXT'], ['telefono', 'TEXT'],
    ['estado_tramite', "TEXT NOT NULL DEFAULT 'activo'"], ['estado_fiscal', "TEXT NOT NULL DEFAULT 'verificado'"],
    ['fuente_verificacion', 'TEXT'], ['fecha_verificacion', 'TEXT'], ['creado_por', 'INTEGER'], ['revisado_por', 'INTEGER'],
    ['creado_en', 'TEXT'], ['actualizado_en', 'TEXT'], ['apellido_nombres', 'TEXT'], ['tipo_documento', 'TEXT'],
    ['numero_documento', 'TEXT'], ['apoderado', 'TEXT'], ['forma_juridica', 'TEXT'], ['fecha_constitucion', 'TEXT'],
    ['domicilio_legal', 'TEXT'], ['representante_legal', 'TEXT'], ['dato_registral', 'TEXT']
  ];
  for (const [name, type] of extra) if (!columns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE padron ADD COLUMN ${name} ${type}`);
  }
  db.exec("UPDATE padron SET estado_tramite = 'activo', estado_fiscal = 'verificado' WHERE creado_por IS NULL AND estado = 'activo'");
}

function initDb(dbPath = DB_PATH) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS padron (
      cuit         TEXT PRIMARY KEY,
      razon_social TEXT,
      actividad    TEXT NOT NULL,
      alicuota     REAL NOT NULL,
      condicion    TEXT
    );

    CREATE TABLE IF NOT EXISTS percepciones (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      id_venta          TEXT UNIQUE,
      cuit              TEXT NOT NULL,
      monto_venta       REAL NOT NULL,
      alicuota_aplicada REAL NOT NULL,
      monto_percepcion  REAL NOT NULL,
      fecha             TEXT NOT NULL
    );
  `);

  migratePercepciones(db);
  migratePadron(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, rol TEXT NOT NULL CHECK (rol IN ('admin','convencional')),
      activo INTEGER NOT NULL DEFAULT 1, creado_en TEXT NOT NULL, actualizado_en TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auditoria_sujetos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER, accion TEXT NOT NULL, tipo_sujeto TEXT,
      sujeto_cuit TEXT, estado_anterior TEXT, estado_posterior TEXT, fecha TEXT NOT NULL, detalle_json TEXT
    );
  `);

  const count = db.prepare('SELECT COUNT(*) AS n FROM padron').get().n;
  if (count === 0) {
    const insert = db.prepare(
      'INSERT INTO padron (cuit, razon_social, actividad, alicuota, condicion) VALUES (?, ?, ?, ?, ?)'
    );
    const insertAll = db.transaction((rows) => {
      rows.forEach((row) => insert.run(
        row.cuit,
        row.razon_social || `Contribuyente ${row.cuit}`,
        row.actividad,
        row.alicuota,
        row.condicion || 'contribuyente'
      ));
    });
    insertAll(seedPadron());
  }

  return db;
}

function publicPadron(row) {
  return row && {
    cuit: row.cuit,
    actividad: row.actividad,
    alicuota: row.alicuota
  };
}

function publicPercepcion(row) {
  return row && {
    id: String(row.id),
    id_venta: row.id_venta,
    cuit: row.cuit,
    monto_venta: row.monto_venta,
    alicuota_aplicada: row.alicuota_aplicada,
    monto_percepcion: row.monto_percepcion,
    fecha: row.fecha
  };
}

module.exports = { initDb, publicPadron, publicPercepcion };

// Conexión única a Supabase Postgres. En Vercel usar el pooler de transacciones
// (puerto 6543) en DATABASE_URL o POSTGRES_URL.
const { Pool } = require('pg');

let pool;
function getPool() {
  if (pool) return pool;
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!raw) throw Object.assign(new Error('falta DATABASE_URL'), { status: 503 });
  const url = new URL(raw);
  url.searchParams.delete('sslmode'); // el SSL se configura abajo
  const local = /^(localhost|127\.0\.0\.1)$/.test(url.hostname);
  pool = new Pool({
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10_000,
  });
  return pool;
}

// Permite inyectar otra base (tests).
function setDb(custom) { pool = custom; }

const query = (text, params) => getPool().query(text, params);

// Ejecuta fn dentro de una transacción con un cliente dedicado.
async function tx(fn) {
  const p = getPool();
  if (p.transaction) return p.transaction(fn); // PGlite en tests
  const client = await p.connect();
  try {
    await client.query('begin');
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, tx, setDb };

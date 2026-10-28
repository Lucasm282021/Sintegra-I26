// Aplica las migraciones de supabase/migrations que todavía no figuran en
// public.sintegra_migraciones. Las dos primeras se cargaron a mano en el
// editor SQL de Supabase: si el esquema ya existe, se marcan como aplicadas.
require('./env');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

(async () => {
  const url = new URL(process.env.DATABASE_URL); url.searchParams.delete('sslmode');
  const c = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('create table if not exists public.sintegra_migraciones (nombre text primary key, aplicada_en timestamptz not null default now())');
  const hechas = new Set((await c.query('select nombre from public.sintegra_migraciones')).rows.map((r) => r.nombre));
  const dir = path.join(__dirname, '..', 'supabase', 'migrations');
  const yaHayEsquema = (await c.query("select to_regclass('billetera.usuarios') is not null as ok")).rows[0].ok;
  for (const archivo of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (hechas.has(archivo)) continue;
    if (yaHayEsquema && /0000[12]_/.test(archivo)) {
      await c.query('insert into public.sintegra_migraciones (nombre) values ($1)', [archivo]);
      console.log('ya estaba aplicada:', archivo);
      continue;
    }
    await c.query('begin');
    try {
      await c.query(fs.readFileSync(path.join(dir, archivo), 'utf8'));
      await c.query('insert into public.sintegra_migraciones (nombre) values ($1)', [archivo]);
      await c.query('commit');
      console.log('aplicada:', archivo);
    } catch (e) {
      await c.query('rollback');
      throw new Error(`${archivo}: ${e.message}`);
    }
  }
  await c.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });

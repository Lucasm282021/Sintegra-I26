require('./env');
const { Client } = require('pg');
(async () => {
  const url = new URL(process.env.DATABASE_URL); url.searchParams.delete('sslmode');
  const c = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const s = await c.query(`select table_schema, count(*)::int n from information_schema.tables
    where table_schema in ('padron','municipio','arba','arca','banco','billetera','tpv') group by 1 order by 1`);
  console.log('tablas por esquema:', s.rows);
  for (const t of ['padron.contribuyentes','banco.cuentas','billetera.cuentas','billetera.usuarios']) {
    try { const r = await c.query(`select count(*)::int n from ${t}`); console.log(t, r.rows[0].n); } catch (e) { console.log(t, 'NO EXISTE'); }
  }
  await c.end();
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });

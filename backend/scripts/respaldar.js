// Respalda todas las tablas de los esquemas del ecosistema en un JSON por tabla.
// Uso: node scripts/respaldar.js <carpeta-destino>   (no imprime credenciales)
require('./env');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

(async () => {
  const destino = process.argv[2];
  if (!destino) throw new Error('indicá la carpeta destino');
  fs.mkdirSync(destino, { recursive: true });
  const url = new URL(process.env.DATABASE_URL); url.searchParams.delete('sslmode');
  const c = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const { rows } = await c.query(`select table_schema s, table_name t from information_schema.tables
    where table_type = 'BASE TABLE' and table_schema in ('core','padron','arca','arba','municipio','banco','billetera','tpv','public')
    order by 1, 2`);
  let total = 0;
  for (const { s, t } of rows) {
    const datos = (await c.query(`select * from "${s}"."${t}"`)).rows;
    fs.writeFileSync(path.join(destino, `${s}.${t}.json`), JSON.stringify(datos, null, 1));
    total += datos.length;
    console.log(`${s}.${t}: ${datos.length}`);
  }
  console.log(`respaldo listo: ${rows.length} tablas, ${total} filas`);
  await c.end();
})().catch((e) => { console.error('error:', e.message); process.exit(1); });

// Backend local sobre una base Postgres en memoria (PGlite) con todas las
// migraciones y el seed. No toca Supabase; los datos se pierden al cerrar.
// Uso: npm run dev:memoria   (puerto 3010, o PORT=...)
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const pg = new PGlite({ extensions: { pgcrypto } });
  await pg.exec('create schema if not exists extensions;');
  const dir = path.join(__dirname, '..', 'supabase');
  for (const f of fs.readdirSync(path.join(dir, 'migrations')).sort()) {
    await pg.exec(fs.readFileSync(path.join(dir, 'migrations', f), 'utf8'));
    if (f.startsWith('20261026000002')) await pg.exec(fs.readFileSync(path.join(dir, 'seed.sql'), 'utf8'));
  }
  require('../src/db').setDb(pg);
  const app = require('../src/app');
  const port = Number(process.env.PORT || 3010);
  app.listen(port, () => console.log(`sintegra-backend (memoria) en http://localhost:${port}`));
})().catch((e) => { console.error(e); process.exit(1); });

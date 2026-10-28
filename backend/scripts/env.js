// Carga .env.supabase.local (no versionado) sin imprimir valores.
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(__dirname, '..', '.env.supabase.local');
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

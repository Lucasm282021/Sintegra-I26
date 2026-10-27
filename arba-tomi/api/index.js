// Vercel ejecuta el servidor completo de ARBA (usuarios, trámites, padrón y
// percepciones). La base SQLite vive en /tmp: es temporal y se reinicia.
process.env.DB_PATH = process.env.DB_PATH || '/tmp/arba.db';
const { createApp } = require('../src/app');

const app = createApp();

// El frontend llama a /api/...; el servidor de Tomi espera las rutas sin ese prefijo.
module.exports = (req, res) => {
  if (req.url === '/api' || req.url.startsWith('/api/')) req.url = req.url.slice(4) || '/';
  return app(req, res);
};

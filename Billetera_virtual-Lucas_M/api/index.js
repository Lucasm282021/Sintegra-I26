// Vercel ejecuta la app de Express como función. SQLite vive en /tmp (temporal).
process.env.DB_PATH = process.env.DB_PATH || '/tmp/billetera.db';
module.exports = require('../src/server');

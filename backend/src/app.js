// Backend único de Sintegra I26: un módulo por sistema sobre la misma base.
const express = require('express');
const { query } = require('./db');
const { HttpError } = require('./http');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// Las apps llaman desde su propio dominio (o por rewrite de Vercel). No hay
// cookies de sesión en este backend, así que se permite cualquier origen.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, X-Sintegra-Admin-Token');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

app.get(['/', '/health'], async (_req, res) => {
  let db = 'ok';
  try { await query('select 1'); } catch { db = 'sin conexión'; }
  res.status(db === 'ok' ? 200 : 503).json({
    status: db === 'ok' ? 'ok' : 'error', servicio: 'sintegra-backend', db,
    modulos: ['core', 'padron', 'banco', 'billetera', 'arba', 'arca', 'municipio', 'tpv'],
  });
});

app.use('/core', require('./modulos/core'));
app.use('/padron', require('./modulos/padron'));
app.use('/banco', require('./modulos/banco').router);
app.use('/billetera', require('./modulos/billetera').router);
app.use('/arba', require('./modulos/arba').router);
app.use('/arca', require('./modulos/arca').router);
app.use('/municipio', require('./modulos/municipio'));
app.use('/tpv', require('./modulos/webhooks').router);
app.use('/tpv', require('./modulos/tpv'));

app.use((_req, res) => res.status(404).json({ error: 'ruta no encontrada' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...(err.detalle || {}) });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err.status === 503) return res.status(503).json({ error: err.message });
  console.error('[sintegra-backend]', err.message);
  return res.status(500).json({ error: 'error interno' });
});

module.exports = app;

const express = require('express');
const { initDb } = require('./db');
const percepcionesRoutes = require('./routes/percepciones');
const padronRoutes = require('./routes/padron');
const sujetosRoutes = require('./routes/sujetos');
const { router: usuariosRoutes, auditRouter } = require('./routes/usuarios');
const authRoutes = require('./routes/auth');
const { ensureInitialAdmin } = require('./routes/auth');

function createApp(db = initDb()) {
  const app = express();
  app.use(express.json());
  app.locals.db = db;
  ensureInitialAdmin(db);

  app.get('/health', (req, res) => res.status(200).json({ status: 'ok', servicio: 'arba' }));
  app.use('/auth', authRoutes.router);
  app.use('/arba/usuarios', usuariosRoutes);
  app.use('/arba/auditoria', auditRouter);
  app.use('/arba/sujetos', sujetosRoutes);
  app.use('/arba/percepciones', percepcionesRoutes);
  app.use('/arba/padron', padronRoutes);

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'json invalido' });
    }
    return res.status(500).json({ error: 'error interno' });
  });

  app.use((req, res) => res.status(404).json({ error: 'no encontrado' }));
  return app;
}

module.exports = { createApp };

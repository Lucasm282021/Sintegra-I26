const express = require('express');
const padronRouter = require('./routes/padron');
const comerciosRouter = require('./routes/comercios');
const percepcionesRouter = require('./routes/percepciones');
const v1Router = require('./routes/v1');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'arba' }));
app.use('/api/v1/arba', v1Router);
app.use('/arba/padron', padronRouter);
app.use('/arba/comercios', comerciosRouter);
app.use('/arba/percepciones', percepcionesRouter);

app.use((req, res) => res.status(404).json({ error: 'Recurso no encontrado' }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
});

const port = Number(process.env.PORT) || 3003;
if (require.main === module) {
  app.listen(port, () => console.log(`ARBA escuchando en el puerto ${port}`));
}

module.exports = app;

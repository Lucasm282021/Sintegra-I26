const path = require('path');
const express = require('express');
const { randomUUID } = require('crypto');
const db = require('./db');
const {
  validarCuit,
  validarMonto,
  validarIdVenta,
  validarAlicuota,
  validarActividad,
  round2,
} = require('./validate');

const fs = require('fs');

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173'))
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(!origin || allowedOrigins.includes(origin) ? 204 : 403);
  }
  next();
});
app.use(express.json());

// Servir archivos estáticos del frontend (React SPA o HTML estático)
const distDir = path.join(__dirname, '..', 'dist');
const publicDir = path.join(__dirname, '..', 'public');
const staticDir = fs.existsSync(distDir) ? distDir : publicDir;
app.use(express.static(staticDir));

// GET /health - Verificación de disponibilidad del servicio
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// GET /arba/stats - Métricas generales para el Dashboard
app.get('/arba/stats', (req, res) => {
  const stats = db.getStats();
  return res.status(200).json(stats);
});

// GET /arba/padron - Listado paginado de comercios y alícuotas
app.get('/arba/padron', (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '10', 10);

  if (Number.isNaN(page) || page < 1 || Number.isNaN(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'Parámetros de paginación inválidos' });
  }

  const resultado = db.listPadron({ page, limit });
  return res.status(200).json(resultado);
});

// GET /arba/padron/:cuit - Consulta la alícuota y actividad de un CUIT
app.get('/arba/padron/:cuit', (req, res) => {
  const { cuit } = req.params;

  if (!validarCuit(cuit)) {
    return res.status(400).json({ error: 'cuit debe ser un string de 11 dígitos' });
  }

  const contribuyente = db.getPadronByCuit(cuit);
  if (!contribuyente) {
    return res.status(404).json({ error: 'CUIT no encontrado en el padrón' });
  }

  return res.status(200).json({
    cuit: contribuyente.cuit,
    actividad: contribuyente.actividad,
    alicuota: contribuyente.alicuota,
  });
});

// POST /arba/padron - Alta de un nuevo contribuyente en el padrón
app.post('/arba/padron', (req, res) => {
  const { cuit, actividad, alicuota } = req.body || {};

  if (!validarCuit(cuit)) {
    return res.status(400).json({ error: 'cuit debe ser un string de 11 dígitos numéricos' });
  }

  if (!validarActividad(actividad)) {
    return res.status(400).json({ error: 'actividad es requerida y no debe estar vacía' });
  }

  const alicuotaNum = parseFloat(alicuota);
  if (!validarAlicuota(alicuotaNum)) {
    return res.status(400).json({ error: 'alicuota debe ser un número decimal entre 0 y 1 (ej: 0.03 para 3%)' });
  }

  const resultado = db.createPadron({
    cuit,
    actividad: actividad.trim(),
    alicuota: alicuotaNum,
  });

  if (resultado.error) {
    return res.status(resultado.status).json({ error: resultado.error });
  }

  return res.status(201).json(resultado.data);
});

// PUT /arba/padron/:cuit - Modificación de actividad y/o alícuota
app.put('/arba/padron/:cuit', (req, res) => {
  const { cuit } = req.params;
  const { actividad, alicuota } = req.body || {};

  if (!validarCuit(cuit)) {
    return res.status(400).json({ error: 'cuit debe ser un string de 11 dígitos' });
  }

  const updates = {};
  if (actividad !== undefined) {
    if (!validarActividad(actividad)) {
      return res.status(400).json({ error: 'actividad no debe estar vacía' });
    }
    updates.actividad = actividad.trim();
  }

  if (alicuota !== undefined) {
    const alicuotaNum = parseFloat(alicuota);
    if (!validarAlicuota(alicuotaNum)) {
      return res.status(400).json({ error: 'alicuota debe ser un número decimal entre 0 y 1' });
    }
    updates.alicuota = alicuotaNum;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Debe especificar al menos actividad o alicuota para actualizar' });
  }

  const actualizado = db.updatePadron(cuit, updates);
  if (!actualizado) {
    return res.status(404).json({ error: 'CUIT no encontrado en el padrón' });
  }

  return res.status(200).json(actualizado);
});

// DELETE /arba/padron/:cuit - Baja de un contribuyente
app.delete('/arba/padron/:cuit', (req, res) => {
  const { cuit } = req.params;

  if (!validarCuit(cuit)) {
    return res.status(400).json({ error: 'cuit debe ser un string de 11 dígitos' });
  }

  const eliminado = db.deletePadron(cuit);
  if (!eliminado) {
    return res.status(404).json({ error: 'CUIT no encontrado en el padrón' });
  }

  return res.status(200).json({ mensaje: 'Contribuyente eliminado con éxito', cuit });
});

// GET /arba/percepciones - Historial de percepciones registradas
app.get('/arba/percepciones', (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '50', 10);
  const resultado = db.listPercepciones({ page, limit });
  return res.status(200).json(resultado);
});

// POST /arba/seed/reset - Restablecer datos a la semilla inicial
app.post('/arba/seed/reset', (req, res) => {
  const inicial = db.resetSeed();
  return res.status(200).json({ mensaje: 'Datos restablecidos a la semilla inicial', total: inicial.padron.length });
});

// POST /arba/percepciones - Calcula y registra la percepción de IIBB para una venta
app.post('/arba/percepciones', (req, res) => {
  const { id_venta, cuit, monto_venta } = req.body || {};

  if (!validarIdVenta(id_venta)) {
    return res.status(400).json({ error: 'id_venta es requerido y debe ser string no vacío' });
  }

  if (!validarCuit(cuit)) {
    return res.status(400).json({ error: 'cuit debe ser un string de 11 dígitos' });
  }

  if (!validarMonto(monto_venta)) {
    return res.status(400).json({ error: 'monto_venta es requerido y debe ser un número mayor a 0' });
  }

  const montoVenta = round2(monto_venta);

  // Manejo de idempotencia por id_venta
  const existente = db.getPercepcionByIdVenta(id_venta);
  if (existente) {
    // Si la solicitud repite la misma clave con idénticos datos -> 200 OK idempotente
    const mismoCuit = existente.cuit === cuit;
    const mismoMonto = Math.abs(existente.monto_venta - montoVenta) < 0.001;

    if (mismoCuit && mismoMonto) {
      return res.status(200).json(existente);
    }

    // Misma clave con otros datos -> 409 Conflict
    return res.status(409).json({ error: 'Conflicto: id_venta ya existe con otros datos' });
  }

  // Verificación en el padrón fiscal
  const contribuyente = db.getPadronByCuit(cuit);
  if (!contribuyente) {
    return res.status(404).json({ error: 'CUIT no encontrado en el padrón' });
  }

  // Cálculo de la percepción
  const montoPercepcion = round2(montoVenta * contribuyente.alicuota);
  const fecha = new Date().toISOString();

  const nuevaPercepcion = {
    id: `percepcion-${randomUUID().slice(0, 8)}`,
    id_venta,
    cuit,
    monto_venta: montoVenta,
    alicuota_aplicada: contribuyente.alicuota,
    monto_percepcion: montoPercepcion,
    fecha,
  };

  db.createPercepcion(nuevaPercepcion);
  return res.status(201).json(nuevaPercepcion);
});

// Middleware 404 para rutas no definidas
app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' });
});

// Manejador centralizado de errores
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON malformado en el cuerpo de la solicitud' });
  }
  console.error('[ARBA Error]:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Configuración de puerto (Normativo de cátedra: 3003)
if (require.main === module) {
  const PORT = process.env.PORT || 3003;
  app.listen(PORT, () => {
    console.log(`[ARBA Lucas-P] Servicio iniciado y escuchando en el puerto ${PORT}`);
  });
}

module.exports = app;

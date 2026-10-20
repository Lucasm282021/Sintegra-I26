/**
 * Vercel Serverless Function — API entry point.
 * Uses an in-memory store instead of better-sqlite3 (which requires native
 * binaries that are not available in Vercel's Lambda environment).
 * Self-contained: no imports outside this file.
 */
const express = require('express');

// ─── Inline helpers (mirrors src/validate.js) ────────────────────────────────
function validarCuit(cuit)       { return typeof cuit === 'string' && /^\d{11}$/.test(cuit); }
function validarMonto(monto)     { return typeof monto === 'number' && Number.isFinite(monto) && monto > 0; }
function validarIdVenta(idVenta) { return typeof idVenta === 'string' && idVenta.trim().length > 0; }
function round2(value)           { return Math.round((value + Number.EPSILON) * 100) / 100; }

// ─── In-memory store ────────────────────────────────────────────────────────
const PADRON = [
  { cuit: '30712345678', actividad: 'Comercio minorista',      alicuota: 0.03,  razon_social: 'Comercio Demo Uno' },
  { cuit: '27304567891', actividad: 'Servicios profesionales', alicuota: 0.02,  razon_social: 'Servicios Demo Dos' },
  { cuit: '30556789012', actividad: 'Producción de alimentos', alicuota: 0.015, razon_social: 'Alimentos Demo Tres' },
  { cuit: '20123456789', actividad: 'Librería',                alicuota: 0.03,  razon_social: 'Librería Demo Cuatro' },
  { cuit: '30678901234', actividad: 'Comercio mayorista',      alicuota: 0,     razon_social: 'Mayorista Demo Cinco' },
  { cuit: '20234567890', actividad: 'Comercio minorista',      alicuota: 0.025, razon_social: 'Lopez Maria Victoria' },
  { cuit: '27345678901', actividad: 'Servicios IT',            alicuota: 0.03,  razon_social: 'Fernandez Ana Laura' },
  { cuit: '30456789012', actividad: 'Distribución',            alicuota: 0.02,  razon_social: 'Distribuidora Norte S.R.L.' },
  { cuit: '30567890123', actividad: 'Comercio mayorista',      alicuota: 0.025, razon_social: 'Comercial del Sur S.A.' },
  { cuit: '20678901234', actividad: 'Gastronomía',             alicuota: 0.015, razon_social: 'Martinez Carlos Alberto' },
];

let percepciones = [];
let nextId = 1;

// ─── Express app ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

PADRON.forEach((item) => {
  item.estado = 'activo';
  item.aplicaciones = { arba_iibb: true, arca_facturacion: false };
});

function comercioValido(body) {
  return body && typeof body.razon_social === 'string' && body.razon_social.trim()
    && typeof body.actividad === 'string' && body.actividad.trim()
    && typeof body.alicuota === 'number' && Number.isFinite(body.alicuota)
    && body.alicuota >= 0 && body.alicuota <= 1;
}

function comercioBody(body) {
  return {
    razon_social: body.razon_social.trim(),
    actividad: body.actividad.trim(),
    alicuota: body.alicuota,
    estado: body.estado === 'inactivo' ? 'inactivo' : 'activo',
    aplicaciones: {
      arba_iibb: body.aplicaciones?.arba_iibb !== false,
      arca_facturacion: body.aplicaciones?.arca_facturacion === true,
    },
  };
}

app.get(['/arba/comercios', '/api/arba/comercios'], (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '100', 10);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'paginacion invalida' });
  }
  const start = (page - 1) * limit;
  const items = [...PADRON].sort((a, b) => a.razon_social.localeCompare(b.razon_social)).slice(start, start + limit);
  return res.status(200).json({ page, limit, total: PADRON.length, items });
});

app.post(['/arba/comercios', '/api/arba/comercios'], (req, res) => {
  const { cuit } = req.body || {};
  if (!validarCuit(cuit) || !comercioValido(req.body)) return res.status(400).json({ error: 'datos de comercio invalidos' });
  if (PADRON.some((item) => item.cuit === cuit)) return res.status(409).json({ error: 'cuit ya registrado' });
  const nuevo = { cuit, ...comercioBody(req.body) };
  PADRON.push(nuevo);
  return res.status(201).json(nuevo);
});

app.put(['/arba/comercios/:cuit', '/api/arba/comercios/:cuit'], (req, res) => {
  const row = PADRON.find((item) => item.cuit === req.params.cuit);
  if (!validarCuit(req.params.cuit) || !comercioValido(req.body)) return res.status(400).json({ error: 'datos de comercio invalidos' });
  if (!row) return res.status(404).json({ error: 'comercio no encontrado' });
  Object.assign(row, comercioBody(req.body));
  return res.status(200).json({ ...row });
});

app.delete(['/arba/comercios/:cuit', '/api/arba/comercios/:cuit'], (req, res) => {
  const index = PADRON.findIndex((item) => item.cuit === req.params.cuit);
  if (!validarCuit(req.params.cuit)) return res.status(400).json({ error: 'cuit invalido' });
  if (index < 0) return res.status(404).json({ error: 'comercio no encontrado' });
  PADRON.splice(index, 1);
  return res.status(200).json({ cuit: req.params.cuit });
});

// Health — the client calls /api/health which Vercel rewrites to this function
// Express receives the full path including /api prefix
app.get(['/health', '/api/health'], (req, res) => res.status(200).json({ status: 'ok', servicio: 'arba' }));

// GET /api/arba/padron
app.get(['/arba/padron', '/api/arba/padron'], (req, res) => {
  const page  = parseInt(req.query.page  || '1',  10);
  const limit = parseInt(req.query.limit || '10', 10);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'paginacion invalida' });
  }
  const offset = (page - 1) * limit;
  const items  = PADRON.slice(offset, offset + limit).map(({ cuit, actividad, alicuota, razon_social }) => ({
    cuit, actividad, alicuota, razon_social,
  }));
  return res.status(200).json({ page, limit, total: PADRON.length, items });
});

// GET /api/arba/padron/:cuit
app.get(['/arba/padron/:cuit', '/api/arba/padron/:cuit'], (req, res) => {
  const { cuit } = req.params;
  if (!validarCuit(cuit)) return res.status(400).json({ error: 'cuit invalido' });
  const row = PADRON.find(r => r.cuit === cuit);
  if (!row) return res.status(404).json({ error: 'cuit no encontrado en padron' });
  return res.status(200).json({ cuit: row.cuit, actividad: row.actividad, alicuota: row.alicuota, razon_social: row.razon_social });
});

// POST /api/arba/percepciones
app.post(['/arba/percepciones', '/api/arba/percepciones'], (req, res) => {
  const { id_venta, cuit, monto_venta } = req.body || {};
  if (!validarIdVenta(id_venta))  return res.status(400).json({ error: 'id_venta invalido' });
  if (!validarCuit(cuit))         return res.status(400).json({ error: 'cuit invalido' });
  if (!validarMonto(monto_venta)) return res.status(400).json({ error: 'monto_venta invalido' });

  const existente = percepciones.find(p => p.id_venta === id_venta);
  if (existente) {
    if (existente.cuit !== cuit || Math.abs(existente.monto_venta - round2(monto_venta)) > 0.001) {
      return res.status(409).json({ error: 'id_venta ya existe con otros datos' });
    }
    return res.status(200).json(existente);
  }

  const contribuyente = PADRON.find(r => r.cuit === cuit && r.estado !== 'inactivo' && r.aplicaciones?.arba_iibb !== false);
  if (!contribuyente) return res.status(404).json({ error: 'cuit no encontrado en padron' });

  const nueva = {
    id:               String(nextId++),
    id_venta,
    cuit,
    monto_venta:      round2(monto_venta),
    alicuota_aplicada: contribuyente.alicuota,
    monto_percepcion: round2(monto_venta * contribuyente.alicuota),
    fecha:            new Date().toISOString(),
  };
  percepciones.unshift(nueva);
  return res.status(201).json(nueva);
});

// GET /api/arba/percepciones/:cuit
app.get(['/arba/percepciones/:cuit', '/api/arba/percepciones/:cuit'], (req, res) => {
  const { cuit } = req.params;
  if (!validarCuit(cuit)) return res.status(400).json({ error: 'cuit invalido' });
  const filtradas = percepciones.filter(p => p.cuit === cuit);
  return res.status(200).json({ cuit, cantidad: filtradas.length, percepciones: filtradas });
});

// 404 catch-all
app.use((req, res) => res.status(404).json({ error: 'no encontrado' }));

module.exports = app;

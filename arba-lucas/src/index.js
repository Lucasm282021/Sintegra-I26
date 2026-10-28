const path = require('path');
const fs = require('fs');
const express = require('express');
const { randomUUID } = require('crypto');
const db = require('./db');
const {
  validarCuit,
  validarMonto,
  validarIdVenta,
  validarAlicuota,
  validarActividad,
  validarMontoMinor,
  round2,
} = require('./validate');

/**
 * Módulo ARBA (Lucas P) — API REST de padrón y percepciones de IIBB.
 *
 * Expone dos contratos que comparten la misma lógica y persistencia:
 * - Legado:  /arba/...         → respuestas planas (contrato original de cátedra).
 * - Unificado: /api/v1/arba/... → respuestas envueltas en { data }, sale_id,
 *   importes enteros en centavos (base_amount_minor / tax_amount_minor),
 *   Idempotency-Key y tasa versionada (doc/AJUSTE-ARBA.md).
 */

const RATE_SOURCE = 'padron-simulado-arba-lucas';
const JURISDICCION = 'PBA';
const CURRENCY = 'ARS';

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Idempotency-Key');
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
const healthHandler = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'arba-lucas',
    storage: db.MEMORY_MODE ? 'memory' : 'file',
  });
};
app.get('/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// ─── Helpers de dominio ──────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parsePagination(query, defaultLimit) {
  const page = parseInt(query.page || '1', 10);
  const limit = parseInt(query.limit || String(defaultLimit), 10);
  if (Number.isNaN(page) || page < 1 || Number.isNaN(limit) || limit < 1 || limit > 100) {
    return null;
  }
  return { page, limit };
}

// Representación de la percepción según el contrato unificado v1
function toV1Percepcion(p, { replay = false } = {}) {
  const baseMinor = p.base_amount_minor ?? Math.round(p.monto_venta * 100);
  const taxMinor = p.tax_amount_minor ?? Math.round(p.monto_percepcion * 100);
  return {
    perception_id: p.id,
    sale_id: p.sale_id || p.id_venta,
    cuit: p.cuit,
    rate: p.alicuota_aplicada,
    rate_valid_from: p.rate_valid_from || db.SEED_VALID_FROM,
    rate_source: p.rate_source || RATE_SOURCE,
    base_amount_minor: baseMinor,
    tax_amount_minor: taxMinor,
    currency: p.currency || CURRENCY,
    status: 'calculated',
    idempotent_replay: replay,
    created_at: p.fecha,
  };
}

function toV1Inscripcion(c) {
  return {
    cuit: c.cuit,
    jurisdiccion: JURISDICCION,
    actividad: c.actividad,
    rate: c.alicuota,
    valid_from: c.vigencia_desde || db.SEED_VALID_FROM,
    source: RATE_SOURCE,
  };
}

/**
 * Normaliza la solicitud de percepción aceptando ambos contratos:
 * - Identificador: sale_id | id_venta | header Idempotency-Key.
 * - Importe: base_amount_minor (entero, centavos) | monto_venta (decimal).
 * Devuelve { error } o { saleId, cuit, baseMinor }.
 */
function normalizarSolicitud(body, headers) {
  const { sale_id, id_venta, cuit, monto_venta, base_amount_minor, currency } = body || {};
  const headerKey = headers['idempotency-key'];

  if (sale_id !== undefined && id_venta !== undefined && sale_id !== id_venta) {
    return { error: 'sale_id e id_venta no coinciden' };
  }
  const saleId = sale_id ?? id_venta ?? headerKey;
  if (headerKey && saleId !== headerKey) {
    return { error: 'Idempotency-Key no coincide con sale_id/id_venta' };
  }
  if (!validarIdVenta(saleId)) {
    return { error: 'id_venta (o sale_id) es requerido y debe ser string no vacío' };
  }

  if (!validarCuit(cuit)) {
    return { error: 'cuit debe ser un string de 11 dígitos' };
  }

  if (currency !== undefined && currency !== CURRENCY) {
    return { error: `currency no soportada: solo ${CURRENCY}` };
  }

  let baseMinor;
  if (base_amount_minor !== undefined) {
    if (!validarMontoMinor(base_amount_minor)) {
      return { error: 'base_amount_minor debe ser un entero mayor a 0 (centavos)' };
    }
    baseMinor = base_amount_minor;
  } else {
    if (!validarMonto(monto_venta)) {
      return { error: 'monto_venta es requerido y debe ser un número mayor a 0' };
    }
    baseMinor = Math.round(round2(monto_venta) * 100);
  }

  return { saleId: saleId.trim(), cuit, baseMinor };
}

/**
 * Calcula y registra una percepción con idempotencia estricta por sale_id.
 * Devuelve { status, record, replay } o { status, error }.
 */
function procesarPercepcion({ saleId, cuit, baseMinor }) {
  // Manejo de idempotencia por id_venta / sale_id
  const existente = db.getPercepcionByIdVenta(saleId);
  if (existente) {
    const existenteMinor = existente.base_amount_minor ?? Math.round(existente.monto_venta * 100);
    // Misma clave con idénticos datos -> 200 OK idempotente
    if (existente.cuit === cuit && existenteMinor === baseMinor) {
      return { status: 200, record: existente, replay: true };
    }
    // Misma clave con otros datos -> 409 Conflict
    return { status: 409, error: 'Conflicto: id_venta ya existe con otros datos' };
  }

  // Verificación en el padrón fiscal
  const contribuyente = db.getPadronByCuit(cuit);
  if (!contribuyente) {
    return { status: 404, error: 'CUIT no encontrado en el padrón' };
  }

  // Cálculo en centavos enteros para evitar errores de coma flotante
  const taxMinor = Math.round(baseMinor * contribuyente.alicuota);

  const record = {
    id: `percepcion-${randomUUID().slice(0, 8)}`,
    id_venta: saleId,
    sale_id: saleId,
    cuit,
    monto_venta: baseMinor / 100,
    alicuota_aplicada: contribuyente.alicuota,
    monto_percepcion: taxMinor / 100,
    base_amount_minor: baseMinor,
    tax_amount_minor: taxMinor,
    currency: CURRENCY,
    rate_valid_from: contribuyente.vigencia_desde || db.SEED_VALID_FROM,
    rate_source: RATE_SOURCE,
    fecha: new Date().toISOString(),
  };

  db.createPercepcion(record);
  return { status: 201, record, replay: false };
}

// ─── Router compartido (legado y v1) ─────────────────────────────────────────

function createArbaRouter({ v1 }) {
  const router = express.Router();
  // En v1 las respuestas exitosas se envuelven en { data }. Los errores siempre son { error }.
  const ok = (res, status, payload) => res.status(status).json(v1 ? { data: payload } : payload);
  const fail = (res, status, error) => res.status(status).json({ error });

  // GET /stats - Métricas generales para el Dashboard
  router.get('/stats', (req, res) => ok(res, 200, db.getStats()));

  // GET /padron - Listado paginado de comercios y alícuotas
  router.get('/padron', (req, res) => {
    const pag = parsePagination(req.query, 10);
    if (!pag) return fail(res, 400, 'Parámetros de paginación inválidos');
    return ok(res, 200, db.listPadron(pag));
  });

  // GET /padron/:cuit - Consulta la alícuota y actividad de un CUIT
  router.get('/padron/:cuit', (req, res) => {
    const { cuit } = req.params;
    if (!validarCuit(cuit)) return fail(res, 400, 'cuit debe ser un string de 11 dígitos');

    const contribuyente = db.getPadronByCuit(cuit);
    if (!contribuyente) return fail(res, 404, 'CUIT no encontrado en el padrón');

    if (v1) return ok(res, 200, toV1Inscripcion(contribuyente));
    return ok(res, 200, {
      cuit: contribuyente.cuit,
      actividad: contribuyente.actividad,
      alicuota: contribuyente.alicuota,
    });
  });

  // POST /padron - Alta de un nuevo contribuyente en el padrón
  router.post('/padron', (req, res) => {
    const { cuit, actividad, alicuota } = req.body || {};

    if (!validarCuit(cuit)) return fail(res, 400, 'cuit debe ser un string de 11 dígitos numéricos');
    if (!validarActividad(actividad)) return fail(res, 400, 'actividad es requerida y no debe estar vacía');

    const alicuotaNum = parseFloat(alicuota);
    if (!validarAlicuota(alicuotaNum)) {
      return fail(res, 400, 'alicuota debe ser un número decimal entre 0 y 1 (ej: 0.03 para 3%)');
    }

    const resultado = db.createPadron({
      cuit,
      actividad: actividad.trim(),
      alicuota: alicuotaNum,
      vigencia_desde: today(),
    });
    if (resultado.error) return fail(res, resultado.status, resultado.error);
    return ok(res, 201, resultado.data);
  });

  // PUT /padron/:cuit - Modificación de actividad y/o alícuota
  router.put('/padron/:cuit', (req, res) => {
    const { cuit } = req.params;
    const { actividad, alicuota } = req.body || {};

    if (!validarCuit(cuit)) return fail(res, 400, 'cuit debe ser un string de 11 dígitos');

    const updates = {};
    if (actividad !== undefined) {
      if (!validarActividad(actividad)) return fail(res, 400, 'actividad no debe estar vacía');
      updates.actividad = actividad.trim();
    }
    if (alicuota !== undefined) {
      const alicuotaNum = parseFloat(alicuota);
      if (!validarAlicuota(alicuotaNum)) return fail(res, 400, 'alicuota debe ser un número decimal entre 0 y 1');
      updates.alicuota = alicuotaNum;
    }
    if (Object.keys(updates).length === 0) {
      return fail(res, 400, 'Debe especificar al menos actividad o alicuota para actualizar');
    }

    // Un cambio de alícuota genera una nueva vigencia (tasa versionada)
    const actual = db.getPadronByCuit(cuit);
    if (!actual) return fail(res, 404, 'CUIT no encontrado en el padrón');
    if (updates.alicuota !== undefined && updates.alicuota !== actual.alicuota) {
      updates.vigencia_desde = today();
    }

    return ok(res, 200, db.updatePadron(cuit, updates));
  });

  // DELETE /padron/:cuit - Baja de un contribuyente
  router.delete('/padron/:cuit', (req, res) => {
    const { cuit } = req.params;
    if (!validarCuit(cuit)) return fail(res, 400, 'cuit debe ser un string de 11 dígitos');
    if (!db.deletePadron(cuit)) return fail(res, 404, 'CUIT no encontrado en el padrón');
    return ok(res, 200, { mensaje: 'Contribuyente eliminado con éxito', cuit });
  });

  // GET /percepciones - Historial de percepciones registradas
  router.get('/percepciones', (req, res) => {
    const pag = parsePagination(req.query, 50);
    if (!pag) return fail(res, 400, 'Parámetros de paginación inválidos');
    const resultado = db.listPercepciones(pag);
    if (v1) resultado.items = resultado.items.map((p) => toV1Percepcion(p));
    return ok(res, 200, resultado);
  });

  // GET /percepciones/:cuit - Historial de auditoría de un contribuyente
  router.get('/percepciones/:cuit', (req, res) => {
    const { cuit } = req.params;
    if (!validarCuit(cuit)) return fail(res, 400, 'cuit debe ser un string de 11 dígitos');
    const items = db.listPercepcionesByCuit(cuit);
    return ok(res, 200, { cuit, total: items.length, items: v1 ? items.map((p) => toV1Percepcion(p)) : items });
  });

  // POST /percepciones - Calcula y registra la percepción de IIBB para una venta
  router.post('/percepciones', (req, res) => {
    const solicitud = normalizarSolicitud(req.body, req.headers);
    if (solicitud.error) return fail(res, 400, solicitud.error);

    const resultado = procesarPercepcion(solicitud);
    if (resultado.error) return fail(res, resultado.status, resultado.error);

    const payload = v1 ? toV1Percepcion(resultado.record, { replay: resultado.replay }) : resultado.record;
    return ok(res, resultado.status, payload);
  });

  // POST /seed/reset - Restablecer datos a la semilla inicial
  router.post('/seed/reset', (req, res) => {
    const inicial = db.resetSeed();
    return ok(res, 200, { mensaje: 'Datos restablecidos a la semilla inicial', total: inicial.padron.length });
  });

  return router;
}

function createAuthRouter({ v1 }) {
  const router = express.Router();
  const ok = (res, status, payload) => res.status(status).json(v1 ? { data: payload } : payload);
  const fail = (res, status, error) => res.status(status).json({ error });

  // POST /login
  router.post('/login', (req, res) => {
    const { email, password } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return fail(res, 400, 'Correo electrónico inválido o no provisto');
    }
    if (!password || typeof password !== 'string') {
      return fail(res, 400, 'Contraseña requerida');
    }
    const user = db.findUserByEmail(email);
    if (!user || !db.verifyPassword(password, user.hash, user.salt)) {
      return fail(res, 401, 'Credenciales inválidas');
    }
    const token = Buffer.from(
      JSON.stringify({ id: user.id, email: user.email, rol: user.rol, exp: Date.now() + 24 * 3600 * 1000 })
    ).toString('base64');

    return ok(res, 200, {
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
      },
      token,
      message: 'Inicio de sesión exitoso',
    });
  });

  // POST /register
  router.post('/register', (req, res) => {
    const { nombre, email, password, rol } = req.body || {};
    if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
      return fail(res, 400, 'El nombre debe tener al menos 2 caracteres');
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return fail(res, 400, 'Correo electrónico inválido');
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return fail(res, 400, 'La contraseña debe tener al menos 6 caracteres');
    }
    const rolValido = rol === 'admin' ? 'admin' : 'operador';
    const resultado = db.createUser({ nombre, email, password, rol: rolValido });
    if (resultado.error) return fail(res, resultado.status, resultado.error);

    const token = Buffer.from(
      JSON.stringify({ id: resultado.data.id, email: resultado.data.email, rol: resultado.data.rol, exp: Date.now() + 24 * 3600 * 1000 })
    ).toString('base64');

    return ok(res, 201, {
      user: resultado.data,
      token,
      message: 'Usuario registrado exitosamente',
    });
  });

  // GET /me
  router.get('/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return fail(res, 401, 'Token de autenticación no provisto');
    }
    const rawToken = authHeader.slice(7).trim();
    try {
      const payload = JSON.parse(Buffer.from(rawToken, 'base64').toString('utf-8'));
      if (!payload.id || (payload.exp && payload.exp < Date.now())) {
        return fail(res, 401, 'Sesión expirada o token inválido');
      }
      const user = db.findUserById(payload.id);
      if (!user) return fail(res, 401, 'Usuario no encontrado');
      return ok(res, 200, {
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          rol: user.rol,
        },
      });
    } catch {
      return fail(res, 401, 'Token inválido');
    }
  });

  // POST /logout
  router.post('/logout', (req, res) => {
    return ok(res, 200, { message: 'Sesión cerrada correctamente' });
  });

  return router;
}

app.use('/auth', createAuthRouter({ v1: false }));
app.use('/api/v1/auth', createAuthRouter({ v1: true }));
app.use('/arba', createArbaRouter({ v1: false }));
app.use('/api/v1/arba', createArbaRouter({ v1: true }));

// Fallback SPA para navegación web (compatible con Express 5)
app.use((req, res, next) => {
  if (req.method === 'GET' && req.accepts('html')) {
    const indexPath = path.join(staticDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
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

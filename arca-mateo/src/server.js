const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const app = express();
const PORT = Number(process.env.PORT || 3004);
const DATA_FILE = path.resolve(process.env.ARCA_DATA_FILE || path.join(__dirname, '..', 'data', 'arca.json'));
const rawPuntoVenta = process.env.ARCA_PUNTO_VENTA || '00001';
if (!/^\d{1,5}$/.test(rawPuntoVenta)) throw new Error('ARCA_PUNTO_VENTA debe tener entre 1 y 5 dígitos');
const PUNTO_VENTA = rawPuntoVenta.padStart(5, '0');
// Con ARCA_BACKEND_URL, el padrón fiscal y los comprobantes son los del backend
// común del ecosistema (los mismos que usan los TPV). Usuarios y sesiones siguen
// siendo de esta app. Sin la variable, se usa el archivo JSON local como antes.
const BACKEND = (process.env.ARCA_BACKEND_URL || '').replace(/\/$/, '');
async function backend(metodo, ruta, body) {
  try {
    const r = await fetch(BACKEND + ruta, { method: metodo, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  } catch {
    return { status: 503, body: { error: 'el backend común de ARCA no responde' } };
  }
}
const reciboBackend = (c) => ({ id: c.id, id_venta: c.id_venta, cuit: c.cuit, numero_comprobante: c.numero_comprobante,
  tipo_comprobante: c.tipo_comprobante, monto_total: c.monto_total, cae: c.cae, fecha_emision: c.fecha_emision, estado: c.estado });
const TIPOS = new Set(['FACTURA_A', 'FACTURA_B', 'FACTURA_C']);
const ROLES = new Set(['superadmin', 'admin', 'usuario']);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();
const loginFailures = new Map();
let setupInProgress = false;
const SEED = {
  '30712345678': { cuit: '30712345678', condicion_fiscal: 'Responsable Inscripto' },
  '20301234567': { cuit: '20301234567', condicion_fiscal: 'Monotributista' }
};

function initialStore() {
  return { contribuyentes: { ...SEED }, comprobantes_por_venta: {}, correlativos: {}, usuarios: {} };
}
function loadStore() {
  if (!fs.existsSync(DATA_FILE)) return initialStore();
  const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Archivo ARCA inválido');
  return {
    contribuyentes: { ...SEED, ...(saved.contribuyentes || {}) },
    comprobantes_por_venta: saved.comprobantes_por_venta || {},
    correlativos: saved.correlativos || {},
    usuarios: saved.usuarios || {}
  };
}
let store = loadStore();
// En Vercel el disco es temporal: si está vacío, se crea la cuenta demo de la
// cátedra desde las variables ARCA_ADMIN_EMAIL y ARCA_ADMIN_PASSWORD.
const bootstrapReady = (async () => {
  const email = (process.env.ARCA_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ARCA_ADMIN_PASSWORD || '';
  if (!email || !password || Object.keys(store.usuarios).length > 0) return;
  if (!validGmail(email) || !validPassword(password)) {
    console.error('ARCA_ADMIN_EMAIL/ARCA_ADMIN_PASSWORD inválidos; no se crea la cuenta demo');
    return;
  }
  const id = crypto.randomUUID();
  const user = { id, email, password_hash: await hashPassword(password), rol: 'superadmin', activo: true, creado_en: new Date().toISOString() };
  persistStore({ ...store, usuarios: { [id]: user } });
})();
function persistStore(nextStore) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const temp = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(nextStore, null, 2), 'utf8');
  fs.renameSync(temp, DATA_FILE);
  store = nextStore;
}
function error(res, status, message) { return res.status(status).json({ error: message }); }
function validCuit(value) { return typeof value === 'string' && /^\d{11}$/.test(value); }
function validGmail(value) { return typeof value === 'string' && value.trim().length <= 254 && /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(value.trim()); }
function validPassword(value) { return typeof value === 'string' && value.length >= 10 && value.length <= 128; }
function isLoopbackRequest(req) {
  // En Vercel la conexión llega desde el proxy interno: no se confía en ella.
  if (process.env.VERCEL) return false;
  const address = req.socket.remoteAddress || '';
  return address === '::1' || address === '127.0.0.1' || address.startsWith('::ffff:127.');
}
function validSetupToken(candidate) {
  const expected = process.env.ARCA_SETUP_TOKEN || '';
  if (!expected || typeof candidate !== 'string') return false;
  const receivedBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}
function publicUser(user) {
  return { id: user.id, email: user.email, rol: user.rol, activo: user.activo, creado_en: user.creado_en };
}
function scrypt(password, salt) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key))));
}
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
async function verifyPassword(password, encoded) {
  const [algorithm, saltHex, hashHex] = String(encoded || '').split('$');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/i.test(saltHex || '') || !/^[a-f0-9]{128}$/i.test(hashHex || '')) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'));
  return crypto.timingSafeEqual(actual, expected);
}
function requestSessionToken(req) {
  const cookie = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith('arca_session='));
  return cookie ? cookie.slice('arca_session='.length) : '';
}
function requireAuth(req, res, next) {
  const token = requestSessionToken(req);
  const session = sessions.get(token);
  if (!session) return error(res, 401, 'Iniciá sesión para continuar');
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return error(res, 401, 'La sesión venció; iniciá sesión nuevamente');
  }
  const user = store.usuarios[session.userId];
  if (!user || !user.activo) {
    sessions.delete(token);
    return error(res, 401, 'La cuenta está inactiva o ya no existe');
  }
  req.user = user;
  req.sessionToken = token;
  return next();
}
function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user.rol)
    ? next()
    : error(res, 403, 'No tenés permisos para realizar esta acción');
}
function setSessionCookie(res, token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `arca_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeconds}${secure}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'arca_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
}
function publicReceipt(r) {
  return {
    id: r.id, id_venta: r.id_venta, cuit: r.cuit,
    numero_comprobante: r.numero_comprobante, tipo_comprobante: r.tipo_comprobante,
    monto_total: r.monto_total, cae: r.cae, fecha_emision: r.fecha_emision, estado: r.estado
  };
}

app.use((_req, _res, next) => bootstrapReady.then(() => next(), next));
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', servicio: 'arca' }));

app.get('/auth/status', (_req, res) => res.status(200).json({ setup_required: Object.keys(store.usuarios).length === 0 }));

app.post('/auth/setup', async (req, res) => {
  if (!isLoopbackRequest(req) && !validSetupToken(req.body?.setup_token)) return error(res, 403, 'La configuración inicial solo se permite desde el equipo local o con ARCA_SETUP_TOKEN');
  if (Object.keys(store.usuarios).length > 0 || setupInProgress) return error(res, 409, 'La configuración inicial ya fue completada');
  const { email, password } = req.body || {};
  if (!validGmail(email)) return error(res, 400, 'Usá una dirección @gmail.com válida');
  if (!validPassword(password)) return error(res, 400, 'La contraseña propia de ARCA debe tener entre 10 y 128 caracteres');
  setupInProgress = true;
  try {
    const id = crypto.randomUUID();
    const user = { id, email: email.trim().toLowerCase(), password_hash: await hashPassword(password), rol: 'superadmin', activo: true, creado_en: new Date().toISOString() };
    const nextStore = { ...store, usuarios: { ...store.usuarios, [id]: user } };
    persistStore(nextStore);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { userId: id, expiresAt: Date.now() + SESSION_TTL_MS });
    setSessionCookie(res, token, SESSION_TTL_MS / 1000);
    return res.status(201).json({ usuario: publicUser(user) });
  } finally {
    setupInProgress = false;
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!validGmail(email) || typeof password !== 'string') return error(res, 401, 'Correo o contraseña incorrectos');
  const normalizedEmail = email.trim().toLowerCase();
  const attemptKey = `${req.socket.remoteAddress || 'local'}:${normalizedEmail}`;
  const attempts = loginFailures.get(attemptKey);
  if (attempts?.lockedUntil > Date.now()) return error(res, 429, 'Demasiados intentos; esperá un minuto antes de volver a probar');
  const user = Object.values(store.usuarios).find((candidate) => candidate.email === normalizedEmail);
  if (!user || !user.activo || !(await verifyPassword(password, user.password_hash))) {
    const next = { count: (attempts?.count || 0) + 1, lockedUntil: 0 };
    if (next.count >= 5) next.lockedUntil = Date.now() + 60 * 1000;
    loginFailures.set(attemptKey, next);
    return error(res, next.lockedUntil ? 429 : 401, next.lockedUntil ? 'Demasiados intentos; esperá un minuto antes de volver a probar' : 'Correo o contraseña incorrectos');
  }
  loginFailures.delete(attemptKey);
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  for (const [key, session] of sessions) if (session.expiresAt <= now) sessions.delete(key);
  sessions.set(token, { userId: user.id, expiresAt: now + SESSION_TTL_MS });
  setSessionCookie(res, token, SESSION_TTL_MS / 1000);
  return res.status(200).json({ usuario: publicUser(user) });
});

app.post('/auth/logout', (req, res) => {
  const token = requestSessionToken(req);
  if (token) sessions.delete(token);
  clearSessionCookie(res);
  return res.status(200).json({ mensaje: 'Sesión cerrada' });
});

app.get('/auth/me', requireAuth, (req, res) => res.status(200).json({ usuario: publicUser(req.user) }));

app.post('/auth/password', requireAuth, async (req, res) => {
  const { current_password, password } = req.body || {};
  if (typeof current_password !== 'string' || !(await verifyPassword(current_password, req.user.password_hash))) return error(res, 401, 'La contraseña actual es incorrecta');
  if (!validPassword(password)) return error(res, 400, 'La contraseña propia de ARCA debe tener entre 10 y 128 caracteres');
  const updated = { ...req.user, password_hash: await hashPassword(password) };
  persistStore({ ...store, usuarios: { ...store.usuarios, [updated.id]: updated } });
  for (const [token, session] of sessions) if (session.userId === updated.id) sessions.delete(token);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: updated.id, expiresAt: Date.now() + SESSION_TTL_MS });
  setSessionCookie(res, token, SESSION_TTL_MS / 1000);
  return res.status(200).json({ usuario: publicUser(updated) });
});

app.get('/admin/users', requireAuth, requireRole('superadmin', 'admin'), (_req, res) => {
  const usuarios = Object.values(store.usuarios).map(publicUser).sort((a, b) => a.email.localeCompare(b.email));
  return res.status(200).json({ usuarios });
});

app.post('/admin/users', requireAuth, requireRole('superadmin', 'admin'), async (req, res) => {
  const { email, password } = req.body || {};
  const rol = req.user.rol === 'superadmin' ? req.body?.rol : 'usuario';
  if (!validGmail(email)) return error(res, 400, 'Usá una dirección @gmail.com válida');
  if (!validPassword(password)) return error(res, 400, 'La contraseña propia de ARCA debe tener entre 10 y 128 caracteres');
  if (!ROLES.has(rol)) return error(res, 400, 'Rol inválido');
  const normalizedEmail = email.trim().toLowerCase();
  if (Object.values(store.usuarios).some((user) => user.email === normalizedEmail)) return error(res, 409, 'Ya existe una cuenta con ese correo');
  const passwordHash = await hashPassword(password);
  if (Object.values(store.usuarios).some((user) => user.email === normalizedEmail)) return error(res, 409, 'Ya existe una cuenta con ese correo');
  const id = crypto.randomUUID();
  const user = { id, email: normalizedEmail, password_hash: passwordHash, rol, activo: true, creado_en: new Date().toISOString() };
  persistStore({ ...store, usuarios: { ...store.usuarios, [id]: user } });
  return res.status(201).json({ usuario: publicUser(user) });
});

app.patch('/admin/users/:id', requireAuth, requireRole('superadmin', 'admin'), (req, res) => {
  const user = store.usuarios[req.params.id];
  if (!user) return error(res, 404, 'Usuario no encontrado');
  const { rol, activo } = req.body || {};
  if (activo !== undefined && typeof activo !== 'boolean') return error(res, 400, 'activo debe ser booleano');
  if (rol !== undefined && !ROLES.has(rol)) return error(res, 400, 'Rol inválido');
  if (req.user.rol === 'admin' && (user.rol !== 'usuario' || rol !== undefined)) return error(res, 403, 'El admin solo puede activar o desactivar cuentas de usuario');
  if (req.user.rol === 'admin' && rol !== undefined) return error(res, 403, 'El admin no puede cambiar roles');
  if (req.user.rol === 'superadmin' && user.rol === 'superadmin' && (rol !== undefined && rol !== 'superadmin' || activo === false)) {
    const activeSuperadmins = Object.values(store.usuarios).filter((candidate) => candidate.rol === 'superadmin' && candidate.activo).length;
    if (activeSuperadmins <= 1) return error(res, 409, 'Debe quedar al menos un superadmin activo');
  }
  const updated = { ...user, ...(rol === undefined ? {} : { rol }), ...(activo === undefined ? {} : { activo }) };
  persistStore({ ...store, usuarios: { ...store.usuarios, [user.id]: updated } });
  return res.status(200).json({ usuario: publicUser(updated) });
});

app.post('/admin/users/:id/password', requireAuth, requireRole('superadmin', 'admin'), async (req, res) => {
  const user = store.usuarios[req.params.id];
  if (!user) return error(res, 404, 'Usuario no encontrado');
  if (user.id === req.user.id) return error(res, 409, 'Usá el cambio de clave de perfil para tu propia cuenta');
  if (req.user.rol === 'admin' && user.rol !== 'usuario') return error(res, 403, 'El admin solo puede restablecer claves de cuentas comunes');
  const { password } = req.body || {};
  if (!validPassword(password)) return error(res, 400, 'La contraseña propia de ARCA debe tener entre 10 y 128 caracteres');
  const updated = { ...user, password_hash: await hashPassword(password) };
  persistStore({ ...store, usuarios: { ...store.usuarios, [user.id]: updated } });
  for (const [token, session] of sessions) if (session.userId === user.id) sessions.delete(token);
  return res.status(200).json({ usuario: publicUser(updated) });
});

app.get('/arca/contribuyentes/:cuit', requireAuth, async (req, res) => {
  const { cuit } = req.params;
  if (!validCuit(cuit)) return error(res, 400, 'El cuit debe ser un string de 11 dígitos, sin puntos ni guiones');
  if (BACKEND) {
    const r = await backend('GET', `/arca/contribuyentes/${cuit}`);
    if (r.status !== 200) return error(res, r.status, r.status === 404 ? 'Contribuyente no encontrado' : r.body.error);
    return res.status(200).json({ cuit: r.body.cuit, condicion_fiscal: r.body.condicion_fiscal, razon_social: r.body.razon_social });
  }
  const contributor = store.contribuyentes[cuit];
  if (!contributor) return error(res, 404, 'Contribuyente no encontrado');
  return res.status(200).json(contributor);
});

// ---------- Trámites ante ARCA (padrón fiscal común) ----------
const ADMINS = requireRole('superadmin', 'admin');
const soloBackend = (res) => error(res, 503, 'Disponible cuando ARCA trabaja con el backend común (ARCA_BACKEND_URL)');
const reenviar = async (res, metodo, ruta, body) => {
  const r = await backend(metodo, ruta, body);
  return res.status(r.status).json(r.status >= 400 ? { error: r.body.error || 'No se pudo completar la operación' } : r.body);
};

// Ficha del comercio en todo el ecosistema (ARBA, Municipio, Banco, Billetera).
app.get('/arca/ficha/:cuit', requireAuth, async (req, res) => {
  if (!validCuit(req.params.cuit)) return error(res, 400, 'El cuit debe tener 11 dígitos');
  if (!BACKEND) return soloBackend(res);
  return reenviar(res, 'GET', `/padron/contribuyentes/${req.params.cuit}`);
});

// Padrón general: lo inscripto en ARCA más los comercios cargados en «Comercios · Alta única»
// que todavía esperan su inscripción.
app.get('/arca/padron-general', requireAuth, async (req, res) => {
  if (!BACKEND) return soloBackend(res);
  return reenviar(res, 'GET', `/padron/general?buscar=${encodeURIComponent(String(req.query.buscar || '').slice(0, 60))}`);
});
app.get('/arca/padron-general/:cuit', requireAuth, async (req, res) => {
  if (!validCuit(req.params.cuit)) return error(res, 400, 'El cuit debe tener 11 dígitos');
  if (!BACKEND) return soloBackend(res);
  return reenviar(res, 'GET', `/padron/general/${req.params.cuit}`);
});

// Inscripción de un contribuyente (alta de CUIT en el padrón fiscal).
app.post('/arca/contribuyentes', requireAuth, ADMINS, async (req, res) => {
  const b = req.body || {};
  if (!validCuit(b.cuit)) return error(res, 400, 'El cuit debe tener 11 dígitos');
  if (!BACKEND) return soloBackend(res);
  return reenviar(res, 'POST', '/arca/contribuyentes', { cuit: b.cuit, razon_social: b.razon_social,
    condicion_iva: b.condicion_iva, tipo_persona: b.tipo_persona, domicilio_fiscal: b.domicilio_fiscal });
});

// Puntos de venta habilitados para facturar.
app.get('/arca/puntos-venta', requireAuth, async (req, res) => {
  if (!validCuit(req.query.cuit)) return error(res, 400, 'Indicá el cuit (11 dígitos)');
  if (!BACKEND) return soloBackend(res);
  return reenviar(res, 'GET', `/arca/puntos-venta?cuit=${req.query.cuit}`);
});
app.post('/arca/puntos-venta', requireAuth, ADMINS, async (req, res) => {
  const b = req.body || {};
  if (!validCuit(b.cuit)) return error(res, 400, 'El cuit debe tener 11 dígitos');
  if (!BACKEND) return soloBackend(res);
  return reenviar(res, 'POST', '/arca/puntos-venta', { cuit: b.cuit, punto_venta: Number(b.punto_venta) });
});

app.post('/arca/comprobantes', requireAuth, async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return error(res, 400, 'El cuerpo debe ser un objeto JSON');
  const allowed = new Set(['id_venta', 'cuit', 'monto_total', 'tipo_comprobante']);
  if (Object.keys(req.body).some((key) => !allowed.has(key))) return error(res, 400, 'El request contiene campos no admitidos');
  const { id_venta, cuit, monto_total, tipo_comprobante } = req.body;
  if (typeof id_venta !== 'string' || id_venta.trim() === '') return error(res, 400, 'id_venta es obligatorio y debe ser un string no vacío');
  if (!validCuit(cuit)) return error(res, 400, 'cuit debe ser un string de 11 dígitos, sin puntos ni guiones');
  if (typeof monto_total !== 'number' || !Number.isFinite(monto_total) || monto_total <= 0) return error(res, 400, 'monto_total debe ser un número positivo');
  const centsFloat = monto_total * 100;
  const cents = Math.round(centsFloat);
  if (!Number.isSafeInteger(cents) || Math.abs(centsFloat - cents) > 1e-8) {
    return error(res, 400, 'monto_total debe tener hasta dos decimales y estar dentro del rango admitido');
  }
  if (typeof tipo_comprobante !== 'string' || !TIPOS.has(tipo_comprobante)) return error(res, 400, 'tipo_comprobante debe ser FACTURA_A, FACTURA_B o FACTURA_C');
  if (BACKEND) {
    const saleId = id_venta.trim();
    const propio = store.comprobantes_por_venta[saleId];
    if (propio && req.user.rol === 'usuario' && propio.owner_user_id !== req.user.id) return error(res, 404, 'Comprobante no encontrado');
    const r = await backend('POST', '/arca/comprobantes', { id_venta: saleId, cuit, monto_total, tipo_comprobante, punto_venta: Number(PUNTO_VENTA) });
    if (r.status !== 200 && r.status !== 201) return error(res, r.status, r.body.error || 'No se pudo emitir el comprobante');
    // Se recuerda quién lo emitió para que un usuario común vea solo los suyos.
    if (!propio) persistStore({ ...store, comprobantes_por_venta: { ...store.comprobantes_por_venta,
      [saleId]: { id_venta: saleId, numero_comprobante: r.body.numero_comprobante, tipo_comprobante, owner_user_id: req.user.id } } });
    return res.status(r.status).json(reciboBackend(r.body));
  }
  if (!store.contribuyentes[cuit]) return error(res, 404, 'Contribuyente no encontrado');

  const saleId = id_venta.trim();
  const fingerprint = JSON.stringify({ cuit, cents, tipo_comprobante });
  const old = store.comprobantes_por_venta[saleId];
  if (old) {
    if (req.user.rol === 'usuario' && old.owner_user_id !== req.user.id) return error(res, 404, 'Comprobante no encontrado');
    if (old.huella !== fingerprint) return error(res, 409, 'id_venta ya fue usada con datos diferentes');
    return res.status(200).json(publicReceipt(old));
  }

  const series = `${PUNTO_VENTA}:${tipo_comprobante}`;
  const nextNumber = (store.correlativos[series] || 0) + 1;
  const record = {
    id: crypto.randomUUID(), id_venta: saleId, cuit,
    numero_comprobante: String(nextNumber).padStart(8, '0'), tipo_comprobante,
    monto_total: Number((cents / 100).toFixed(2)),
    cae: `FICTICIO-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
    fecha_emision: new Date().toISOString(), estado: 'emitido',
    punto_venta: PUNTO_VENTA, huella: fingerprint, owner_user_id: req.user.id
  };
  const nextStore = {
    ...store,
    correlativos: { ...store.correlativos, [series]: nextNumber },
    comprobantes_por_venta: { ...store.comprobantes_por_venta, [saleId]: record }
  };
  persistStore(nextStore);
  return res.status(201).json(publicReceipt(record));
});

// Consulta aditiva tomada del handbook ARCA v2; los filtros resuelven series homónimas.
app.get('/arca/comprobantes/:numero', requireAuth, async (req, res) => {
  const { numero } = req.params;
  if (!/^\d{8}$/.test(numero)) return error(res, 400, 'numero debe tener 8 dígitos');
  const filters = req.query;
  if (Object.keys(filters).some((k) => !['cuit', 'tipo', 'pv'].includes(k))) return error(res, 400, 'Filtros admitidos: cuit, tipo y pv');
  if (filters.cuit !== undefined && !validCuit(filters.cuit)) return error(res, 400, 'El filtro cuit debe tener 11 dígitos');
  if (filters.tipo !== undefined && !TIPOS.has(filters.tipo)) return error(res, 400, 'El filtro tipo debe ser FACTURA_A, FACTURA_B o FACTURA_C');
  if (filters.pv !== undefined && !/^\d{1,5}$/.test(filters.pv)) return error(res, 400, 'El filtro pv debe tener entre 1 y 5 dígitos');
  if (BACKEND) {
    const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== undefined));
    const r = await backend('GET', `/arca/comprobantes/${Number(numero)}?${q}`);
    if (r.status !== 200) return error(res, r.status, r.status === 404 ? 'Comprobante no encontrado' : r.body.error);
    if (req.user.rol === 'usuario' && store.comprobantes_por_venta[r.body.id_venta]?.owner_user_id !== req.user.id) return error(res, 404, 'Comprobante no encontrado');
    return res.status(200).json(reciboBackend(r.body));
  }
  const matches = Object.values(store.comprobantes_por_venta).filter((r) => (
    r.numero_comprobante === numero
    && (req.user.rol !== 'usuario' || r.owner_user_id === req.user.id)
    && (filters.cuit === undefined || r.cuit === filters.cuit)
    && (filters.tipo === undefined || r.tipo_comprobante === filters.tipo)
    && (filters.pv === undefined || r.punto_venta === filters.pv.padStart(5, '0'))
  ));
  if (matches.length === 0) return error(res, 404, 'Comprobante no encontrado');
  if (matches.length > 1) return error(res, 409, 'Número ambiguo; indique filtros tipo y/o pv');
  return res.status(200).json(publicReceipt(matches[0]));
});

app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) return error(res, 400, 'JSON inválido');
  console.error('Error interno ARCA:', err.message);
  return error(res, 500, 'Error interno');
});
app.use((_req, res) => error(res, 404, 'Ruta no encontrada'));

if (require.main === module) {
  app.listen(PORT, () => console.log(`ARCA simulado escuchando en http://localhost:${PORT}`));
}
module.exports = { app };

/**
 * Motor Demo — simulación 100 % en el navegador del backend ARBA.
 *
 * Replica las reglas de negocio de src/index.js (validaciones, cálculo en centavos,
 * idempotencia por id_venta, 404/409/400) sin hacer solicitudes de red.
 * Los datos se guardan en localStorage para sobrevivir recargas de página.
 *
 * Todas las funciones devuelven { status, data } con la misma forma que la API legada (/arba/...).
 */

const STORAGE_KEY = 'arba_lucas_demo_v1';
const SEED_VALID_FROM = '2026-01-01';
const RATE_SOURCE = 'padron-simulado-arba-lucas';
const LATENCY_MS = 180;

const SEED_PADRON = [
  { cuit: '30712345678', actividad: 'Comercio minorista', alicuota: 0.03, vigencia_desde: SEED_VALID_FROM },
  { cuit: '20345678901', actividad: 'Venta al por menor', alicuota: 0.035, vigencia_desde: SEED_VALID_FROM },
  { cuit: '27123456789', actividad: 'Servicios profesionales', alicuota: 0.02, vigencia_desde: SEED_VALID_FROM },
  { cuit: '20456789012', actividad: 'Industria manufacturera', alicuota: 0.025, vigencia_desde: SEED_VALID_FROM },
  { cuit: '23987654321', actividad: 'Servicios financieros', alicuota: 0.05, vigencia_desde: SEED_VALID_FROM },
  { cuit: '30678901234', actividad: 'Comercio mayorista (exento)', alicuota: 0, vigencia_desde: SEED_VALID_FROM },
];

const SEED_USERS = [
  {
    id: 'demo-admin-1',
    email: 'admin@arba.demo',
    nombre: 'Administrador ARBA',
    rol: 'admin',
    password: 'admin123',
  },
  {
    id: 'demo-operador-1',
    email: 'operador@arba.demo',
    nombre: 'Operador de Turno',
    rol: 'operador',
    password: 'operador123',
  },
];

// ─── Persistencia local ──────────────────────────────────────────────────────

function freshSeed() {
  return {
    padron: SEED_PADRON.map((p) => ({ ...p })),
    percepciones: [],
    usuarios: SEED_USERS.map((u) => ({ ...u })),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.padron) && Array.isArray(parsed.percepciones)) {
        if (!Array.isArray(parsed.usuarios)) parsed.usuarios = SEED_USERS.map((u) => ({ ...u }));
        return parsed;
      }
    }
  } catch {
    /* datos corruptos: se reinicializa con la semilla */
  }
  const seed = freshSeed();
  save(seed);
  return seed;
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ─── Validaciones (espejo de src/validate.js) ────────────────────────────────

const validarCuit = (c) => typeof c === 'string' && /^\d{11}$/.test(c);
const validarMonto = (m) => typeof m === 'number' && Number.isFinite(m) && m > 0;
const validarIdVenta = (id) => typeof id === 'string' && id.trim().length > 0;
const validarAlicuota = (a) => typeof a === 'number' && Number.isFinite(a) && a >= 0 && a <= 1;
const validarActividad = (a) => typeof a === 'string' && a.trim().length > 0;
const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const today = () => new Date().toISOString().slice(0, 10);

const delay = () => new Promise((r) => setTimeout(r, LATENCY_MS));
const reply = async (status, data) => {
  await delay();
  return { status, data };
};
const randomId = () =>
  (globalThis.crypto?.randomUUID?.() || Math.random().toString(16).slice(2) + Date.now().toString(16)).slice(0, 8);

// ─── Operaciones ─────────────────────────────────────────────────────────────

export async function health() {
  return reply(200, { status: 'ok', service: 'arba-lucas', storage: 'demo-browser' });
}

export async function stats() {
  const { padron, percepciones } = load();
  const totalRecaudado = percepciones.reduce((acc, p) => acc + (p.monto_percepcion || 0), 0);
  const totalVentas = percepciones.reduce((acc, p) => acc + (p.monto_venta || 0), 0);
  const alicuotaPromedio = padron.length ? padron.reduce((acc, p) => acc + (p.alicuota || 0), 0) / padron.length : 0;
  return reply(200, {
    totalContribuyentes: padron.length,
    totalPercepciones: percepciones.length,
    totalRecaudado: round2(totalRecaudado),
    totalVentas: round2(totalVentas),
    alicuotaPromedio: Math.round((alicuotaPromedio + Number.EPSILON) * 10000) / 10000,
  });
}

export async function listPadron(page = 1, limit = 10) {
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return reply(400, { error: 'Parámetros de paginación inválidos' });
  }
  const sorted = [...load().padron].sort((a, b) => a.cuit.localeCompare(b.cuit));
  const offset = (page - 1) * limit;
  return reply(200, { page, limit, total: sorted.length, items: sorted.slice(offset, offset + limit) });
}

export async function getPadron(cuit) {
  if (!validarCuit(cuit)) return reply(400, { error: 'cuit debe ser un string de 11 dígitos' });
  const c = load().padron.find((p) => p.cuit === cuit);
  if (!c) return reply(404, { error: 'CUIT no encontrado en el padrón' });
  return reply(200, { cuit: c.cuit, actividad: c.actividad, alicuota: c.alicuota });
}

export async function createPadron({ cuit, actividad, alicuota } = {}) {
  if (!validarCuit(cuit)) return reply(400, { error: 'cuit debe ser un string de 11 dígitos numéricos' });
  if (!validarActividad(actividad)) return reply(400, { error: 'actividad es requerida y no debe estar vacía' });
  const alicuotaNum = parseFloat(alicuota);
  if (!validarAlicuota(alicuotaNum)) {
    return reply(400, { error: 'alicuota debe ser un número decimal entre 0 y 1 (ej: 0.03 para 3%)' });
  }
  const data = load();
  if (data.padron.some((p) => p.cuit === cuit)) return reply(409, { error: 'El CUIT ya existe en el padrón' });
  const nuevo = { cuit, actividad: actividad.trim(), alicuota: alicuotaNum, vigencia_desde: today() };
  data.padron.push(nuevo);
  save(data);
  return reply(201, nuevo);
}

export async function updatePadron(cuit, { actividad, alicuota } = {}) {
  if (!validarCuit(cuit)) return reply(400, { error: 'cuit debe ser un string de 11 dígitos' });
  const updates = {};
  if (actividad !== undefined) {
    if (!validarActividad(actividad)) return reply(400, { error: 'actividad no debe estar vacía' });
    updates.actividad = actividad.trim();
  }
  if (alicuota !== undefined) {
    const alicuotaNum = parseFloat(alicuota);
    if (!validarAlicuota(alicuotaNum)) return reply(400, { error: 'alicuota debe ser un número decimal entre 0 y 1' });
    updates.alicuota = alicuotaNum;
  }
  if (Object.keys(updates).length === 0) {
    return reply(400, { error: 'Debe especificar al menos actividad o alicuota para actualizar' });
  }
  const data = load();
  const item = data.padron.find((p) => p.cuit === cuit);
  if (!item) return reply(404, { error: 'CUIT no encontrado en el padrón' });
  if (updates.alicuota !== undefined && updates.alicuota !== item.alicuota) updates.vigencia_desde = today();
  Object.assign(item, updates);
  save(data);
  return reply(200, item);
}

export async function deletePadron(cuit) {
  if (!validarCuit(cuit)) return reply(400, { error: 'cuit debe ser un string de 11 dígitos' });
  const data = load();
  const before = data.padron.length;
  data.padron = data.padron.filter((p) => p.cuit !== cuit);
  if (data.padron.length === before) return reply(404, { error: 'CUIT no encontrado en el padrón' });
  save(data);
  return reply(200, { mensaje: 'Contribuyente eliminado con éxito', cuit });
}

export async function listPercepciones(page = 1, limit = 50) {
  const sorted = [...load().percepciones].reverse();
  const offset = (page - 1) * limit;
  return reply(200, { page, limit, total: sorted.length, items: sorted.slice(offset, offset + limit) });
}

export async function crearPercepcion({ id_venta, cuit, monto_venta } = {}) {
  if (!validarIdVenta(id_venta)) return reply(400, { error: 'id_venta es requerido y debe ser string no vacío' });
  if (!validarCuit(cuit)) return reply(400, { error: 'cuit debe ser un string de 11 dígitos' });
  if (!validarMonto(monto_venta)) return reply(400, { error: 'monto_venta es requerido y debe ser un número mayor a 0' });

  const saleId = id_venta.trim();
  const baseMinor = Math.round(round2(monto_venta) * 100);
  const data = load();

  // Idempotencia estricta por id_venta
  const existente = data.percepciones.find((p) => p.id_venta === saleId);
  if (existente) {
    if (existente.cuit === cuit && existente.base_amount_minor === baseMinor) return reply(200, existente);
    return reply(409, { error: 'Conflicto: id_venta ya existe con otros datos' });
  }

  const contribuyente = data.padron.find((p) => p.cuit === cuit);
  if (!contribuyente) return reply(404, { error: 'CUIT no encontrado en el padrón' });

  const taxMinor = Math.round(baseMinor * contribuyente.alicuota);
  const record = {
    id: `percepcion-${randomId()}`,
    id_venta: saleId,
    sale_id: saleId,
    cuit,
    monto_venta: baseMinor / 100,
    alicuota_aplicada: contribuyente.alicuota,
    monto_percepcion: taxMinor / 100,
    base_amount_minor: baseMinor,
    tax_amount_minor: taxMinor,
    currency: 'ARS',
    rate_valid_from: contribuyente.vigencia_desde || SEED_VALID_FROM,
    rate_source: RATE_SOURCE,
    fecha: new Date().toISOString(),
    origen: 'demo',
  };
  data.percepciones.push(record);
  save(data);
  return reply(201, record);
}

export async function resetSeed() {
  const seed = freshSeed();
  save(seed);
  return reply(200, { mensaje: 'Datos restablecidos a la semilla inicial', total: seed.padron.length });
}

// ─── Autenticación Demo ──────────────────────────────────────────────────────

export async function login({ email, password } = {}) {
  if (!email || !password) return reply(400, { error: 'Email y contraseña requeridos' });
  const normalized = email.trim().toLowerCase();
  const data = load();
  const user = (data.usuarios || []).find((u) => u.email.toLowerCase() === normalized && u.password === password);
  if (!user) return reply(401, { error: 'Credenciales inválidas' });
  const token = `demo-token-${user.id}-${Date.now()}`;
  return reply(200, {
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
    token,
    message: 'Inicio de sesión exitoso',
  });
}

export async function register({ nombre, email, password, rol = 'operador' } = {}) {
  if (!nombre || nombre.trim().length < 2) return reply(400, { error: 'El nombre debe tener al menos 2 caracteres' });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return reply(400, { error: 'Correo electrónico inválido' });
  if (!password || password.length < 6) return reply(400, { error: 'La contraseña debe tener al menos 6 caracteres' });
  const normalized = email.trim().toLowerCase();
  const data = load();
  if (!Array.isArray(data.usuarios)) data.usuarios = [...SEED_USERS];
  if (data.usuarios.some((u) => u.email.toLowerCase() === normalized)) {
    return reply(409, { error: 'El correo electrónico ya está registrado' });
  }
  const nuevo = {
    id: `demo-user-${randomId()}`,
    nombre: nombre.trim(),
    email: normalized,
    password,
    rol: rol === 'admin' ? 'admin' : 'operador',
    fecha_creacion: new Date().toISOString(),
  };
  data.usuarios.push(nuevo);
  save(data);
  const token = `demo-token-${nuevo.id}-${Date.now()}`;
  return reply(201, {
    user: { id: nuevo.id, nombre: nuevo.nombre, email: nuevo.email, rol: nuevo.rol },
    token,
    message: 'Usuario registrado exitosamente',
  });
}

export async function getMe(token) {
  if (!token) return reply(401, { error: 'Token no provisto' });
  const data = load();
  const match = token.match(/^demo-token-([^-]+(?:-[^-]+)*)-\d+$/);
  const userId = match ? match[1] : null;
  const user = (data.usuarios || []).find((u) => u.id === userId) || (data.usuarios || [])[0];
  if (!user) return reply(401, { error: 'Usuario no encontrado' });
  return reply(200, {
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
  });
}

export async function logout() {
  return reply(200, { message: 'Sesión cerrada correctamente' });
}


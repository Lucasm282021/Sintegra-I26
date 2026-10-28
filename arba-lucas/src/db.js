const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Modo de almacenamiento:
 * - Archivo JSON (por defecto): persistente en data/db.json o DB_PATH.
 * - Memoria: DB_PATH=':memory:' o ejecución en Vercel (filesystem de solo lectura).
 *   Los datos vuelven a la semilla cuando la instancia se reinicia.
 */
const MEMORY_MODE = process.env.DB_PATH === ':memory:' || Boolean(process.env.VERCEL);
const dbPath = MEMORY_MODE ? null : process.env.DB_PATH || path.join(__dirname, '..', 'data', 'db.json');

if (!MEMORY_MODE) {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

let memoryStore = null;

// Funciones criptográficas para contraseñas usando scrypt nativo
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false;
  try {
    const computed = crypto.scryptSync(password, salt, 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

// Semilla de usuarios preconfigurados para cátedra y pruebas
const seedUsuarios = [
  {
    id: 'user-admin-1',
    email: 'admin@arba.demo',
    nombre: 'Administrador ARBA',
    rol: 'admin',
    ...hashPassword('admin123', 'salt-admin-seed-arba'),
    fecha_creacion: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-operador-1',
    email: 'operador@arba.demo',
    nombre: 'Operador de Turno',
    rol: 'operador',
    ...hashPassword('operador123', 'salt-operador-seed-arba'),
    fecha_creacion: '2026-01-01T00:00:00.000Z',
  },
];

/**
 * Padrón semilla determinista con valores simulados para el entorno de prueba.
 * NOTA: Las alícuotas son valores ficticios para propósitos de la simulación
 * y se expresan como fracción decimal (ej: 0.03 equivale al 3%).
 */
const SEED_VALID_FROM = '2026-01-01';

const seedPadron = [
  { cuit: '30712345678', actividad: 'Comercio minorista', alicuota: 0.03, vigencia_desde: SEED_VALID_FROM },
  { cuit: '20345678901', actividad: 'Venta al por menor', alicuota: 0.035, vigencia_desde: SEED_VALID_FROM },
  { cuit: '27123456789', actividad: 'Servicios profesionales', alicuota: 0.02, vigencia_desde: SEED_VALID_FROM },
  { cuit: '20456789012', actividad: 'Industria manufacturera', alicuota: 0.025, vigencia_desde: SEED_VALID_FROM },
  { cuit: '23987654321', actividad: 'Servicios financieros', alicuota: 0.05, vigencia_desde: SEED_VALID_FROM },
];

function freshSeed() {
  return {
    padron: seedPadron.map((p) => ({ ...p })),
    percepciones: [],
    usuarios: seedUsuarios.map((u) => ({ ...u })),
  };
}

function loadData() {
  if (MEMORY_MODE) {
    if (!memoryStore) memoryStore = freshSeed();
    return memoryStore;
  }
  if (!fs.existsSync(dbPath)) {
    const initial = freshSeed();
    fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.usuarios)) {
      parsed.usuarios = seedUsuarios.map((u) => ({ ...u }));
      saveData(parsed);
    }
    return parsed;
  } catch (err) {
    console.error('Error al leer la base de datos local, reinicializando:', err.message);
    const fallback = freshSeed();
    fs.writeFileSync(dbPath, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

function saveData(data) {
  if (MEMORY_MODE) {
    memoryStore = data;
    return;
  }
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
}

function getPadronByCuit(cuit) {
  const data = loadData();
  return data.padron.find((p) => p.cuit === cuit) || null;
}

function listPadron({ page = 1, limit = 10 }) {
  const data = loadData();
  const sorted = [...data.padron].sort((a, b) => a.cuit.localeCompare(b.cuit));
  const total = sorted.length;
  const offset = (page - 1) * limit;
  const items = sorted.slice(offset, offset + limit);
  return { page, limit, total, items };
}

function getPercepcionByIdVenta(id_venta) {
  const data = loadData();
  return data.percepciones.find((p) => p.id_venta === id_venta) || null;
}

function createPercepcion(percepcion) {
  const data = loadData();
  data.percepciones.push(percepcion);
  saveData(data);
  return percepcion;
}

function createPadron({ cuit, actividad, alicuota, vigencia_desde }) {
  const data = loadData();
  const index = data.padron.findIndex((p) => p.cuit === cuit);
  if (index !== -1) {
    return { error: 'El CUIT ya existe en el padrón', status: 409 };
  }
  const nuevo = { cuit, actividad, alicuota, vigencia_desde };
  data.padron.push(nuevo);
  saveData(data);
  return { data: nuevo, status: 201 };
}

function updatePadron(cuit, { actividad, alicuota, vigencia_desde }) {
  const data = loadData();
  const index = data.padron.findIndex((p) => p.cuit === cuit);
  if (index === -1) {
    return null;
  }
  if (actividad !== undefined) data.padron[index].actividad = actividad;
  if (alicuota !== undefined) data.padron[index].alicuota = alicuota;
  if (vigencia_desde !== undefined) data.padron[index].vigencia_desde = vigencia_desde;
  saveData(data);
  return data.padron[index];
}

function deletePadron(cuit) {
  const data = loadData();
  const initialLength = data.padron.length;
  data.padron = data.padron.filter((p) => p.cuit !== cuit);
  if (data.padron.length === initialLength) {
    return false;
  }
  saveData(data);
  return true;
}

function listPercepciones({ page = 1, limit = 50 } = {}) {
  const data = loadData();
  // Ordenar cronológicamente descendente (más recientes primero)
  const sorted = [...(data.percepciones || [])].reverse();
  const total = sorted.length;
  const offset = (page - 1) * limit;
  const items = sorted.slice(offset, offset + limit);
  return { page, limit, total, items };
}

function listPercepcionesByCuit(cuit) {
  const data = loadData();
  return [...(data.percepciones || [])].reverse().filter((p) => p.cuit === cuit);
}

function getStats() {
  const data = loadData();
  const padron = data.padron || [];
  const percepciones = data.percepciones || [];

  const totalContribuyentes = padron.length;
  const totalPercepciones = percepciones.length;
  const totalRecaudado = percepciones.reduce((acc, p) => acc + (p.monto_percepcion || 0), 0);
  const totalVentas = percepciones.reduce((acc, p) => acc + (p.monto_venta || 0), 0);
  const alicuotaPromedio =
    totalContribuyentes > 0
      ? padron.reduce((acc, p) => acc + (p.alicuota || 0), 0) / totalContribuyentes
      : 0;

  return {
    totalContribuyentes,
    totalPercepciones,
    totalRecaudado: Math.round((totalRecaudado + Number.EPSILON) * 100) / 100,
    totalVentas: Math.round((totalVentas + Number.EPSILON) * 100) / 100,
    alicuotaPromedio: Math.round((alicuotaPromedio + Number.EPSILON) * 10000) / 10000,
  };
}

function resetSeed() {
  const initial = freshSeed();
  saveData(initial);
  return initial;
}

function findUserByEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const data = loadData();
  const normalized = email.trim().toLowerCase();
  return (data.usuarios || []).find((u) => u.email.toLowerCase() === normalized) || null;
}

function findUserById(id) {
  if (!id) return null;
  const data = loadData();
  return (data.usuarios || []).find((u) => u.id === id) || null;
}

function createUser({ nombre, email, password, rol = 'operador' }) {
  const data = loadData();
  if (!Array.isArray(data.usuarios)) data.usuarios = [];
  const normalized = email.trim().toLowerCase();
  if (data.usuarios.some((u) => u.email.toLowerCase() === normalized)) {
    return { error: 'El correo electrónico ya está registrado', status: 409 };
  }
  const { hash, salt } = hashPassword(password);
  const nuevo = {
    id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    nombre: nombre.trim(),
    email: normalized,
    rol: rol === 'admin' ? 'admin' : 'operador',
    hash,
    salt,
    fecha_creacion: new Date().toISOString(),
  };
  data.usuarios.push(nuevo);
  saveData(data);
  return {
    data: {
      id: nuevo.id,
      nombre: nuevo.nombre,
      email: nuevo.email,
      rol: nuevo.rol,
      fecha_creacion: nuevo.fecha_creacion,
    },
    status: 201,
  };
}

function listUsers() {
  const data = loadData();
  return (data.usuarios || []).map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    fecha_creacion: u.fecha_creacion,
  }));
}

module.exports = {
  getPadronByCuit,
  listPadron,
  createPadron,
  updatePadron,
  deletePadron,
  getPercepcionByIdVenta,
  createPercepcion,
  listPercepciones,
  listPercepcionesByCuit,
  getStats,
  resetSeed,
  seedPadron,
  SEED_VALID_FROM,
  MEMORY_MODE,
  // Auth & Usuarios
  findUserByEmail,
  findUserById,
  createUser,
  listUsers,
  verifyPassword,
  hashPassword,
  seedUsuarios,
};

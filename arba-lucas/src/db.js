const fs = require('fs');
const path = require('path');

// Ubicación de almacenamiento JSON persistente
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'db.json');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

/**
 * Padrón semilla determinista con valores simulados para el entorno de prueba.
 * NOTA: Las alícuotas son valores ficticios para propósitos de la simulación
 * y se expresan como fracción decimal (ej: 0.03 equivale al 3%).
 */
const seedPadron = [
  { cuit: '30712345678', actividad: 'Comercio minorista', alicuota: 0.03 },
  { cuit: '20345678901', actividad: 'Venta al por menor', alicuota: 0.035 },
  { cuit: '27123456789', actividad: 'Servicios profesionales', alicuota: 0.02 },
  { cuit: '20456789012', actividad: 'Industria manufacturera', alicuota: 0.025 },
  { cuit: '23987654321', actividad: 'Servicios financieros', alicuota: 0.05 },
];

function loadData() {
  if (!fs.existsSync(dbPath)) {
    const initial = { padron: seedPadron, percepciones: [] };
    fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error al leer la base de datos local, reinicializando:', err.message);
    const fallback = { padron: seedPadron, percepciones: [] };
    fs.writeFileSync(dbPath, JSON.stringify(fallback, null, 2), 'utf-8');
    return fallback;
  }
}

function saveData(data) {
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

function createPadron({ cuit, actividad, alicuota }) {
  const data = loadData();
  const index = data.padron.findIndex((p) => p.cuit === cuit);
  if (index !== -1) {
    return { error: 'El CUIT ya existe en el padrón', status: 409 };
  }
  const nuevo = { cuit, actividad, alicuota };
  data.padron.push(nuevo);
  saveData(data);
  return { data: nuevo, status: 201 };
}

function updatePadron(cuit, { actividad, alicuota }) {
  const data = loadData();
  const index = data.padron.findIndex((p) => p.cuit === cuit);
  if (index === -1) {
    return null;
  }
  if (actividad !== undefined) data.padron[index].actividad = actividad;
  if (alicuota !== undefined) data.padron[index].alicuota = alicuota;
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
  const initial = { padron: [...seedPadron], percepciones: [] };
  saveData(initial);
  return initial;
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
  getStats,
  resetSeed,
  seedPadron,
};

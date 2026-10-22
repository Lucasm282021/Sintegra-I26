const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'db.json');
const defaultApplications = { arba_iibb: true, arca_facturacion: false };

// Seed académico ficticio basado en los cinco CUIT y alícuotas ya definidos
// para el módulo de Nehemías. Los nombres son etiquetas de demostración.
const seedPadron = [
  { cuit: '20345678901', razon_social: 'Comercio demo 1', actividad: 'Comercio minorista', alicuota: 0.03 },
  { cuit: '27123456789', razon_social: 'Comercio demo 2', actividad: 'Servicios profesionales', alicuota: 0.02 },
  { cuit: '30712345678', razon_social: 'Comercio demo 3', actividad: 'Gastronomía', alicuota: 0.035 },
  { cuit: '20456789012', razon_social: 'Comercio demo 4', actividad: 'Industria manufacturera', alicuota: 0.025 },
  { cuit: '23987654321', razon_social: 'Comercio demo 5', actividad: 'Servicios financieros', alicuota: 0.05 },
].map((item) => ({
  ...item,
  estado: 'activo',
  aplicaciones: { ...defaultApplications },
}));

function ensureInitialized() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (!fs.existsSync(dbPath)) {
    writeData({ padron: seedPadron, percepciones: [] });
  }
}

function readData() {
  ensureInitialized();
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  if (!Array.isArray(data.padron) || !Array.isArray(data.percepciones)) {
    throw new Error('El archivo de datos ARBA no tiene el formato esperado');
  }
  return data;
}

function writeData(data) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const temporaryPath = `${dbPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temporaryPath, dbPath);
}

function publicPadron(row) {
  return { cuit: row.cuit, actividad: row.actividad, alicuota: row.alicuota };
}

function fullComercio(row) {
  return {
    cuit: row.cuit,
    razon_social: row.razon_social,
    actividad: row.actividad,
    alicuota: row.alicuota,
    estado: row.estado || 'activo',
    aplicaciones: { ...defaultApplications, ...(row.aplicaciones || {}) },
  };
}

function getPadronByCuit(cuit) {
  const row = readData().padron.find((item) => item.cuit === cuit);
  return row ? publicPadron(row) : null;
}

function getComercioByCuit(cuit) {
  const row = readData().padron.find((item) => item.cuit === cuit);
  return row ? fullComercio(row) : null;
}

function listPadron(page, limit) {
  const rows = [...readData().padron].sort((a, b) => a.cuit.localeCompare(b.cuit));
  return {
    page,
    limit,
    total: rows.length,
    items: rows.slice((page - 1) * limit, page * limit).map(publicPadron),
  };
}

function listComercios(page, limit) {
  const rows = [...readData().padron].sort((a, b) => a.razon_social.localeCompare(b.razon_social));
  return {
    page,
    limit,
    total: rows.length,
    items: rows.slice((page - 1) * limit, page * limit).map(fullComercio),
  };
}

function createComercio(comercio) {
  const data = readData();
  if (data.padron.some((row) => row.cuit === comercio.cuit)) return false;
  data.padron.push(comercio);
  writeData(data);
  return true;
}

function updateComercio(cuit, comercio) {
  const data = readData();
  const index = data.padron.findIndex((row) => row.cuit === cuit);
  if (index < 0) return null;
  data.padron[index] = { cuit, ...comercio };
  writeData(data);
  return fullComercio(data.padron[index]);
}

function deleteComercio(cuit) {
  const data = readData();
  const index = data.padron.findIndex((row) => row.cuit === cuit);
  if (index < 0) return false;
  data.padron.splice(index, 1);
  writeData(data);
  return true;
}

function getPercepcionByIdVenta(idVenta) {
  return readData().percepciones.find((row) => row.id_venta === idVenta) || null;
}

function createPercepcion(percepcion) {
  const data = readData();
  data.percepciones.push(percepcion);
  writeData(data);
  return percepcion;
}

function listPercepcionesByCuit(cuit) {
  return readData().percepciones
    .filter((row) => row.cuit === cuit)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

ensureInitialized();

module.exports = {
  createComercio,
  createPercepcion,
  deleteComercio,
  fullComercio,
  getComercioByCuit,
  getPadronByCuit,
  getPercepcionByIdVenta,
  listComercios,
  listPadron,
  listPercepcionesByCuit,
  publicPadron,
  updateComercio,
};

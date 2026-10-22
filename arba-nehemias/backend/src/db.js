const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'db.json');
const DEFAULT_JURISDICTION = 'AR-B';
const DEMO_SOURCE = 'Semilla académica ficticia; no es una fuente fiscal oficial';
const DEMO_VALID_FROM = '2026-01-01';
const defaultApplications = { arba_iibb: true, arca_facturacion: false };

const seedPadron = [
  { cuit: '20345678901', razon_social: 'Comercio demo 1', actividad: 'Comercio minorista', alicuota: 0.03, activity_code: 'DEMO-01' },
  { cuit: '27123456789', razon_social: 'Comercio demo 2', actividad: 'Servicios profesionales', alicuota: 0.02, activity_code: 'DEMO-02' },
  { cuit: '30712345678', razon_social: 'Comercio demo 3', actividad: 'Gastronomía', alicuota: 0.035, activity_code: 'DEMO-03' },
  { cuit: '20456789012', razon_social: 'Comercio demo 4', actividad: 'Industria manufacturera', alicuota: 0.025, activity_code: 'DEMO-04' },
  { cuit: '23987654321', razon_social: 'Comercio demo 5', actividad: 'Servicios financieros', alicuota: 0.05, activity_code: 'DEMO-05' },
];

function emptyData() {
  return { schema_version: 2, comercios: [], inscripciones_iibb: [], alicuotas: [], percepciones: [], usuarios: [] };
}

function buildSeed() {
  const data = emptyData();
  for (const row of seedPadron) {
    const commerceId = `COM-${row.cuit}`;
    data.comercios.push({ commerce_id: commerceId, cuit: row.cuit, razon_social: row.razon_social });
    data.inscripciones_iibb.push({
      id: `IIBB-${row.cuit}`,
      commerce_id: commerceId,
      cuit: row.cuit,
      jurisdiction: DEFAULT_JURISDICTION,
      activity_code: row.activity_code,
      actividad: row.actividad,
      status: 'active',
      is_official: false,
      applications: { ...defaultApplications },
      source: DEMO_SOURCE,
    });
    data.alicuotas.push({
      rate_id: `RATE-${row.cuit}-DEMO-2026-01`,
      cuit: row.cuit,
      jurisdiction: DEFAULT_JURISDICTION,
      rate: row.alicuota,
      valid_from: DEMO_VALID_FROM,
      valid_to: null,
      version: 'DEMO-2026-01',
      source: DEMO_SOURCE,
    });
  }
  return data;
}

function legacyToV2(previous) {
  const data = emptyData();
  data.usuarios = Array.isArray(previous.usuarios) ? previous.usuarios : [];
  const oldPadron = Array.isArray(previous.padron) ? previous.padron : [];
  const oldComercios = Array.isArray(previous.comercios) ? previous.comercios : [];
  const sourceRows = oldPadron.length ? oldPadron : oldComercios;

  for (const [index, row] of sourceRows.entries()) {
    if (!row || typeof row.cuit !== 'string') continue;
    const commerceId = row.commerce_id || `COM-${row.cuit}`;
    const activityCode = row.activity_code || `DEMO-${String(index + 1).padStart(2, '0')}`;
    const inscription = Array.isArray(previous.inscripciones_iibb)
      ? previous.inscripciones_iibb.find((item) => item.cuit === row.cuit)
      : null;
    const rate = Number(row.alicuota ?? row.rate);

    data.comercios.push({
      commerce_id: commerceId,
      cuit: row.cuit,
      razon_social: row.razon_social || `Comercio ${row.cuit}`,
    });
    data.inscripciones_iibb.push({
      id: inscription?.id || `IIBB-${row.cuit}`,
      commerce_id: commerceId,
      cuit: row.cuit,
      jurisdiction: row.jurisdiction || DEFAULT_JURISDICTION,
      activity_code: inscription?.activity_code || activityCode,
      actividad: row.actividad || inscription?.actividad || 'Actividad de demostración',
      status: row.estado === 'inactivo' || inscription?.status === 'inactive' ? 'inactive' : 'active',
      is_official: false,
      applications: { ...defaultApplications, ...(row.aplicaciones || inscription?.applications || {}) },
      source: DEMO_SOURCE,
    });

    if (Array.isArray(previous.alicuotas)) {
      data.alicuotas.push(...previous.alicuotas.filter((item) => item.cuit === row.cuit));
    }
    if (Number.isFinite(rate) && !data.alicuotas.some((item) => item.cuit === row.cuit)) {
      data.alicuotas.push({
        rate_id: `RATE-${row.cuit}-DEMO-2026-01`,
        cuit: row.cuit,
        jurisdiction: row.jurisdiction || DEFAULT_JURISDICTION,
        rate,
        valid_from: DEMO_VALID_FROM,
        valid_to: null,
        version: 'DEMO-2026-01',
        source: DEMO_SOURCE,
      });
    }
  }

  const oldPercepciones = Array.isArray(previous.percepciones) ? previous.percepciones : [];
  for (const item of oldPercepciones) {
    const saleId = item.sale_id || item.id_venta;
    if (!saleId || !item.cuit) continue;
    const rateRow = getRateFromList(data.alicuotas, item.cuit, String(item.fecha || '').slice(0, 10))
      || data.alicuotas.find((rateItem) => rateItem.cuit === item.cuit);
    const rate = Number(item.rate ?? item.alicuota_aplicada ?? rateRow?.rate ?? 0);
    const oldBase = Number(item.monto_venta);
    const baseMinor = Number.isInteger(item.base_amount_minor)
      ? item.base_amount_minor
      : Math.round(oldBase * 100);
    const taxMinor = Number.isInteger(item.tax_amount_minor)
      ? item.tax_amount_minor
      : Math.round(baseMinor * rate);
    data.percepciones.push({
      id: item.id || randomUUID(),
      sale_id: saleId,
      idempotency_key: item.idempotency_key || saleId,
      cuit: item.cuit,
      commerce_id: item.commerce_id || `COM-${item.cuit}`,
      base_amount_minor: baseMinor,
      rate,
      rate_version: item.rate_version || rateRow?.version || 'LEGACY-DEMO',
      rate_valid_from: item.rate_valid_from || rateRow?.valid_from || DEMO_VALID_FROM,
      rate_source: item.rate_source || rateRow?.source || DEMO_SOURCE,
      tax_amount_minor: taxMinor,
      currency: item.currency || 'ARS',
      status: item.status || 'calculated',
      created_at: item.created_at || item.fecha || new Date().toISOString(),
    });
  }
  return data;
}

function ensureInitialized() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (!fs.existsSync(dbPath)) {
    writeData(buildSeed());
  }
}

function writeData(data) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const temporaryPath = `${dbPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temporaryPath, dbPath);
}

function readData() {
  ensureInitialized();
  const stored = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  if (stored.schema_version === 2
    && Array.isArray(stored.comercios)
    && Array.isArray(stored.inscripciones_iibb)
    && Array.isArray(stored.alicuotas)
    && Array.isArray(stored.percepciones)) {
    if (!Array.isArray(stored.usuarios)) {
      stored.usuarios = [];
      writeData(stored);
    }
    return stored;
  }
  const migrated = legacyToV2(stored);
  writeData(migrated);
  return migrated;
}

function getRateFromList(rates, cuit, asOf = new Date().toISOString().slice(0, 10)) {
  return rates
    .filter((item) => item.cuit === cuit && item.valid_from <= asOf && (!item.valid_to || item.valid_to >= asOf))
    .sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0] || null;
}

function getRate(cuit, asOf) {
  return getRateFromList(readData().alicuotas, cuit, asOf);
}

function getInscription(cuit) {
  const data = readData();
  const inscription = data.inscripciones_iibb.find((item) => item.cuit === cuit);
  if (!inscription) return null;
  const commerce = data.comercios.find((item) => item.cuit === cuit);
  const rate = getRateFromList(data.alicuotas, cuit);
  return {
    ...inscription,
    commerce_id: commerce?.commerce_id || inscription.commerce_id,
    razon_social: commerce?.razon_social || null,
    rate: rate ? { value: rate.rate, valid_from: rate.valid_from, valid_to: rate.valid_to, version: rate.version, source: rate.source } : null,
  };
}

function fullComercio(row, inscription, rate) {
  return {
    cuit: row.cuit,
    razon_social: row.razon_social,
    actividad: inscription?.actividad || '',
    alicuota: rate?.rate ?? null,
    estado: inscription?.status === 'inactive' ? 'inactivo' : 'activo',
    aplicaciones: { ...defaultApplications, ...(inscription?.applications || {}) },
  };
}

function publicPadron(row, inscription, rate) {
  return { cuit: row.cuit, actividad: inscription?.actividad || '', alicuota: rate?.rate ?? null };
}

function getPadronByCuit(cuit) {
  const data = readData();
  const row = data.comercios.find((item) => item.cuit === cuit);
  const inscription = data.inscripciones_iibb.find((item) => item.cuit === cuit);
  if (!row || !inscription) return null;
  const rate = getRateFromList(data.alicuotas, cuit);
  return publicPadron(row, inscription, rate);
}

function getComercioByCuit(cuit) {
  const data = readData();
  const row = data.comercios.find((item) => item.cuit === cuit);
  if (!row) return null;
  const inscription = data.inscripciones_iibb.find((item) => item.cuit === cuit);
  const rate = getRateFromList(data.alicuotas, cuit);
  return fullComercio(row, inscription, rate);
}

function listPadron(page, limit) {
  const data = readData();
  const rows = data.comercios
    .filter((row) => data.inscripciones_iibb.some((item) => item.cuit === row.cuit))
    .sort((a, b) => a.cuit.localeCompare(b.cuit));
  return {
    page,
    limit,
    total: rows.length,
    items: rows.slice((page - 1) * limit, page * limit).map((row) => {
      const inscription = data.inscripciones_iibb.find((item) => item.cuit === row.cuit);
      return publicPadron(row, inscription, getRateFromList(data.alicuotas, row.cuit));
    }),
  };
}

function listPadronV1(page, limit) {
  const data = readData();
  const rows = data.comercios
    .map((commerce) => ({ commerce, inscription: data.inscripciones_iibb.find((item) => item.cuit === commerce.cuit) }))
    .filter((item) => item.inscription)
    .sort((a, b) => a.commerce.cuit.localeCompare(b.commerce.cuit));
  return {
    page,
    limit,
    total: rows.length,
    items: rows.slice((page - 1) * limit, page * limit).map(({ commerce, inscription }) => {
      const rate = getRateFromList(data.alicuotas, commerce.cuit);
      return {
        commerce_id: commerce.commerce_id,
        cuit: commerce.cuit,
        razon_social: commerce.razon_social,
        jurisdiction: inscription.jurisdiction,
        activity_code: inscription.activity_code,
        actividad: inscription.actividad,
        enrollment_status: inscription.status,
        is_official: Boolean(inscription.is_official),
        rate: rate ? { value: rate.rate, valid_from: rate.valid_from, valid_to: rate.valid_to, version: rate.version, source: rate.source } : null,
      };
    }),
  };
}

function listComercios(page, limit) {
  const data = readData();
  const rows = [...data.comercios].sort((a, b) => a.razon_social.localeCompare(b.razon_social));
  return {
    page,
    limit,
    total: rows.length,
    items: rows.slice((page - 1) * limit, page * limit).map((row) => fullComercio(
      row,
      data.inscripciones_iibb.find((item) => item.cuit === row.cuit),
      getRateFromList(data.alicuotas, row.cuit),
    )),
  };
}

function createProfile(profile) {
  const data = readData();
  if (data.comercios.some((item) => item.cuit === profile.cuit || item.commerce_id === profile.commerce_id)) return false;
  data.comercios.push({ commerce_id: profile.commerce_id || `COM-${profile.cuit}`, cuit: profile.cuit, razon_social: profile.razon_social });
  writeData(data);
  return true;
}

function updateProfile(cuit, profile) {
  const data = readData();
  const commerce = data.comercios.find((item) => item.cuit === cuit);
  if (!commerce) return null;
  commerce.razon_social = profile.razon_social;
  writeData(data);
  return { ...commerce };
}

function createInscription(enrollment) {
  const data = readData();
  const commerce = data.comercios.find((item) => item.cuit === enrollment.cuit || item.commerce_id === enrollment.commerce_id);
  if (!commerce || data.inscripciones_iibb.some((item) => item.cuit === commerce.cuit)) return false;
  const cuit = commerce.cuit;
  const start = enrollment.valid_from;
  const rate = Number(enrollment.rate);
  const inscription = {
    id: randomUUID(), commerce_id: commerce.commerce_id, cuit,
    jurisdiction: enrollment.jurisdiction, activity_code: enrollment.activity_code,
    actividad: enrollment.actividad, status: enrollment.status || 'active',
    is_official: false, applications: { ...defaultApplications }, source: enrollment.source,
  };
  data.inscripciones_iibb.push(inscription);
  data.alicuotas.push({
    rate_id: randomUUID(), cuit, jurisdiction: enrollment.jurisdiction, rate,
    valid_from: start, valid_to: enrollment.valid_to || null,
    version: enrollment.version || `MANUAL-${start}`,
    source: enrollment.source,
  });
  writeData(data);
  return getInscription(cuit);
}

function updateInscription(cuit, enrollment) {
  const data = readData();
  const inscription = data.inscripciones_iibb.find((item) => item.cuit === cuit);
  if (!inscription) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (enrollment.rate !== undefined) {
    const priorRate = getRateFromList(data.alicuotas, cuit, today);
    const start = enrollment.valid_from || today;
    if (!priorRate || priorRate.rate !== enrollment.rate) {
      const dayBefore = new Date(`${start}T00:00:00Z`);
      if (priorRate) {
        dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
        priorRate.valid_to = dayBefore.toISOString().slice(0, 10);
      }
      data.alicuotas.push({
        rate_id: randomUUID(), cuit, jurisdiction: enrollment.jurisdiction || inscription.jurisdiction,
        rate: enrollment.rate, valid_from: start, valid_to: enrollment.valid_to || null,
        version: enrollment.version || `MANUAL-${start}`, source: enrollment.source || 'Carga manual de demostración académica',
      });
    }
  }
  for (const key of ['jurisdiction', 'activity_code', 'actividad', 'status']) {
    if (enrollment[key] !== undefined) inscription[key] = enrollment[key];
  }
  inscription.is_official = false;
  if (enrollment.source) inscription.source = enrollment.source;
  writeData(data);
  return getInscription(cuit);
}

function createComercio(comercio) {
  const data = readData();
  if (data.comercios.some((row) => row.cuit === comercio.cuit)) return false;
  const commerceId = `COM-${comercio.cuit}`;
  data.comercios.push({ commerce_id: commerceId, cuit: comercio.cuit, razon_social: comercio.razon_social });
  data.inscripciones_iibb.push({
    id: `IIBB-${comercio.cuit}`, commerce_id: commerceId, cuit: comercio.cuit,
    jurisdiction: DEFAULT_JURISDICTION,
    activity_code: 'DEMO-MANUAL', actividad: comercio.actividad,
    status: comercio.estado === 'inactivo' ? 'inactive' : 'active', is_official: false,
    applications: { ...defaultApplications, ...(comercio.aplicaciones || {}) }, source: DEMO_SOURCE,
  });
  if (Number.isFinite(comercio.alicuota)) {
    data.alicuotas.push({
      rate_id: randomUUID(), cuit: comercio.cuit, jurisdiction: DEFAULT_JURISDICTION,
      rate: comercio.alicuota, valid_from: DEMO_VALID_FROM, valid_to: null,
      version: 'DEMO-MANUAL-2026-01', source: DEMO_SOURCE,
    });
  }
  writeData(data);
  return true;
}

function updateComercio(cuit, comercio) {
  const data = readData();
  const profile = data.comercios.find((row) => row.cuit === cuit);
  const inscription = data.inscripciones_iibb.find((row) => row.cuit === cuit);
  if (!profile || !inscription) return null;
  profile.razon_social = comercio.razon_social;
  inscription.actividad = comercio.actividad;
  inscription.status = comercio.estado === 'inactivo' ? 'inactive' : 'active';
  inscription.applications = { ...defaultApplications, ...(comercio.aplicaciones || {}) };
  if (getRateFromList(data.alicuotas, cuit)?.rate !== comercio.alicuota) {
    const today = new Date().toISOString().slice(0, 10);
    const priorRate = getRateFromList(data.alicuotas, cuit, today);
    if (priorRate) {
      const dayBefore = new Date(`${today}T00:00:00Z`);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
      priorRate.valid_to = dayBefore.toISOString().slice(0, 10);
    }
    data.alicuotas.push({
      rate_id: randomUUID(), cuit, jurisdiction: inscription.jurisdiction,
      rate: comercio.alicuota, valid_from: today, valid_to: null,
      version: `MANUAL-${today}`, source: 'Carga manual de demostración académica',
    });
  }
  writeData(data);
  return fullComercio(profile, inscription, getRateFromList(data.alicuotas, cuit));
}

function deleteComercio(cuit) {
  const data = readData();
  const index = data.comercios.findIndex((row) => row.cuit === cuit);
  if (index < 0) return false;
  data.comercios.splice(index, 1);
  data.inscripciones_iibb = data.inscripciones_iibb.filter((row) => row.cuit !== cuit);
  // Conservamos alícuotas históricas y percepciones para auditoría académica.
  writeData(data);
  return true;
}

function getPercepcionByIdVenta(saleId) {
  return readData().percepciones.find((row) => row.sale_id === saleId) || null;
}

function getPercepcionByIdempotencyKey(key) {
  return readData().percepciones.find((row) => row.idempotency_key === key) || null;
}

function countUsers() {
  return readData().usuarios.length;
}

function findUserByEmail(email) {
  return readData().usuarios.find((user) => user.email === email.toLowerCase()) || null;
}

function findUserById(id) {
  return readData().usuarios.find((user) => user.id === id) || null;
}

function createUser(user) {
  const data = readData();
  if (data.usuarios.some((existing) => existing.email === user.email.toLowerCase())) return false;
  if (user.role === 'superadmin' && data.usuarios.some((existing) => existing.role === 'superadmin')) return false;
  data.usuarios.push({ ...user, email: user.email.toLowerCase() });
  writeData(data);
  return true;
}

function listUsers() {
  return readData().usuarios.map(({ password_hash, ...user }) => user);
}

function createPercepcion(percepcion) {
  const data = readData();
  if (data.percepciones.some((row) => row.sale_id === percepcion.sale_id)) return false;
  data.percepciones.push(percepcion);
  writeData(data);
  return percepcion;
}

function listPercepcionesByCuit(cuit) {
  return readData().percepciones
    .filter((row) => row.cuit === cuit)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((row) => ({
      id: row.id, id_venta: row.sale_id, cuit: row.cuit,
      monto_venta: row.base_amount_minor / 100,
      alicuota_aplicada: row.rate,
      monto_percepcion: row.tax_amount_minor / 100,
      fecha: row.created_at,
    }));
}

function listPercepcionesV1ByCuit(cuit) {
  const rows = readData().percepciones
    .filter((row) => row.cuit === cuit)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return rows.map((row) => ({
    reference: row.id, sale_id: row.sale_id, commerce_id: row.commerce_id, cuit: row.cuit,
    rate: row.rate, rate_version: row.rate_version, rate_valid_from: row.rate_valid_from,
    rate_source: row.rate_source, base_amount_minor: row.base_amount_minor,
    tax_amount_minor: row.tax_amount_minor, currency: row.currency,
    status: row.status, created_at: row.created_at,
  }));
}

ensureInitialized();

module.exports = {
  countUsers,
  createComercio,
  createInscription,
  createPercepcion,
  createProfile,
  deleteComercio,
  fullComercio,
  findUserByEmail,
  findUserById,
  getComercioByCuit,
  getInscription,
  getPadronByCuit,
  getPercepcionByIdempotencyKey,
  getPercepcionByIdVenta,
  getRate,
  listComercios,
  listPadron,
  listPadronV1,
  listPercepcionesByCuit,
  listPercepcionesV1ByCuit,
  listUsers,
  createUser,
  updateComercio,
  updateInscription,
  updateProfile,
};

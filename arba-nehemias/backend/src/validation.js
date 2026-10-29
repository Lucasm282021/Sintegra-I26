function isValidCuit(value) {
  return typeof value === 'string' && /^\d{11}$/.test(value);
}

function isValidIdVenta(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidMoney(value) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value > 0
    && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function pageParameters(query, defaultLimit) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return null;
  }
  return { page, limit };
}

function normalizeComercioFields(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (typeof body.razon_social !== 'string' || !body.razon_social.trim()) return null;
  if (typeof body.actividad !== 'string' || !body.actividad.trim()) return null;
  if (typeof body.alicuota !== 'number' || !Number.isFinite(body.alicuota)
    || body.alicuota < 0 || body.alicuota > 1) return null;

  const estado = body.estado === undefined ? 'activo' : body.estado;
  if (!['activo', 'inactivo'].includes(estado)) return null;

  const applications = body.aplicaciones === undefined ? {} : body.aplicaciones;
  if (!applications || typeof applications !== 'object' || Array.isArray(applications)) return null;
  if (applications.arba_iibb !== undefined && typeof applications.arba_iibb !== 'boolean') return null;
  if (applications.arca_facturacion !== undefined && typeof applications.arca_facturacion !== 'boolean') return null;

  return {
    razon_social: body.razon_social.trim(),
    actividad: body.actividad.trim(),
    alicuota: body.alicuota,
    estado,
    aplicaciones: {
      arba_iibb: applications.arba_iibb === undefined ? true : applications.arba_iibb,
      arca_facturacion: applications.arca_facturacion === undefined ? false : applications.arca_facturacion,
    },
  };
}

function normalizeComercio(body) {
  if (!body || typeof body.cuit !== 'string' || !isValidCuit(body.cuit)) return null;
  return normalizeComercioFields(body);
}

function normalizeComercioUpdate(body) {
  return normalizeComercioFields(body);
}

module.exports = { isValidCuit, isValidIdVenta, isValidMoney, normalizeComercio, normalizeComercioUpdate, pageParameters, round2 };

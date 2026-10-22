async function request(url, options = {}) {
  const token = localStorage.getItem('arba_session_token');
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  };

  const response = await fetch(url, config);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error || `Error ${response.status}: ${response.statusText}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return { status: response.status, data };
}

function normalizePadronRow(row) {
  return {
    ...row,
    actividad: row.actividad || '',
    alicuota: row.rate?.value ?? null,
  };
}

function normalizePercepcion(row) {
  return {
    id: row.reference,
    id_venta: row.sale_id,
    cuit: row.cuit,
    monto_venta: row.base_amount_minor / 100,
    alicuota_aplicada: row.rate,
    monto_percepcion: row.tax_amount_minor / 100,
    fecha: row.created_at,
    currency: row.currency,
    status: row.status,
    rate_version: row.rate_version,
    rate_valid_from: row.rate_valid_from,
    rate_source: row.rate_source,
  };
}

export const arbaApi = {
  getHealth: () => request('/api/v1/arba/health'),

  // API versionada. Se normaliza al formato que ya consume la interfaz.
  getPadron: async (page = 1, limit = 10) => {
    const result = await request(`/api/v1/arba/padron?page=${page}&limit=${limit}`);
    return { ...result, data: { ...result.data, items: (result.data?.items || []).map(normalizePadronRow) } };
  },
  getPadronByCuit: async (cuit) => {
    const result = await request(`/api/v1/arba/padron/${cuit}`);
    return { ...result, data: normalizePadronRow(result.data) };
  },

  // Durante la transición, la administración conserva las rutas anteriores.
  // El backend legacy las traduce al esquema separado de perfiles e IIBB.
  getComercios: (page = 1, limit = 10) =>
    request(`/api/arba/comercios?page=${page}&limit=${limit}`),
  createComercio: (payload) =>
    request('/api/arba/comercios', { method: 'POST', body: JSON.stringify(payload) }),
  updateComercio: (cuit, payload) =>
    request(`/api/arba/comercios/${cuit}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteComercio: (cuit) =>
    request(`/api/arba/comercios/${cuit}`, { method: 'DELETE' }),

  createPercepcion: async (payload) => {
    const baseAmount = Number(payload.monto_venta);
    const baseAmountMinor = Math.round(baseAmount * 100);
    const result = await request('/api/v1/arba/percepciones', {
      method: 'POST',
      headers: { 'Idempotency-Key': payload.id_venta },
      body: JSON.stringify({
        sale_id: payload.id_venta,
        cuit: payload.cuit,
        base_amount_minor: baseAmountMinor,
        currency: 'ARS',
      }),
    });
    return { ...result, data: normalizePercepcion(result.data?.data || {}) };
  },
  getPercepcionesByCuit: async (cuit) => {
    const result = await request(`/api/v1/arba/percepciones/${cuit}`);
    const resource = result.data?.data || {};
    return {
      ...result,
      data: {
        ...resource,
        percepciones: (resource.percepciones || []).map(normalizePercepcion),
      },
    };
  },
};

async function request(url, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
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

export const arbaApi = {
  getHealth: () => request('/api/health'),

  // Padrón público
  getPadron: (page = 1, limit = 10) =>
    request(`/api/arba/padron?page=${page}&limit=${limit}`),
  getPadronByCuit: (cuit) =>
    request(`/api/arba/padron/${cuit}`),

  // Comercios
  getComercios: (page = 1, limit = 10) =>
    request(`/api/arba/comercios?page=${page}&limit=${limit}`),
  createComercio: (payload) =>
    request('/api/arba/comercios', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateComercio: (cuit, payload) =>
    request(`/api/arba/comercios/${cuit}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  deleteComercio: (cuit) =>
    request(`/api/arba/comercios/${cuit}`, {
      method: 'DELETE'
    }),

  // Percepciones
  createPercepcion: (payload) =>
    request('/api/arba/percepciones', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  getPercepcionesByCuit: (cuit) =>
    request(`/api/arba/percepciones/${cuit}`)
};

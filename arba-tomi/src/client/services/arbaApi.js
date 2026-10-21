import { demoEngine } from './demoEngine';

// Base URL por defecto: utiliza el proxy relativo de Vite '/api'
// o bien una URL absoluta si se configura (ej. http://localhost:3003)
const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class ArbaApiService {
  constructor(baseUrl = DEFAULT_API_BASE_URL, mode = 'api') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.mode = mode; // 'api' | 'demo'
  }

  setMode(mode) {
    this.mode = mode;
  }

  setBaseUrl(url) {
    this.baseUrl = (url || '').trim().replace(/\/+$/, '');
  }

  getEffectiveEndpoint(path) {
    // Si la URL base es '/api', se preserva el prefijo de proxy (/api/health, /api/arba/...)
    // Si la URL base es directa (ej. http://localhost:3003), se remueve el prefijo '/api' si el path lo incluía
    if (!this.baseUrl || this.baseUrl === '/api') {
      return `/api${path.startsWith('/') ? path : `/${path}`}`;
    }
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async health() {
    if (this.mode === 'demo') {
      return demoEngine.health();
    }

    try {
      const endpoint = this.getEffectiveEndpoint('/health');
      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      return {
        ok: res.ok,
        status: res.status,
        data,
        origin: 'API',
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        isNetworkError: true,
        error: `Error de red: no se pudo conectar con ${this.baseUrl || 'el backend'}.`,
        origin: 'Error',
      };
    }
  }

  async listPadron(page = 1, limit = 10) {
    if (this.mode === 'demo') {
      return demoEngine.listPadron(page, limit);
    }

    try {
      const endpoint = this.getEffectiveEndpoint(`/arba/padron?page=${encodeURIComponent(page)}&limit=${encodeURIComponent(limit)}`);
      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      return {
        ok: res.ok,
        status: res.status,
        data,
        origin: 'API',
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        isNetworkError: true,
        error: 'No se pudo conectar con el servicio ARBA para consultar el padrón.',
        origin: 'Error',
      };
    }
  }

  async getPadronByCuit(cuit) {
    if (this.mode === 'demo') {
      return demoEngine.getPadronByCuit(cuit);
    }

    try {
      const endpoint = this.getEffectiveEndpoint(`/arba/padron/${encodeURIComponent(cuit)}`);
      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      return {
        ok: res.ok,
        status: res.status,
        data,
        origin: 'API',
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        isNetworkError: true,
        error: 'Error de conexión al consultar el contribuyente.',
        origin: 'Error',
      };
    }
  }

  async createComercio(comercio) {
    if (this.mode === 'demo') return demoEngine.createComercio(comercio);
    return this.requestComercio('/arba/comercios', 'POST', comercio);
  }

  async auth(path, method = 'GET', body) {
    if (this.mode === 'demo') return demoEngine.auth(path, method, body);
    return this.requestComercio(path.startsWith('/auth') ? path : `/auth${path}`, method, body);
  }

  async subjects(method = 'GET', path = '/arba/sujetos', body) {
    if (this.mode === 'demo') return demoEngine.subjects(method, path, body);
    return this.requestComercio(path, method, body);
  }

  async users(method = 'GET', path = '/arba/usuarios', body) {
    if (this.mode === 'demo') return demoEngine.users(method, path, body);
    return this.requestComercio(path, method, body);
  }

  async auditSubjects() {
    if (this.mode === 'demo') return demoEngine.auditSubjects();
    return this.requestComercio('/arba/auditoria', 'GET');
  }

  async updateComercio(cuit, comercio) {
    if (this.mode === 'demo') return demoEngine.updateComercio(cuit, comercio);
    return this.requestComercio(`/arba/comercios/${encodeURIComponent(cuit)}`, 'PUT', comercio);
  }

  async deleteComercio(cuit) {
    if (this.mode === 'demo') return demoEngine.deleteComercio(cuit);
    return this.requestComercio(`/arba/comercios/${encodeURIComponent(cuit)}`, 'DELETE');
  }

  async listComercios() {
    if (this.mode === 'demo') return demoEngine.listComercios();
    return this.requestComercio('/arba/comercios?page=1&limit=100', 'GET');
  }

  async requestComercio(path, method, body) {
    try {
      const res = await fetch(this.getEffectiveEndpoint(path), {
        method,
        credentials: 'include',
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data, origin: 'API' };
    } catch {
      return { ok: false, status: 0, isNetworkError: true, data: { error: 'No se pudo conectar con el servicio de comercios.' }, origin: 'Error' };
    }
  }

  async createPercepcion({ id_venta, cuit, monto_venta }) {
    if (this.mode === 'demo') {
      return demoEngine.createPercepcion({ id_venta, cuit, monto_venta });
    }

    try {
      const endpoint = this.getEffectiveEndpoint('/arba/percepciones');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ id_venta, cuit, monto_venta }),
      });
      const data = await res.json().catch(() => ({}));
      return {
        ok: res.ok,
        status: res.status,
        data,
        isIdempotent: res.status === 200,
        origin: 'API',
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        isNetworkError: true,
        error: 'Error de conexión al registrar la percepción en el backend.',
        origin: 'Error',
      };
    }
  }

  async getPercepcionesByCuit(cuit) {
    if (this.mode === 'demo') {
      return demoEngine.getPercepcionesByCuit(cuit);
    }

    try {
      const endpoint = this.getEffectiveEndpoint(`/arba/percepciones/${encodeURIComponent(cuit)}`);
      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      return {
        ok: res.ok,
        status: res.status,
        data,
        origin: 'API',
      };
    } catch (err) {
      return {
        ok: false,
        status: 0,
        isNetworkError: true,
        error: 'Error de red al consultar el historial de percepciones del CUIT.',
        origin: 'Error',
      };
    }
  }
}

export const arbaApi = new ArbaApiService();

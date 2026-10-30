import { apiUrl } from '../apiUrl';
import * as demo from './demoEngine';

/**
 * Capa de servicio ARBA — punto único de acceso a datos para la UI.
 *
 * Según el modo seleccionado delega en:
 * - 'api'  → backend HTTP (local en :3003, Docker o función serverless de Vercel).
 * - 'demo' → motor local en el navegador (services/demoEngine.js).
 *
 * Todas las operaciones devuelven { ok, status, data, origin, networkError? }.
 * Un fallo de red en modo API NUNCA se transforma en un resultado demo silencioso.
 */

const MODE_KEY = 'arba_lucas_mode';
const SESSION_KEY = 'arba_lucas_session_v1';
export const MODES = { API: 'api', DEMO: 'demo' };

// Solo se usa el modo real (API del ecosistema). El motor demo del navegador
// queda en el código pero ya no se puede activar desde la interfaz.
export function getMode() {
  return MODES.API;
}

export function setMode() {
  try { localStorage.removeItem(MODE_KEY); } catch { /* sin almacenamiento */ }
}

// ─── Manejo de Sesión ────────────────────────────────────────────────────────

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session && session.user && session.token) return session;
    return null;
  } catch {
    return null;
  }
}

export function saveSession(user, token) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ user, token }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Cliente HTTP ────────────────────────────────────────────────────────────

async function http(path, { method = 'GET', body } = {}) {
  try {
    const session = getSession();
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

    const res = await fetch(apiUrl(path), {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data, origin: 'API' };
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: 'No se pudo conectar con la API ARBA' },
      origin: 'Error',
      networkError: true,
    };
  }
}

async function fromDemo(promise) {
  const { status, data } = await promise;
  return { ok: status >= 200 && status < 300, status, data, origin: 'Demo' };
}

const isDemo = () => getMode() === MODES.DEMO;

export const arbaService = {
  // Autenticación
  login: async (credentials) => {
    const res = isDemo() ? await fromDemo(demo.login(credentials)) : await http('/auth/login', { method: 'POST', body: credentials });
    if (res.ok && res.data?.user && res.data?.token) {
      saveSession(res.data.user, res.data.token);
    }
    return res;
  },

  register: async (userData) => {
    const res = isDemo() ? await fromDemo(demo.register(userData)) : await http('/auth/register', { method: 'POST', body: userData });
    if (res.ok && res.data?.user && res.data?.token) {
      saveSession(res.data.user, res.data.token);
    }
    return res;
  },

  getMe: async () => {
    const session = getSession();
    if (!session) return { ok: false, status: 401, data: { error: 'No autenticado' } };
    if (isDemo()) {
      return fromDemo(demo.getMe(session.token));
    }
    return http('/auth/me');
  },

  logout: async () => {
    try {
      if (isDemo()) await demo.logout();
      else await http('/auth/logout', { method: 'POST' });
    } finally {
      clearSession();
    }
    return { ok: true, status: 200 };
  },

  // Dominio
  health: () => (isDemo() ? fromDemo(demo.health()) : http('/health')),

  stats: () => (isDemo() ? fromDemo(demo.stats()) : http('/arba/stats')),

  listPadron: (page = 1, limit = 100) =>
    isDemo() ? fromDemo(demo.listPadron(page, limit)) : http(`/arba/padron?page=${page}&limit=${limit}`),

  getPadron: (cuit) => (isDemo() ? fromDemo(demo.getPadron(cuit)) : http(`/arba/padron/${cuit}`)),

  createPadron: (body) =>
    isDemo() ? fromDemo(demo.createPadron(body)) : http('/arba/padron', { method: 'POST', body }),

  updatePadron: (cuit, body) =>
    isDemo() ? fromDemo(demo.updatePadron(cuit, body)) : http(`/arba/padron/${cuit}`, { method: 'PUT', body }),

  deletePadron: (cuit) =>
    isDemo() ? fromDemo(demo.deletePadron(cuit)) : http(`/arba/padron/${cuit}`, { method: 'DELETE' }),

  listPercepciones: (page = 1, limit = 100) =>
    isDemo() ? fromDemo(demo.listPercepciones(page, limit)) : http(`/arba/percepciones?page=${page}&limit=${limit}`),

  crearPercepcion: (payload) =>
    isDemo() ? fromDemo(demo.crearPercepcion(payload)) : http('/arba/percepciones', { method: 'POST', body: payload }),

  resetSeed: () => (isDemo() ? fromDemo(demo.resetSeed()) : http('/arba/seed/reset', { method: 'POST' })),
};

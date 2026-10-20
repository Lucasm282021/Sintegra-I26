import { PADRON_DEMO, INITIAL_PERCEPCIONES_DEMO, DEFAULT_FISCAL_APPS } from '../data/demoData.js';
import { round2 } from '../utils/formatters';

const STORAGE_KEY = 'arba_demo_percepciones_v1';
const PADRON_STORAGE_KEY = 'arba_demo_padron_v1';

function loadPadron() {
  try {
    const raw = localStorage.getItem(PADRON_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {
    console.warn('No se pudo cargar el padrón demo', err);
  }
  return PADRON_DEMO.map((item) => ({
    ...item,
    estado: 'activo',
    aplicaciones: { ...DEFAULT_FISCAL_APPS },
  }));
}

let padronMemory = loadPadron();

function savePadron() {
  try {
    localStorage.setItem(PADRON_STORAGE_KEY, JSON.stringify(padronMemory));
  } catch (err) {
    console.warn('No se pudo guardar el padrón demo', err);
  }
}

function loadStoredPercepciones() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('No se pudo acceder a sessionStorage para demo data', err);
  }
  return [...INITIAL_PERCEPCIONES_DEMO];
}

let percepcionesMemory = loadStoredPercepciones();

function saveToStorage() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(percepcionesMemory));
  } catch (err) {
    console.warn('Error al guardar demo data en sessionStorage', err);
  }
}

export function validarCuit(cuit) {
  return typeof cuit === 'string' && /^\d{11}$/.test(cuit);
}

export function validarMonto(monto) {
  return typeof monto === 'number' && Number.isFinite(monto) && monto > 0;
}

export function validarIdVenta(id) {
  return typeof id === 'string' && id.trim().length > 0 && id.length <= 64;
}

export const demoEngine = {
  async health() {
    return {
      status: 200,
      ok: true,
      data: { status: 'ok', servicio: 'arba' },
      origin: 'Demo',
    };
  },

  async listPadron(page = 1, limit = 10) {
    const p = Number.parseInt(page, 10);
    const l = Number.parseInt(limit, 10);

    if (!Number.isInteger(p) || p < 1 || !Number.isInteger(l) || l < 1 || l > 100) {
      return {
        status: 400,
        ok: false,
        data: { error: 'paginacion invalida' },
        origin: 'Demo',
      };
    }

    const offset = (p - 1) * l;
    const items = padronMemory.slice(offset, offset + l).map((row) => ({ ...row }));

    return {
      status: 200,
      ok: true,
      data: {
        page: p,
        limit: l,
        total: padronMemory.length,
        items,
      },
      origin: 'Demo',
    };
  },

  async getPadronByCuit(cuit) {
    if (!validarCuit(cuit)) {
      return {
        status: 400,
        ok: false,
        data: { error: 'cuit invalido' },
        origin: 'Demo',
      };
    }

    const row = padronMemory.find((item) => item.cuit === cuit);
    if (!row) {
      return {
        status: 404,
        ok: false,
        data: { error: 'cuit no encontrado en padron' },
        origin: 'Demo',
      };
    }

    return {
      status: 200,
      ok: true,
      data: {
        cuit: row.cuit,
        actividad: row.actividad,
        alicuota: row.alicuota,
        razon_social: row.razon_social,
      },
      origin: 'Demo',
    };
  },

  async listComercios() {
    return { status: 200, ok: true, data: { page: 1, limit: 100, total: padronMemory.length, items: padronMemory.map((row) => ({ ...row })) }, origin: 'Demo' };
  },

  async createComercio(input) {
    if (!input || !validarCuit(input.cuit) || !input.razon_social?.trim() || !input.actividad?.trim()
      || !Number.isFinite(Number(input.alicuota)) || Number(input.alicuota) < 0 || Number(input.alicuota) > 1) {
      return { status: 400, ok: false, data: { error: 'datos de comercio invalidos' }, origin: 'Demo' };
    }
    if (padronMemory.some((row) => row.cuit === input.cuit)) {
      return { status: 409, ok: false, data: { error: 'cuit ya registrado' }, origin: 'Demo' };
    }
    const item = {
      cuit: input.cuit,
      razon_social: input.razon_social.trim(),
      actividad: input.actividad.trim(),
      alicuota: Number(input.alicuota),
      estado: input.estado === 'inactivo' ? 'inactivo' : 'activo',
      aplicaciones: { ...DEFAULT_FISCAL_APPS, ...(input.aplicaciones || {}) },
    };
    padronMemory = [...padronMemory, item];
    savePadron();
    return { status: 201, ok: true, data: { ...item }, origin: 'Demo' };
  },

  async updateComercio(cuit, input) {
    const index = padronMemory.findIndex((row) => row.cuit === cuit);
    if (index < 0) return { status: 404, ok: false, data: { error: 'comercio no encontrado' }, origin: 'Demo' };
    if (!input || !input.razon_social?.trim() || !input.actividad?.trim()
      || !Number.isFinite(Number(input.alicuota)) || Number(input.alicuota) < 0 || Number(input.alicuota) > 1) {
      return { status: 400, ok: false, data: { error: 'datos de comercio invalidos' }, origin: 'Demo' };
    }
    const item = {
      ...padronMemory[index],
      razon_social: input.razon_social.trim(),
      actividad: input.actividad.trim(),
      alicuota: Number(input.alicuota),
      estado: input.estado === 'inactivo' ? 'inactivo' : 'activo',
      aplicaciones: { ...DEFAULT_FISCAL_APPS, ...(input.aplicaciones || {}) },
    };
    padronMemory = padronMemory.map((row, i) => i === index ? item : row);
    savePadron();
    return { status: 200, ok: true, data: { ...item }, origin: 'Demo' };
  },

  async deleteComercio(cuit) {
    if (!padronMemory.some((row) => row.cuit === cuit)) {
      return { status: 404, ok: false, data: { error: 'comercio no encontrado' }, origin: 'Demo' };
    }
    padronMemory = padronMemory.filter((row) => row.cuit !== cuit);
    savePadron();
    return { status: 200, ok: true, data: { cuit }, origin: 'Demo' };
  },

  async createPercepcion({ id_venta, cuit, monto_venta }) {
    if (!validarIdVenta(id_venta)) {
      return {
        status: 400,
        ok: false,
        data: { error: 'id_venta invalido' },
        origin: 'Demo',
      };
    }
    if (!validarCuit(cuit)) {
      return {
        status: 400,
        ok: false,
        data: { error: 'cuit invalido' },
        origin: 'Demo',
      };
    }
    if (!validarMonto(monto_venta)) {
      return {
        status: 400,
        ok: false,
        data: { error: 'monto_venta invalido' },
        origin: 'Demo',
      };
    }

    // Comprobar idempotencia por id_venta
    const existente = percepcionesMemory.find((p) => p.id_venta === id_venta);
    if (existente) {
      const misma = existente.cuit === cuit && Math.abs(existente.monto_venta - round2(monto_venta)) < 0.0001;
      if (!misma) {
        return {
          status: 409,
          ok: false,
          data: { error: 'id_venta ya existe con otros datos' },
          origin: 'Demo',
        };
      }
      return {
        status: 200,
        ok: true,
        data: { ...existente },
        isIdempotent: true,
        origin: 'Demo',
      };
    }

    const contribuyente = padronMemory.find((item) => item.cuit === cuit && item.estado !== 'inactivo' && item.aplicaciones?.arba_iibb !== false);
    if (!contribuyente) {
      return {
        status: 404,
        ok: false,
        data: { error: 'cuit no encontrado en padron' },
        origin: 'Demo',
      };
    }

    const montoPercepcion = round2(monto_venta * contribuyente.alicuota);
    const nueva = {
      id: String(percepcionesMemory.length + 1),
      id_venta,
      cuit,
      monto_venta: round2(monto_venta),
      alicuota_aplicada: contribuyente.alicuota,
      monto_percepcion: montoPercepcion,
      fecha: new Date().toISOString(),
      origen: 'Demo',
    };

    percepcionesMemory.unshift(nueva);
    saveToStorage();

    return {
      status: 201,
      ok: true,
      data: nueva,
      origin: 'Demo',
    };
  },

  async getPercepcionesByCuit(cuit) {
    if (!validarCuit(cuit)) {
      return {
        status: 400,
        ok: false,
        data: { error: 'cuit invalido' },
        origin: 'Demo',
      };
    }

    const filtradas = percepcionesMemory.filter((p) => p.cuit === cuit);
    return {
      status: 200,
      ok: true,
      data: {
        cuit,
        cantidad: filtradas.length,
        percepciones: filtradas,
      },
      origin: 'Demo',
    };
  },

  getAllPercepciones() {
    return [...percepcionesMemory];
  },

  resetDemoData() {
    percepcionesMemory = [...INITIAL_PERCEPCIONES_DEMO];
    saveToStorage();
    return percepcionesMemory;
  },
};

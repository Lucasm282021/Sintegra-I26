import { PADRON_DEMO, INITIAL_PERCEPCIONES_DEMO, DEFAULT_FISCAL_APPS } from '../data/demoData.js';
import { round2 } from '../utils/formatters';

const STORAGE_KEY = 'arba_demo_percepciones_v1';
const PADRON_STORAGE_KEY = 'arba_demo_padron_v1';
const SUBJECTS_KEY = 'arba_demo_sujetos_v1';
const SESSION_KEY = 'arba_demo_usuario_v1';
const USERS_KEY = 'arba_demo_usuarios_v1';
const AUDIT_KEY = 'arba_demo_auditoria_v1';
const DEMO_USERS = [
  { id: 1, nombre: 'Administración demo', email: 'admin@arba.demo', password: 'demo-admin-123', rol: 'admin', activo: true },
  { id: 2, nombre: 'Usuario demo', email: 'usuario@arba.demo', password: 'demo-user-123', rol: 'convencional', activo: true },
];
const loadJson = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value ?? fallback; } catch { return fallback; } };
let subjectMemory = loadJson(SUBJECTS_KEY, []);
let userMemory = loadJson(USERS_KEY, DEMO_USERS);
let auditMemory = loadJson(AUDIT_KEY, []);
let activeDemoUser = loadJson(SESSION_KEY, null);
const persistSubjects = () => localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjectMemory));
const persistUsers = () => localStorage.setItem(USERS_KEY, JSON.stringify(userMemory));
const persistAudit = () => localStorage.setItem(AUDIT_KEY, JSON.stringify(auditMemory));
const demoResult = (status, ok, data) => ({ status, ok, data, origin: 'Demo' });
const logAudit = (action, subject, before = null, after = null) => { auditMemory.unshift({ actor_id: activeDemoUser?.id, accion: action, tipo_sujeto: subject?.tipo_titular, sujeto_cuit: subject?.cuit, estado_anterior: before, estado_posterior: after, fecha: new Date().toISOString(), detalle: {} }); persistAudit(); };

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

  async auth(path, method = 'GET', body) {
    if (path === '/auth/login' && method === 'POST') {
      const user = userMemory.find((item) => item.email === body?.email?.toLowerCase() && item.password === body?.password && item.activo);
      if (!user) return demoResult(401, false, { error: 'credenciales invalidas' });
      activeDemoUser = { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
      localStorage.setItem(SESSION_KEY, JSON.stringify(activeDemoUser));
      return demoResult(200, true, { usuario: activeDemoUser });
    }
    if (path === '/auth/logout' && method === 'POST') { activeDemoUser = null; localStorage.removeItem(SESSION_KEY); return demoResult(200, true, { ok: true }); }
    if (!activeDemoUser) return demoResult(401, false, { error: 'autenticacion requerida' });
    return demoResult(200, true, { usuario: activeDemoUser });
  },

  async subjects(method = 'GET', path = '/arba/sujetos', body) {
    if (!activeDemoUser) return demoResult(401, false, { error: 'autenticacion requerida' });
    const admin = activeDemoUser.rol === 'admin';
    const cuit = path.split('/')[3];
    if (method === 'GET' && !cuit) return demoResult(200, true, { items: subjectMemory.filter((x) => admin || x.creado_por === activeDemoUser.id) });
    if (method === 'POST' && path === '/arba/sujetos') {
      if (!validarCuit(body?.cuit) || !['persona_humana','persona_juridica'].includes(body?.tipo_titular)) return demoResult(400, false, { error: 'CUIT o tipo de titular inválido' });
      if (subjectMemory.some((x) => x.cuit === body.cuit)) return demoResult(409, false, { error: 'cuit ya registrado' });
      const item = { ...body, alicuota: null, aplicaciones: { arba_iibb: false, arca_facturacion: false }, estado: 'inactivo', estado_tramite: 'borrador', estado_fiscal: 'pendiente_consulta', creado_por: activeDemoUser.id, creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() };
      subjectMemory.unshift(item); persistSubjects(); logAudit('crear_sujeto', item, null, item.estado_tramite); return demoResult(201, true, item);
    }
    const item = subjectMemory.find((x) => x.cuit === cuit);
    if (!item) return demoResult(404, false, { error: 'sujeto no encontrado' });
    if (!admin && item.creado_por !== activeDemoUser.id) return demoResult(403, false, { error: 'permiso denegado' });
    if (method === 'GET') return demoResult(200, true, item);
    if (path.endsWith('/enviar-revision') && method === 'POST') {
      if (item.estado_tramite !== 'borrador' && item.estado_tramite !== 'observado') return demoResult(409, false, { error: 'transicion de estado invalida' });
      const before = item.estado_tramite; item.estado_tramite = 'pendiente_revision'; logAudit('enviar_revision', item, before, item.estado_tramite); persistSubjects(); return demoResult(200, true, item);
    }
    if (path.endsWith('/aprobar') && method === 'POST' && admin) { const before=item.estado_tramite;item.estado_tramite='aprobado';logAudit('aprobar',item,before,item.estado_tramite);persistSubjects();return demoResult(200,true,item); }
    if (path.endsWith('/observar') && method === 'POST' && admin) { if(item.estado_tramite!=='pendiente_revision')return demoResult(409,false,{error:'transicion de estado invalida'});const before=item.estado_tramite;item.estado_tramite='observado';logAudit('observar',item,before,item.estado_tramite);persistSubjects();return demoResult(200,true,item); }
    if (method === 'PUT') { if (!admin && !['borrador','pendiente_revision'].includes(item.estado_tramite)) return demoResult(403,false,{error:'permiso denegado'});Object.assign(item,body,{actualizado_en:new Date().toISOString()});persistSubjects();logAudit('editar_sujeto',item,item.estado_tramite,item.estado_tramite);return demoResult(200,true,item); }
    if (path.endsWith('/estado-operativo') && method === 'PATCH' && admin) {
      if(body.estado==='activo'&&!['aprobado','inactivo'].includes(item.estado_tramite))return demoResult(409,false,{error:'el sujeto debe estar aprobado'});
      Object.assign(item,body,{estado_tramite:body.estado,actualizado_en:new Date().toISOString()});
      const inPadron=padronMemory.findIndex((x)=>x.cuit===item.cuit);
      const operative={cuit:item.cuit,razon_social:item.razon_social||item.apellido_nombres,actividad:item.actividad,alicuota:item.alicuota,estado:body.estado,aplicaciones:{...body.aplicaciones}};
      if(inPadron<0)padronMemory.push(operative);else padronMemory[inPadron]=operative;
      savePadron();logAudit('configurar_estado_operativo',item,null,item.estado_tramite);persistSubjects();return demoResult(200,true,item);
    }
    return demoResult(403, false, { error: 'permiso denegado' });
  },

  async users(method = 'GET', path = '/arba/usuarios', body) {
    if (!activeDemoUser) return demoResult(401, false, { error: 'autenticacion requerida' });
    if (activeDemoUser.rol !== 'admin') return demoResult(403, false, { error: 'permiso denegado' });
    if (method === 'GET') return demoResult(200, true, { items: userMemory.map(({ password, ...u }) => u) });
    if (method === 'POST') { if(userMemory.some(x=>x.email===body.email))return demoResult(409,false,{error:'email ya registrado'});const item={...body,id:Math.max(0,...userMemory.map(x=>x.id))+1,activo:true};userMemory.push(item);persistUsers();return demoResult(201,true,(({password,...u})=>u)(item)); }
    const id=Number(path.split('/')[3]);const item=userMemory.find(x=>x.id===id);if(!item)return demoResult(404,false,{error:'usuario no encontrado'});
    if(method==='PUT')Object.assign(item,body);if(method==='PATCH')item.activo=Boolean(body.activo);persistUsers();return demoResult(200,true,(({password,...u})=>u)(item));
  },

  async auditSubjects() { if (!activeDemoUser) return demoResult(401,false,{error:'autenticacion requerida'});if(activeDemoUser.rol!=='admin')return demoResult(403,false,{error:'permiso denegado'});return demoResult(200,true,{items:[...auditMemory]}); },

  getActiveUser() { return activeDemoUser; },

  getAllPercepciones() {
    return [...percepcionesMemory];
  },

  resetDemoData() {
    percepcionesMemory = [...INITIAL_PERCEPCIONES_DEMO];
    saveToStorage();
    return percepcionesMemory;
  },
};

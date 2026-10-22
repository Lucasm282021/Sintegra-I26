import {
  ApiResponse,
  ApiTrafficLog,
  CertificadoLibreDeuda,
  Comercio,
  ComprobantePago,
  DesgloseConcepto,
  HttpStatusCode,
  NuevoComercioPayload,
  PagoTributoPayload,
  TributoPeriodo,
} from '../types/municipio';

export const PUERTO_MUNICIPIO = 3005;

export const CONCEPTOS_MUNICIPALES = {
  TISH: 'Tasa de Seguridad e Higiene (TISH)' as const,
  VIA_PUBLICA: 'Conservación de la Vía Pública' as const,
};

export const PERIODOS_INICIALES = ['2026-07', '2026-08', '2026-09'] as const;

const HTTP_STATUS_TEXT: Record<HttpStatusCode, string> = {
  200: '200 OK',
  201: '201 Created',
  400: '400 Bad Request',
  404: '404 Not Found',
  409: '409 Conflict',
};

/**
 * Valida que el CUIT sea exactamente una cadena de 11 dígitos numéricos sin guiones ni puntos.
 */
export function validarCuit(cuit: unknown): { valido: boolean; mensaje?: string } {
  if (typeof cuit !== 'string') {
    return { valido: false, mensaje: 'El CUIT debe ser una cadena de texto.' };
  }
  const limpio = cuit.trim();
  if (limpio.length !== 11) {
    return {
      valido: false,
      mensaje: `El CUIT debe contener exactamente 11 dígitos numéricos (recibido: ${limpio.length} caracteres).`,
    };
  }
  if (!/^\d{11}$/.test(limpio)) {
    return {
      valido: false,
      mensaje: 'El CUIT solo puede contener dígitos numéricos del 0 al 9, sin guiones ni puntos.',
    };
  }
  return { valido: true };
}

/**
 * Valida que el período municipal respete el formato "YYYY-MM".
 */
export function validarPeriodo(periodo: unknown): boolean {
  if (typeof periodo !== 'string') return false;
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo.trim());
}

/**
 * Redondea un importe en ARS a un máximo de 2 decimales.
 */
export function redondearArs(monto: number): number {
  return Math.round((monto + Number.EPSILON) * 100) / 100;
}

/**
 * Formatea un número en pesos argentinos (ARS) con 2 decimales.
 */
export function formatearArs(monto: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(redondearArs(monto));
}

/**
 * Construye los 3 períodos tributarios iniciales ("2026-07", "2026-08", "2026-09")
 * integrando "Tasa de Seguridad e Higiene (TISH)" y "Conservación de la Vía Pública".
 */
function construirTributosPorDefecto(
  cuit: string,
  estadoInicial: 'pendiente' | 'pagado',
  baseTish: number = 94500.5,
  baseViaPublica: number = 31250.25
): TributoPeriodo[] {
  const configs = [
    {
      periodo: '2026-07',
      factor: 1.0,
      vencimiento: '2026-07-20',
      fechaPagoSeed: '2026-07-14T11:20:00.000Z',
      idComprobanteSeed: `CMP-202607-${cuit.slice(-4)}`,
    },
    {
      periodo: '2026-08',
      factor: 1.05,
      vencimiento: '2026-08-20',
      fechaPagoSeed: '2026-08-16T15:42:10.000Z',
      idComprobanteSeed: `CMP-202608-${cuit.slice(-4)}`,
    },
    {
      periodo: '2026-09',
      factor: 1.1,
      vencimiento: '2026-09-21',
      fechaPagoSeed: '2026-09-18T09:15:30.000Z',
      idComprobanteSeed: `CMP-202609-${cuit.slice(-4)}`,
    },
  ];

  return configs.map((cfg) => {
    const importeTish = redondearArs(baseTish * cfg.factor);
    const importeVia = redondearArs(baseViaPublica * cfg.factor);
    const importeTotal = redondearArs(importeTish + importeVia);
    const desglose: DesgloseConcepto[] = [
      {
        concepto: CONCEPTOS_MUNICIPALES.TISH,
        importe: importeTish,
      },
      {
        concepto: CONCEPTOS_MUNICIPALES.VIA_PUBLICA,
        importe: importeVia,
      },
    ];

    return {
      id_tributo: `TRIB-${cuit}-${cfg.periodo}`,
      cuit,
      periodo: cfg.periodo,
      concepto_principal: `${CONCEPTOS_MUNICIPALES.TISH} + ${CONCEPTOS_MUNICIPALES.VIA_PUBLICA}`,
      desglose,
      importe: importeTotal,
      vencimiento: cfg.vencimiento,
      estado: estadoInicial,
      fecha_pago: estadoInicial === 'pagado' ? cfg.fechaPagoSeed : null,
      id_comprobante: estadoInicial === 'pagado' ? cfg.idComprobanteSeed : null,
    };
  });
}

// ============================================================================
// MOCK STORE EN MEMORIA (Estado Desacoplado)
// ============================================================================

interface MunicipioStore {
  comercios: Map<string, Comercio>;
  tributosPorCuit: Map<string, TributoPeriodo[]>;
  comprobantes: ComprobantePago[];
  certificados: CertificadoLibreDeuda[];
  trafficLogs: ApiTrafficLog[];
}

const store: MunicipioStore = {
  comercios: new Map(),
  tributosPorCuit: new Map(),
  comprobantes: [],
  certificados: [],
  trafficLogs: [],
};

let simulatedLatencyMs = 220;
const trafficListeners = new Set<(logs: ApiTrafficLog[]) => void>();

export function setSimulatedLatencyMs(ms: number): void {
  simulatedLatencyMs = Math.max(0, ms);
}

export function getSimulatedLatencyMs(): number {
  return simulatedLatencyMs;
}

function notifyTrafficListeners(): void {
  const snapshot = [...store.trafficLogs];
  trafficListeners.forEach((listener) => listener(snapshot));
}

export function subscribeTrafficLogs(listener: (logs: ApiTrafficLog[]) => void): () => void {
  trafficListeners.add(listener);
  listener([...store.trafficLogs]);
  return () => {
    trafficListeners.delete(listener);
  };
}

export function getTrafficLogs(): ApiTrafficLog[] {
  return [...store.trafficLogs];
}

export function clearTrafficLogs(): void {
  store.trafficLogs = [];
  notifyTrafficListeners();
}

/**
 * Inicializa o reinicia los Datos Semilla (Seed Data):
 * 1. Comercio habilitado SIN deuda (CUIT: "30712345678" - Molinos del Sur S.A.)
 * 2. Comercio habilitado CON deuda (CUIT: "30789012345" - Ferretería Industrial El Tornillo S.R.L.)
 */
export function resetSeedData(): void {
  store.comercios.clear();
  store.tributosPorCuit.clear();
  store.comprobantes = [];
  store.certificados = [];
  store.trafficLogs = [];

  // 1. Comercio habilitado SIN deuda ($0.00 pendiente)
  const comercioSinDeuda: Comercio = {
    cuit: '30712345678',
    razon_social: 'Molinos del Sur S.A.',
    condicion_fiscal: 'Responsable Inscripto',
    direccion: 'Av. Libertador Gral. San Martín 840, Centro',
    rubro_principal: 'Industria Alimenticia y Molienda',
    rubro_secundario: 'Logística y Distribución Mayorista',
    estado: 'habilitado',
    fecha_alta: '2026-06-15',
  };
  const tributosSinDeuda = construirTributosPorDefecto('30712345678', 'pagado', 88400.0, 29600.0);

  store.comercios.set(comercioSinDeuda.cuit, comercioSinDeuda);
  store.tributosPorCuit.set(comercioSinDeuda.cuit, tributosSinDeuda);

  // Generar comprobantes históricos para el comercio sin deuda
  tributosSinDeuda.forEach((trib, index) => {
    store.comprobantes.push({
      id_comprobante: trib.id_comprobante || `CMP-SEED-${index + 1}`,
      numero_operacion: `OP-MUN-000${index + 101}`,
      cuit: comercioSinDeuda.cuit,
      razon_social: comercioSinDeuda.razon_social,
      periodo: trib.periodo,
      conceptos: trib.desglose,
      monto: trib.importe,
      moneda: 'ARS',
      fecha_pago: trib.fecha_pago || '2026-09-18T09:15:30.000Z',
      estado: 'pagado',
    });
  });

  // 2. Comercio habilitado CON deuda (3 períodos pendientes: 2026-07, 2026-08, 2026-09)
  const comercioConDeuda: Comercio = {
    cuit: '30789012345',
    razon_social: 'Ferretería Industrial El Tornillo S.R.L.',
    condicion_fiscal: 'Responsable Inscripto',
    direccion: 'Bvd. Bartolomé Mitre 2150, Parque Industrial',
    rubro_principal: 'Ferretería y Suministros Industriales',
    rubro_secundario: 'Venta de Maquinaria y Herramientas',
    estado: 'habilitado',
    fecha_alta: '2026-06-28',
  };
  const tributosConDeuda = construirTributosPorDefecto('30789012345', 'pendiente', 112500.75, 36400.25);

  store.comercios.set(comercioConDeuda.cuit, comercioConDeuda);
  store.tributosPorCuit.set(comercioConDeuda.cuit, tributosConDeuda);

  notifyTrafficListeners();
}

// Cargar datos semilla al inicializar el módulo
resetSeedData();

/**
 * Simula latencia de red asíncrona y registra el evento en el Inspector de Tráfico API.
 */
async function simularRequest<T>(
  method: 'GET' | 'POST',
  endpoint: string,
  requestBody: unknown | null,
  handler: () => { status: HttpStatusCode; data?: T; error?: { codigo: string; mensaje: string; detalles?: string } }
): Promise<ApiResponse<T>> {
  const start = performance.now();
  const jitter = simulatedLatencyMs > 0 ? Math.floor(Math.random() * 60) : 0;
  const delay = simulatedLatencyMs + jitter;

  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  const result = handler();
  const elapsed = Math.max(1, Math.round(performance.now() - start));
  const timestamp = new Date().toISOString();
  const statusText = HTTP_STATUS_TEXT[result.status];
  const ok = result.status >= 200 && result.status < 300;

  const responsePayload = ok ? result.data : { error: result.error };

  const logEntry: ApiTrafficLog = {
    id: `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    timestamp,
    method,
    endpoint,
    port: PUERTO_MUNICIPIO,
    status: result.status,
    statusText,
    latencyMs: elapsed,
    requestBody: requestBody ? JSON.parse(JSON.stringify(requestBody)) : null,
    responseBody: JSON.parse(JSON.stringify(responsePayload)),
  };

  store.trafficLogs = [logEntry, ...store.trafficLogs].slice(0, 100);
  notifyTrafficListeners();

  return {
    status: result.status,
    statusText,
    ok,
    latencyMs: elapsed,
    timestamp,
    data: result.data,
    error: result.error,
  };
}

// ============================================================================
// ENDPOINTS SIMULADOS DEL SERVICIO MUNICIPIO (Puerto 3005)
// ============================================================================

/**
 * GET /health
 * Retorna { "status": "ok", "servicio": "MUNICIPIO" }
 */
export async function getHealth(): Promise<ApiResponse<{ status: string; servicio: string; puerto: number }>> {
  return simularRequest('GET', '/health', null, () => ({
    status: 200,
    data: {
      status: 'ok',
      servicio: 'MUNICIPIO',
      puerto: PUERTO_MUNICIPIO,
    },
  }));
}

/**
 * GET /municipio/comercios
 * Retorna el padrón completo de comercios junto con su estado de deuda resumido.
 */
export interface ComercioConResumen extends Comercio {
  deuda_total: number;
  periodos_pendientes: number;
  periodos_pagados: number;
}

export async function listarComercios(): Promise<ApiResponse<ComercioConResumen[]>> {
  return simularRequest('GET', '/municipio/comercios', null, () => {
    const lista: ComercioConResumen[] = Array.from(store.comercios.values()).map((comercio) => {
      const tributos = store.tributosPorCuit.get(comercio.cuit) || [];
      const pendientes = tributos.filter((t) => t.estado === 'pendiente');
      const pagados = tributos.filter((t) => t.estado === 'pagado');
      const deudaTotal = redondearArs(pendientes.reduce((acc, item) => acc + item.importe, 0));

      return {
        ...comercio,
        deuda_total: deudaTotal,
        periodos_pendientes: pendientes.length,
        periodos_pagados: pagados.length,
      };
    });

    return {
      status: 200,
      data: lista,
    };
  });
}

/**
 * POST /municipio/comercios
 * Body: { cuit, razon_social, condicion_fiscal, direccion, rubro_principal, rubro_secundario }
 * Regla: Si el CUIT ya existe, retornar 409. Si se crea exitosamente, guarda el comercio como
 * "habilitado" y genera automáticamente 3 tributos pendientes de pago ("2026-07", "2026-08", "2026-09").
 */
export async function crearComercio(
  payload: NuevoComercioPayload
): Promise<ApiResponse<{ comercio: Comercio; tributos_generados: TributoPeriodo[] }>> {
  return simularRequest('POST', '/municipio/comercios', payload, () => {
    const validacionCuit = validarCuit(payload?.cuit);
    if (!validacionCuit.valido) {
      return {
        status: 400,
        error: {
          codigo: 'CUIT_INVALIDO',
          mensaje: validacionCuit.mensaje || 'Formato de CUIT inválido.',
          detalles: 'El campo cuit requiere exactamente 11 dígitos numéricos sin guiones ni puntos.',
        },
      };
    }

    const cuit = payload.cuit.trim();
    const razon_social = (payload.razon_social || '').trim();
    const condicion_fiscal = (payload.condicion_fiscal || '').trim();
    const direccion = (payload.direccion || '').trim();
    const rubro_principal = (payload.rubro_principal || '').trim();
    const rubro_secundario = (payload.rubro_secundario || '').trim();

    if (!razon_social || !condicion_fiscal || !direccion || !rubro_principal) {
      return {
        status: 400,
        error: {
          codigo: 'CAMPOS_REQUERIDOS_FALTANTES',
          mensaje: 'Todos los campos obligatorios (cuit, razon_social, condicion_fiscal, direccion, rubro_principal) deben completarse.',
        },
      };
    }

    if (store.comercios.has(cuit)) {
      return {
        status: 409,
        error: {
          codigo: 'COMERCIO_YA_REGISTRADO',
          mensaje: `Conflicto: El CUIT ${cuit} ya se encuentra empadronado en el Municipio.`,
          detalles: 'POST /municipio/comercios rechazado por duplicidad de clave tributaria (HTTP 409 Conflict).',
        },
      };
    }

    const nuevoComercio: Comercio = {
      cuit,
      razon_social,
      condicion_fiscal,
      direccion,
      rubro_principal,
      rubro_secundario: rubro_secundario || 'Sin rubro secundario declarado',
      estado: 'habilitado',
      fecha_alta: new Date().toISOString().slice(0, 10),
    };

    const tributosIniciales = construirTributosPorDefecto(cuit, 'pendiente', 96800.0, 32400.5);

    store.comercios.set(cuit, nuevoComercio);
    store.tributosPorCuit.set(cuit, tributosIniciales);

    return {
      status: 201,
      data: {
        comercio: nuevoComercio,
        tributos_generados: tributosIniciales,
      },
    };
  });
}

/**
 * GET /municipio/comercios/{cuit}
 * Retorna datos del comercio.
 */
export async function obtenerComercioPorCuit(cuitInput: string): Promise<ApiResponse<Comercio>> {
  const cuitLimpio = (cuitInput || '').trim();
  return simularRequest('GET', `/municipio/comercios/${cuitLimpio}`, null, () => {
    const validacion = validarCuit(cuitLimpio);
    if (!validacion.valido) {
      return {
        status: 400,
        error: {
          codigo: 'CUIT_INVALIDO',
          mensaje: validacion.mensaje || 'El CUIT consultado no tiene 11 dígitos numéricos.',
        },
      };
    }

    const comercio = store.comercios.get(cuitLimpio);
    if (!comercio) {
      return {
        status: 404,
        error: {
          codigo: 'COMERCIO_NO_ENCONTRADO',
          mensaje: `No se encontró ningún comercio registrado bajo el CUIT ${cuitLimpio}.`,
        },
      };
    }

    return {
      status: 200,
      data: { ...comercio },
    };
  });
}

/**
 * GET /municipio/tributos/{cuit}
 * Retorna la lista de períodos, importes y estado ("pendiente" / "pagado").
 */
export interface RespuestaTributosCuit {
  cuit: string;
  razon_social: string;
  estado_comercio: string;
  moneda: 'ARS';
  deuda_total: number;
  total_pagado: number;
  periodos_pendientes: number;
  tributos: TributoPeriodo[];
}

export async function obtenerTributosPorCuit(cuitInput: string): Promise<ApiResponse<RespuestaTributosCuit>> {
  const cuitLimpio = (cuitInput || '').trim();
  return simularRequest('GET', `/municipio/tributos/${cuitLimpio}`, null, () => {
    const validacion = validarCuit(cuitLimpio);
    if (!validacion.valido) {
      return {
        status: 400,
        error: {
          codigo: 'CUIT_INVALIDO',
          mensaje: validacion.mensaje || 'El CUIT debe tener exactamente 11 dígitos numéricos.',
        },
      };
    }

    const comercio = store.comercios.get(cuitLimpio);
    if (!comercio) {
      return {
        status: 404,
        error: {
          codigo: 'CUIT_NO_EMPADRONADO',
          mensaje: `No existen obligaciones tributarias asociadas al CUIT ${cuitLimpio} (Comercio no encontrado).`,
        },
      };
    }

    const tributos = (store.tributosPorCuit.get(cuitLimpio) || []).map((t) => ({
      ...t,
      desglose: [...t.desglose],
    }));

    const deudaTotal = redondearArs(
      tributos.filter((t) => t.estado === 'pendiente').reduce((acc, t) => acc + t.importe, 0)
    );
    const totalPagado = redondearArs(
      tributos.filter((t) => t.estado === 'pagado').reduce((acc, t) => acc + t.importe, 0)
    );
    const periodosPendientes = tributos.filter((t) => t.estado === 'pendiente').length;

    return {
      status: 200,
      data: {
        cuit: comercio.cuit,
        razon_social: comercio.razon_social,
        estado_comercio: comercio.estado,
        moneda: 'ARS',
        deuda_total: deudaTotal,
        total_pagado: totalPagado,
        periodos_pendientes: periodosPendientes,
        tributos,
      },
    };
  });
}

/**
 * POST /municipio/tributos/pagos
 * Body: { cuit, periodo, monto }
 * Regla: Si el período ya fue pagado, retornar 409. De lo contrario, cambia estado a "pagado" y genera un objeto comprobante.
 */
export async function registrarPagoTributo(
  payload: PagoTributoPayload
): Promise<ApiResponse<{ comprobante: ComprobantePago; tributo_actualizado: TributoPeriodo; saldo_deuda_restante: number }>> {
  return simularRequest('POST', '/municipio/tributos/pagos', payload, () => {
    const validacionCuit = validarCuit(payload?.cuit);
    if (!validacionCuit.valido) {
      return {
        status: 400,
        error: {
          codigo: 'CUIT_INVALIDO',
          mensaje: validacionCuit.mensaje || 'CUIT inválido.',
        },
      };
    }

    if (!validarPeriodo(payload?.periodo)) {
      return {
        status: 400,
        error: {
          codigo: 'PERIODO_INVALIDO',
          mensaje: `El período "${payload?.periodo}" no respeta el formato municipal "YYYY-MM".`,
        },
      };
    }

    if (typeof payload?.monto !== 'number' || Number.isNaN(payload.monto) || payload.monto <= 0) {
      return {
        status: 400,
        error: {
          codigo: 'MONTO_INVALIDO',
          mensaje: 'El monto a abonar debe ser un número positivo expresado en ARS.',
        },
      };
    }

    const cuit = payload.cuit.trim();
    const periodo = payload.periodo.trim();
    const monto = redondearArs(payload.monto);

    const comercio = store.comercios.get(cuit);
    if (!comercio) {
      return {
        status: 404,
        error: {
          codigo: 'COMERCIO_NO_ENCONTRADO',
          mensaje: `No existe comercio registrado con CUIT ${cuit}.`,
        },
      };
    }

    const tributos = store.tributosPorCuit.get(cuit) || [];
    const tributo = tributos.find((t) => t.periodo === periodo);

    if (!tributo) {
      return {
        status: 404,
        error: {
          codigo: 'PERIODO_NO_ENCONTRADO',
          mensaje: `El período ${periodo} no existe en la cuenta corriente del CUIT ${cuit}.`,
        },
      };
    }

    if (tributo.estado === 'pagado') {
      return {
        status: 409,
        error: {
          codigo: 'TRIBUTO_YA_PAGADO',
          mensaje: `Conflicto: El período ${periodo} del CUIT ${cuit} ya fue abonado anteriormente (Comprobante ${tributo.id_comprobante}).`,
          detalles: 'No se admiten pagos duplicados para un mismo período fiscal (HTTP 409 Conflict).',
        },
      };
    }

    if (Math.abs(tributo.importe - monto) > 0.01) {
      return {
        status: 400,
        error: {
          codigo: 'MONTO_INEXACTO',
          mensaje: `El monto enviado (${formatearArs(monto)}) no coincide con el importe liquidado para el período ${periodo} (${formatearArs(tributo.importe)}).`,
        },
      };
    }

    const fechaPago = new Date().toISOString();
    const idComprobante = `CMP-${periodo.replace('-', '')}-${cuit.slice(-4)}-${Math.floor(100 + Math.random() * 900)}`;
    const numeroOperacion = `OP-MUN-${store.comprobantes.length + 101}`;

    tributo.estado = 'pagado';
    tributo.fecha_pago = fechaPago;
    tributo.id_comprobante = idComprobante;

    const comprobante: ComprobantePago = {
      id_comprobante: idComprobante,
      numero_operacion: numeroOperacion,
      cuit: comercio.cuit,
      razon_social: comercio.razon_social,
      periodo: tributo.periodo,
      conceptos: [...tributo.desglose],
      monto: tributo.importe,
      moneda: 'ARS',
      fecha_pago: fechaPago,
      estado: 'pagado',
    };

    store.comprobantes = [comprobante, ...store.comprobantes];

    const saldoRestante = redondearArs(
      tributos.filter((t) => t.estado === 'pendiente').reduce((acc, t) => acc + t.importe, 0)
    );

    return {
      status: 200,
      data: {
        comprobante,
        tributo_actualizado: { ...tributo, desglose: [...tributo.desglose] },
        saldo_deuda_restante: saldoRestante,
      },
    };
  });
}

/**
 * GET /municipio/comprobantes
 * Retorna los comprobantes emitidos (opcionalmente filtrados por CUIT).
 */
export async function listarComprobantes(cuitFiltro?: string): Promise<ApiResponse<ComprobantePago[]>> {
  const endpoint = cuitFiltro
    ? `/municipio/comprobantes?cuit=${cuitFiltro.trim()}`
    : '/municipio/comprobantes';

  return simularRequest('GET', endpoint, null, () => {
    if (cuitFiltro && cuitFiltro.trim() !== '') {
      const validacion = validarCuit(cuitFiltro.trim());
      if (!validacion.valido) {
        return {
          status: 400,
          error: {
            codigo: 'CUIT_INVALIDO',
            mensaje: validacion.mensaje || 'El filtro CUIT debe tener 11 dígitos numéricos.',
          },
        };
      }
      const filtrados = store.comprobantes.filter((c) => c.cuit === cuitFiltro.trim());
      return {
        status: 200,
        data: filtrados,
      };
    }

    return {
      status: 200,
      data: [...store.comprobantes],
    };
  });
}

/**
 * GET /municipio/certificados/libre-deuda/{cuit}
 * Emite el "Certificado de Libre Deuda" únicamente si el CUIT existe y registra $0.00 de deuda.
 */
export async function emitirCertificadoLibreDeuda(
  cuitInput: string
): Promise<ApiResponse<CertificadoLibreDeuda>> {
  const cuitLimpio = (cuitInput || '').trim();
  return simularRequest('GET', `/municipio/certificados/libre-deuda/${cuitLimpio}`, null, () => {
    const validacion = validarCuit(cuitLimpio);
    if (!validacion.valido) {
      return {
        status: 400,
        error: {
          codigo: 'CUIT_INVALIDO',
          mensaje: validacion.mensaje || 'Formato de CUIT inválido.',
        },
      };
    }

    const comercio = store.comercios.get(cuitLimpio);
    if (!comercio) {
      return {
        status: 404,
        error: {
          codigo: 'COMERCIO_NO_ENCONTRADO',
          mensaje: `El CUIT ${cuitLimpio} no se encuentra empadronado en el Municipio.`,
        },
      };
    }

    const tributos = store.tributosPorCuit.get(cuitLimpio) || [];
    const pendientes = tributos.filter((t) => t.estado === 'pendiente');
    const deudaTotal = redondearArs(pendientes.reduce((acc, t) => acc + t.importe, 0));

    if (deudaTotal > 0 || pendientes.length > 0) {
      return {
        status: 409,
        error: {
          codigo: 'REGISTRA_DEUDA_PENDIENTE',
          mensaje: `No se puede emitir el Certificado de Libre Deuda. El comercio ${comercio.razon_social} registra una deuda exigible de ${formatearArs(deudaTotal)} en ${pendientes.length} período(s).`,
          detalles: `Períodos impagos: ${pendientes.map((p) => p.periodo).join(', ')}`,
        },
      };
    }

    const ahora = new Date();
    const vigencia = new Date(ahora.getTime() + 90 * 24 * 60 * 60 * 1000);
    const certificado: CertificadoLibreDeuda = {
      id_certificado: `CLD-2026-${cuitLimpio.slice(-4)}-${Math.floor(1000 + Math.random() * 9000)}`,
      codigo_verificacion: `MUN3005-${cuitLimpio.slice(0, 4)}-${cuitLimpio.slice(-4)}-OK`,
      cuit: comercio.cuit,
      razon_social: comercio.razon_social,
      condicion_fiscal: comercio.condicion_fiscal,
      direccion: comercio.direccion,
      rubro_principal: comercio.rubro_principal,
      fecha_emision: ahora.toISOString(),
      vigencia_hasta: vigencia.toISOString().slice(0, 10),
      deuda_total_ars: 0,
      periodos_auditados: tributos.map((t) => t.periodo),
      estado_fiscal: 'LIBRE DE DEUDA',
      organismo: 'Dirección General de Rentas - Módulo MUNICIPIO (Puerto 3005)',
    };

    store.certificados = [certificado, ...store.certificados.filter((c) => c.cuit !== cuitLimpio)];

    return {
      status: 200,
      data: certificado,
    };
  });
}

export const municipioService = {
  getHealth,
  listarComercios,
  crearComercio,
  obtenerComercioPorCuit,
  obtenerTributosPorCuit,
  registrarPagoTributo,
  listarComprobantes,
  emitirCertificadoLibreDeuda,
  resetSeedData,
  getTrafficLogs,
  clearTrafficLogs,
  subscribeTrafficLogs,
  setSimulatedLatencyMs,
};

export default municipioService;

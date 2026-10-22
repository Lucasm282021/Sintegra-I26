export type EstadoComercio = 'habilitado' | 'suspendido' | 'baja';

export type CondicionFiscal =
  | 'Responsable Inscripto'
  | 'Monotributista'
  | 'Exento'
  | 'Consumidor Final';

export type ConceptoTasa =
  | 'Tasa de Seguridad e Higiene (TISH)'
  | 'Conservación de la Vía Pública';

export type EstadoTributo = 'pendiente' | 'pagado';

export type HttpStatusCode = 200 | 201 | 400 | 404 | 409;

export interface Comercio {
  cuit: string;
  razon_social: string;
  condicion_fiscal: CondicionFiscal | string;
  direccion: string;
  rubro_principal: string;
  rubro_secundario: string;
  estado: EstadoComercio;
  fecha_alta: string;
}

export interface NuevoComercioPayload {
  cuit: string;
  razon_social: string;
  condicion_fiscal: string;
  direccion: string;
  rubro_principal: string;
  rubro_secundario: string;
}

export interface DesgloseConcepto {
  concepto: ConceptoTasa;
  importe: number;
}

export interface TributoPeriodo {
  id_tributo: string;
  cuit: string;
  periodo: string; // YYYY-MM
  concepto_principal: string;
  desglose: DesgloseConcepto[];
  importe: number; // Suma en ARS con hasta 2 decimales
  vencimiento: string;
  estado: EstadoTributo;
  fecha_pago?: string | null;
  id_comprobante?: string | null;
}

export interface PagoTributoPayload {
  cuit: string;
  periodo: string;
  monto: number;
}

export interface ComprobantePago {
  id_comprobante: string;
  numero_operacion: string;
  cuit: string;
  razon_social: string;
  periodo: string;
  conceptos: DesgloseConcepto[];
  monto: number;
  moneda: 'ARS';
  fecha_pago: string;
  estado: 'pagado';
}

export interface CertificadoLibreDeuda {
  id_certificado: string;
  codigo_verificacion: string;
  cuit: string;
  razon_social: string;
  condicion_fiscal: string;
  direccion: string;
  rubro_principal: string;
  fecha_emision: string;
  vigencia_hasta: string;
  deuda_total_ars: number;
  periodos_auditados: string[];
  estado_fiscal: 'LIBRE DE DEUDA';
  organismo: 'Dirección General de Rentas - Módulo MUNICIPIO (Puerto 3005)';
}

export interface ApiResponse<T = unknown> {
  status: HttpStatusCode;
  statusText: string;
  ok: boolean;
  latencyMs: number;
  timestamp: string;
  data?: T;
  error?: {
    codigo: string;
    mensaje: string;
    detalles?: string;
  };
}

export interface ApiTrafficLog {
  id: string;
  timestamp: string;
  method: 'GET' | 'POST';
  endpoint: string;
  port: number;
  status: HttpStatusCode;
  statusText: string;
  latencyMs: number;
  requestBody: unknown | null;
  responseBody: unknown;
}

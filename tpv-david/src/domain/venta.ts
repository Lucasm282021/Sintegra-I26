// Entidades y tipos del dominio de Venta.
// Sin dependencias de Express, base de datos ni nada externo: esto es lógica pura.

export type MedioPago = "efectivo" | "tarjeta" | "transferencia" | "billetera_virtual";

export type EstadoVenta =
  | "pendiente_cobro"
  | "cobrada"
  | "percibida"
  | "facturada"
  | "completada"
  | "error";

export interface Comercio {
  cuit: string; // siempre string, 11 dígitos, sin puntos ni guiones (contrato común)
  razonSocial: string;
}

export interface ItemVenta {
  productoId: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
}

// Lo que manda quien arma la venta: solo referencia al producto y cantidad.
// El nombre y el precio se resuelven del catálogo, no se vuelven a escribir.
export interface ItemVentaInput {
  productoId: string;
  cantidad: number;
}

export interface NuevaVentaInput {
  comercio: Comercio;
  items: ItemVentaInput[];
  medioPago: MedioPago;
  /** CUIT del cliente que paga; obligatorio solo con billetera_virtual. */
  cuitCliente?: string;
}

// Datos del pago confirmado por el Banco. Se completa cuando el estado pasa a "cobrada".
export interface PagoConfirmado {
  movimientoId: string;
  confirmadoEn: string;
}

// Percepción de IIBB calculada por ARBA. Se completa cuando el estado pasa a "percibida".
export interface PercepcionAplicada {
  montoPercepcion: number;
  alicuotaAplicada: number;
}

// Comprobante emitido por ARCA. Se completa cuando el estado pasa a "completada".
export interface ComprobanteEmitido {
  cae: string;
  vencimientoCae: string;
  tipoComprobante: string;
  puntoVenta: string;
  numero: string;
}

export interface Venta {
  id: string;
  comercio: Comercio;
  items: ItemVenta[];
  total: number;
  medioPago: MedioPago;
  cuitCliente?: string;
  estado: EstadoVenta;
  createdAt: string;
  pago?: PagoConfirmado;
  percepcion?: PercepcionAplicada;
  factura?: ComprobanteEmitido;
  errorDetalle?: string;
}

// Total final que se le va a facturar a ARCA: la venta original + la
// percepción de IIBB ya calculada por ARBA. Sin percepción, es el total base.
export function calcularTotalFinal(venta: Venta): number {
  return venta.total + (venta.percepcion?.montoPercepcion ?? 0);
}

const MEDIOS_PAGO_VALIDOS: MedioPago[] = [
  "efectivo",
  "tarjeta",
  "transferencia",
  "billetera_virtual",
];

const CUIT_REGEX = /^\d{11}$/;

export function esMedioPagoValido(valor: unknown): valor is MedioPago {
  return typeof valor === "string" && MEDIOS_PAGO_VALIDOS.includes(valor as MedioPago);
}

export function esCuitValido(valor: unknown): valor is string {
  return typeof valor === "string" && CUIT_REGEX.test(valor);
}

export function esCantidadValida(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor) && valor > 0;
}

export function calcularTotal(items: ItemVenta[]): number {
  return items.reduce((acc, item) => acc + item.cantidad * item.precioUnitario, 0);
}

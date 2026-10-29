export const ESTADO_PENDIENTE = 'PENDIENTE';
export const ESTADO_COMPLETADA = 'COMPLETADA';
export const ESTADO_ERROR_RECUPERABLE = 'ERROR_RECUPERABLE';

export const ETAPA_MUNICIPIO = 'municipio';
export const ETAPA_ARBA = 'arba';
export const ETAPA_PAGO = 'pago';
export const ETAPA_PAGO_EN_CURSO = 'pago_en_curso';
export const ETAPA_ARCA = 'arca';
export const ETAPA_CONCILIACION_PAGO = 'conciliacion_pago';

/**
 * Una venta requiere conciliación cuando el cobro no pudo confirmarse.
 * REVISION_MANUAL es un estado legado y ya no se escribe.
 */
export function esVentaEnConciliacionPago(venta: {
  estado: string;
  etapaPendiente: string | null;
}): boolean {
  return venta.etapaPendiente === ETAPA_CONCILIACION_PAGO;
}

import { ETAPA_CONCILIACION_PAGO } from './venta-estados';

function maskValue(value?: string | null, visibleStart = 4, visibleEnd = 4): string | null {
  if (!value) {
    return null;
  }
  const text = String(value);
  if (text.length <= visibleStart + visibleEnd) {
    return `${text.slice(0, 2)}****`;
  }
  return `${text.slice(0, visibleStart)}****${text.slice(-visibleEnd)}`;
}

function maskCuit(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const text = String(value);
  if (text.length <= 4) {
    return '****';
  }
  return `${text.slice(0, 2)}******${text.slice(-3)}`;
}

/**
 * Formato público del contrato TPV para el admin de una empresa.
 */
export function formatVentaResponse(venta: any) {
  const transaccionId = venta.bancoTransaccionId || venta.billeteraTransaccionId || null;

  return {
    id: venta.idVentaExternal || String(venta.id),
    id_venta: venta.idVentaExternal || String(venta.id),
    estado: (venta.estado || 'BORRADOR').toLowerCase(),
    etapa_pendiente: venta.etapaPendiente || null,
    requiere_conciliacion: venta.etapaPendiente === ETAPA_CONCILIACION_PAGO,
    intentos: venta.intentos || 0,
    comercio_cuit: venta.cuit,
    comercio: {
      cuit: venta.cuit,
      razonSocial: venta.comercio?.razonSocial || `Comercio CUIT ${venta.cuit}`,
    },
    lineas: (venta.items || []).map((item: any) => ({
      producto_id: item.producto?.codigo || item.productoId,
      descripcion: item.producto?.nombre || `Producto ${item.productoId}`,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
      subtotal: item.subtotal,
    })),
    subtotal: venta.subtotal,
    percepcion: venta.percepcionArba || 0,
    total: venta.montoTotal,
    medio_pago: venta.medioPago,
    pago: {
      monto: venta.montoTotal,
      medio_pago: venta.medioPago,
      transaccion_id: transaccionId,
      cuenta_origen: venta.cuentaOrigen || null,
      cuenta_destino: venta.cuentaDestino || null,
      cuit_pagador: venta.cuitPagador || null,
      confirmado: !!transaccionId,
    },
    comprobante: {
      cae: venta.cae || null,
      numero: venta.comprobanteNumero || null,
      fecha_vencimiento: venta.fechaVencimientoCae || null,
      tipo: venta.tipoComprobante || 'FACTURA_B',
    },
    error_detalle: venta.errorDetalle || null,
    observacion_conciliacion: venta.observacionConciliacion || null,
    createdAt: venta.createdAt,
  };
}

/**
 * Formato de solo lectura para análisis del superadmin.
 * No expone contraseñas, tokens ni credenciales; enmascara datos financieros sensibles.
 */
export function formatVentaAnalitica(venta: any) {
  const base = formatVentaResponse(venta);
  return {
    ...base,
    empresa_id: venta.empresaId,
    pago: {
      ...base.pago,
      cuenta_origen: maskValue(base.pago.cuenta_origen),
      cuenta_destino: maskValue(base.pago.cuenta_destino),
      cuit_pagador: maskCuit(base.pago.cuit_pagador),
    },
  };
}

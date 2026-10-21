/**
 * Funciones de validación y utilidades numéricas para ARBA.
 */

// El CUIT debe ser un string de exactamente 11 dígitos numéricos
function validarCuit(cuit) {
  return typeof cuit === 'string' && /^\d{11}$/.test(cuit);
}

// El monto debe ser un número finito estrictamente mayor a 0
function validarMonto(monto) {
  return typeof monto === 'number' && Number.isFinite(monto) && monto > 0;
}

// id_venta debe ser un string no vacío
function validarIdVenta(idVenta) {
  return typeof idVenta === 'string' && idVenta.trim().length > 0;
}

// La alícuota debe ser un número entre 0 y 1 (o hasta 100% como 1.0)
function validarAlicuota(alicuota) {
  return typeof alicuota === 'number' && Number.isFinite(alicuota) && alicuota >= 0 && alicuota <= 1;
}

// La actividad debe ser un string no vacío
function validarActividad(actividad) {
  return typeof actividad === 'string' && actividad.trim().length > 0;
}

// Redondeo exacto a 2 decimales para importes monetarios
function round2(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

module.exports = {
  validarCuit,
  validarMonto,
  validarIdVenta,
  validarAlicuota,
  validarActividad,
  round2,
};

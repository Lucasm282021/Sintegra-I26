function validarCuit(cuit) {
  return typeof cuit === 'string' && /^\d{11}$/.test(cuit);
}

function validarMonto(monto) {
  return typeof monto === 'number' && Number.isFinite(monto) && monto > 0;
}

function validarIdVenta(idVenta) {
  return typeof idVenta === 'string' && idVenta.trim().length > 0;
}

function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

module.exports = { validarCuit, validarMonto, validarIdVenta, round2 };

/**
 * Limpia el CUIT removiendo espacios, guiones y puntos.
 */
export function cleanCuit(cuit) {
  if (!cuit) return '';
  return String(cuit).replace(/[\s.-]/g, '');
}

/**
 * Valida si un CUIT tiene exactamente 11 dígitos numéricos.
 */
export function isValidCuit(cuit) {
  return /^\d{11}$/.test(cleanCuit(cuit));
}

/**
 * Formatea un número decimal a porcentaje (ej: 0.03 -> "3%", 0.025 -> "2,5%").
 */
export function formatPercent(alicuota) {
  if (alicuota === undefined || alicuota === null || isNaN(alicuota)) return '-';
  const val = Number(alicuota) * 100;
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 3
  }).format(val) + '%';
}

/**
 * Formatea un monto numérico a moneda local ($ ARS).
 */
export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '$ 0,00';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  }).format(amount);
}

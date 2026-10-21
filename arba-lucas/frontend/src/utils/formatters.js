/**
 * Utilidades y formateadores para ARBA
 */

export const formatCurrency = (val) => {
  const num = Number(val) || 0;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(num);
};

export const formatPercent = (decimal) => {
  const num = (Number(decimal) || 0) * 100;
  return `${num.toFixed(2).replace('.', ',')}%`;
};

export const formatDecimal = (val) => {
  const num = Number(val) || 0;
  return num.toFixed(4);
};

export const formatCuit = (cuit) => {
  if (!cuit || cuit.length !== 11) return cuit || '-';
  return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`;
};

export const formatDateTime = (isoStr) => {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('es-AR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  } catch {
    return isoStr;
  }
};

export const generateSaleId = () => `venta-${Math.floor(100000 + Math.random() * 900000)}`;

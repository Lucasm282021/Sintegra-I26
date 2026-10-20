/**
 * Utilidades de formato para la consola ARBA
 */

export function round2(val) {
  const num = typeof val === 'number' ? val : Number(val);
  return Math.round(num * 100) / 100;
}

export function formatCurrency(amount) {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
    return '$ 0,00';
  }
  const num = Number(amount);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPercent(decimal) {
  if (decimal === undefined || decimal === null || Number.isNaN(Number(decimal))) {
    return '0,00%';
  }
  const pct = Number(decimal) * 100;
  return `${pct.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function formatCuit(cuit) {
  if (!cuit || typeof cuit !== 'string') return '';
  const clean = cuit.replace(/\D/g, '');
  if (clean.length === 11) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
  }
  return cuit;
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

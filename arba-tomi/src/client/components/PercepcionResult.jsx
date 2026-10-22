import React from 'react';
import { AlertCircle, CheckCircle2, ReceiptText } from 'lucide-react';
import { formatCurrency, formatPercent, formatCuit, formatDateTime } from '../utils/formatters';

export function PercepcionResult({ result }) {
  if (!result) return <div className="content-card flex min-h-[320px] flex-col items-center justify-center text-center"><span className="card-icon"><ReceiptText className="h-5 w-5"/></span><h2 className="mt-4 text-sm font-semibold text-slate-200">Esperando una operación</h2><p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">Completá los datos de una venta para ver el resultado de la simulación.</p></div>;
  const { status, ok, isIdempotent, data, isNetworkError, error } = result;
  let title = 'No se pudo completar la operación';
  let description = error || data?.error || 'Revisá los datos e intentá nuevamente.';
  if (ok) { title = isIdempotent ? 'Operación ya registrada' : 'Percepción calculada'; description = isIdempotent ? 'Esta venta ya había sido procesada. Se muestra el resultado existente.' : 'La operación se registró correctamente.'; }
  else if (isNetworkError) { title = 'No pudimos conectar'; description = 'Intentá nuevamente dentro de unos minutos.'; }
  else if (status === 404) { title = 'CUIT no encontrado'; description = 'No encontramos ese CUIT en el padrón disponible.'; }
  else if (status === 409) { title = 'La venta ya existe'; description = 'El número de venta ya se utilizó con otros datos.'; }
  else if (status === 400) { title = 'Revisá los datos'; description = data?.error || 'Verificá el CUIT, el número de venta y el monto.'; }
  const Icon = ok ? CheckCircle2 : AlertCircle;
  return <div className="content-card flex flex-col">
    <div className={`notice-${ok ? 'success' : 'error'}`}><Icon className="h-4 w-4 shrink-0"/><div><p className="font-semibold">{title}</p><p className="mt-1">{description}</p></div></div>
    {ok && data && <div className="mt-5 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950/40 px-4">
      <ResultRow label="Número de venta" value={data.id_venta}/><ResultRow label="CUIT" value={formatCuit(data.cuit)}/><ResultRow label="Monto de venta" value={formatCurrency(data.monto_venta)}/><ResultRow label="Alícuota" value={formatPercent(data.alicuota_aplicada)}/><ResultRow label="Percepción" value={formatCurrency(data.monto_percepcion)} prominent/>{data.fecha && <ResultRow label="Fecha" value={formatDateTime(data.fecha)} />}
    </div>}
  </div>;
}

function ResultRow({ label, value, prominent }) { return <div className="flex items-center justify-between gap-4 py-3"><span className="text-xs text-slate-400">{label}</span><span className={`text-right text-sm ${prominent ? 'font-bold text-emerald-300' : 'font-medium text-slate-200'}`}>{value}</span></div>; }

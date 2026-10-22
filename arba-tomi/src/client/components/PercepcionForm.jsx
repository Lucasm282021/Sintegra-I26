import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Calculator, RefreshCw } from 'lucide-react';
import { formatCurrency, formatPercent, round2, formatCuit } from '../utils/formatters';

export function PercepcionForm({ padronItems, selectedCuit, onCalculate, isSubmitting }) {
  const [saleId, setSaleId] = useState('venta-101');
  const [cuit, setCuit] = useState('30712345678');
  const [amount, setAmount] = useState('10200.00');
  useEffect(() => { if (selectedCuit) setCuit(selectedCuit); }, [selectedCuit]);
  const cleanCuit = cuit.trim().replace(/[-.]/g, '');
  const contributor = useMemo(() => padronItems.find((item) => item.cuit === cleanCuit), [padronItems, cleanCuit]);
  const numericAmount = Number.parseFloat(amount);
  const validAmount = Number.isFinite(numericAmount) && numericAmount > 0;
  const rate = contributor ? contributor.alicuota : null;
  const estimated = rate !== null && validAmount ? round2(numericAmount * rate) : null;
  const newSaleId = () => setSaleId(`venta-${Math.floor(100 + Math.random() * 900)}`);
  const submit = (event) => { event.preventDefault(); if (!saleId.trim() || cleanCuit.length !== 11 || !validAmount) return; onCalculate({ id_venta: saleId.trim(), cuit: cleanCuit, monto_venta: round2(numericAmount) }); };

  return <form onSubmit={submit} className="content-card space-y-5">
    <div className="flex items-center gap-3"><span className="card-icon"><Calculator className="h-5 w-5"/></span><div><h2 className="text-sm font-bold text-white">Simulador de percepción</h2><p className="mt-1 text-xs text-slate-400">Calculá el importe estimado de una venta.</p></div></div>
    <div className="space-y-4">
      <label className="block"><span className="field-label">Número de venta</span><div className="flex gap-2"><input className="form-input" value={saleId} onChange={(event) => setSaleId(event.target.value)} placeholder="Ej. venta-001" required/><button type="button" onClick={newSaleId} className="button-secondary shrink-0" title="Generar otro número"><RefreshCw className="h-4 w-4"/><span className="hidden sm:inline">Nuevo</span></button></div></label>
      <label className="block"><span className="field-label">CUIT del sujeto</span><input className="form-input" inputMode="numeric" maxLength="13" value={cuit} onChange={(event) => setCuit(event.target.value)} placeholder="00-00000000-0" required/>{padronItems.length > 0 && <select className="form-input mt-2" value={cleanCuit} onChange={(event) => setCuit(event.target.value)}><option value="">Seleccioná del padrón</option>{padronItems.map((item) => <option key={item.cuit} value={item.cuit}>{formatCuit(item.cuit)} · {item.razon_social || item.actividad}</option>)}</select>}</label>
      <label className="block"><span className="field-label">Monto de venta ($)</span><input className="form-input" type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="10200.00" required/></label>
    </div>
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"><div className="flex items-center justify-between text-xs text-slate-400"><span>Estimación</span><span>{rate === null ? 'Alícuota no disponible' : formatPercent(rate)}</span></div><div className="mt-3 flex items-end justify-between gap-3"><span className="text-xs text-slate-400">Percepción estimada</span><span className="text-xl font-bold text-emerald-300">{estimated !== null ? formatCurrency(estimated) : '—'}</span></div><p className="mt-2 text-[10px] leading-4 text-slate-500">Valores ficticios para uso académico.</p></div>
    <button type="submit" disabled={isSubmitting || !saleId.trim() || cleanCuit.length !== 11 || !validAmount} className="button-primary w-full">{isSubmitting ? 'Calculando…' : 'Calcular percepción'}<ArrowRight className="h-4 w-4"/></button>
  </form>;
}

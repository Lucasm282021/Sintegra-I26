import React, { useMemo, useState } from 'react';
import { Building2, Plus, Search, Pencil, Trash2, X, ShieldCheck, ReceiptText, Users, CircleCheck, CircleOff } from 'lucide-react';
import { formatCuit, formatPercent } from '../utils/formatters';

const emptyForm = {
  cuit: '', razon_social: '', actividad: '', alicuota: '0.03', estado: 'activo',
  aplicaciones: { arba_iibb: true, arca_facturacion: false },
};

export function ComerciosPanel({ items, onCreate, onUpdate, onDelete, isLoading, error, mode }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => items.filter((item) => {
    const term = query.trim().toLowerCase();
    const matchesTerm = !term || [item.razon_social, item.actividad, item.cuit].some((value) => String(value || '').toLowerCase().includes(term));
    return matchesTerm && (statusFilter === 'todos' || item.estado === statusFilter);
  }), [items, query, statusFilter]);

  const activeCount = items.filter((item) => item.estado !== 'inactivo').length;
  const enabledApps = items.reduce((sum, item) => sum + Number(item.aplicaciones?.arba_iibb !== false) + Number(item.aplicaciones?.arca_facturacion === true), 0);

  const openNew = () => {
    setEditing('nuevo'); setForm(emptyForm); setFormError('');
  };

  const openEdit = (item) => {
    setEditing(item.cuit);
    setForm({ ...item, alicuota: String(item.alicuota), estado: item.estado || 'activo', aplicaciones: { arba_iibb: true, arca_facturacion: false, ...item.aplicaciones } });
    setFormError('');
  };

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const updateApp = (key, value) => setForm((prev) => ({ ...prev, aplicaciones: { ...prev.aplicaciones, [key]: value } }));

  const submit = async (event) => {
    event.preventDefault();
    const cuit = form.cuit.replace(/\D/g, '');
    const alicuota = Number(form.alicuota);
    if (!/^\d{11}$/.test(cuit)) return setFormError('Ingresá un CUIT de 11 dígitos.');
    if (!form.razon_social.trim() || !form.actividad.trim()) return setFormError('Completá la razón social y la actividad.');
    if (!Number.isFinite(alicuota) || alicuota < 0 || alicuota > 1) return setFormError('La alícuota debe estar entre 0 y 1 (por ejemplo, 0,03 para 3%).');
    setSaving(true); setFormError('');
    const payload = { ...form, cuit, alicuota };
    const result = editing === 'nuevo' ? await onCreate(payload) : await onUpdate(editing, payload);
    setSaving(false);
    if (!result?.ok) return setFormError(result?.data?.error === 'cuit ya registrado' ? 'Ya existe un comercio con ese CUIT.' : result?.data?.error || 'No se pudo guardar el comercio.');
    setEditing(null);
  };

  const remove = async (item) => {
    if (!window.confirm(`¿Eliminar a ${item.razon_social} (${formatCuit(item.cuit)}) del padrón?`)) return;
    await onDelete(item.cuit);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono uppercase tracking-[0.16em] mb-2">
            <Building2 className="w-4 h-4" /> Administración general
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Comercios y aplicaciones fiscales</h2>
          <p className="text-sm text-slate-400 mt-1">Gestioná los comercios registrados y sus módulos tributarios.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors shadow-lg shadow-emerald-950/30">
          <Plus className="w-4 h-4" /> Nuevo comercio
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metric icon={Users} label="Comercios registrados" value={items.length} tone="sky" />
        <Metric icon={CircleCheck} label="Activos" value={activeCount} tone="emerald" />
        <Metric icon={ShieldCheck} label="Aplicaciones habilitadas" value={enabledApps} tone="violet" />
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por comercio, CUIT o actividad..." className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Estado</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500/60">
              <option value="todos">Todos</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option>
            </select>
            <span className="text-xs font-mono text-slate-500 pl-1">{filtered.length} resultados</span>
          </div>
        </div>

        {error && <div className="px-4 py-3 bg-rose-500/10 border-b border-rose-500/20 text-sm text-rose-300">{error}</div>}
        {mode === 'demo' && <div className="px-4 py-2 bg-amber-500/5 border-b border-slate-800 text-[11px] text-amber-300/80 font-mono">Modo Demo · Los cambios se guardan en este navegador.</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[850px]">
            <thead className="bg-slate-950/70 text-[10px] uppercase tracking-wider text-slate-500 font-mono">
              <tr><th className="px-4 py-3 font-medium">Comercio</th><th className="px-4 py-3 font-medium">CUIT</th><th className="px-4 py-3 font-medium">Actividad</th><th className="px-4 py-3 font-medium">Alícuota IIBB</th><th className="px-4 py-3 font-medium">Aplicaciones fiscales</th><th className="px-4 py-3 font-medium">Estado</th><th className="px-4 py-3 text-right font-medium">Acciones</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {isLoading ? <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-slate-500">Cargando comercios…</td></tr>
                : filtered.length === 0 ? <tr><td colSpan="7" className="px-4 py-12 text-center text-sm text-slate-500">No se encontraron comercios.</td></tr>
                  : filtered.map((item) => <tr key={item.cuit} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3"><div className="text-sm font-medium text-slate-200">{item.razon_social}</div><div className="text-[11px] text-slate-500 mt-0.5">{item.estado === 'inactivo' ? 'Sin operaciones' : 'En operación'}</div></td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{formatCuit(item.cuit)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{item.actividad}</td>
                    <td className="px-4 py-3"><span className="text-sm font-mono text-emerald-300">{formatPercent(item.alicuota)}</span></td>
                    <td className="px-4 py-3"><div className="flex gap-1.5 flex-wrap">
                      {item.aplicaciones?.arba_iibb !== false && <AppBadge icon={ShieldCheck} label="ARBA · IIBB" tone="emerald" />}
                      {item.aplicaciones?.arca_facturacion && <AppBadge icon={ReceiptText} label="ARCA · Facturación" tone="sky" />}
                      {item.aplicaciones?.arba_iibb === false && !item.aplicaciones?.arca_facturacion && <span className="text-[11px] text-slate-600">Sin aplicaciones</span>}
                    </div></td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold border ${item.estado === 'inactivo' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'}`}><span className={`w-1.5 h-1.5 rounded-full ${item.estado === 'inactivo' ? 'bg-slate-500' : 'bg-emerald-400'}`} />{item.estado === 'inactivo' ? 'Inactivo' : 'Activo'}</span></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1.5">
                      <button onClick={() => openEdit(item)} title="Editar comercio" className="p-2 rounded-md border border-slate-700 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/40 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => remove(item)} title="Eliminar comercio" className="p-2 rounded-md border border-slate-700 text-slate-400 hover:text-rose-300 hover:border-rose-500/40 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div></td>
                  </tr>)}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500"><span>Padrón general · {items.length} comercios</span><span>Aplicaciones enlazadas al módulo fiscal</span></div>
      </div>

      {editing && <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
        <form onSubmit={submit} className="w-full max-w-2xl bg-[#101827] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
          <div className="flex items-start justify-between px-6 py-5 border-b border-slate-800">
            <div><div className="text-[10px] font-mono uppercase tracking-[0.16em] text-emerald-400 mb-1">Registro de comercios</div><h3 className="text-lg font-bold text-white">{editing === 'nuevo' ? 'Dar de alta un comercio' : 'Editar comercio'}</h3><p className="text-xs text-slate-500 mt-1">Los cambios se reflejan en el padrón utilizado por ARBA.</p></div>
            <button type="button" onClick={() => setEditing(null)} className="p-2 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="CUIT" hint="11 dígitos, sin guiones"><input required disabled={editing !== 'nuevo'} maxLength={13} value={form.cuit} onChange={(e) => updateField('cuit', e.target.value)} placeholder="30-12345678-9" className={inputClass} /></Field>
              <Field label="Razón social"><input required maxLength={100} value={form.razon_social} onChange={(e) => updateField('razon_social', e.target.value)} placeholder="Nombre del comercio" className={inputClass} /></Field>
              <Field label="Actividad económica"><input required maxLength={100} value={form.actividad} onChange={(e) => updateField('actividad', e.target.value)} placeholder="Ej. Comercio minorista" className={inputClass} /></Field>
              <Field label="Alícuota ARBA · IIBB" hint="Decimal: 0,03 equivale a 3%"><div className="relative"><input required type="number" min="0" max="1" step="0.001" value={form.alicuota} onChange={(e) => updateField('alicuota', e.target.value)} className={`${inputClass} pr-10 font-mono`} /><span className="absolute right-3 top-2.5 text-xs text-slate-500">{formatPercent(Number(form.alicuota) || 0)}</span></div></Field>
              <Field label="Estado del comercio"><select value={form.estado} onChange={(e) => updateField('estado', e.target.value)} className={inputClass}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></Field>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-300 mb-2">Aplicaciones fiscales</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AppToggle checked={form.aplicaciones.arba_iibb} onChange={(value) => updateApp('arba_iibb', value)} icon={ShieldCheck} title="ARBA · IIBB" description="Habilita el comercio para el padrón y simulador de percepciones." />
                <AppToggle checked={form.aplicaciones.arca_facturacion} onChange={(value) => updateApp('arca_facturacion', value)} icon={ReceiptText} title="ARCA · Facturación" description="Registra que esta aplicación fiscal está habilitada para el comercio." />
              </div>
              {!form.aplicaciones.arba_iibb && <p className="mt-2 text-[11px] text-amber-300/80 flex items-center gap-1"><CircleOff className="w-3 h-3" /> Este comercio no podrá usarlo para simular percepciones.</p>}
            </div>
            {formError && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{formError}</div>}
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-800 bg-slate-950/30"><button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800">Cancelar</button><button disabled={saving} type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white">{saving ? 'Guardando…' : 'Guardar comercio'}</button></div>
        </form>
      </div>}
    </section>
  );
}

const inputClass = 'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60 disabled:opacity-50 disabled:cursor-not-allowed';

function Field({ label, hint, children }) { return <label className="block"><span className="block text-xs font-medium text-slate-300 mb-1.5">{label}</span>{children}{hint && <span className="block text-[10px] text-slate-600 mt-1">{hint}</span>}</label>; }

function Metric({ icon: Icon, label, value, tone }) {
  const tones = { emerald: 'text-emerald-400', sky: 'text-sky-400', violet: 'text-violet-400' };
  return <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4"><div className="flex items-center justify-between text-xs text-slate-500"><span>{label}</span><Icon className={`w-4 h-4 ${tones[tone]}`} /></div><div className="mt-2 text-2xl font-bold font-mono text-white tabular-nums">{value}</div></div>;
}

function AppBadge({ icon: Icon, label, tone }) {
  const tones = { emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20', sky: 'text-sky-300 bg-sky-500/10 border-sky-500/20' };
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] border ${tones[tone]}`}><Icon className="w-3 h-3" />{label}</span>;
}

function AppToggle({ checked, onChange, icon: Icon, title, description }) {
  return <label className={`flex gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${checked ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 bg-slate-950/50 hover:border-slate-700'}`}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" /><span className={`mt-0.5 w-8 h-8 shrink-0 rounded-lg flex items-center justify-center border ${checked ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' : 'text-slate-500 bg-slate-800 border-slate-700'}`}><Icon className="w-4 h-4" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-slate-200">{title}</span><span className="block text-[10px] leading-relaxed text-slate-500 mt-0.5">{description}</span></span><span className={`mt-1 w-8 h-[18px] rounded-full p-0.5 transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`}><span className={`block w-3.5 h-3.5 bg-white rounded-full transition-transform ${checked ? 'translate-x-3.5' : ''}`} /></span></label>;
}

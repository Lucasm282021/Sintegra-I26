import React, { useState } from 'react';
import { History, Search, FileCode, Check, Copy, X, ArrowDownRight, RefreshCw, AlertCircle } from 'lucide-react';
import { formatCurrency, formatPercent, formatCuit, formatDateTime } from '../utils/formatters';

export function AuditHistory({
  percepciones,
  onQueryAuditByCuit,
  isLoading,
  error,
  mode,
  padronList,
}) {
  const [filterCuit, setFilterCuit] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [copied, setCopied] = useState(false);
  const [auditQueryCuit, setAuditQueryCuit] = useState('30712345678');
  const [queryError, setQueryError] = useState(null);

  // Filtrado de la tabla por CUIT
  const filteredList = percepciones.filter((item) => {
    if (!filterCuit.trim()) return true;
    const term = filterCuit.replace(/[-.]/g, '').toLowerCase();
    return (item.cuit || '').includes(term) || (item.id_venta || '').toLowerCase().includes(term);
  });

  const handleCopyJson = () => {
    if (!selectedRecord) return;
    navigator.clipboard.writeText(JSON.stringify(selectedRecord, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunAuditQuery = async (e) => {
    e.preventDefault();
    const clean = auditQueryCuit.replace(/\D/g, '');
    if (clean.length !== 11) {
      setQueryError('El CUIT debe tener exactamente 11 dígitos.');
      return;
    }
    setQueryError(null);
    const res = await onQueryAuditByCuit(clean);
    if (!res.ok) {
      setQueryError(res.data?.error || res.error || 'Error al consultar historial.');
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Historial y Auditoría de Percepciones
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              ({percepciones.length} cargadas)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Ruta complementaria de auditoría: <code className="font-mono text-slate-300">GET /arba/percepciones/{'{cuit}'}</code>
          </p>
        </div>

        {/* Formulario de consulta puntual por CUIT en la API */}
        <form onSubmit={handleRunAuditQuery} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
            <span className="text-[11px] text-slate-400 font-mono">Consultar CUIT:</span>
            <input
              type="text"
              value={auditQueryCuit}
              onChange={(e) => {
                setAuditQueryCuit(e.target.value);
                setQueryError(null);
              }}
              placeholder="30712345678"
              className="w-32 bg-transparent text-xs font-mono text-white focus:outline-none placeholder:text-slate-600"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-3 py-1 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-mono transition-colors flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Consultar</span>
          </button>
        </form>
      </div>

      {queryError && (
        <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-xs text-rose-300 flex items-center gap-2 font-mono">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{queryError}</span>
        </div>
      )}

      {/* Toolbar de filtro en memoria */}
      <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterCuit}
            onChange={(e) => setFilterCuit(e.target.value)}
            placeholder="Filtrar por CUIT o ID venta..."
            className="w-full bg-slate-900 border border-slate-800 rounded pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-600 font-mono focus:outline-none focus:border-sky-500"
          />
        </div>
        <div className="text-[11px] text-slate-400 font-mono">
          Total registros cargados en vista: <strong className="text-white">{filteredList.length}</strong>
        </div>
      </div>

      {/* Tabla de auditoría */}
      <div className="overflow-x-auto min-h-[180px]">
        {filteredList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            {percepciones.length === 0
              ? 'No hay registros cargados. Realice una simulación o consulte un CUIT con el botón superior.'
              : 'No hay percepciones que coincidan con el filtro.'}
          </div>
        ) : (
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-medium text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-4">Fecha</th>
                <th className="py-2.5 px-4">ID Percepción</th>
                <th className="py-2.5 px-4">ID Venta</th>
                <th className="py-2.5 px-4">CUIT</th>
                <th className="py-2.5 px-4 text-right">Monto Venta</th>
                <th className="py-2.5 px-4 text-right">Alícuota</th>
                <th className="py-2.5 px-4 text-right">Percepción</th>
                <th className="py-2.5 px-4 text-center">Origen</th>
                <th className="py-2.5 px-4 text-center">JSON</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredList.map((row) => (
                <tr key={`${row.id_venta}-${row.id}`} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                    {formatDateTime(row.fecha)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-300 font-bold">
                    #{row.id}
                  </td>
                  <td className="py-2.5 px-4 text-emerald-400">
                    {row.id_venta}
                  </td>
                  <td className="py-2.5 px-4 text-white">
                    {formatCuit(row.cuit)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-slate-300 tabular-nums">
                    {formatCurrency(row.monto_venta)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-emerald-400 tabular-nums">
                    {formatPercent(row.alicuota_aplicada)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-white font-bold tabular-nums">
                    {formatCurrency(row.monto_percepcion)}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.origen === 'Demo'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {row.origen || (mode === 'demo' ? 'Demo' : 'API')}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedRecord(row)}
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                      title="Ver JSON completo de auditoría"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Inspector JSON */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#111827] border border-slate-700 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Registro de Auditoría #{selectedRecord.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-mono">Payload JSON:</span>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono flex items-center gap-1 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-400 overflow-x-auto max-h-72 leading-relaxed">
                {JSON.stringify(selectedRecord, null, 2)}
              </pre>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

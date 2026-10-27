import React, { useState } from 'react';
import { Search, RefreshCw, Eye, ArrowUpRight, AlertCircle, Building2 } from 'lucide-react';
import { formatPercent, formatCuit } from '../utils/formatters';

export function PadronTable({
  items,
  total,
  page,
  limit,
  onPageChange,
  onLimitChange,
  isLoading,
  error,
  onRefresh,
  onSelectDetail,
  onSelectForSimulation,
  onLookupDirectCuit,
  mode,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [directCuitLoading, setDirectCuitLoading] = useState(false);
  const [directCuitError, setDirectCuitError] = useState(null);

  // Búsqueda local sobre los elementos cargados
  const filteredItems = items.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().replace(/[-.]/g, '');
    const cuitMatch = item.cuit.includes(term);
    const actMatch = (item.actividad || '').toLowerCase().includes(searchTerm.toLowerCase());
    const razonMatch = (item.razon_social || '').toLowerCase().includes(searchTerm.toLowerCase());
    return cuitMatch || actMatch || razonMatch;
  });

  const totalPages = Math.max(1, Math.ceil((total || items.length) / limit));

  // Consulta directa de CUIT en backend si el usuario escribe 11 dígitos y no aparece
  const handleDirectLookup = async () => {
    const clean = searchTerm.replace(/\D/g, '');
    if (clean.length !== 11) {
      setDirectCuitError('Ingrese un CUIT válido de 11 dígitos para consulta puntual.');
      return;
    }
    setDirectCuitLoading(true);
    setDirectCuitError(null);
    try {
      const res = await onLookupDirectCuit(clean);
      if (!res.ok) {
        setDirectCuitError(res.data?.error || 'CUIT no encontrado en padrón.');
      } else {
        onSelectDetail(res.data);
      }
    } catch (err) {
      setDirectCuitError('Error al consultar CUIT directo.');
    } finally {
      setDirectCuitLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* Table Header / Toolbar */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/40">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">
              Sujetos habilitados
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              ({total !== null ? `${total} en total` : `${items.length} registros`})
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Consultá los sujetos disponibles para operar
          </p>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setDirectCuitError(null);
              }}
              placeholder="Buscar por CUIT o actividad..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            title="Recargar padrón"
            className="p-2 text-slate-400 hover:text-white bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Direct Lookup Helper when search is 11 digits */}
      {searchTerm.replace(/\D/g, '').length === 11 && filteredItems.length === 0 && (
        <div className="px-4 py-2.5 bg-sky-500/10 border-b border-sky-500/20 text-xs text-sky-300 flex items-center justify-between">
          <span>
            No encontramos este CUIT en la lista. ¿Querés consultarlo?
          </span>
          <button
            type="button"
            onClick={handleDirectLookup}
            disabled={directCuitLoading}
            className="px-3 py-1 bg-[#14214F] hover:bg-[#1E2F6B] text-[#ffffff] rounded text-xs font-medium font-mono transition-colors"
          >
            {directCuitLoading ? 'Consultando...' : 'Consultar CUIT'}
          </button>
        </div>
      )}

      {directCuitError && (
        <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>{directCuitError}</span>
        </div>
      )}

      {/* Main Table */}
      <div className="overflow-x-auto min-h-[220px]">
        {error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-rose-300">Error al cargar el padrón</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">{error}</p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-4 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : isLoading && items.length === 0 ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 bg-slate-800/40 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No se encontraron contribuyentes que coincidan con la búsqueda.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium font-mono text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-4">CUIT</th>
                <th className="py-2.5 px-4">Actividad Económica</th>
                <th className="py-2.5 px-4 text-right">Alícuota</th>
                <th className="py-2.5 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredItems.map((row) => (
                <tr key={row.cuit} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="py-2.5 px-4 font-bold text-white tracking-wide">
                    {formatCuit(row.cuit)}
                  </td>
                  <td className="py-2.5 px-4 text-slate-300 font-sans">
                    <div>{row.actividad}</div>
                    {row.razon_social && (
                      <div className="text-[11px] text-slate-500 font-normal">{row.razon_social}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right text-white font-bold tabular-nums">
                    {formatPercent(row.alicuota)}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 font-sans">
                      <button
                        type="button"
                        onClick={() => onSelectDetail(row)}
                        title="Ver detalle del contribuyente"
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectForSimulation(row.cuit)}
                        title="Cargar CUIT en el simulador"
                        className="px-2 py-1 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded flex items-center gap-1 transition-colors"
                      >
                        <span>Simular</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>Filas por página:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 font-mono text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            ({total ?? items.length} sujetos)
          </span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto font-mono">
          <span>
            Pág. {page} de {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || isLoading}
              className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

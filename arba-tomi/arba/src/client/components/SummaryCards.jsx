import React from 'react';
import { Activity, Users, FileSpreadsheet, DollarSign } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export function SummaryCards({
  mode,
  healthStatus,
  padronCount,
  loadedPerceptionsCount,
  loadedTotalPerceptionsAmount,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Tarjeta 1: Estado del Servicio */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Estado del Servicio</span>
          <Activity className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          {mode === 'demo' ? (
            <div className="text-lg font-bold text-amber-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Modo Demo</span>
            </div>
          ) : healthStatus.connected ? (
            <div className="text-lg font-bold text-emerald-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>API Operativa</span>
            </div>
          ) : (
            <div className="text-lg font-bold text-rose-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>API Desconectada</span>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-1 font-mono">
            {mode === 'demo' ? 'Simulación en memoria' : `Endpoint /health: ${healthStatus.connected ? '200 OK' : 'Sin respuesta'}`}
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Origen</span>
          <span className="font-mono text-slate-300">{mode === 'demo' ? 'Local Demo' : 'REST API (:3003)'}</span>
        </div>
      </div>

      {/* Tarjeta 2: Padrón de Contribuyentes */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Padrón IIBB</span>
          <Users className="w-4 h-4 text-sky-400" />
        </div>
        <div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {padronCount !== null ? padronCount : '—'}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Contribuyentes registrados
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Origen de padrón</span>
          <span className="font-mono text-slate-300">{mode === 'demo' ? 'PADRON_DEMO (5)' : 'SQLite (/arba/padron)'}</span>
        </div>
      </div>

      {/* Tarjeta 3: Percepciones Cargadas en Sesión */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Historial en Pantalla</span>
          <FileSpreadsheet className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {loadedPerceptionsCount}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Operaciones auditadas
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Alcance</span>
          <span className="font-mono text-slate-300">Registros consultados</span>
        </div>
      </div>

      {/* Tarjeta 4: Total Acumulado */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Total Acumulado Cargado</span>
          <DollarSign className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums truncate">
            {formatCurrency(loadedTotalPerceptionsAmount)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Suma de percepciones en vista
          </p>
        </div>
        <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Métrica</span>
          <span className="font-mono text-slate-300">Total registros cargados</span>
        </div>
      </div>
    </div>
  );
}

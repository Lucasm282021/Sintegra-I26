import React from 'react';
import { X, ShieldAlert, ArrowUpRight, Building, Hash, Percent, Tag } from 'lucide-react';
import { formatPercent, formatCuit } from '../utils/formatters';

export function PadronDetailModal({ item, onClose, onSelectForSimulation }) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111827] border border-slate-700 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden">
        {/* Header modal */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Detalle de Contribuyente
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-3">
            <div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                CUIT Registrado
              </span>
              <div className="text-lg font-mono font-bold text-white tracking-wide">
                {formatCuit(item.cuit)}
                <span className="text-xs text-slate-500 font-normal ml-2">({item.cuit})</span>
              </div>
            </div>

            {item.razon_social && (
              <div>
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  Razón Social / Denominación
                </span>
                <div className="text-sm font-medium text-slate-200">
                  {item.razon_social}
                </div>
              </div>
            )}

            <div>
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                Actividad Económica Declarada
              </span>
              <div className="text-sm font-medium text-slate-200">
                {item.actividad}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                  <Percent className="w-3.5 h-3.5 text-emerald-400" />
                  Alícuota Decimal
                </span>
                <div className="text-base font-mono font-bold text-emerald-400">
                  {item.alicuota}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                  <Percent className="w-3.5 h-3.5 text-emerald-400" />
                  Porcentaje IIBB
                </span>
                <div className="text-base font-mono font-bold text-white">
                  {formatPercent(item.alicuota)}
                </div>
              </div>
            </div>
          </div>

          {/* Advertencia académica */}
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong>Alícuota académica ficticia:</strong> Este valor ha sido asignado de manera determinista para la simulación educativa del ecosistema fintech. No refleja la alícuota fiscal real del contribuyente ante la Agencia de Recaudación de la Provincia de Buenos Aires.
            </p>
          </div>
        </div>

        {/* Footer modal */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => {
              onSelectForSimulation(item.cuit);
              onClose();
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <span>Usar CUIT en Simulador</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

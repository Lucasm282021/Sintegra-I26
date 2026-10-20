import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Copy, Check, Terminal, FileCode2 } from 'lucide-react';
import { formatCurrency, formatPercent, formatCuit, formatDateTime } from '../utils/formatters';

export function PercepcionResult({ result }) {
  const [copied, setCopied] = useState(false);

  if (!result) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[320px]">
        <div className="w-12 h-12 rounded-xl bg-slate-800/60 flex items-center justify-center text-slate-500 mb-3">
          <Terminal className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-300">Esperando simulación</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Complete los datos en el simulador o use los accesos rápidos de prueba y presione "Calcular y registrar percepción".
        </p>
      </div>
    );
  }

  const { status, ok, isIdempotent, data, origin, isNetworkError, error } = result;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(data || { error }, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determinar badges y explicaciones según status HTTP
  let badgeConfig = {
    color: 'bg-slate-800 text-slate-300 border-slate-700',
    title: `HTTP ${status}`,
    desc: 'Respuesta recibida del módulo',
    icon: Terminal,
  };

  if (isNetworkError) {
    badgeConfig = {
      color: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
      title: 'Error de Red (API Desconectada)',
      desc: error || 'No se pudo conectar con el servidor ARBA.',
      icon: AlertCircle,
    };
  } else if (status === 201) {
    badgeConfig = {
      color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      title: 'HTTP 201 · Creado (Nueva Percepción)',
      desc: 'Percepción calculada y registrada exitosamente en el módulo ARBA.',
      icon: CheckCircle2,
    };
  } else if (status === 200) {
    badgeConfig = {
      color: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
      title: 'HTTP 200 · Reintento Idempotente',
      desc: 'El id_venta ya existía con datos idénticos (mismo CUIT y monto). Se devolvió el registro existente sin duplicar la operación.',
      icon: CheckCircle2,
    };
  } else if (status === 409) {
    badgeConfig = {
      color: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
      title: 'HTTP 409 · Conflicto de id_venta',
      desc: 'El id_venta ya fue utilizado previamente con otro CUIT o un monto diferente.',
      icon: AlertTriangle,
    };
  } else if (status === 404) {
    badgeConfig = {
      color: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
      title: 'HTTP 404 · CUIT No Encontrado',
      desc: 'El CUIT no se encuentra inscripto en el padrón de IIBB de la provincia.',
      icon: AlertCircle,
    };
  } else if (status === 400) {
    badgeConfig = {
      color: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
      title: 'HTTP 400 · Solicitud Inválida',
      desc: data?.error || 'Parámetros inválidos (id_venta, cuit o monto_venta).',
      icon: AlertCircle,
    };
  }

  const Icon = badgeConfig.icon;

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
      <div>
        {/* Header respuesta */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Respuesta Oficial del Servicio
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Origen: <strong className={origin === 'Demo' ? 'text-amber-400' : 'text-emerald-400'}>{origin}</strong>
          </span>
        </div>

        {/* Badge de Estado y Explicación */}
        <div className={`p-3.5 rounded-lg border ${badgeConfig.color} mb-4`}>
          <div className="flex items-center gap-2 font-mono font-bold text-xs">
            <Icon className="w-4 h-4 shrink-0" />
            <span>{badgeConfig.title}</span>
          </div>
          <p className="text-xs mt-1 leading-relaxed opacity-90">{badgeConfig.desc}</p>
        </div>

        {/* Resumen del registro si es 201 o 200 */}
        {ok && data && (
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 mb-4 text-xs font-mono space-y-2">
            <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-800/80">
              <div>
                <span className="text-[11px] text-slate-500 block">ID Percepción:</span>
                <span className="text-white font-bold">{data.id}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">ID Venta:</span>
                <span className="text-emerald-400 font-bold">{data.id_venta}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-800/80">
              <div>
                <span className="text-[11px] text-slate-500 block">CUIT Contribuyente:</span>
                <span className="text-white">{formatCuit(data.cuit)}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Alícuota Aplicada:</span>
                <span className="text-emerald-400 font-bold">
                  {formatPercent(data.alicuota_aplicada)} ({data.alicuota_aplicada})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[11px] text-slate-500 block">Monto de Venta:</span>
                <span className="text-white">{formatCurrency(data.monto_venta)}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Monto Percepción IIBB:</span>
                <span className="text-emerald-300 font-bold text-sm">
                  {formatCurrency(data.monto_percepcion)}
                </span>
              </div>
            </div>

            {data.fecha && (
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between">
                <span>Fecha registro:</span>
                <span>{formatDateTime(data.fecha)}</span>
              </div>
            )}
          </div>
        )}

        {/* Payload JSON Crudo */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono text-slate-400">Payload JSON Completo:</span>
            <button
              type="button"
              onClick={handleCopyJson}
              className="px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 font-mono transition-colors flex items-center gap-1"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copiar JSON</span>
                </>
              )}
            </button>
          </div>
          <pre className="bg-slate-950 border border-slate-800/90 rounded-lg p-3 text-xs font-mono text-emerald-400/90 overflow-x-auto max-h-48 leading-relaxed">
            {JSON.stringify(data || { error: error || 'Respuesta vacía' }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

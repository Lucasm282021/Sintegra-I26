import React, { useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Copy,
  Play,
  RotateCcw,
  Terminal,
  Trash2,
} from 'lucide-react';
import {
  clearTrafficLogs,
  crearComercio,
  getHealth,
  obtenerComercioPorCuit,
} from '../services/municipioService';
import { ApiTrafficLog, HttpStatusCode } from '../types/municipio';

interface TabInspectorApiProps {
  logs: ApiTrafficLog[];
  onResetSeed: () => Promise<void>;
  isFullTab?: boolean;
}

function getStatusStyle(status: HttpStatusCode): string {
  switch (status) {
    case 200:
      return 'text-emerald-800 bg-emerald-50 border-emerald-300';
    case 201:
      return 'text-blue-800 bg-blue-50 border-blue-300';
    case 400:
      return 'text-amber-800 bg-amber-50 border-amber-300';
    case 404:
      return 'text-orange-800 bg-orange-50 border-orange-300';
    case 409:
      return 'text-red-800 bg-red-50 border-red-300';
    default:
      return 'text-slate-800 bg-slate-100 border-slate-300';
  }
}

export const TabInspectorApi: React.FC<TabInspectorApiProps> = ({
  logs,
  onResetSeed,
  isFullTab = true,
}) => {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<number | 'todos'>('todos');
  const [copiedType, setCopiedType] = useState<'req' | 'res' | null>(null);

  const filteredLogs =
    statusFilter === 'todos' ? logs : logs.filter((l) => l.status === statusFilter);

  const activeLog =
    filteredLogs.find((l) => l.id === selectedLogId) || filteredLogs[0] || null;

  const handleCopy = (type: 'req' | 'res', data: unknown) => {
    navigator.clipboard?.writeText(JSON.stringify(data, null, 2));
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 1500);
  };

  const handleSimular400 = async () => {
    await obtenerComercioPorCuit('30-123'); // CUIT con guión y longitud inválida -> 400 Bad Request
  };

  const handleSimular404 = async () => {
    await obtenerComercioPorCuit('30999999999'); // CUIT inexistente -> 404 Not Found
  };

  const handleSimular409 = async () => {
    await crearComercio({
      cuit: '30712345678',
      razon_social: 'Molinos del Sur S.A.',
      condicion_fiscal: 'Responsable Inscripto',
      direccion: 'Av. Libertador Gral. San Martín 840',
      rubro_principal: 'Industria Alimenticia',
      rubro_secundario: 'Logística',
    });
  };

  return (
    <div className="space-y-5">
      {/* Toolbar: Contract Test Simulator & Filters */}
      <section
        aria-label="Controles del Inspector de Tráfico API"
        className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Inspector de Tráfico API en Tiempo Real (Puerto Local 3005)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              Auditoría de contratos REST · Códigos simulados: 200 OK · 201 Created · 400 Bad Request · 404 Not Found · 409 Conflict
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => getHealth()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold text-emerald-900 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3" />
              <span>GET /health (200)</span>
            </button>
            <button
              type="button"
              onClick={handleSimular400}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3" />
              <span>Simular 400</span>
            </button>
            <button
              type="button"
              onClick={handleSimular404}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold text-orange-900 bg-orange-50 border border-orange-300 hover:bg-orange-100 rounded-lg transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3" />
              <span>Simular 404</span>
            </button>
            <button
              type="button"
              onClick={handleSimular409}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold text-red-900 bg-red-50 border border-red-300 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3" />
              <span>Simular 409</span>
            </button>
            <button
              type="button"
              onClick={onResetSeed}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reiniciar Datos Semilla</span>
            </button>
            <button
              type="button"
              onClick={() => clearTrafficLogs()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpiar Log</span>
            </button>
          </div>
        </div>

        {/* Filter by HTTP Status Code */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['todos', 200, 201, 400, 404, 409] as const).map((code) => (
              <button
                key={String(code)}
                type="button"
                onClick={() => setStatusFilter(code)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === code
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {code === 'todos' ? `Todos (${logs.length})` : `HTTP ${code}`}
              </button>
            ))}
          </div>

          <div className="text-xs font-mono text-slate-500 tabular-nums">
            Host simulado: http://localhost:3005 · Eventos capturados: {filteredLogs.length}
          </div>
        </div>
      </section>

      {/* Master-Detail Log Viewer */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-12 gap-5 ${
          isFullTab ? 'min-h-[520px]' : ''
        }`}
      >
        {/* Left List: Chronological Requests */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Secuencia de Peticiones REST</span>
            <span className="font-mono text-slate-500">Latencia / Estado</span>
          </div>

          <div className="divide-y divide-slate-200 max-h-[520px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No hay trazas HTTP registradas para este filtro. Ejecute una acción o presione los botones de prueba superior.
              </div>
            ) : (
              filteredLogs.map((log) => {
                const isSelected = activeLog?.id === log.id;
                return (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => setSelectedLogId(log.id)}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                      isSelected ? 'bg-blue-50/90' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-xs font-bold ${
                            log.method === 'POST' ? 'text-blue-700' : 'text-slate-800'
                          }`}
                        >
                          {log.method}
                        </span>
                        <span className="font-mono text-xs text-slate-900 truncate">
                          {log.endpoint}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] font-mono text-slate-500 tabular-nums">
                        {log.timestamp.slice(11, 23)} · ID {log.id.slice(-5)}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block font-mono text-xs font-bold px-2 py-0.5 rounded border tabular-nums ${getStatusStyle(
                          log.status
                        )}`}
                      >
                        {log.statusText}
                      </span>
                      <div className="mt-1 text-[11px] font-mono text-slate-500 tabular-nums">
                        {log.latencyMs} ms
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Detail: Request & Response JSON */}
        <div className="lg:col-span-7 bg-slate-900 text-slate-100 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          {!activeLog ? (
            <div className="py-16 text-center text-xs font-mono text-slate-400">
              Seleccione una petición de la lista para inspeccionar su Request y Response JSON.
            </div>
          ) : (
            <>
              {/* Selected Request Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="font-bold text-blue-400">{activeLog.method}</span>
                  <span className="text-white font-semibold">
                    http://localhost:{activeLog.port}
                    {activeLog.endpoint}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                  <span
                    className={`font-bold ${
                      activeLog.status >= 400 ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    HTTP {activeLog.statusText}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-300">{activeLog.latencyMs} ms</span>
                </div>
              </div>

              {/* Request Body JSON */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>REQUEST BODY (JSON)</span>
                  {activeLog.requestBody !== null && (
                    <button
                      type="button"
                      onClick={() => handleCopy('req', activeLog.requestBody)}
                      className="inline-flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedType === 'req' ? 'Copiado' : 'Copiar Request'}</span>
                    </button>
                  )}
                </div>
                <pre className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto max-h-44">
                  {activeLog.requestBody
                    ? JSON.stringify(activeLog.requestBody, null, 2)
                    : '// Sin body (Petición GET)'}
                </pre>
              </div>

              {/* Response Body JSON */}
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>RESPONSE PAYLOAD (JSON)</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('res', activeLog.responseBody)}
                    className="inline-flex items-center gap-1 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedType === 'res' ? 'Copiado' : 'Copiar Response'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto max-h-72">
                  {JSON.stringify(activeLog.responseBody, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Panel inferior acoplable (Dock) para inspeccionar el tráfico API mientras se opera en las pestañas 1, 2 o 3.
 */
interface DockedTrafficInspectorProps {
  logs: ApiTrafficLog[];
  isOpen: boolean;
  onToggle: () => void;
  onOpenFullTab: () => void;
}

export const DockedTrafficInspector: React.FC<DockedTrafficInspectorProps> = ({
  logs,
  isOpen,
  onToggle,
  onOpenFullTab,
}) => {
  const latestLog = logs[0] || null;

  return (
    <aside
      aria-label="Panel inferior de tráfico API en vivo"
      className="bg-slate-900 text-slate-100 border-t border-slate-800 mt-10"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-11 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2.5 text-xs font-mono text-slate-200 hover:text-white transition-colors truncate cursor-pointer"
          >
            <Terminal className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="font-semibold">Inspector de Tráfico API (:3005)</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300 tabular-nums">{logs.length} eventos</span>
            {latestLog && (
              <>
                <span className="text-slate-500 hidden sm:inline">·</span>
                <span className="hidden sm:inline text-slate-300 truncate">
                  Último: {latestLog.method} {latestLog.endpoint} → HTTP {latestLog.statusText} ({latestLog.latencyMs}ms)
                </span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenFullTab}
              className="px-2.5 py-1 text-xs font-mono text-blue-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
            >
              Abrir Vista Completa
            </button>
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isOpen}
              aria-label={isOpen ? 'Contraer panel de tráfico API' : 'Expandir panel de tráfico API'}
              className="p-1 text-slate-300 hover:text-white bg-slate-800 rounded cursor-pointer"
            >
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="py-4 border-t border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-4 max-h-72 overflow-y-auto">
            <div className="lg:col-span-5 space-y-1.5">
              <div className="text-[11px] font-mono text-slate-400 uppercase">
                Últimas llamadas registradas
              </div>
              {logs.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-2 text-xs font-mono"
                >
                  <div className="truncate">
                    <span className="font-bold text-blue-400 mr-1.5">{log.method}</span>
                    <span className="text-slate-200">{log.endpoint}</span>
                  </div>
                  <span
                    className={`shrink-0 font-bold tabular-nums ${
                      log.status >= 400 ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {log.status} ({log.latencyMs}ms)
                  </span>
                </div>
              ))}
            </div>

            <div className="lg:col-span-7">
              <div className="text-[11px] font-mono text-slate-400 uppercase mb-1.5">
                Último Response JSON ({latestLog ? `${latestLog.method} ${latestLog.endpoint}` : 'Sin llamadas'})
              </div>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto max-h-48">
                {latestLog
                  ? JSON.stringify(
                      {
                        request: latestLog.requestBody,
                        response: latestLog.responseBody,
                      },
                      null,
                      2
                    )
                  : '// Sin actividad'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

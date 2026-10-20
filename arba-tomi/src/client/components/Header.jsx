import React, { useState } from 'react';
import { ShieldCheck, Server, AlertCircle, Database, Settings, CheckCircle2, XCircle, RefreshCw, LayoutDashboard, Building2 } from 'lucide-react';

export function Header({
  mode,
  onModeChange,
  healthStatus,
  apiBaseUrl,
  onApiBaseUrlChange,
  onCheckHealth,
  isCheckingHealth,
  activeView,
  onViewChange,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [tempUrl, setTempUrl] = useState(apiBaseUrl);

  const handleSaveSettings = (e) => {
    e.preventDefault();
    onApiBaseUrlChange(tempUrl);
    setShowSettings(false);
    onCheckHealth();
  };

  return (
    <header className="border-b border-slate-800/80 bg-[#0B0F19]/90 backdrop-blur sticky top-0 z-40">
      {/* Aviso institucional permanente */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            <strong>Aviso académico:</strong> Datos ficticios y deterministas para uso educativo — no representan alícuotas ni valores fiscales reales de ARBA oficial.
          </span>
        </div>
        <span className="hidden sm:inline font-mono text-[11px] text-amber-400/80">Ecosistema Fintech</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Zona 1: Título y Módulo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  ARBA <span className="text-slate-400 font-normal">· Percepción de IIBB</span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Módulo 3003 · Ecosistema Fintech simulado
              </p>
            </div>
          </div>

          {/* Zona 2: Selector de Modo & Estado */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center bg-slate-900/70 border border-slate-800 p-0.5 rounded-lg">
              <button type="button" onClick={() => onViewChange('panel')} className={`px-2.5 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-colors ${activeView === 'panel' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}><LayoutDashboard className="w-3.5 h-3.5" />Panel general</button>
              <button type="button" onClick={() => onViewChange('comercios')} className={`px-2.5 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-colors ${activeView === 'comercios' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}><Building2 className="w-3.5 h-3.5" />Comercios</button>
            </div>
            {/* Toggle de Modo Segmentado */}
            <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => onModeChange('api')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  mode === 'api'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Modo API</span>
              </button>
              <button
                type="button"
                onClick={() => onModeChange('demo')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  mode === 'demo'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Modo Demo</span>
              </button>
            </div>

            {/* Indicador de Estado de Conexión */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono border border-slate-800 bg-slate-900/60">
              {mode === 'demo' ? (
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Modo demo activo
                </span>
              ) : healthStatus.connected ? (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  API conectada ({healthStatus.latency || 'OK'})
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-rose-400">
                  <XCircle className="w-3.5 h-3.5" />
                  API desconectada
                </span>
              )}
            </div>

            {/* Botón de configuración de endpoint */}
            <button
              type="button"
              onClick={() => {
                setTempUrl(apiBaseUrl);
                setShowSettings(!showSettings);
              }}
              title="Configurar endpoint de API"
              className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="lg:hidden pb-3 flex items-center bg-slate-900/60 border border-slate-800 p-0.5 rounded-lg w-fit">
          <button type="button" onClick={() => onViewChange('panel')} className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-colors ${activeView === 'panel' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}><LayoutDashboard className="w-3.5 h-3.5" />Panel general</button>
          <button type="button" onClick={() => onViewChange('comercios')} className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition-colors ${activeView === 'comercios' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}><Building2 className="w-3.5 h-3.5" />Comercios</button>
        </div>

        {/* Panel de configuración colapsable */}
        {showSettings && (
          <div className="pb-4 pt-1 border-t border-slate-800 animate-fadeIn">
            <form onSubmit={handleSaveSettings} className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Configuración de Conexión REST
                </span>
                <span className="text-xs text-slate-400 font-mono">Puerto estándar: 3003</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <label htmlFor="apiBaseUrl" className="block text-xs text-slate-400 mb-1">
                    API Base URL (relativo o absoluto con CORS habilitado):
                  </label>
                  <input
                    id="apiBaseUrl"
                    type="text"
                    value={tempUrl}
                    onChange={(e) => setTempUrl(e.target.value)}
                    placeholder="/api o http://localhost:3003"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition-colors"
                  >
                    Guardar y verificar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTempUrl('/api');
                      onApiBaseUrlChange('/api');
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono transition-colors"
                  >
                    Reset (/api)
                  </button>
                  <button
                    type="button"
                    onClick={onCheckHealth}
                    disabled={isCheckingHealth}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                    Probar
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Por defecto, el frontend utiliza el proxy de Vite en <code className="text-emerald-400 font-mono">/api</code> que reenvía internamente las peticiones a <code className="text-emerald-400 font-mono">http://localhost:3003</code> evitando bloqueos CORS.
              </p>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}

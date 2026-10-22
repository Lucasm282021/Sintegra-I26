import React from 'react';
import { Activity, Building2, FileCheck2, ReceiptText, Terminal } from 'lucide-react';

export type ActiveTabId = 'padron' | 'cuentas' | 'comprobantes' | 'inspector';

interface HeaderGlobalProps {
  activeTab: ActiveTabId;
  onSelectTab: (tab: ActiveTabId) => void;
  apiOnline: boolean;
  lastHealthLatency: number | null;
  trafficCount: number;
  onPingHealth: () => void;
}

export const HeaderGlobal: React.FC<HeaderGlobalProps> = ({
  activeTab,
  onSelectTab,
  apiOnline,
  lastHealthLatency,
  trafficCount,
  onPingHealth,
}) => {
  const navItems: { id: ActiveTabId; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: 'padron',
      label: 'Alta y Padrón de Comercios',
      icon: <Building2 className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'cuentas',
      label: 'Cuentas Corrientes y Pago de Tasas',
      icon: <ReceiptText className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'comprobantes',
      label: 'Comprobantes y Certificados',
      icon: <FileCheck2 className="w-3.5 h-3.5 shrink-0" />,
    },
    {
      id: 'inspector',
      label: 'Inspector de Tráfico API',
      icon: <Terminal className="w-3.5 h-3.5 shrink-0" />,
      count: trafficCount,
    },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-3">
        {/* Zone 1: Brand Title */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('padron');
          }}
          className="text-sm sm:text-base font-bold tracking-tight text-slate-900 truncate max-w-[225px] sm:max-w-none whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
        >
          Municipio - Sistema de Gestión Tributaria
        </a>

        {/* Zone 2: Primary Navigation Tabs */}
        <nav
          aria-label="Navegación principal del módulo Municipio"
          className="hidden xl:flex items-center gap-1"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {typeof item.count === 'number' && (
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      isActive ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    ({item.count})
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action / API Status Indicator */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onPingHealth}
            title={`Ejecutar GET /health en puerto 3005${lastHealthLatency ? ` (Latencia: ${lastHealthLatency}ms)` : ''}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-semibold text-emerald-900 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>{apiOnline ? 'MOCK ONLINE' : 'MOCK OFFLINE'}</span>
            <span aria-hidden="true" className="hidden sm:inline text-emerald-400">·</span>
            <span className="hidden sm:inline text-emerald-800 tabular-nums">:3005</span>
          </button>
        </div>
      </div>

      {/* Responsive Sub-bar for viewports smaller than XL */}
      <div className="xl:hidden border-t border-slate-200 bg-slate-50 px-4 py-2 overflow-x-auto">
        <nav
          aria-label="Navegación móvil del módulo Municipio"
          className="flex items-center gap-1.5 min-w-max"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {typeof item.count === 'number' && (
                  <span className="font-mono tabular-nums opacity-80">({item.count})</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

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
    { id: 'padron', label: 'Altas y padrón', icon: <Building2 className="h-4 w-4 shrink-0" /> },
    { id: 'cuentas', label: 'Cuentas y pagos', icon: <ReceiptText className="h-4 w-4 shrink-0" /> },
    { id: 'comprobantes', label: 'Comprobantes', icon: <FileCheck2 className="h-4 w-4 shrink-0" /> },
    { id: 'inspector', label: 'Inspector API', icon: <Terminal className="h-4 w-4 shrink-0" />, count: trafficCount },
  ];
  const activeColors: Record<ActiveTabId, string> = {
    padron: 'bg-blue-700',
    cuentas: 'bg-emerald-700',
    comprobantes: 'bg-violet-700',
    inspector: 'bg-slate-800',
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-sm shadow-slate-900/[0.03] backdrop-blur">
      <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[76px] items-center justify-between gap-4 py-3">
          <a
            href="#top"
            onClick={(event) => {
              event.preventDefault();
              onSelectTab('padron');
            }}
            className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          >
            <img
              src="/logo-muni-i26.png"
              alt="i26 Muni"
              className="h-11 w-auto max-w-[138px] rounded-md border border-slate-200 object-contain sm:h-12"
            />
            <span className="hidden min-w-0 flex-col sm:flex">
              <span className="text-sm font-bold tracking-tight text-slate-900 sm:text-base">Municipio</span>
              <span className="text-xs text-slate-500">Gestión tributaria local</span>
            </span>
          </a>

          <button
            type="button"
            onClick={onPingHealth}
            title={`Consultar estado de la API${lastHealthLatency !== null ? ` (${lastHealthLatency} ms)` : ''}`}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 cursor-pointer ${
              apiOnline
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
            }`}
          >
            <Activity className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{apiOnline ? 'API demo activa' : 'API sin conexión'}</span>
            {lastHealthLatency !== null && (
              <span className="hidden font-mono text-[11px] tabular-nums sm:inline">
                {lastHealthLatency} ms
              </span>
            )}
          </button>
        </div>

        <nav
          aria-label="Navegación principal del módulo Municipio"
          className="grid grid-cols-2 gap-2 border-t border-slate-100 py-3 sm:flex sm:flex-wrap"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 cursor-pointer ${
                  isActive
                    ? `${activeColors[item.id]} text-white shadow-sm`
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {typeof item.count === 'number' && (
                  <span className={`font-mono text-[11px] tabular-nums ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

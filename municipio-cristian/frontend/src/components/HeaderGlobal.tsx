import React from 'react';
import { Activity, Building2, FileCheck2, Menu, ReceiptText, Terminal, X } from 'lucide-react';

export type ActiveTabId = 'padron' | 'cuentas' | 'comprobantes' | 'inspector';

export const NAV_ITEMS: { id: ActiveTabId; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'padron', label: 'Altas y padrón', Icon: Building2 },
  { id: 'cuentas', label: 'Cuentas y pagos', Icon: ReceiptText },
  { id: 'comprobantes', label: 'Comprobantes', Icon: FileCheck2 },
  { id: 'inspector', label: 'Inspector API', Icon: Terminal },
];

interface SidebarProps {
  activeTab: ActiveTabId;
  onSelectTab: (tab: ActiveTabId) => void;
  trafficCount: number;
  open: boolean;
  onClose: () => void;
}

// Menú lateral común a todas las apps (consolidacion/UNIFICACION-DISENO.md).
export const SidebarNav: React.FC<SidebarProps> = ({ activeTab, onSelectTab, trafficCount, open, onClose }) => (
  <aside
    id="menu-principal"
    aria-label="Menú principal"
    className={`fixed inset-y-0 left-0 z-40 flex w-full flex-col bg-brand-navy px-3.5 py-5 text-white transition-transform motion-reduce:transition-none sm:w-[248px] lg:translate-x-0 ${
      open ? 'translate-x-0 shadow-[0_0_0_100vmax_rgb(20_33_79/40%)]' : '-translate-x-full'
    }`}
  >
    <div className="mb-1.5 flex items-center gap-2">
      <div className="flex-1 rounded-lg bg-white px-3 py-2.5">
        <img src="/logo-muni-i26.png" alt="i26 Muni · Tasas y Habilitaciones" className="h-11 w-auto object-contain" />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar menú"
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-white hover:bg-white/10 lg:hidden cursor-pointer"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
    <p className="mx-2 mb-5 text-[13px] text-[#C9CEDC]">Municipio · Gestión tributaria local</p>

    <nav aria-label="Secciones del módulo Municipio">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  onSelectTab(id);
                  onClose();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg border-l-[3px] px-3 text-left text-[15px] transition-colors cursor-pointer ${
                  isActive ? 'border-brand-sand bg-white/10 font-semibold' : 'border-transparent hover:bg-white/[0.08]'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {id === 'inspector' && (
                  <span className="font-mono text-xs tabular-nums text-[#C9CEDC]" aria-label={`${trafficCount} llamadas`}>
                    {trafficCount}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>

    <p className="mt-auto border-t border-white/15 px-2 pt-3 text-[13px] text-[#C9CEDC]">
      Sintegra I26 · Ecosistema fintech simulado
    </p>
  </aside>
);

interface TopbarProps {
  title: string;
  apiOnline: boolean;
  lastHealthLatency: number | null;
  onPingHealth: () => void;
  menuOpen: boolean;
  onOpenMenu: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ title, apiOnline, lastHealthLatency, onPingHealth, menuOpen, onOpenMenu }) => (
  <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-brand-border bg-white px-4 py-2 sm:px-6">
    <button
      type="button"
      onClick={onOpenMenu}
      aria-label="Abrir menú"
      aria-controls="menu-principal"
      aria-expanded={menuOpen}
      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-brand-border text-brand-navy hover:bg-brand-muted lg:hidden cursor-pointer"
    >
      <Menu className="h-5 w-5" aria-hidden="true" />
    </button>
    <h1 className="font-heading text-xl font-bold text-brand-navy sm:text-2xl">{title}</h1>

    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FBF3E0] px-2.5 py-1 text-[13px] font-semibold text-[#9A6700]">
        <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
        Modo demo
      </span>
      <button
        type="button"
        onClick={onPingHealth}
        title={`Consultar estado de la API${lastHealthLatency !== null ? ` (${lastHealthLatency} ms)` : ''}`}
        className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold transition-colors cursor-pointer ${
          apiOnline ? 'bg-[#E8F4EE] text-[#1E7B4F] hover:bg-[#d8ecdf]' : 'bg-[#FDECEA] text-[#B42318] hover:bg-[#fadad6]'
        }`}
      >
        <Activity className="h-4 w-4" aria-hidden="true" />
        <span>{apiOnline ? 'API conectada' : 'Sin conexión'}</span>
        {lastHealthLatency !== null && (
          <span className="hidden font-mono text-xs tabular-nums sm:inline">{lastHealthLatency} ms</span>
        )}
      </button>
    </div>
  </header>
);

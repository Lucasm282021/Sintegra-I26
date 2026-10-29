import React from 'react';
import { NavTab, useBanking } from '../context/BankingContext';

export const DesktopNav: React.FC = () => {
  const { activeTab, setActiveTab, setIsTransferModalOpen } = useBanking();
  const items: { id: NavTab; label: string; icon: string }[] = [
    { id: 'inicio', label: 'Inicio', icon: 'home' },
    { id: 'cuentas', label: 'Cuentas', icon: 'account_balance_wallet' },
    { id: 'movimientos', label: 'Movimientos', icon: 'receipt_long' },
    { id: 'perfil', label: 'Perfil', icon: 'shield_person' },
  ];

  return (
    <aside className="sticky top-28 hidden h-[calc(100vh-8rem)] w-60 shrink-0 flex-col border-r border-surface-container px-4 py-6 lg:flex">
      <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-outline">Tu banco</p>
      <nav aria-label="Navegación principal" className="flex flex-col gap-1">
        {items.map((item) => {
          const selected = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={selected ? 'page' : undefined}
              onClick={() => setActiveTab(item.id)}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-left transition-colors ${selected ? 'bg-primary-container/15 text-primary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
            >
              <span className={`material-symbols-outlined text-[22px] ${selected ? 'fill' : ''}`}>{item.icon}</span>
              <span className="font-label-lg text-label-lg">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={() => setIsTransferModalOpen(true)}
        className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary-container px-4 font-label-lg text-label-lg font-semibold text-on-primary-container shadow-lg shadow-primary-container/20 transition hover:brightness-110"
      >
        <span className="material-symbols-outlined">swap_horiz</span>
        Transferir
      </button>
      <div className="mt-auto rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
        Entorno de simulación. Las operaciones y los datos son de prueba.
      </div>
    </aside>
  );
};

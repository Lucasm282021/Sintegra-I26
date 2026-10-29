import React from 'react';
import { useBanking, NavTab } from '../context/BankingContext';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, setIsTransferModalOpen } = useBanking();

  const handleTabClick = (tab: NavTab) => {
    if (tab === 'transferir') {
      setIsTransferModalOpen(true);
    } else {
      setActiveTab(tab);
    }
  };

  const navItems = [
    { id: 'inicio' as NavTab, label: 'Inicio', icon: 'home' },
    { id: 'cuentas' as NavTab, label: 'Cuentas', icon: 'account_balance_wallet' },
    { id: 'transferir' as NavTab, label: 'Transferir', icon: 'swap_horiz', isFab: true },
    { id: 'movimientos' as NavTab, label: 'Movimientos', icon: 'receipt_long' },
    { id: 'perfil' as NavTab, label: 'Perfil', icon: 'shield_person' },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 pb-safe bg-surface-container-low/95 backdrop-blur-xl border-t border-surface-container shadow-[0_-4px_24px_rgba(2,14,33,0.6)] lg:hidden">
      <div className="flex justify-between items-center h-20 px-space-xs max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;

          if (item.isFab) {
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className="flex flex-col items-center justify-center gap-1 flex-1 py-1 text-on-surface-variant hover:text-on-surface transition-colors min-h-[44px] group"
              >
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shadow-lg shadow-primary-container/30 -mt-3 group-active:scale-95 transition-transform">
                  <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                </div>
                <span className="font-label-sm text-label-sm mt-0.5 group-hover:text-primary transition-colors">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-colors min-h-[44px] ${
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className={`material-symbols-outlined text-[24px] ${isActive ? 'fill' : ''}`}>
                {item.icon}
              </span>
              <span className="font-label-sm text-label-sm">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

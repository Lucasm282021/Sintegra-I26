import React from 'react';
import { useBanking } from '../context/BankingContext';

export const Toast: React.FC = () => {
  const { toast } = useBanking();

  if (!toast.visible) return null;

  return (
    <div className="fixed bottom-24 inset-x-4 max-w-sm mx-auto pointer-events-none transition-all duration-300 z-50 animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-inverse-surface text-inverse-on-surface px-4 py-3 rounded-xl flex items-center gap-3 shadow-2xl border border-surface-bright/50">
        <span className="material-symbols-outlined text-primary text-[22px] shrink-0">
          {toast.icon}
        </span>
        <span className="font-body-md text-body-md font-medium truncate">
          {toast.message}
        </span>
      </div>
    </div>
  );
};

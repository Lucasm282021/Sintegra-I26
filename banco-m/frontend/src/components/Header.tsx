import React from 'react';
import { useBanking } from '../context/BankingContext';
import { BOREAL_LOGO_URL } from '../data/mockData';

export const Header: React.FC = () => {
  const { user, setIsNotificationsOpen, setActiveTab } = useBanking();

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_4px_20px_rgba(2,14,33,0.5)]">
      {/* Simulation strip banner */}
      <div className="w-full bg-amber-500/10 px-margin py-1 flex items-center justify-center gap-1.5 border-b border-amber-500/15">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
        <span className="font-label-sm text-label-sm text-amber-300 font-medium tracking-wide uppercase">
          Entorno de simulación - Datos de prueba ficticios
        </span>
      </div>

      {/* Main Bar */}
      <div className="h-16 px-margin md:px-8 flex items-center justify-between max-w-[1440px] mx-auto w-full">
        <div
          className="flex items-center gap-space-sm cursor-pointer select-none"
          onClick={() => setActiveTab('inicio')}
        >
          <img
            alt="Boreal Banco Logo"
            className="h-8 w-auto object-contain"
            src={BOREAL_LOGO_URL}
          />
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-on-surface-variant font-medium leading-none">
              Banco Digital
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">
              Boreal Banco
            </span>
          </div>
        </div>

        <div className="flex items-center gap-space-xs">
          <button
            aria-label="Notificaciones"
            className="relative w-11 h-11 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container active:scale-95 transition-all"
            onClick={() => setIsNotificationsOpen(true)}
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {user.notificationsCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary ring-2 ring-surface"></span>
            )}
          </button>
          <button
            className="flex items-center pl-1 focus:outline-none"
            onClick={() => setActiveTab('perfil')}
            aria-label="Perfil de usuario"
          >
            <img
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/40 hover:ring-primary transition-all"
              src={user.avatarUrl}
            />
          </button>
        </div>
      </div>
    </header>
  );
};

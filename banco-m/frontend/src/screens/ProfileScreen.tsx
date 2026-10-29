import React, { useState } from 'react';
import { useBanking } from '../context/BankingContext';

export const ProfileScreen: React.FC = () => {
  const {
    user,
    logout,
    resetSandboxData,
    isBalanceHidden,
    toggleBalanceVisibility,
    showToast,
    downloadCbuPdf,
  } = useBanking();

  const [biometricsEnabled, setBiometricsEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleToggleBio = () => {
    setBiometricsEnabled(!biometricsEnabled);
    showToast(
      !biometricsEnabled
        ? 'Autenticación biométrica activada'
        : 'Autenticación biométrica desactivada'
    );
  };

  const handleToggleNotif = () => {
    setNotificationsEnabled(!notificationsEnabled);
    showToast(
      !notificationsEnabled
        ? 'Notificaciones bancarias activadas'
        : 'Notificaciones bancarias silenciadas'
    );
  };

  return (
    <div className="grid w-full grid-cols-1 gap-space-md pb-6 lg:grid-cols-2">
      {/* Profile Header Card */}
      <div className="rounded-2xl bg-surface-container p-space-md shadow-lg flex items-center gap-4 border border-surface-container-high/40">
        <div className="relative">
          <img
            alt={user.name}
            src={user.avatarUrl}
            className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/40 shadow-md"
          />
          <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-tertiary ring-2 ring-surface flex items-center justify-center">
            <span className="material-symbols-outlined text-[10px] text-on-tertiary font-bold">
              check
            </span>
          </span>
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="font-headline-md text-headline-md text-on-surface font-bold truncate">
              {user.name}
            </h1>
            <span className={`material-symbols-outlined text-[20px] ${user.verified ? 'text-primary' : 'text-outline'}`}>{user.verified ? 'verified' : 'error'}</span>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            CUIT: {user.cuil}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary font-label-sm text-label-sm font-semibold">
              {user.tier}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-tertiary-container/30 text-tertiary font-label-sm text-label-sm">
              Sandbox Activo
            </span>
          </div>
        </div>
      </div>

      {/* Limits & Banking Status */}
      <div className="rounded-xl bg-surface-container-high p-space-md shadow-md border border-surface-bright/30 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]">
              account_balance
            </span>
            <span className="font-label-lg text-label-lg font-semibold text-on-surface">
              Límites y Operatoria
            </span>
          </div>
          <span className="font-label-sm text-label-sm text-tertiary font-medium">banco-m</span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="p-3 rounded-lg bg-surface-container flex flex-col gap-0.5">
            <span className="font-label-sm text-label-sm text-outline">Transferencias</span>
            <span className="font-tabular-mono text-tabular-mono text-on-surface font-bold">
              Según saldo disponible
            </span>
          </div>
          <div className="p-3 rounded-lg bg-surface-container flex flex-col gap-0.5">
            <span className="font-label-sm text-label-sm text-outline">Pagos QR</span>
            <span className="font-tabular-mono text-tabular-mono text-on-surface font-bold">
              QR vence a los 15 min
            </span>
          </div>
        </div>

        <button
          onClick={() => downloadCbuPdf()}
          className="w-full mt-1 py-2.5 px-3 rounded-lg bg-surface-container hover:bg-surface-bright text-primary font-label-md text-label-md flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">badge</span>
          <span>Descargar datos bancarios (TXT)</span>
        </button>
      </div>

      {/* Settings Section */}
      <div className="rounded-xl bg-surface-container p-space-md shadow-md border border-surface-container-high/40 flex flex-col gap-3">
        <span className="font-label-lg text-label-lg font-semibold text-on-surface">
          Seguridad y Preferencias
        </span>

        {/* Biometrics Toggle */}
        <div className="flex items-center justify-between py-2 border-b border-surface-container-high">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-[20px]">fingerprint</span>
            </div>
            <div className="flex flex-col">
              <span className="font-body-md text-body-md font-medium text-on-surface">
                Ingreso con Huella / FaceID
              </span>
              <span className="font-label-sm text-label-sm text-outline">
                Biometría rápida en este dispositivo
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleBio}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              biometricsEnabled ? 'bg-primary' : 'bg-surface-container-highest'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-surface-container-lowest absolute top-0.5 transition-transform ${
                biometricsEnabled ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Notifications Toggle */}
        <div className="flex items-center justify-between py-2 border-b border-surface-container-high">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </div>
            <div className="flex flex-col">
              <span className="font-body-md text-body-md font-medium text-on-surface">
                Alertas de movimientos
              </span>
              <span className="font-label-sm text-label-sm text-outline">
                Notificaciones push inmediatas
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleNotif}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              notificationsEnabled ? 'bg-primary' : 'bg-surface-container-highest'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-surface-container-lowest absolute top-0.5 transition-transform ${
                notificationsEnabled ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Balance Visibility Toggle */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">visibility</span>
            </div>
            <div className="flex flex-col">
              <span className="font-body-md text-body-md font-medium text-on-surface">
                Ocultar saldos en pantalla
              </span>
              <span className="font-label-sm text-label-sm text-outline">
                Modo privacidad en espacios públicos
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleBalanceVisibility}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              isBalanceHidden ? 'bg-primary' : 'bg-surface-container-highest'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-surface-container-lowest absolute top-0.5 transition-transform ${
                isBalanceHidden ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Sandbox Controls */}
      <div className="rounded-xl bg-surface-container-low p-space-md border border-amber-500/20 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-amber-300">
          <span className="material-symbols-outlined text-[20px]">tune</span>
          <span className="font-label-md text-label-md font-semibold">
            Herramientas del Sandbox
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
          Actualizá el saldo y los movimientos consultando nuevamente la API del banco.
        </p>
        <button
          type="button"
          onClick={resetSandboxData}
          className="mt-1 w-full py-2.5 px-3 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-md text-label-md flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px] text-tertiary">restart_alt</span>
          <span>Actualizar datos desde banco-m</span>
        </button>
      </div>

      {/* Logout Action */}
      <button
        type="button"
        onClick={logout}
        className="w-full mt-2 py-3 px-4 rounded-xl bg-error/15 hover:bg-error/25 text-error font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer border border-error/20"
      >
        <span className="material-symbols-outlined text-[20px]">logout</span>
        <span>Desconectar esta cuenta</span>
      </button>

      {/* Footer Info */}
      <div className="text-center py-2 lg:col-span-2">
        <span className="font-label-sm text-label-sm text-outline">
          Boreal Banco App v2.4.1 • Retail Banking Sandbox
        </span>
      </div>
    </div>
  );
};

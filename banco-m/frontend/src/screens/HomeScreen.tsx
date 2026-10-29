import React from 'react';
import { useBanking } from '../context/BankingContext';

export const HomeScreen: React.FC = () => {
  const {
    user,
    accounts,
    transactions,
    isBalanceHidden,
    toggleBalanceVisibility,
    copyToClipboard,
    setActiveTab,
    setIsTransferModalOpen,
    setIsPayServiceModalOpen,
    setIsDepositModalOpen,
    setIsQrModalOpen,
    setSelectedTransaction,
  } = useBanking();

  // Total balance computation
  const pesoAccounts = accounts.filter((account) => account.currency === 'ARS');
  const primaryPesosAccount = pesoAccounts.find((account) => account.isPrimary) || pesoAccounts[0] || accounts[0];
  const usdAccount = accounts.find((account) => account.currency === 'USD');
  const totalPesos = pesoAccounts.reduce((total, account) => total + account.balance, 0);

  const displayTotalBalance = isBalanceHidden
    ? '••••••••••'
    : `$ ${totalPesos.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  const displayCaPesos = isBalanceHidden
    ? '••••••'
    : `$ ${(primaryPesosAccount?.balance || 0).toLocaleString('es-AR', {
        minimumFractionDigits: 2,
      })}`;

  const displayUsd = isBalanceHidden
    ? '••••••'
    : `U$S ${(usdAccount?.balance || 0).toLocaleString('es-AR', {
        minimumFractionDigits: 2,
      })}`;

  // Take the latest 3 transactions
  const recentTransactions = transactions.slice(0, 3);

  return (
    <div className="grid w-full grid-cols-1 gap-space-lg lg:grid-cols-2">
      {/* Header Saludo & Status Pill */}
      <div className="flex flex-col gap-space-xs lg:col-span-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold tracking-tight">
              ¡Hola, {user.name.split(' ')[0]}! 👋
            </h1>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-secondary text-label-sm font-label-sm shadow-sm">
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
            En línea
          </span>
        </div>

        {/* Sim Warning Pill Embedded */}
        <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full bg-surface-container-high text-amber-300 shadow-sm border border-amber-400/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          <span className="font-label-sm text-label-sm font-semibold tracking-wider uppercase">
            Entorno de simulación activa
          </span>
        </div>
      </div>

      {/* Hero Card: Saldo Total Consolidado */}
      <div className="relative overflow-hidden rounded-xl bg-surface-container-high p-space-lg shadow-xl border border-surface-bright/30">
        <div className="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-primary-container/10 blur-2xl pointer-events-none"></div>
        <div className="absolute right-0 bottom-0 w-32 h-32 rounded-full bg-tertiary/10 blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col gap-space-md">
          {/* Top Row Hero: Info & Toggle Visibilidad */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-on-surface-variant font-label-md text-label-md">
              <span className="material-symbols-outlined text-[16px] text-primary">
                account_balance
              </span>
              <span>Saldo disponible en banco-m</span>
            </div>
            <button
              aria-label="Ocultar o mostrar saldo"
              onClick={toggleBalanceVisibility}
              className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-bright active:scale-90 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">
                {isBalanceHidden ? 'visibility' : 'visibility_off'}
              </span>
            </button>
          </div>

          {/* Importe Principal */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="font-currency-display-mobile text-currency-display-mobile text-on-surface tracking-tight font-bold">
                {displayTotalBalance}
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
              Cuenta de prueba conectada al módulo bancario
            </span>
          </div>

          {/* Desglose Rápido en Bento Píldoras */}
          <div className="grid grid-cols-1 gap-space-xs pt-space-xs sm:grid-cols-2">
            {accounts.map((account, index) => (
              <div key={account.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-surface-container-highest/40 bg-surface-container p-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${index % 2 ? 'bg-tertiary' : 'bg-primary'}`}></span>
                  <span className="truncate font-label-sm text-label-sm text-on-surface-variant">{account.type}</span>
                </div>
                <span className="shrink-0 font-tabular-mono text-tabular-mono font-semibold text-on-surface">
                  {isBalanceHidden ? '••••••' : account.currency === 'USD' ? displayUsd : `$ ${account.balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Botonera de Acciones Rápidas Circulares */}
      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center justify-between px-1">
          <span className="font-label-lg text-label-lg text-on-surface font-semibold">
            Acciones rápidas
          </span>
          <span className="font-label-sm text-label-sm text-secondary">Frecuentes</span>
        </div>
        <div className="grid grid-cols-5 gap-2 pt-1">
          {/* Transferir */}
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="flex flex-col items-center gap-2 group focus:outline-none cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shadow-lg shadow-primary-container/25 group-active:scale-95 transition-transform">
              <span className="material-symbols-outlined text-[24px]">swap_horiz</span>
            </div>
            <span className="font-label-sm text-label-sm text-center text-on-surface group-hover:text-primary transition-colors leading-tight">
              Transferir
            </span>
          </button>

          {/* Pagar o generar QR */}
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="flex flex-col items-center gap-2 group focus:outline-none cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center shadow-md group-hover:bg-surface-container-highest group-active:scale-95 transition-all">
              <span className="material-symbols-outlined text-[24px] text-primary">qr_code_2</span>
            </div>
            <span className="font-label-sm text-label-sm text-center text-on-surface group-hover:text-primary transition-colors leading-tight">
              Pagar QR
            </span>
          </button>

          {/* Pagar Servicio */}
          <button
            onClick={() => setIsPayServiceModalOpen(true)}
            className="flex flex-col items-center gap-2 group focus:outline-none cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center shadow-md group-hover:bg-surface-container-highest group-active:scale-95 transition-all">
              <span className="material-symbols-outlined text-[24px] text-primary-fixed-dim">
                receipt
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-center text-on-surface group-hover:text-primary transition-colors leading-tight">
              Pagar servicio
            </span>
          </button>

          {/* Ver CBU / Alias */}
          <button
            onClick={() => setActiveTab('cuentas')}
            className="flex flex-col items-center gap-2 group focus:outline-none cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center shadow-md group-hover:bg-surface-container-highest group-active:scale-95 transition-all">
              <span className="material-symbols-outlined text-[24px] text-secondary">share</span>
            </div>
            <span className="font-label-sm text-label-sm text-center text-on-surface group-hover:text-primary transition-colors leading-tight">
              Ver CBU / Alias
            </span>
          </button>

          {/* Ingresar Dinero */}
          <button
            onClick={() => setIsDepositModalOpen(true)}
            className="flex flex-col items-center gap-2 group focus:outline-none cursor-pointer"
          >
            <div className="w-14 h-14 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center shadow-md group-hover:bg-surface-container-highest group-active:scale-95 transition-all">
              <span className="material-symbols-outlined text-[24px] text-tertiary">
                account_balance_wallet
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-center text-on-surface group-hover:text-primary transition-colors leading-tight">
              Ingresar dinero
            </span>
          </button>
        </div>
      </div>

      {/* Cuentas Disponibles Section */}
      <div className="flex flex-col gap-space-sm lg:col-span-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
            Cuentas disponibles
          </h2>
          <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">
            {accounts.length} activas
          </span>
        </div>

        {/* Account Details Card */}
        <div className="rounded-xl bg-surface-container p-space-md shadow-md flex flex-col gap-space-sm relative overflow-hidden border border-surface-container-high/50">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">account_balance</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                  {primaryPesosAccount?.type || 'Cuenta bancaria'}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Boreal Banco • Titular
                </span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-surface-container-highest text-tertiary font-label-sm text-label-sm font-semibold uppercase tracking-wider">
              Activa
            </span>
          </div>

          {/* Identificadores Bancarios: CBU y Alias con Copia Dinámica */}
          <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-surface-container-low border border-surface-container-highest/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm">
                <span>CBU</span>
                <span className="font-tabular-mono text-tabular-mono text-on-surface font-medium">
                  {primaryPesosAccount?.cbuFormatted || 'CBU de prueba'}
                </span>
              </div>
              <button
                className="text-primary hover:text-primary-fixed-dim text-label-sm font-label-sm flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                onClick={() =>
                  copyToClipboard(primaryPesosAccount?.cbu || '', 'CBU')
                }
              >
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                <span>Copiar</span>
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm">
                <span>Alias</span>
                <span className="font-tabular-mono text-tabular-mono text-secondary font-medium">
                  {primaryPesosAccount?.alias}
                </span>
              </div>
              <button
                className="text-primary hover:text-primary-fixed-dim text-label-sm font-label-sm flex items-center gap-1 cursor-pointer active:scale-95 transition-transform"
                onClick={() =>
                  copyToClipboard(primaryPesosAccount?.alias || '', 'Alias')
                }
              >
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                <span>Copiar</span>
              </button>
            </div>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Saldo en cuenta
            </span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">
              {displayCaPesos}
            </span>
          </div>
        </div>
      </div>

      {/* Actividad Reciente Section */}
      <div className="flex flex-col gap-space-sm lg:col-span-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
            Actividad reciente
          </h2>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Últimos movimientos
          </span>
        </div>

        <div className="flex flex-col gap-space-xs">
          {recentTransactions.map((tx) => {
            const isIncome = tx.amount > 0;
            const formattedAmount = isBalanceHidden
              ? '••••••'
              : `${isIncome ? '+' : '-'}$ ${Math.abs(tx.amount).toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                })}`;

            return (
              <div
                key={tx.id}
                onClick={() => setSelectedTransaction(tx)}
                className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer border border-surface-container-high/30 active:scale-[0.99]"
              >
                <div className="flex items-center gap-space-sm min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${
                      isIncome
                        ? 'bg-tertiary-container/30 text-tertiary'
                        : 'bg-surface-container-high text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {tx.icon}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-body-md text-body-md font-semibold text-on-surface truncate">
                      {tx.concept}
                    </span>
                    <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-label-sm">
                      <span>{tx.date}</span>
                      <span>•</span>
                      <span
                        className={
                          isIncome ? 'text-tertiary font-medium' : 'text-secondary'
                        }
                      >
                        {tx.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end flex-shrink-0 pl-2">
                  <span
                    className={`font-tabular-mono text-tabular-mono font-bold ${
                      isIncome ? 'text-tertiary' : 'text-on-surface'
                    }`}
                  >
                    {formattedAmount}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {tx.category === 'servicios'
                      ? 'Débito directo'
                      : tx.category === 'ingresos'
                      ? 'Sueldo / Nómina'
                      : 'Transferencia 3.0'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enlace a Ver Todos los Movimientos */}
        <button
          onClick={() => setActiveTab('movimientos')}
          className="mt-space-xs py-3 px-4 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-center gap-2 text-primary font-label-lg text-label-lg transition-colors group cursor-pointer border border-surface-container-high/30"
        >
          <span>Ver todos los movimientos</span>
          <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">
            arrow_forward
          </span>
        </button>
      </div>

      {/* Banner Ilustrativo de Soporte & Tip Ficticio */}
      <div className="p-space-md rounded-xl bg-surface-container-high/60 flex items-center gap-space-md relative overflow-hidden border border-surface-container-highest/40 lg:col-span-2">
        <div className="w-12 h-12 rounded-full bg-secondary-container/40 flex-shrink-0 flex items-center justify-center text-secondary">
          <span className="material-symbols-outlined text-[24px]">verified_user</span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-label-md text-label-md font-semibold text-on-surface">
            Canal de prueba seguro
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Recordá que ninguna operación en este entorno transacciona fondos bancarios reales ni
            afecta tu scoring crediticio.
          </span>
        </div>
      </div>
    </div>
  );
};

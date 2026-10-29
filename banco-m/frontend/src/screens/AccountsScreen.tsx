import React, { useState } from 'react';
import { useBanking } from '../context/BankingContext';

export const AccountsScreen: React.FC = () => {
  const {
    user,
    accounts,
    isBalanceHidden,
    copyToClipboard,
    downloadCbuPdf,
    shareWhatsApp,
  } = useBanking();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string, label: string) => {
    copyToClipboard(text, label);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 1800);
  };

  const caPesos = accounts.find((a) => a.id === 'ca-pesos') || accounts[0];
  const ccPesos = accounts.find((a) => a.id === 'cc-pesos') || accounts[1];
  const caUsd = accounts.find((a) => a.id === 'ca-usd') || accounts[2];

  const formatBalance = (amount: number, currency: 'ARS' | 'USD') => {
    if (isBalanceHidden) return '••••••';
    const formatted = amount.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return currency === 'USD' ? `U$S ${formatted}` : `$ ${formatted}`;
  };

  return (
    <div className="flex flex-col w-full gap-space-md">
      {/* Status & Profile Quick Context */}
      <div className="flex items-center justify-between bg-surface-container px-space-md py-space-sm rounded-xl border border-surface-container-high/40">
        <div className="flex items-center gap-space-sm min-w-0">
          <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">account_balance</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                {user.name}
              </span>
              <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant truncate">
              CUIT: {user.cuil} • {user.tier}
            </span>
          </div>
        </div>
        <div className="bg-surface-container-high px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
          <span className="font-label-sm text-label-sm text-tertiary">{accounts.length} cuentas</span>
        </div>
      </div>

      {/* Hero Section Indicator */}
      <div className="relative overflow-hidden bg-surface-container-high rounded-xl p-space-md shadow-md border border-surface-bright/30">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-primary/10 blur-2xl pointer-events-none"></div>
        <div className="flex items-start justify-between gap-space-sm relative z-10">
          <div className="flex flex-col gap-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 w-fit">
              <span className="material-symbols-outlined text-[14px]">tune</span>
              <span className="font-label-sm text-label-sm">Cuentas Bancarias Simuladas</span>
            </div>
            <span className="font-headline-md text-headline-md text-on-surface mt-1">
              Datos y Coordinadas
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Consultá tus claves bancarias ficticias para testing de transferencias inmediatas y cobros DEBIN.
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[26px]">badge</span>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
        {/* CUENTA 1: Principal (Expanded by Default) */}
        {caPesos && (
          <div className="bg-surface-container rounded-xl overflow-hidden shadow-md transition-all duration-300 border border-surface-container-high/40">
            {/* Card Header Accent */}
            <div className="bg-primary/20 px-space-md py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[16px]">stars</span>
                <span className="font-label-sm text-label-sm text-primary uppercase tracking-wider font-semibold">
                  Cuenta Principal Predeterminada
                </span>
              </div>
              <span className="font-label-sm text-label-sm bg-tertiary-container/40 text-tertiary px-2 py-0.5 rounded-full">
                {caPesos.status}
              </span>
            </div>

            <div className="p-space-md flex flex-col gap-space-md">
              {/* Account Balance & Title */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    {caPesos.type}
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-currency-display-mobile text-currency-display-mobile text-on-surface font-bold">
                      {formatBalance(caPesos.balance, 'ARS')}
                    </span>
                    <span className="font-label-sm text-label-sm text-secondary">ARS</span>
                  </div>
                  <span className="font-tabular-mono text-tabular-mono text-outline mt-0.5">
                    N° {caPesos.accountNumber}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[22px]">savings</span>
                </div>
              </div>

              {/* Bank Details Modules */}
              <div className="flex flex-col gap-space-sm pt-space-xs">
                {/* CBU */}
                <div className="bg-surface-container-lowest p-space-sm rounded-lg flex items-center justify-between gap-space-sm border border-surface-container-highest/20">
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                      CBU de la cuenta
                    </span>
                    <span className="font-tabular-mono text-tabular-mono text-on-surface truncate">
                      {caPesos.cbuFormatted}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <button
                      aria-label="Copiar CBU"
                      className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary text-label-md font-label-md flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      onClick={() => handleCopy(caPesos.cbu, 'cbu-1', 'CBU')}
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      <span>Copiar</span>
                    </button>
                    {copiedId === 'cbu-1' && (
                      <span className="absolute -top-8 right-0 bg-primary text-on-primary font-label-sm text-label-sm px-2 py-0.5 rounded shadow animate-in fade-in">
                        ¡Copiado!
                      </span>
                    )}
                  </div>
                </div>

                {/* Alias */}
                <div className="bg-surface-container-lowest p-space-sm rounded-lg flex items-center justify-between gap-space-sm border border-surface-container-highest/20">
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                      Alias bancario
                    </span>
                    <span className="font-tabular-mono text-tabular-mono text-secondary truncate">
                      {caPesos.alias}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <button
                      aria-label="Copiar Alias"
                      className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary text-label-md font-label-md flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      onClick={() => handleCopy(caPesos.alias, 'alias-1', 'Alias')}
                    >
                      <span className="material-symbols-outlined text-[16px]">alternate_email</span>
                      <span>Copiar</span>
                    </button>
                    {copiedId === 'alias-1' && (
                      <span className="absolute -top-8 right-0 bg-primary text-on-primary font-label-sm text-label-sm px-2 py-0.5 rounded shadow animate-in fade-in">
                        ¡Copiado!
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Micro Tag Details */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-tertiary">
                    check_circle
                  </span>
                  CBU y alias de banco-m
                </span>
                <span className="px-2 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm">
                  Saldo administrado por banco-m
                </span>
              </div>
            </div>
          </div>
        )}

        {/* CUENTA 2: Cuenta Corriente Especial */}
        {ccPesos && (
          <div className="bg-surface-container rounded-xl overflow-hidden shadow-md border border-surface-container-high/40">
            <div className="p-space-md flex flex-col gap-space-md">
              {/* Account Balance & Title */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-label-md text-label-md text-on-surface-variant">
                      {ccPesos.type}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-headline-lg text-headline-lg text-on-surface font-bold">
                      {formatBalance(ccPesos.balance, 'ARS')}
                    </span>
                    <span className="font-label-sm text-label-sm text-secondary">ARS</span>
                  </div>
                  <span className="font-tabular-mono text-tabular-mono text-outline mt-0.5">
                    N° {ccPesos.accountNumber} • Activa
                  </span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[22px]">storefront</span>
                </div>
              </div>

              {/* Bank Details Modules */}
              <div className="flex flex-col gap-space-sm">
                <div className="bg-surface-container-lowest p-space-sm rounded-lg flex items-center justify-between gap-space-sm border border-surface-container-highest/20">
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                      CBU
                    </span>
                    <span className="font-tabular-mono text-tabular-mono text-on-surface truncate">
                      {ccPesos.cbuFormatted}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <button
                      aria-label="Copiar CBU"
                      className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary text-label-md font-label-md flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      onClick={() => handleCopy(ccPesos.cbu, 'cbu-2', 'CBU')}
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      <span>Copiar</span>
                    </button>
                    {copiedId === 'cbu-2' && (
                      <span className="absolute -top-8 right-0 bg-primary text-on-primary font-label-sm text-label-sm px-2 py-0.5 rounded shadow animate-in fade-in">
                        ¡Copiado!
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-space-sm rounded-lg flex items-center justify-between gap-space-sm border border-surface-container-highest/20">
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                      Alias Comercial
                    </span>
                    <span className="font-tabular-mono text-tabular-mono text-secondary truncate">
                      {ccPesos.alias}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <button
                      aria-label="Copiar Alias"
                      className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary text-label-md font-label-md flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      onClick={() => handleCopy(ccPesos.alias, 'alias-2', 'Alias')}
                    >
                      <span className="material-symbols-outlined text-[16px]">alternate_email</span>
                      <span>Copiar</span>
                    </button>
                    {copiedId === 'alias-2' && (
                      <span className="absolute -top-8 right-0 bg-primary text-on-primary font-label-sm text-label-sm px-2 py-0.5 rounded shadow animate-in fade-in">
                        ¡Copiado!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CUENTA 3: Dólares Simulada */}
        {caUsd && (
          <div className="bg-surface-container rounded-xl overflow-hidden shadow-md border border-surface-container-high/40">
            <div className="p-space-md flex flex-col gap-space-md">
              {/* Account Balance & Title */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-label-md text-label-md text-on-surface-variant">
                      {caUsd.type}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">
                      {caUsd.status}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-headline-lg text-headline-lg text-on-surface font-bold">
                      {formatBalance(caUsd.balance, 'USD')}
                    </span>
                    <span className="font-label-sm text-label-sm text-tertiary">USD</span>
                  </div>
                  <span className="font-tabular-mono text-tabular-mono text-outline mt-0.5">
                    N° {caUsd.accountNumber}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-tertiary">
                  <span className="material-symbols-outlined text-[22px]">paid</span>
                </div>
              </div>

              {/* Bank Details Modules */}
              <div className="flex flex-col gap-space-sm">
                <div className="bg-surface-container-lowest p-space-sm rounded-lg flex items-center justify-between gap-space-sm border border-surface-container-highest/20">
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                      CBU Moneda Extranjera
                    </span>
                    <span className="font-tabular-mono text-tabular-mono text-on-surface truncate">
                      {caUsd.cbuFormatted}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <button
                      aria-label="Copiar CBU"
                      className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary text-label-md font-label-md flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      onClick={() => handleCopy(caUsd.cbu, 'cbu-3', 'CBU')}
                    >
                      <span className="material-symbols-outlined text-[16px]">content_copy</span>
                      <span>Copiar</span>
                    </button>
                    {copiedId === 'cbu-3' && (
                      <span className="absolute -top-8 right-0 bg-primary text-on-primary font-label-sm text-label-sm px-2 py-0.5 rounded shadow animate-in fade-in">
                        ¡Copiado!
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-space-sm rounded-lg flex items-center justify-between gap-space-sm border border-surface-container-highest/20">
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                      Alias Ficticio Dólar
                    </span>
                    <span className="font-tabular-mono text-tabular-mono text-secondary truncate">
                      {caUsd.alias}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <button
                      aria-label="Copiar Alias"
                      className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-primary text-label-md font-label-md flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      onClick={() => handleCopy(caUsd.alias, 'alias-3', 'Alias')}
                    >
                      <span className="material-symbols-outlined text-[16px]">alternate_email</span>
                      <span>Copiar</span>
                    </button>
                    {copiedId === 'alias-3' && (
                      <span className="absolute -top-8 right-0 bg-primary text-on-primary font-label-sm text-label-sm px-2 py-0.5 rounded shadow animate-in fade-in">
                        ¡Copiado!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Safety Warning Card */}
      <div className="bg-surface-container-low rounded-xl p-space-md flex items-start gap-space-sm border border-amber-500/20">
        <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <span className="material-symbols-outlined text-[18px]">gavel</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-label-md text-label-md text-amber-300 font-semibold">
            Aviso de Regulación y Pruebas
          </span>
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Identificadores bancarios generados exclusivamente para pruebas de flujo en este prototipo.
            No válidos para operaciones en el sistema financiero oficial ni compensación por el BCRA.
          </p>
        </div>
      </div>

      {/* Complementary Action Buttons */}
      <div className="flex flex-col gap-space-sm pt-space-xs">
        <button
          className="w-full bg-primary hover:bg-primary-container text-on-primary py-3 px-space-md rounded-lg font-label-lg text-label-lg flex items-center justify-center gap-space-sm active:scale-98 transition-all shadow-md cursor-pointer"
          onClick={() => downloadCbuPdf(caPesos)}
        >
          <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
          <span>Descargar datos bancarios de prueba (TXT)</span>
        </button>
        <button
          className="w-full bg-surface-container text-on-surface hover:bg-surface-container-high py-3 px-space-md rounded-lg font-label-lg text-label-lg flex items-center justify-center gap-space-sm active:scale-98 transition-colors cursor-pointer border border-surface-container-highest/30"
          onClick={() => shareWhatsApp(caPesos)}
        >
          <span className="material-symbols-outlined text-[20px] text-tertiary">chat</span>
          <span>Compartir datos por WhatsApp</span>
        </button>
      </div>
    </div>
  );
};

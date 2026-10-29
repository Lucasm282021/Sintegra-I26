import React, { useEffect, useState } from 'react';
import { useBanking } from '../../context/BankingContext';

export const DepositModal: React.FC = () => {
  const {
    isDepositModalOpen,
    setIsDepositModalOpen,
    accounts,
    depositFunds,
    copyToClipboard,
    showToast,
  } = useBanking();

  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || 'ca-pesos');
  const [customAmount, setCustomAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (accounts.length && !accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  if (!isDepositModalOpen) return null;

  const currentAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  const handleDeposit = async (amount: number) => {
    setIsSubmitting(true);
    const success = await depositFunds(selectedAccountId, amount);
    setIsSubmitting(false);
    if (success) setIsDepositModalOpen(false);
  };

  const handleCustomDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customAmount);
    if (isNaN(val) || val <= 0) {
      showToast('Ingresá un importe válido mayor a 0', 'warning');
      return;
    }
    handleDeposit(val);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in"
      onClick={() => setIsDepositModalOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface-container p-5 shadow-2xl flex flex-col gap-4 border border-surface-bright/40 max-h-[90vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-surface-container-high text-tertiary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">
                account_balance_wallet
              </span>
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Ingresar Dinero
              </h2>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Recarga y coordenadas de acreditación
              </span>
            </div>
          </div>
          <button
            aria-label="Cerrar modal"
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            onClick={() => setIsDepositModalOpen(false)}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Account Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="font-label-md text-label-md text-on-surface-variant">
            Cuenta de destino
          </label>
          <div className="grid grid-cols-1 gap-2">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => setSelectedAccountId(acc.id)}
                className={`p-3 rounded-xl flex items-center justify-between text-left transition-all ${
                  selectedAccountId === acc.id
                    ? 'bg-surface-container-high ring-1 ring-primary'
                    : 'bg-surface-container-low hover:bg-surface-container-high/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    {acc.iconName}
                  </span>
                  <div>
                    <span className="font-body-md text-body-md font-medium text-on-surface block">
                      {acc.type}
                    </span>
                    <span className="font-label-sm text-label-sm text-outline">
                      {acc.accountNumber}
                    </span>
                  </div>
                </div>
                <span className="font-tabular-mono text-tabular-mono text-on-surface font-bold text-sm">
                  ${acc.currency === 'USD' ? ' U$S ' : ' '}{acc.balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Bank Coordinates for receiving transfers */}
        <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-surface-container-low">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
            Transferir desde otra entidad
          </span>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-label-sm text-label-sm text-outline block">CBU</span>
              <span className="font-tabular-mono text-tabular-mono text-on-surface text-sm">
                {currentAccount.cbu}
              </span>
            </div>
            <button
              onClick={() => copyToClipboard(currentAccount.cbu, 'CBU')}
              className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-bright text-primary text-label-sm font-label-sm flex items-center gap-1 active:scale-95"
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
              <span>Copiar</span>
            </button>
          </div>
          <div className="flex items-center justify-between border-t border-surface-container pt-2">
            <div>
              <span className="font-label-sm text-label-sm text-outline block">Alias</span>
              <span className="font-tabular-mono text-tabular-mono text-secondary text-sm">
                {currentAccount.alias}
              </span>
            </div>
            <button
              onClick={() => copyToClipboard(currentAccount.alias, 'Alias')}
              className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-bright text-primary text-label-sm font-label-sm flex items-center gap-1 active:scale-95"
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
              <span>Copiar</span>
            </button>
          </div>
        </div>

        {/* Quick Sandbox Top-Up simulation */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 text-tertiary">
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            <span className="font-label-md text-label-md font-semibold">
              Simulador de fondos de prueba
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
              Registrá una acreditación de prueba en la cuenta del backend:
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleDeposit(50000)}
              className="py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-tertiary font-tabular-mono text-sm font-semibold active:scale-95 transition-all text-center"
            >
              +$ 50.000
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleDeposit(150000)}
              className="py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-tertiary font-tabular-mono text-sm font-semibold active:scale-95 transition-all text-center"
            >
              +$ 150.000
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleDeposit(500000)}
              className="py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-bright text-tertiary font-tabular-mono text-sm font-semibold active:scale-95 transition-all text-center"
            >
              +$ 500.000
            </button>
          </div>
        </div>

        {/* Custom amount */}
        <form onSubmit={handleCustomDeposit} className="flex gap-2">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="Otro importe..."
            className="flex-1 bg-surface-container-lowest px-3 py-2 rounded-xl text-on-surface font-body-md text-sm placeholder:text-outline focus:outline-none"
          />
          <button
            type="submit"
            className="bg-primary text-on-primary px-4 py-2 rounded-xl font-label-md text-label-md font-semibold hover:bg-primary-container active:scale-95 transition-all"
          >
            Acreditar
          </button>
        </form>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useBanking } from '../../context/BankingContext';

export const TransferModal: React.FC = () => {
  const {
    isTransferModalOpen,
    setIsTransferModalOpen,
    accounts,
    sendTransfer,
    showToast,
  } = useBanking();

  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || 'ca-pesos');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('Varios');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (accounts.length && !accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  if (!isTransferModalOpen) return null;

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  const handleSelectContact = (alias: string) => {
    setRecipient(alias);
  };

  const handleQuickAmount = (val: number) => {
    setAmount(val.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Ingresá un importe válido mayor a 0', 'warning');
      return;
    }
    if (!recipient.trim()) {
      showToast('Ingresá un destinatario, CBU o Alias', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await sendTransfer(selectedAccountId, recipient.trim(), numAmount, concept);
      if (success) {
        setIsTransferModalOpen(false);
        setRecipient('');
        setAmount('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in"
      onClick={() => setIsTransferModalOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface-container p-5 shadow-2xl flex flex-col gap-4 border border-surface-bright/40 max-h-[90vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Transferir Dinero
              </h2>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Simulación inmediata 3.0
              </span>
            </div>
          </div>
          <button
            aria-label="Cerrar modal"
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            onClick={() => setIsTransferModalOpen(false)}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Origin Account Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Cuenta de origen
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
                    <div className="flex flex-col">
                      <span className="font-body-md text-body-md font-medium text-on-surface">
                        {acc.type}
                      </span>
                      <span className="font-label-sm text-label-sm text-outline">
                        {acc.accountNumber}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-tabular-mono text-tabular-mono text-on-surface font-bold block">
                      ${acc.currency === 'USD' ? ' U$S ' : ' '}{acc.balance.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="font-label-sm text-label-sm text-secondary">
                      Disponible
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Frequent Contacts */}
          <div className="flex flex-col gap-1.5">
            <span className="font-label-md text-label-md text-on-surface-variant">
              Contactos frecuentes
            </span>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {accounts.filter((account) => account.id !== selectedAccountId).map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => handleSelectContact(account.alias)}
                  className="px-3 py-1.5 rounded-full bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-md text-label-md flex items-center gap-1.5 whitespace-nowrap active:scale-95 transition-all shrink-0"
                >
                  <span className="material-symbols-outlined text-xs text-primary">person</span>
                  <span>{account.alias}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recipient Input */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface">
              Alias, CBU o CUIT de destino
            </label>
            <div className="relative flex items-center bg-surface-container-lowest rounded-lg">
              <span className="material-symbols-outlined text-outline ml-3 absolute pointer-events-none text-xl">
                badge
              </span>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Alias bancario, CBU de 22 dígitos o CUIT"
                required
                className="w-full bg-transparent py-3 pl-10 pr-3 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none"
              />
            </div>
          </div>

          {/* Amount Input */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <label className="font-label-md text-label-md text-on-surface">
                Importe a transferir
              </label>
              <span className="font-label-sm text-label-sm text-outline">
                Límite diario: $5.000.000
              </span>
            </div>
            <div className="relative flex items-center bg-surface-container-lowest rounded-lg">
              <span className="text-secondary ml-3.5 absolute pointer-events-none font-bold text-lg">
                $
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
                className="w-full bg-transparent py-3 pl-8 pr-3 font-currency-display-mobile text-on-surface placeholder:text-outline focus:outline-none"
              />
            </div>
            {/* Quick Amount Chips */}
            <div className="flex items-center gap-2 pt-1 overflow-x-auto no-scrollbar">
              {[5000, 15000, 30000, 50000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className="px-2.5 py-1 rounded-md bg-surface-container-high hover:bg-surface-bright text-secondary font-tabular-mono text-xs active:scale-95 transition-all"
                >
                  +${val.toLocaleString('es-AR')}
                </button>
              ))}
            </div>
          </div>

          {/* Concept Selector */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Concepto
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {['Varios', 'Alquiler', 'Factura', 'Servicio'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setConcept(c)}
                  className={`py-1.5 rounded-lg font-label-md text-label-md text-center transition-all ${
                    concept === c
                      ? 'bg-primary text-on-primary font-semibold'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 bg-primary-container text-on-primary-container py-3.5 px-4 rounded-xl font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary-container/20 active:scale-98 transition-all hover:bg-primary"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-[20px] animate-spin">
                  progress_activity
                </span>
                <span>Procesando transferencia...</span>
              </>
            ) : (
              <>
                <span>Confirmar Transferencia</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

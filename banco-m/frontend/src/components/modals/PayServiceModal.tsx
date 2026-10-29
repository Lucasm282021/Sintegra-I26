import React, { useEffect, useState } from 'react';
import { useBanking } from '../../context/BankingContext';
import { AVAILABLE_SERVICES } from '../../data/mockData';

export const PayServiceModal: React.FC = () => {
  const {
    isPayServiceModalOpen,
    setIsPayServiceModalOpen,
    accounts,
    payService,
    showToast,
  } = useBanking();

  const [selectedService, setSelectedService] = useState(AVAILABLE_SERVICES[0]);
  const [identifier, setIdentifier] = useState('2819039');
  const [amount, setAmount] = useState(AVAILABLE_SERVICES[0].defaultAmount.toString());
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || 'ca-pesos');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (accounts.length && !accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  if (!isPayServiceModalOpen) return null;

  const handleSelectService = (srv: (typeof AVAILABLE_SERVICES)[0]) => {
    setSelectedService(srv);
    setAmount(srv.defaultAmount.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Ingresá un importe válido', 'warning');
      return;
    }

    setIsSubmitting(true);
    const ok = await payService(
      selectedAccountId,
      selectedService.name,
      numAmount,
      identifier || 'FAC-98421'
    );
    setIsSubmitting(false);
    if (ok) setIsPayServiceModalOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in"
      onClick={() => setIsPayServiceModalOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface-container p-5 shadow-2xl flex flex-col gap-4 border border-surface-bright/40 max-h-[90vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-surface-container-high text-primary-fixed-dim flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">receipt</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Pagar Servicio
              </h2>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Registra un débito en banco-m
              </span>
            </div>
          </div>
          <button
            aria-label="Cerrar modal"
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            onClick={() => setIsPayServiceModalOpen(false)}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 font-body-sm text-body-sm text-amber-200">
            banco-m registra el débito y su referencia; la liquidación con la empresa no está conectada.
          </p>
          {/* Select Service */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Empresa / Servicio
            </label>
            <div className="grid grid-cols-1 gap-2">
              {AVAILABLE_SERVICES.map((srv) => (
                <button
                  key={srv.id}
                  type="button"
                  onClick={() => handleSelectService(srv)}
                  className={`p-3 rounded-xl flex items-center justify-between text-left transition-all ${
                    selectedService.id === srv.id
                      ? 'bg-surface-container-high ring-1 ring-primary'
                      : 'bg-surface-container-low hover:bg-surface-container-high/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-[18px]">
                        {srv.icon}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-body-md text-body-md font-medium text-on-surface">
                        {srv.name}
                      </span>
                      <span className="font-label-sm text-label-sm text-outline">
                        {srv.category}
                      </span>
                    </div>
                  </div>
                  <span className="font-tabular-mono text-tabular-mono text-on-surface font-bold text-sm">
                    $ {srv.defaultAmount.toLocaleString('es-AR')}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Identifier/Client code */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface">
              N° de Cliente / Código de Pago Electrónico
            </label>
            <div className="relative flex items-center bg-surface-container-lowest rounded-lg">
              <span className="material-symbols-outlined text-outline ml-3 absolute pointer-events-none text-xl">
                tag
              </span>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Código de barras o referencia"
                required
                className="w-full bg-transparent py-3 pl-10 pr-3 font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none"
              />
            </div>
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface">
              Importe a pagar
            </label>
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
                required
                className="w-full bg-transparent py-3 pl-8 pr-3 font-currency-display-mobile text-on-surface focus:outline-none"
              />
            </div>
          </div>

          {/* Pay Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 bg-primary text-on-primary py-3.5 px-4 rounded-xl font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all hover:bg-primary-container"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined text-[20px] animate-spin">
                  progress_activity
                </span>
                <span>Procesando pago...</span>
              </>
            ) : (
              <>
                <span>Registrar débito</span>
                <span className="material-symbols-outlined text-[20px]">task_alt</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

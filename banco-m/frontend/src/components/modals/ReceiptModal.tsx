import React from 'react';
import { useBanking } from '../../context/BankingContext';

export const ReceiptModal: React.FC = () => {
  const { selectedTransaction, setSelectedTransaction, showToast, copyToClipboard } = useBanking();

  if (!selectedTransaction) return null;

  const isIncome = selectedTransaction.amount > 0;
  const formattedAmount = `${isIncome ? '+' : '-'}$ ${Math.abs(
    selectedTransaction.amount
  ).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const handleShare = () => {
    const text = `Comprobante Boreal Banco\nConcepto: ${selectedTransaction.concept}\nImporte: ${formattedAmount}\nRef: ${selectedTransaction.referenceId}\nFecha: ${selectedTransaction.date} - ${selectedTransaction.time}`;
    copyToClipboard(text, 'Comprobante');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in"
      onClick={() => setSelectedTransaction(null)}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface-container-high p-5 shadow-2xl flex flex-col gap-4 border border-surface-bright/40"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-primary">
            <span className="material-symbols-outlined text-[20px]">verified</span>
            <span className="font-label-md text-label-md font-semibold">
              Comprobante Digital Simulado
            </span>
          </div>
          <button
            aria-label="Cerrar modal"
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            onClick={() => setSelectedTransaction(null)}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex flex-col items-center py-2 text-center bg-surface-container rounded-xl p-4">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider mb-1">
            {selectedTransaction.counterpartDetail || selectedTransaction.description}
          </span>
          <span
            className={`font-headline-lg text-headline-lg font-bold tracking-tight ${
              isIncome ? 'text-tertiary' : 'text-on-surface'
            }`}
          >
            {formattedAmount}
          </span>
          <span className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-[260px] truncate">
            {selectedTransaction.concept}
          </span>
          <span className="mt-2 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm bg-tertiary-container/30 text-tertiary font-medium">
            {selectedTransaction.status}
          </span>
        </div>

        <div className="flex flex-col gap-2 font-body-sm text-body-sm">
          <div className="flex justify-between py-1 border-b border-surface-container text-on-surface-variant">
            <span>Fecha y hora</span>
            <span className="text-on-surface font-tabular-mono text-tabular-mono font-medium">
              {selectedTransaction.date} - {selectedTransaction.time}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-surface-container text-on-surface-variant">
            <span>Identificador de transacción</span>
            <span className="text-on-surface font-tabular-mono text-tabular-mono">
              {selectedTransaction.referenceId}
            </span>
          </div>
          <div className="flex justify-between py-1 text-on-surface-variant">
            <span>Canal</span>
            <span className="text-on-surface">{selectedTransaction.channel}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <button
            className="flex-1 py-2.5 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md flex items-center justify-center gap-1 hover:bg-surface-container-highest active:scale-95 transition-all"
            type="button"
            onClick={handleShare}
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            <span>Compartir</span>
          </button>
          <button
            className="flex-1 py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold hover:bg-primary-container active:scale-95 transition-all shadow-md"
            type="button"
            onClick={() => setSelectedTransaction(null)}
          >
            <span>Aceptar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

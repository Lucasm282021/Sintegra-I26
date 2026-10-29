import React, { useState, useMemo } from 'react';
import { useBanking } from '../context/BankingContext';
import { Transaction, TransactionCategory } from '../types';

export const MovementsScreen: React.FC = () => {
  const {
    transactions,
    setSelectedTransaction,
    showToast,
    isBalanceHidden,
    user,
  } = useBanking();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | TransactionCategory>('all');
  const [period, setPeriod] = useState('Últimos 30 días');
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const [forceEmptyState, setForceEmptyState] = useState(false);

  const filterChips: { id: 'all' | TransactionCategory; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'ingresos', label: 'Ingresos' },
    { id: 'egresos', label: 'Egresos' },
    { id: 'transferencias', label: 'Transferencias' },
    { id: 'servicios', label: 'Pagos de servicios' },
  ];

  const periodOptions = [
    'Últimos 30 días',
    'Este mes (Octubre)',
    'Mes anterior (Septiembre)',
    'Año 2024',
  ];

  const filteredTransactions = useMemo(() => {
    if (forceEmptyState) return [];

    return transactions.filter((tx) => {
      // Category filter
      if (activeFilter === 'ingresos' && tx.amount <= 0) return false;
      if (activeFilter === 'egresos' && tx.amount >= 0) return false;
      if (activeFilter === 'transferencias' && tx.category !== 'transferencias' && !tx.tags.includes('transferencia')) return false;
      if (activeFilter === 'servicios' && tx.category !== 'servicios' && !tx.tags.includes('servicio')) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesConcept = tx.concept.toLowerCase().includes(q);
        const matchesDesc = tx.description.toLowerCase().includes(q);
        const matchesTags = tx.tags.toLowerCase().includes(q);
        const matchesCounterpart = tx.counterpart?.toLowerCase().includes(q) || false;
        const matchesDetail = tx.counterpartDetail?.toLowerCase().includes(q) || false;
        if (!matchesConcept && !matchesDesc && !matchesTags && !matchesCounterpart && !matchesDetail) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, activeFilter, searchQuery, forceEmptyState]);

  // Group by date label
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    filteredTransactions.forEach((tx) => {
      const label = tx.groupLabel || tx.date;
      if (!groups[label]) groups[label] = [];
      groups[label].push(tx);
    });
    return groups;
  }, [filteredTransactions]);

  const handleExport = () => {
    showToast('Exportando movimientos consultados en banco-m…', 'download');
    setTimeout(() => {
      const element = document.createElement('a');
      const text = `
BOREAL BANCO DIGITAL - RESUMEN DE MOVIMIENTOS
Cliente: ${user.name} (CUIT ${user.cuil})
Periodo: ${period}
Total Movimientos: ${filteredTransactions.length}
------------------------------------------------------------
${filteredTransactions
  .map(
    (t) =>
      `${t.date} ${t.time} | ${t.concept} | ${t.amount > 0 ? '+' : ''}$ ${Math.abs(t.amount)} | ${
        t.status
      } | Ref: ${t.referenceId}`
  )
  .join('\n')}
------------------------------------------------------------
Movimientos recibidos desde la API banco-m.
      `;
      const blob = new Blob([text.trim()], { type: 'text/csv;charset=utf-8' });
      element.href = URL.createObjectURL(blob);
      element.download = `Resumen_Movimientos_${period.replace(/\s+/g, '_')}_Boreal.csv`;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      showToast('Resumen exportado exitosamente', 'download_done');
    }, 700);
  };

  const handleResetFilters = () => {
    setForceEmptyState(false);
    setSearchQuery('');
    setActiveFilter('all');
  };

  return (
    <div className="flex flex-col w-full pb-6">
      {/* Search & Filter Controls */}
      <div className="mb-4 flex flex-col gap-space-sm lg:flex-row lg:items-start lg:gap-4">
        {/* Quick Search Bar */}
        <div className="relative w-full lg:flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </div>
          <input
            type="text"
            id="search-input"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setForceEmptyState(false);
            }}
            placeholder="Buscar por concepto, destinatario o CBU..."
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-surface-container text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:bg-surface-container-high transition-colors border border-surface-container-high/30"
          />
          {searchQuery && (
            <button
              aria-label="Borrar búsqueda"
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Filter Chips Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-margin px-margin lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
          {filterChips.map((chip) => {
            const isSelected = activeFilter === chip.id && !forceEmptyState;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  setActiveFilter(chip.id);
                  setForceEmptyState(false);
                }}
                className={`px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-secondary-container text-primary-fixed shadow-sm font-semibold'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                }`}
              >
                {isSelected && (
                  <span className="material-symbols-outlined text-[16px]">done</span>
                )}
                <span>{chip.label}</span>
              </button>
            );
          })}

          {/* Date Dropdown Chip */}
          <div className="relative">
            <button
              type="button"
              id="period-chip-btn"
              onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
              className="px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap bg-surface-container text-on-surface-variant hover:text-on-surface flex items-center gap-1 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
              <span>{period}</span>
              <span className="material-symbols-outlined text-[16px]">expand_more</span>
            </button>

            {/* Period Dropdown Popup */}
            {isPeriodDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-surface-container-high shadow-xl p-1.5 z-40 flex flex-col gap-0.5 border border-surface-bright/40 animate-in fade-in">
                {periodOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setPeriod(opt);
                      setIsPeriodDropdownOpen(false);
                      showToast(`Filtro temporal: ${opt}`);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg font-label-md text-label-md transition-colors ${
                      period === opt
                        ? 'text-primary bg-surface-container font-semibold'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Sandbox Toolbar Bar */}
      <div className="flex items-center justify-between mb-4 px-3 py-2 rounded-xl bg-surface-container-low shadow-sm border border-surface-container-highest/20">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[18px]">tune</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Simulador de vista
          </span>
        </div>
        <button
          type="button"
          onClick={() => setForceEmptyState(!forceEmptyState)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container text-primary font-label-sm text-label-sm hover:bg-surface-container-high transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">visibility</span>
          <span>
            {forceEmptyState ? 'Restablecer lista' : 'Ver estado de Lista Vacía'}
          </span>
        </button>
      </div>

      {/* Empty State Card */}
      {filteredTransactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-surface-container my-4 shadow-sm border border-surface-container-high/40 animate-in fade-in">
          <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center text-secondary mb-4 shadow-inner">
            <span className="material-symbols-outlined text-[36px]">receipt_long</span>
          </div>
          <span className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-1">
            Sin movimientos encontrados
          </span>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-xs mb-6">
            No hay operaciones que coincidan con los filtros aplicados en este período de simulación.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-5 py-2.5 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg font-semibold hover:bg-primary-container active:scale-95 transition-all shadow-md cursor-pointer"
          >
            Restablecer filtros
          </button>
        </div>
      ) : (
        /* Transactions Stream View Container */
        <div className="flex flex-col gap-6" id="transactions-container">
          {Object.entries(groupedTransactions).map(([dateLabel, items]) => (
            <div key={dateLabel} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="font-label-md text-label-md text-outline font-semibold tracking-wide uppercase">
                  {dateLabel}
                </span>
                <span className="font-label-sm text-label-sm text-outline font-medium">
                  {items.length} {items.length === 1 ? 'operación' : 'operaciones'}
                </span>
              </div>

              {items.map((tx) => {
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
                    className="tx-item flex items-center justify-between p-3.5 rounded-xl bg-surface-container shadow-sm active:scale-[0.99] transition-transform cursor-pointer border border-surface-container-high/30 hover:bg-surface-container-high"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          isIncome
                            ? 'bg-tertiary-container/20 text-tertiary'
                            : tx.status === 'Pendiente de liquidación'
                            ? 'bg-amber-500/10 text-amber-300'
                            : 'bg-surface-container-high text-primary'
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
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-body-sm text-body-sm text-outline truncate">
                            {tx.counterpartDetail || tx.description}
                          </span>
                          <span
                            className={`px-2 py-0.2 rounded-full font-label-sm text-label-sm font-medium shrink-0 ${
                              tx.status === 'Pendiente de liquidación'
                                ? 'bg-amber-500/15 text-amber-300'
                                : 'bg-tertiary-container/30 text-tertiary'
                            }`}
                          >
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 pl-3">
                      <span
                        className={`font-headline-sm text-headline-sm font-semibold tabular-nums ${
                          isIncome ? 'text-tertiary' : 'text-on-surface'
                        }`}
                      >
                        {formattedAmount}
                      </span>
                      <span className="font-body-sm text-body-sm text-outline">{tx.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Export Banner Action */}
      <div className="mt-8 mb-4">
        <button
          type="button"
          onClick={handleExport}
          className="w-full h-12 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-label-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm cursor-pointer border border-surface-container-high/40"
        >
          <span className="material-symbols-outlined text-[20px] text-primary">download</span>
          <span>Exportar movimientos consultados (CSV)</span>
        </button>
      </div>
    </div>
  );
};

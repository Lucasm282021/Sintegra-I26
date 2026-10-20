import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Sparkles, RefreshCw, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatPercent, round2, formatCuit } from '../utils/formatters';

export function PercepcionForm({
  padronItems,
  selectedCuit,
  onCalculate,
  isSubmitting,
  lastSuccessfulPayload,
}) {
  const [idVenta, setIdVenta] = useState('venta-101');
  const [cuit, setCuit] = useState('30712345678');
  const [montoVenta, setMontoVenta] = useState('10200.00');

  // Si cambia el CUIT seleccionado desde la tabla o modal
  useEffect(() => {
    if (selectedCuit) {
      setCuit(selectedCuit);
    }
  }, [selectedCuit]);

  // Buscar si el CUIT ingresado existe en los contribuyentes cargados para previsualización
  const cleanCuit = (cuit || '').trim().replace(/[-.]/g, '');
  const matchedContributor = useMemo(() => {
    return padronItems.find((item) => item.cuit === cleanCuit);
  }, [padronItems, cleanCuit]);

  // Cálculo de estimación visual previa
  const numMonto = Number.parseFloat(montoVenta);
  const isValidMonto = !Number.isNaN(numMonto) && numMonto > 0;
  const estimatedAlicuota = matchedContributor ? matchedContributor.alicuota : null;
  const estimatedPercepcion = estimatedAlicuota !== null && isValidMonto
    ? round2(numMonto * estimatedAlicuota)
    : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!idVenta.trim() || !cleanCuit || !isValidMonto) return;
    onCalculate({
      id_venta: idVenta.trim(),
      cuit: cleanCuit,
      monto_venta: round2(numMonto),
    });
  };

  // Helper: Generar nuevo ID de venta aleatorio
  const handleRandomId = () => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    setIdVenta(`venta-${randomNum}`);
  };

  // Helper: Cargar datos idénticos de la última solicitud para probar idempotencia 200
  const handleLoadLastIdentical = () => {
    if (lastSuccessfulPayload) {
      setIdVenta(lastSuccessfulPayload.id_venta);
      setCuit(lastSuccessfulPayload.cuit);
      setMontoVenta(String(lastSuccessfulPayload.monto_venta));
    }
  };

  // Helper: Cargar mismo id_venta pero monto distinto para probar 409
  const handleSimulateConflict = () => {
    if (lastSuccessfulPayload) {
      setIdVenta(lastSuccessfulPayload.id_venta);
      setCuit(lastSuccessfulPayload.cuit);
      const nuevoMonto = round2(lastSuccessfulPayload.monto_venta + 1500);
      setMontoVenta(String(nuevoMonto));
    } else {
      setIdVenta('venta-101');
      setMontoVenta('99999.00');
    }
  };

  // Helper: Cargar CUIT inexistente para probar 404
  const handleSimulate404 = () => {
    setCuit('11111111111');
    setIdVenta(`venta-404-${Math.floor(Math.random() * 100)}`);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Simulador de Percepción (TPV)
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500">POST /arba/percepciones</span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Simula el envío de una venta desde la terminal de pagos hacia el módulo ARBA
        </p>

        {/* Shortcuts para pruebas rápidas de laboratorio */}
        <div className="mb-4 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
          <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Accesos rápidos para pruebas académicas:</span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <button
              type="button"
              onClick={handleRandomId}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono text-[11px] transition-colors"
            >
              Nuevo id_venta
            </button>
            {lastSuccessfulPayload && (
              <button
                type="button"
                onClick={handleLoadLastIdentical}
                className="px-2 py-0.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-mono text-[11px] transition-colors"
                title="Repite id_venta, CUIT y monto para verificar HTTP 200"
              >
                Repetir idéntica (200)
              </button>
            )}
            <button
              type="button"
              onClick={handleSimulateConflict}
              className="px-2 py-0.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded font-mono text-[11px] transition-colors"
              title="Mismo id_venta con monto modificado para verificar HTTP 409"
            >
              Forzar conflicto (409)
            </button>
            <button
              type="button"
              onClick={handleSimulate404}
              className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-mono text-[11px] transition-colors"
              title="CUIT 11111111111 no registrado para verificar HTTP 404"
            >
              CUIT inexistente (404)
            </button>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Campo id_venta */}
          <div>
            <label htmlFor="id_venta" className="block text-xs text-slate-300 font-medium mb-1">
              ID de Venta (<code className="text-emerald-400 font-mono">id_venta</code>):
            </label>
            <div className="flex gap-2">
              <input
                id="id_venta"
                type="text"
                required
                value={idVenta}
                onChange={(e) => setIdVenta(e.target.value)}
                placeholder="ej. venta-001"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleRandomId}
                className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-mono transition-colors"
                title="Generar nuevo identificador"
              >
                🎲
              </button>
            </div>
          </div>

          {/* Campo CUIT */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="cuit" className="block text-xs text-slate-300 font-medium">
                CUIT del Contribuyente (<code className="text-emerald-400 font-mono">cuit</code>):
              </label>
              {padronItems.length > 0 && (
                <span className="text-[11px] text-slate-400">
                  Selección rápida desde padrón
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              <input
                id="cuit"
                type="text"
                required
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                placeholder="ej. 30712345678 (11 dígitos)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
              {/* Selector desplegable de contribuyentes conocidos */}
              {padronItems.length > 0 && (
                <select
                  value={cleanCuit}
                  onChange={(e) => setCuit(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800/80 rounded-lg px-2.5 py-1 text-xs text-slate-400 font-mono focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Seleccionar contribuyente del padrón --</option>
                  {padronItems.map((item) => (
                    <option key={item.cuit} value={item.cuit}>
                      {formatCuit(item.cuit)} — {item.actividad} ({formatPercent(item.alicuota)})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Campo monto_venta */}
          <div>
            <label htmlFor="monto_venta" className="block text-xs text-slate-300 font-medium mb-1">
              Monto de Venta ($ ARS) (<code className="text-emerald-400 font-mono">monto_venta</code>):
            </label>
            <input
              id="monto_venta"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={montoVenta}
              onChange={(e) => setMontoVenta(e.target.value)}
              placeholder="10200.00"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Previsualización: Estimación visual previa */}
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Estimación visual previa</span>
              <span className="text-[10px] text-amber-400 font-mono">Cálculo en cliente</span>
            </div>
            <div className="text-xs space-y-1 pt-1 font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span>Monto de venta:</span>
                <span className="text-white font-medium">{formatCurrency(isValidMonto ? numMonto : 0)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Alícuota aplicada:</span>
                <span className="text-white font-medium">
                  {estimatedAlicuota !== null ? `${formatPercent(estimatedAlicuota)} (${estimatedAlicuota})` : 'Desconocida (no en vista)'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800 font-bold">
                <span className="text-emerald-400">Percepción IIBB estimada:</span>
                <span className="text-emerald-400 tabular-nums">
                  {estimatedPercepcion !== null ? formatCurrency(estimatedPercepcion) : '—'}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic mt-1">
              Nota: La estimación previa es solo referencial. El valor fiscal oficial es siempre el devuelto por el backend.
            </p>
          </div>

          {/* Botón de envío */}
          <button
            type="submit"
            disabled={isSubmitting || !idVenta.trim() || !cleanCuit || !isValidMonto}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Registrando en ARBA...</span>
              </>
            ) : (
              <>
                <span>Calcular y registrar percepción</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  ComercioConResumen,
  formatearArs,
  obtenerComercioPorCuit,
  obtenerTributosPorCuit,
  registrarPagoTributo,
  RespuestaTributosCuit,
  validarCuit,
} from '../services/municipioService';
import { Comercio, ComprobantePago, TributoPeriodo } from '../types/municipio';

interface TabCuentasCorrientesProps {
  selectedCuit: string;
  comerciosPadron: ComercioConResumen[];
  onSelectCuit: (cuit: string) => void;
  onPagoExitoso: (comprobante: ComprobantePago) => Promise<void>;
  onIrAComprobantes: (cuit: string) => void;
}

export const TabCuentasCorrientes: React.FC<TabCuentasCorrientesProps> = ({
  selectedCuit,
  comerciosPadron,
  onSelectCuit,
  onPagoExitoso,
  onIrAComprobantes,
}) => {
  const [cuitInput, setCuitInput] = useState(selectedCuit || '30789012345');
  const [loadingConsulta, setLoadingConsulta] = useState(false);
  const [comercioActual, setComercioActual] = useState<Comercio | null>(null);
  const [cuentaCorriente, setCuentaCorriente] = useState<RespuestaTributosCuit | null>(null);
  const [consultaError, setConsultaError] = useState<{
    status: number;
    statusText: string;
    mensaje: string;
  } | null>(null);

  const [pagandoPeriodo, setPagandoPeriodo] = useState<string | null>(null);
  const [pagoFeedback, setPagoFeedback] = useState<{
    type: 'success' | 'error';
    statusText: string;
    mensaje: string;
    comprobante?: ComprobantePago;
  } | null>(null);

  const ejecutarConsultaCuit = async (cuitTarget: string) => {
    const limpio = cuitTarget.trim();
    setCuitInput(limpio);
    setLoadingConsulta(true);
    setConsultaError(null);
    setPagoFeedback(null);

    try {
      const [resComercio, resTributos] = await Promise.all([
        obtenerComercioPorCuit(limpio),
        obtenerTributosPorCuit(limpio),
      ]);

      if (!resComercio.ok || !resTributos.ok) {
        const failed = !resComercio.ok ? resComercio : resTributos;
        setComercioActual(null);
        setCuentaCorriente(null);
        setConsultaError({
          status: failed.status,
          statusText: failed.statusText,
          mensaje: failed.error?.mensaje || 'Error al consultar la cuenta corriente.',
        });
        return;
      }

      setComercioActual(resComercio.data || null);
      setCuentaCorriente(resTributos.data || null);
      onSelectCuit(limpio);
    } finally {
      setLoadingConsulta(false);
    }
  };

  useEffect(() => {
    if (selectedCuit && selectedCuit !== comercioActual?.cuit) {
      ejecutarConsultaCuit(selectedCuit);
    } else if (!comercioActual && !consultaError && cuitInput) {
      ejecutarConsultaCuit(cuitInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCuit]);

  const handleSubmitBusqueda = (e: React.FormEvent) => {
    e.preventDefault();
    ejecutarConsultaCuit(cuitInput);
  };

  const handlePagarPeriodo = async (tributo: TributoPeriodo) => {
    setPagandoPeriodo(tributo.periodo);
    setPagoFeedback(null);

    try {
      const res = await registrarPagoTributo({
        cuit: tributo.cuit,
        periodo: tributo.periodo,
        monto: tributo.importe,
      });

      if (res.ok && res.data) {
        // Actualizar vista de tributos local y notificar al estado global
        const updatedTributos = await obtenerTributosPorCuit(tributo.cuit);
        if (updatedTributos.ok && updatedTributos.data) {
          setCuentaCorriente(updatedTributos.data);
        }
        await onPagoExitoso(res.data.comprobante);
        setPagoFeedback({
          type: 'success',
          statusText: `HTTP ${res.statusText}`,
          mensaje: `Pago procesado exitosamente para el período ${tributo.periodo} por ${formatearArs(
            tributo.importe
          )}. Comprobante emitido: ${res.data.comprobante.id_comprobante}.`,
          comprobante: res.data.comprobante,
        });
      } else {
        setPagoFeedback({
          type: 'error',
          statusText: `HTTP ${res.statusText} — ${res.error?.codigo || 'ERROR'}`,
          mensaje: res.error?.mensaje || 'No se pudo procesar el pago de la tasa.',
        });
      }
    } finally {
      setPagandoPeriodo(null);
    }
  };

  const inputValidacion = cuitInput.length > 0 ? validarCuit(cuitInput) : null;

  return (
    <div className="space-y-6">
      {/* Search & Quick-Select Bar */}
      <section
        aria-labelledby="heading-consulta-cuenta"
        className="bg-white border border-slate-200 rounded-xl p-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5">
            <h2 id="heading-consulta-cuenta" className="text-base font-bold text-slate-900">
              Consulta de Cuenta Corriente Tributaria por CUIT
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              GET /municipio/comercios/&#123;cuit&#125; · GET /municipio/tributos/&#123;cuit&#125;
            </p>

            <form onSubmit={handleSubmitBusqueda} className="mt-3 flex items-center gap-2.5">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="search-cuit-cuenta"
                  type="text"
                  inputMode="numeric"
                  maxLength={13}
                  aria-label="CUIT a consultar (11 dígitos)"
                  value={cuitInput}
                  onChange={(e) => setCuitInput(e.target.value.replace(/\s+/g, ''))}
                  placeholder="Ingrese CUIT de 11 dígitos (ej. 30789012345)"
                  className="w-full pl-9 pr-4 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
              <button
                type="submit"
                disabled={loadingConsulta}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {loadingConsulta ? 'Consultando...' : 'Consultar CUIT'}
              </button>
            </form>
            {inputValidacion && !inputValidacion.valido && (
              <p className="mt-1.5 text-xs text-amber-700">
                Nota: {inputValidacion.mensaje} (Al consultar se simulará respuesta HTTP 400 Bad Request).
              </p>
            )}
          </div>

          {/* Quick Select Buttons from Registered Padron + 404 Test */}
          <div className="lg:col-span-7 space-y-2">
            <div className="text-xs font-semibold text-slate-600">
              Selección Rápida de Contribuyentes (Padrón):
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {comerciosPadron.map((c) => {
                const isSelected = c.cuit === comercioActual?.cuit;
                return (
                  <button
                    key={c.cuit}
                    type="button"
                    onClick={() => ejecutarConsultaCuit(c.cuit)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600 text-blue-950 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-mono tabular-nums">{c.cuit}</span>
                    <span aria-hidden="true" className="mx-1.5 text-slate-400">·</span>
                    <span>{c.razon_social}</span>
                    <span aria-hidden="true" className="mx-1.5 text-slate-400">·</span>
                    <span
                      className={`font-mono tabular-nums ${
                        c.deuda_total === 0 ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {c.deuda_total === 0 ? 'Sin Deuda' : formatearArs(c.deuda_total)}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => ejecutarConsultaCuit('30999999999')}
                title="Consulta un CUIT no empadronado para verificar respuesta HTTP 404 Not Found"
                className="px-2.5 py-1.5 text-xs font-mono text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Probar 404 (30999999999)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Error State (400 / 404) */}
      {consultaError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 rounded-xl p-5 text-red-950 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-mono text-sm font-bold">
              HTTP {consultaError.statusText}
            </div>
            <p className="text-sm">{consultaError.mensaje}</p>
          </div>
        </div>
      )}

      {/* Payment Feedback Alert */}
      {pagoFeedback && (
        <div
          role="status"
          className={`p-4 rounded-xl border text-sm flex items-start justify-between gap-4 ${
            pagoFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-red-50 border-red-300 text-red-950'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {pagoFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-mono text-xs font-bold">{pagoFeedback.statusText}</div>
              <p className="text-xs sm:text-sm">{pagoFeedback.mensaje}</p>
            </div>
          </div>

          {pagoFeedback.comprobante && (
            <button
              type="button"
              onClick={() => onIrAComprobantes(pagoFeedback.comprobante!.cuit)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Ver Comprobante y Libre Deuda</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Loaded Account Details */}
      {comercioActual && cuentaCorriente && (
        <div className="space-y-6">
          {/* Entity & Balance Header Card */}
          <section
            aria-label="Datos del Contribuyente y Estado de Deuda"
            className="bg-white border border-slate-200 rounded-xl p-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-slate-900">
                    CUIT {comercioActual.cuit}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{comercioActual.condicion_fiscal}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize text-emerald-700 font-semibold">
                    Comercio {comercioActual.estado}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-slate-900">
                  {comercioActual.razon_social}
                </h3>

                <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{comercioActual.direccion}</span>
                  <span aria-hidden="true">·</span>
                  <span>Rubro Principal: {comercioActual.rubro_principal}</span>
                  {comercioActual.rubro_secundario && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Secundario: {comercioActual.rubro_secundario}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-6">
                <div>
                  <div className="text-xs text-slate-500">Deuda Exigible</div>
                  <div
                    className={`mt-1 text-lg font-bold font-mono tabular-nums ${
                      cuentaCorriente.deuda_total === 0 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {formatearArs(cuentaCorriente.deuda_total)}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500">Total Abonado</div>
                  <div className="mt-1 text-lg font-bold text-slate-900 font-mono tabular-nums">
                    {formatearArs(cuentaCorriente.total_pagado)}
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <div className="text-xs text-slate-500">Períodos Impagos</div>
                  <div className="mt-1 text-lg font-bold text-slate-900 font-mono tabular-nums">
                    {cuentaCorriente.periodos_pendientes} / {cuentaCorriente.tributos.length}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Breakdown of Tax Periods Table */}
          <section
            aria-labelledby="heading-desglose-periodos"
            className="bg-white border border-slate-200 rounded-xl p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3 id="heading-desglose-periodos" className="text-base font-bold text-slate-900">
                  Desglose de Obligaciones Tributarias por Período
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  POST /municipio/tributos/pagos · Conceptos: Tasa de Seguridad e Higiene (TISH) y Conservación de la Vía Pública
                </p>
              </div>

              {cuentaCorriente.deuda_total === 0 && (
                <button
                  type="button"
                  onClick={() => onIrAComprobantes(comercioActual.cuit)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileCheck2 className="w-4 h-4 text-emerald-700" />
                  <span>Contribuyente Libre de Deuda · Emitir Certificado</span>
                </button>
              )}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-3 pr-4">Período / Vencimiento</th>
                    <th className="py-3 px-4">Desglose de Conceptos Municipales</th>
                    <th className="py-3 px-4 text-right">Importe Total (ARS)</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 pl-4 text-right">Operación de Cobranza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {cuentaCorriente.tributos.map((tributo) => {
                    const isPagado = tributo.estado === 'pagado';
                    const isProcessing = pagandoPeriodo === tributo.periodo;

                    return (
                      <tr
                        key={tributo.id_tributo}
                        className="hover:bg-slate-50/80 transition-colors align-top"
                      >
                        <td className="py-4 pr-4 whitespace-nowrap">
                          <div className="font-mono text-base font-bold text-slate-900 tabular-nums">
                            {tributo.periodo}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                            Vto: {tributo.vencimiento}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="space-y-1.5">
                            {tributo.desglose.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-4 text-xs"
                              >
                                <span className="text-slate-700 font-medium">
                                  {item.concepto}
                                </span>
                                <span className="font-mono text-slate-600 tabular-nums">
                                  {formatearArs(item.importe)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="font-mono text-base font-bold text-slate-900 tabular-nums">
                            {formatearArs(tributo.importe)}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">Moneda: ARS</div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          {isPagado ? (
                            <div className="space-y-1">
                              <div className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                                Pagado
                              </div>
                              {tributo.id_comprobante && (
                                <div className="text-xs font-mono text-slate-500 tabular-nums">
                                  {tributo.id_comprobante}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                                Pendiente
                              </div>
                              <div className="text-xs text-slate-500">Saldo exigible</div>
                            </div>
                          )}
                        </td>

                        <td className="py-4 pl-4 text-right whitespace-nowrap">
                          {!isPagado ? (
                            <button
                              type="button"
                              disabled={isProcessing}
                              onClick={() => handlePagarPeriodo(tributo)}
                              aria-label={`Pagar Tasa del período ${tributo.periodo}`}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <CreditCard className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {isProcessing
                                  ? 'Procesando...'
                                  : `Pagar Tasa (${tributo.periodo})`}
                              </span>
                            </button>
                          ) : (
                            <div className="inline-flex items-center justify-end gap-2">
                              <span className="text-xs font-medium text-emerald-700">
                                Obligación cancelada
                              </span>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handlePagarPeriodo(tributo)}
                                title="Simula reintentar pago de un período ya abonado para verificar HTTP 409 Conflict"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Probar 409</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

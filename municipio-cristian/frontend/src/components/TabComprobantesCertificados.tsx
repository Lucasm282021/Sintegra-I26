import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  FileCheck2,
  Lock,
  Printer,
  ReceiptText,
  ShieldCheck,
} from 'lucide-react';
import {
  ComercioConResumen,
  emitirCertificadoLibreDeuda,
  formatearArs,
  listarComprobantes,
} from '../services/municipioService';
import { CertificadoLibreDeuda, ComprobantePago } from '../types/municipio';

interface TabComprobantesCertificadosProps {
  selectedCuit: string;
  comerciosPadron: ComercioConResumen[];
  comprobantes: ComprobantePago[];
  onSelectCuit: (cuit: string) => void;
  onIrACuentaCorriente: (cuit: string) => void;
  onRefreshComprobantes: () => Promise<void>;
}

export const TabComprobantesCertificados: React.FC<TabComprobantesCertificadosProps> = ({
  selectedCuit,
  comerciosPadron,
  comprobantes,
  onSelectCuit,
  onIrACuentaCorriente,
  onRefreshComprobantes,
}) => {
  const [cuitCertificado, setCuitCertificado] = useState<string>(
    selectedCuit || '30712345678'
  );
  const [filtroCuitComprobantes, setFiltroCuitComprobantes] = useState<string>('todos');
  const [emitiendo, setEmitiendo] = useState(false);
  const [certificadoEmitido, setCertificadoEmitido] = useState<CertificadoLibreDeuda | null>(
    null
  );
  const [errorCertificado, setErrorCertificado] = useState<{
    statusText: string;
    mensaje: string;
    detalles?: string;
  } | null>(null);

  const [comprobanteSeleccionado, setComprobanteSeleccionado] =
    useState<ComprobantePago | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCuit) {
      setCuitCertificado(selectedCuit);
    }
  }, [selectedCuit]);

  const comercioSeleccionado = comerciosPadron.find((c) => c.cuit === cuitCertificado);
  const tieneDeudaCero = comercioSeleccionado ? comercioSeleccionado.deuda_total === 0 : false;

  const handleSeleccionarCuit = (cuit: string) => {
    setCuitCertificado(cuit);
    onSelectCuit(cuit);
    setCertificadoEmitido(null);
    setErrorCertificado(null);
  };

  const handleEmitirCertificado = async () => {
    setEmitiendo(true);
    setErrorCertificado(null);
    try {
      const res = await emitirCertificadoLibreDeuda(cuitCertificado);
      if (res.ok && res.data) {
        setCertificadoEmitido(res.data);
      } else {
        setCertificadoEmitido(null);
        setErrorCertificado({
          statusText: `HTTP ${res.statusText} — ${res.error?.codigo || 'ERROR'}`,
          mensaje: res.error?.mensaje || 'No se pudo emitir el Certificado de Libre Deuda.',
          detalles: res.error?.detalles,
        });
      }
    } finally {
      setEmitiendo(false);
    }
  };

  const handleFiltrarComprobantesApi = async (cuitVal: string) => {
    setFiltroCuitComprobantes(cuitVal);
    if (cuitVal === 'todos') {
      await listarComprobantes();
    } else {
      await listarComprobantes(cuitVal);
    }
    await onRefreshComprobantes();
  };

  const handleCopyJson = (id: string, payload: unknown) => {
    navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const comprobantesVisibles =
    filtroCuitComprobantes === 'todos'
      ? comprobantes
      : comprobantes.filter((c) => c.cuit === filtroCuitComprobantes);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Emisión de Certificado de Libre Deuda */}
        <section
          aria-labelledby="heading-certificado-libre-deuda"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="pb-4 border-b border-slate-200">
            <h2
              id="heading-certificado-libre-deuda"
              className="text-base font-bold text-slate-900"
            >
              Emisión de Certificado de Libre Deuda
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Habilitado exclusivamente para comercios con saldo de deuda $ 0,00
            </p>
          </div>

          {/* Selector de Comercio del Padrón */}
          <div className="space-y-2">
            <label
              htmlFor="select-cuit-certificado"
              className="block text-xs font-semibold text-slate-800"
            >
              Seleccionar Comercio Empadronado (CUIT)
            </label>
            <select
              id="select-cuit-certificado"
              value={cuitCertificado}
              onChange={(e) => handleSeleccionarCuit(e.target.value)}
              className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            >
              {comerciosPadron.map((c) => (
                <option key={c.cuit} value={c.cuit}>
                  {c.cuit} — {c.razon_social} (
                  {c.deuda_total === 0 ? 'Deuda: $ 0,00' : `Deuda: ${formatearArs(c.deuda_total)}`})
                </option>
              ))}
            </select>
          </div>

          {/* Estado Fiscal del CUIT Seleccionado */}
          {comercioSeleccionado && (
            <div
              className={`p-4 rounded-xl border space-y-3 ${
                tieneDeudaCero
                  ? 'bg-emerald-50/70 border-emerald-300'
                  : 'bg-amber-50/70 border-amber-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-mono text-slate-600">
                    CUIT {comercioSeleccionado.cuit}
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {comercioSeleccionado.razon_social}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {comercioSeleccionado.condicion_fiscal} · {comercioSeleccionado.rubro_principal}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-600">Deuda Actual</div>
                  <div
                    className={`font-mono text-base font-bold tabular-nums ${
                      tieneDeudaCero ? 'text-emerald-800' : 'text-amber-800'
                    }`}
                  >
                    {formatearArs(comercioSeleccionado.deuda_total)}
                  </div>
                </div>
              </div>

              {tieneDeudaCero ? (
                <div className="pt-2 border-t border-emerald-200/80 flex items-center justify-between gap-2 text-xs text-emerald-900">
                  <div className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Cumple requisito ($ 0,00 de deuda en los 3 períodos)</span>
                  </div>
                </div>
              ) : (
                <div className="pt-2 border-t border-amber-200/80 space-y-2 text-xs text-amber-950">
                  <div className="flex items-start gap-1.5 font-medium">
                    <Lock className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                    <span>
                      Emisión bloqueada: registra {comercioSeleccionado.periodos_pendientes} período(s) pendiente(s) de pago por {formatearArs(comercioSeleccionado.deuda_total)}.
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onIrACuentaCorriente(comercioSeleccionado.cuit)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-200/80 hover:bg-amber-300/80 rounded-lg transition-colors cursor-pointer"
                    >
                      <span>Saldar Deuda en Cuenta Corriente</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleEmitirCertificado}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono text-slate-700 bg-white/80 hover:bg-white border border-amber-300 rounded-lg transition-colors cursor-pointer"
                    >
                      <span>Forzar Petición (Probar 409)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Primary Action Button: Emitir Certificado */}
          <button
            type="button"
            disabled={!tieneDeudaCero || emitiendo}
            onClick={handleEmitirCertificado}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
          >
            <FileCheck2 className="w-4 h-4 shrink-0" />
            <span>
              {emitiendo
                ? 'Verificando Estado Fiscal...'
                : tieneDeudaCero
                ? 'Emitir Certificado de Libre Deuda'
                : 'Emisión Deshabilitada (Requiere Deuda $ 0,00)'}
            </span>
          </button>

          {/* Error Alert (e.g. 409 Conflict test) */}
          {errorCertificado && (
            <div
              role="alert"
              className="p-4 bg-red-50 border border-red-300 rounded-xl text-xs text-red-950 space-y-1"
            >
              <div className="flex items-center gap-2 font-mono font-bold text-red-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorCertificado.statusText}</span>
              </div>
              <p>{errorCertificado.mensaje}</p>
              {errorCertificado.detalles && (
                <p className="font-mono text-red-800 pt-1">{errorCertificado.detalles}</p>
              )}
            </div>
          )}

          {/* Rendered Official Certificate */}
          {certificadoEmitido && (
            <div
              aria-label="Certificado de Libre Deuda Emitido"
              className="border-2 border-slate-900 rounded-xl p-5 bg-slate-50/60 space-y-4"
            >
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-300">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-6 h-6 text-emerald-700 shrink-0" />
                  <div>
                    <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
                      Certificado Oficial Municipal
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      CERTIFICADO DE LIBRE DEUDA
                    </h3>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded">
                  {certificadoEmitido.estado_fiscal}
                </span>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-slate-500">N° Certificado</dt>
                  <dd className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
                    {certificadoEmitido.id_certificado}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Código Verificación</dt>
                  <dd className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
                    {certificadoEmitido.codigo_verificacion}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">CUIT Contribuyente</dt>
                  <dd className="font-mono font-bold text-slate-900 mt-0.5 tabular-nums">
                    {certificadoEmitido.cuit}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Razón Social</dt>
                  <dd className="font-semibold text-slate-900 mt-0.5">
                    {certificadoEmitido.razon_social}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Domicilio y Actividad</dt>
                  <dd className="text-slate-800 mt-0.5">
                    {certificadoEmitido.direccion} · {certificadoEmitido.rubro_principal}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Saldo Deuda Exigible</dt>
                  <dd className="font-mono font-bold text-emerald-700 mt-0.5 tabular-nums">
                    {formatearArs(certificadoEmitido.deuda_total_ars)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Vigencia Hasta</dt>
                  <dd className="font-mono font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {certificadoEmitido.vigencia_hasta}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500">Períodos Auditados Sin Deuda</dt>
                  <dd className="font-mono text-slate-800 mt-0.5">
                    {certificadoEmitido.periodos_auditados.join(' · ')}
                  </dd>
                </div>
              </dl>

              <div className="pt-3 border-t border-slate-300 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  {certificadoEmitido.organismo}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyJson(certificadoEmitido.id_certificado, certificadoEmitido)
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {copiedId === certificadoEmitido.id_certificado
                        ? 'JSON Copiado'
                        : 'Copiar JSON'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 shrink-0" />
                    <span>Imprimir</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Registro de Comprobantes de Pago */}
        <section
          aria-labelledby="heading-comprobantes-pago"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 id="heading-comprobantes-pago" className="text-base font-bold text-slate-900">
                Comprobantes de Pago Emitidos
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Constancias generadas por POST /municipio/tributos/pagos y pagos históricos
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="filter-cuit-comprobantes" className="text-xs text-slate-600">
                Filtrar CUIT:
              </label>
              <select
                id="filter-cuit-comprobantes"
                value={filtroCuitComprobantes}
                onChange={(e) => handleFiltrarComprobantesApi(e.target.value)}
                className="px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
              >
                <option value="todos">Todos ({comprobantes.length})</option>
                {comerciosPadron.map((c) => (
                  <option key={c.cuit} value={c.cuit}>
                    {c.cuit} — {c.razon_social}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Receipt Detail Drawer/Box */}
          {comprobanteSeleccionado && (
            <div className="p-4 bg-slate-50 border border-slate-300 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-blue-700" />
                  <span className="font-mono text-xs font-bold text-slate-900">
                    Detalle de Comprobante {comprobanteSeleccionado.id_comprobante}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setComprobanteSeleccionado(null)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cerrar detalle
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">N° Operación</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {comprobanteSeleccionado.numero_operacion}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">CUIT</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {comprobanteSeleccionado.cuit}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Período Abonado</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {comprobanteSeleccionado.periodo}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Abonado (ARS)</span>
                  <span className="font-mono font-bold text-emerald-700 tabular-nums">
                    {formatearArs(comprobanteSeleccionado.monto)}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 space-y-1 text-xs">
                <div className="font-semibold text-slate-700">Conceptos Incluidos:</div>
                {comprobanteSeleccionado.conceptos.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-slate-600">
                    <span>{item.concepto}</span>
                    <span className="font-mono tabular-nums">{formatearArs(item.importe)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receipts Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 pr-4">Comprobante / Operación</th>
                  <th className="py-3 px-4">Contribuyente (CUIT)</th>
                  <th className="py-3 px-4">Período</th>
                  <th className="py-3 px-4 text-right">Monto (ARS)</th>
                  <th className="py-3 pl-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {comprobantesVisibles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                      No se registran comprobantes de pago para el filtro seleccionado.
                    </td>
                  </tr>
                ) : (
                  comprobantesVisibles.map((cmp) => (
                    <tr
                      key={cmp.id_comprobante}
                      className="hover:bg-slate-50/80 transition-colors align-top"
                    >
                      <td className="py-3.5 pr-4 whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 text-xs tabular-nums">
                          {cmp.id_comprobante}
                        </div>
                        <div className="mt-0.5 text-xs font-mono text-slate-500 tabular-nums">
                          {cmp.numero_operacion} · {cmp.fecha_pago.slice(0, 10)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                          {cmp.razon_social}
                        </div>
                        <div className="text-xs font-mono text-slate-500 tabular-nums">
                          CUIT {cmp.cuit}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {cmp.periodo}
                        </span>
                        <div className="text-xs text-emerald-700 font-medium capitalize">
                          {cmp.estado}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-mono font-bold text-slate-900 tabular-nums">
                          {formatearArs(cmp.monto)}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">{cmp.moneda}</div>
                      </td>

                      <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setComprobanteSeleccionado(cmp)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                          >
                            Ver Recibo
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyJson(cmp.id_comprobante, cmp)}
                            className="px-2.5 py-1.5 text-xs font-mono text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer"
                          >
                            {copiedId === cmp.id_comprobante ? 'Copiado' : 'JSON'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

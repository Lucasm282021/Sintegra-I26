import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileCheck2,
  PlusCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  ComercioConResumen,
  crearComercio,
  formatearArs,
  validarCuit,
} from '../services/municipioService';
import { NuevoComercioPayload } from '../types/municipio';

interface TabPadronComerciosProps {
  comercios: ComercioConResumen[];
  isLoading: boolean;
  onComercioCreado: (cuitCreado: string) => Promise<void>;
  onIrACuentaCorriente: (cuit: string) => void;
  onIrACertificados: (cuit: string) => void;
}

const CONDICIONES_FISCALES = [
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
  'Consumidor Final',
];

const EJEMPLOS_ALTA: NuevoComercioPayload[] = [
  {
    cuit: '30765432109',
    razon_social: 'Frigorífico Regional Pampeano S.A.',
    condicion_fiscal: 'Responsable Inscripto',
    direccion: 'Ruta Provincial 14 Km 8.5, Zona Industrial',
    rubro_principal: 'Procesamiento y Conservación de Carnes',
    rubro_secundario: 'Transporte Refrigerado y Depósito',
  },
  {
    cuit: '20345678901',
    razon_social: 'Farmacia Central del Valle S.C.S.',
    condicion_fiscal: 'Responsable Inscripto',
    direccion: 'Av. 9 de Julio 412, Microcentro',
    rubro_principal: 'Venta Minorista de Productos Farmacéuticos',
    rubro_secundario: 'Perfumería y Artículos de Ortopedia',
  },
  {
    cuit: '30799887766',
    razon_social: 'Tecnología Agrícola del Litoral S.R.L.',
    condicion_fiscal: 'Monotributista',
    direccion: 'Callejón Los Álamos 190, Parque Tecnológico',
    rubro_principal: 'Desarrollo de Sensores y Telemetría Rural',
    rubro_secundario: 'Consultoría Técnica Agropecuaria',
  },
];

export const TabPadronComercios: React.FC<TabPadronComerciosProps> = ({
  comercios,
  isLoading,
  onComercioCreado,
  onIrACuentaCorriente,
  onIrACertificados,
}) => {
  const [formData, setFormData] = useState<NuevoComercioPayload>({
    cuit: '',
    razon_social: '',
    condicion_fiscal: 'Responsable Inscripto',
    direccion: '',
    rubro_principal: '',
    rubro_secundario: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    httpStatus: number;
    title: string;
    message: string;
    createdCuit?: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDeuda, setFilterDeuda] = useState<'todos' | 'sin_deuda' | 'con_deuda'>('todos');
  const [demoIndex, setDemoIndex] = useState(0);

  const cuitValidation = formData.cuit.length > 0 ? validarCuit(formData.cuit) : null;

  const handleCuitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permitir ingresar texto para probar validación, o limpiar espacios
    const val = e.target.value.replace(/\s+/g, '');
    setFormData((prev) => ({ ...prev, cuit: val }));
  };

  const handleAutocompletarDemo = () => {
    // Buscar un ejemplo que aún no esté registrado, o ciclar
    const disponibles = EJEMPLOS_ALTA.filter(
      (ej) => !comercios.some((c) => c.cuit === ej.cuit)
    );
    const elegido =
      disponibles.length > 0
        ? disponibles[0]
        : {
            ...EJEMPLOS_ALTA[demoIndex % EJEMPLOS_ALTA.length],
            cuit: `307${Math.floor(10000000 + Math.random() * 89999999)}`,
          };
    setDemoIndex((prev) => prev + 1);
    setFormData(elegido);
    setFeedback(null);
  };

  const handleCargarDuplicado409 = () => {
    const existente = comercios[0];
    if (!existente) return;
    setFormData({
      cuit: existente.cuit,
      razon_social: existente.razon_social,
      condicion_fiscal: existente.condicion_fiscal,
      direccion: existente.direccion,
      rubro_principal: existente.rubro_principal,
      rubro_secundario: existente.rubro_secundario,
    });
    setFeedback(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    try {
      const response = await crearComercio(formData);
      if (response.ok && response.data) {
        const nuevoCuit = response.data.comercio.cuit;
        await onComercioCreado(nuevoCuit);
        setFeedback({
          type: 'success',
          httpStatus: response.status,
          title: `HTTP ${response.statusText} — Comercio Empadronado`,
          message: `Se registró "${response.data.comercio.razon_social}" (CUIT ${nuevoCuit}) en estado "${response.data.comercio.estado}" y se liquidaron automáticamente 3 períodos pendientes (2026-07, 2026-08, 2026-09).`,
          createdCuit: nuevoCuit,
        });
        setFormData({
          cuit: '',
          razon_social: '',
          condicion_fiscal: 'Responsable Inscripto',
          direccion: '',
          rubro_principal: '',
          rubro_secundario: '',
        });
      } else {
        setFeedback({
          type: 'error',
          httpStatus: response.status,
          title: `HTTP ${response.statusText} — ${response.error?.codigo || 'ERROR'}`,
          message: response.error?.mensaje || 'No fue posible completar el alta del comercio.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const comerciosFiltrados = comercios.filter((c) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      c.cuit.includes(searchQuery.trim()) ||
      c.razon_social.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.rubro_principal.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterDeuda === 'sin_deuda') return c.deuda_total === 0;
    if (filterDeuda === 'con_deuda') return c.deuda_total > 0;
    return true;
  });

  const totalDeudaPadron = comercios.reduce((acc, c) => acc + c.deuda_total, 0);
  const comerciosAlDia = comercios.filter((c) => c.deuda_total === 0).length;

  return (
    <div className="space-y-6">
      {/* KPI Overview Strip */}
      <section
        aria-label="Resumen del Padrón Municipal"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Comercios Empadronados</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {comercios.length}
            </span>
            <span className="text-xs text-slate-500">
              Estado activo · Habilitados
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Comercios Sin Deuda ($0,00)</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
              {comerciosAlDia} / {comercios.length}
            </span>
            <span className="text-xs text-slate-500">
              Aptos para Libre Deuda
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Deuda Tributaria Devengada (Padrón)</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {formatearArs(totalDeudaPadron)}
            </span>
            <span className="text-xs text-slate-500">
              TISH + Vía Pública
            </span>
          </div>
        </div>
      </section>

      {/* Main Two-Column Grid: Registration Form + Registered Businesses Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Formulario de Alta de Comercio (POST /municipio/comercios) */}
        <section
          aria-labelledby="heading-alta-comercio"
          className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
            <div>
              <h2 id="heading-alta-comercio" className="text-base font-bold text-slate-900">
                Alta de Comercio en Padrón
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                POST /municipio/comercios · Genera 3 períodos iniciales
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleAutocompletarDemo}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Autocompletar Datos</span>
              </button>
              <button
                type="button"
                onClick={handleCargarDuplicado409}
                title="Carga un CUIT ya existente para verificar respuesta HTTP 409 Conflict"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Probar 409</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
            {/* CUIT Field */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="input-cuit" className="block text-xs font-semibold text-slate-800">
                  CUIT (11 dígitos numéricos sin guiones) *
                </label>
                <span
                  className={`text-xs font-mono tabular-nums ${
                    formData.cuit.length === 11 && /^\d{11}$/.test(formData.cuit)
                      ? 'text-emerald-700 font-semibold'
                      : 'text-slate-500'
                  }`}
                >
                  {formData.cuit.length}/11 dígitos
                </span>
              </div>
              <input
                id="input-cuit"
                name="cuit"
                type="text"
                inputMode="numeric"
                maxLength={13}
                value={formData.cuit}
                onChange={handleCuitChange}
                placeholder="Ej. 30712345678"
                required
                className={`mt-1.5 w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  cuitValidation && !cuitValidation.valido
                    ? 'border-red-400 focus:ring-red-600/20 focus:border-red-600'
                    : cuitValidation?.valido
                    ? 'border-emerald-500 focus:ring-emerald-600/20 focus:border-emerald-600'
                    : 'border-slate-300 focus:ring-blue-600/20 focus:border-blue-600'
                }`}
              />
              {cuitValidation && !cuitValidation.valido && (
                <p className="mt-1 text-xs text-red-600" role="alert">
                  {cuitValidation.mensaje}
                </p>
              )}
            </div>

            {/* Razón Social */}
            <div>
              <label htmlFor="input-razon-social" className="block text-xs font-semibold text-slate-800">
                Razón Social o Denominación *
              </label>
              <input
                id="input-razon-social"
                name="razon_social"
                type="text"
                value={formData.razon_social}
                onChange={(e) => setFormData((prev) => ({ ...prev, razon_social: e.target.value }))}
                placeholder="Ej. Molinos del Sur S.A."
                required
                className="mt-1.5 w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            {/* Condición Fiscal */}
            <div>
              <label htmlFor="select-condicion-fiscal" className="block text-xs font-semibold text-slate-800">
                Condición Fiscal *
              </label>
              <select
                id="select-condicion-fiscal"
                name="condicion_fiscal"
                value={formData.condicion_fiscal}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, condicion_fiscal: e.target.value }))
                }
                className="mt-1.5 w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              >
                {CONDICIONES_FISCALES.map((cf) => (
                  <option key={cf} value={cf}>
                    {cf}
                  </option>
                ))}
              </select>
            </div>

            {/* Dirección */}
            <div>
              <label htmlFor="input-direccion" className="block text-xs font-semibold text-slate-800">
                Dirección Comercial / Domicilio Fiscal *
              </label>
              <input
                id="input-direccion"
                name="direccion"
                type="text"
                value={formData.direccion}
                onChange={(e) => setFormData((prev) => ({ ...prev, direccion: e.target.value }))}
                placeholder="Ej. Av. San Martín 1450, Centro"
                required
                className="mt-1.5 w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            {/* Rubro Principal & Secundario */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label htmlFor="input-rubro-principal" className="block text-xs font-semibold text-slate-800">
                  Rubro Principal *
                </label>
                <input
                  id="input-rubro-principal"
                  name="rubro_principal"
                  type="text"
                  value={formData.rubro_principal}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, rubro_principal: e.target.value }))
                  }
                  placeholder="Ej. Gastronomía"
                  required
                  className="mt-1.5 w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              <div>
                <label htmlFor="input-rubro-secundario" className="block text-xs font-semibold text-slate-800">
                  Rubro Secundario
                </label>
                <input
                  id="input-rubro-secundario"
                  name="rubro_secundario"
                  type="text"
                  value={formData.rubro_secundario}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, rubro_secundario: e.target.value }))
                  }
                  placeholder="Ej. Cafetería y Panificados"
                  className="mt-1.5 w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>
            </div>

            {/* Regla de Negocio Info */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">
                Regla de Empadronamiento Municipal:
              </div>
              <p>
                Al dar de alta un nuevo CUIT se asigna estado <span className="font-mono font-medium text-slate-900">habilitado</span> y se liquidan automáticamente 3 períodos pendientes (<span className="font-mono">2026-07</span>, <span className="font-mono">2026-08</span>, <span className="font-mono">2026-09</span>) integrando TISH y Conservación de la Vía Pública.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>
                {submitting ? 'Procesando Alta en Padrón...' : 'Empadronar Comercio'}
              </span>
            </button>
          </form>

          {/* Response Feedback Box */}
          {feedback && (
            <div
              role="status"
              className={`mt-4 p-4 rounded-lg border text-xs ${
                feedback.type === 'success'
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                  : 'bg-red-50/80 border-red-300 text-red-950'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5 flex-1">
                  <div className="font-mono font-bold">{feedback.title}</div>
                  <p className="leading-relaxed">{feedback.message}</p>
                  {feedback.createdCuit && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onIrACuentaCorriente(feedback.createdCuit!)}
                        className="inline-flex items-center gap-1.5 font-semibold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 cursor-pointer"
                      >
                        <span>Consultar los 3 períodos generados en Cuenta Corriente</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right Column: Tabla de Comercios Registrados */}
        <section
          aria-labelledby="heading-padron-registrados"
          className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 id="heading-padron-registrados" className="text-base font-bold text-slate-900">
                Padrón de Comercios Registrados
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Contribuyentes activos en el módulo Municipio · Datos semilla cargados
              </p>
            </div>

            {/* Interactive Filter Controls */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFilterDeuda('todos')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filterDeuda === 'todos'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({comercios.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterDeuda('sin_deuda')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filterDeuda === 'sin_deuda'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sin Deuda ({comercios.filter((c) => c.deuda_total === 0).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterDeuda('con_deuda')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filterDeuda === 'con_deuda'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Con Deuda ({comercios.filter((c) => c.deuda_total > 0).length})
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Buscar comercio por CUIT, razón social o rubro"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar padrón por CUIT (ej. 30712345678), razón social o rubro..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
            />
          </div>

          {/* Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 pr-4">CUIT / Estado</th>
                  <th className="py-3 px-4">Razón Social y Rubros</th>
                  <th className="py-3 px-4 text-right">Saldo Deuda (ARS)</th>
                  <th className="py-3 pl-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                      Sincronizando padrón municipal...
                    </td>
                  </tr>
                ) : comerciosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                      No se encontraron comercios para los criterios seleccionados.
                    </td>
                  </tr>
                ) : (
                  comerciosFiltrados.map((comercio) => {
                    const libreDeuda = comercio.deuda_total === 0;
                    return (
                      <tr
                        key={comercio.cuit}
                        className="hover:bg-slate-50/80 transition-colors align-top"
                      >
                        <td className="py-3.5 pr-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-slate-900 tabular-nums">
                            {comercio.cuit}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="capitalize font-medium text-emerald-700">
                              {comercio.estado}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{comercio.fecha_alta}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">
                            {comercio.razon_social}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-600">
                            <span>{comercio.condicion_fiscal}</span>
                            <span aria-hidden="true" className="mx-1.5">·</span>
                            <span>{comercio.direccion}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            <span>{comercio.rubro_principal}</span>
                            {comercio.rubro_secundario && (
                              <>
                                <span aria-hidden="true" className="mx-1.5">·</span>
                                <span>{comercio.rubro_secundario}</span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div
                            className={`font-mono font-bold tabular-nums ${
                              libreDeuda ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {formatearArs(comercio.deuda_total)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 tabular-nums">
                            {libreDeuda ? (
                              <span className="text-emerald-700 font-medium">
                                Sin deuda exigible
                              </span>
                            ) : (
                              <span className="text-amber-800 font-medium">
                                {comercio.periodos_pendientes} período(s) pendiente(s)
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onIrACuentaCorriente(comercio.cuit)}
                              aria-label={`Ver cuenta corriente de ${comercio.razon_social}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <span>Cuenta Corriente</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onIrACertificados(comercio.cuit)}
                              aria-label={`Gestionar certificado de ${comercio.razon_social}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              <span>Certificado</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

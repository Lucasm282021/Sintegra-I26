import React, { useEffect, useState } from 'react';
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
  consultarPadronGeneral,
  listarPadronGeneral,
  FichaPadronGeneral,
  formatearArs,
  liquidarTasa,
  resolverHabilitacion,
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
    cuit: '20345678906',
    razon_social: 'Farmacia Central del Valle S.C.S.',
    condicion_fiscal: 'Responsable Inscripto',
    direccion: 'Av. 9 de Julio 412, Microcentro',
    rubro_principal: 'Venta Minorista de Productos Farmacéuticos',
    rubro_secundario: 'Perfumería y Artículos de Ortopedia',
  },
  {
    cuit: '30799887769',
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
  const [fichaPadron, setFichaPadron] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState<FichaPadronGeneral[]>([]);

  // Comercios del padrón general (inscriptos en ARCA) que todavía no tienen habilitación municipal.
  useEffect(() => {
    listarPadronGeneral().then((r) => {
      if (r.ok && r.data) setPendientes(r.data.filter((f) => f.arca.inscripto && !f.municipio && f.condicion_iva !== 'consumidor_final'));
    });
  }, [comercios.length]);

  const cargarDesdePadron = (f: FichaPadronGeneral) => {
    setFormData((prev) => ({ ...prev, cuit: f.cuit, razon_social: f.razon_social,
      condicion_fiscal: f.condicion_iva === 'monotributo' ? 'Monotributista' : f.condicion_fiscal, direccion: f.domicilio_fiscal || prev.direccion }));
    setFichaPadron(`Datos del padrón general: ${f.razon_social} · ${f.condicion_fiscal}. Completá el rubro y registrá el trámite.`);
  };

  const handleCuitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permitir ingresar texto para probar validación, o limpiar espacios
    const val = e.target.value.replace(/\s+/g, '');
    setFormData((prev) => ({ ...prev, cuit: val }));
    setFichaPadron(null);
    if (/^\d{11}$/.test(val)) {
      consultarPadronGeneral(val).then((r) => {
        if (!r.ok || !r.data) { setFichaPadron('Ese CUIT no figura en el padrón general: primero tiene que inscribirse en ARCA.'); return; }
        if (!r.data.arca.inscripto) { setFichaPadron(`${r.data.razon_social} todavía no está inscripto en ARCA: el Municipio no puede habilitarlo.`); return; }
        cargarDesdePadron(r.data);
      });
    }
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
          title: `HTTP ${response.statusText} — Solicitud municipal registrada`,
          message: `Se registró "${response.data.comercio.razon_social}" (CUIT ${nuevoCuit}). La habilitación queda pendiente de resolución; no se liquidaron tasas automáticamente.`,
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
    <div className="space-y-6 pb-6">
      {/* KPI Overview Strip */}
      <section
        aria-label="Resumen del Padrón Municipal"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <div className="rounded-2xl border border-blue-200 border-l-4 border-l-blue-600 bg-blue-50/90 p-5 shadow-sm shadow-slate-900/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comercios empadronados</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {comercios.length}
            </span>
            <span className="text-xs text-slate-500">
              Estado activo · Habilitados
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 border-l-4 border-l-emerald-600 bg-emerald-50/90 p-5 shadow-sm shadow-slate-900/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comercios sin deuda</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-700 font-mono tabular-nums">
              {comerciosAlDia} / {comercios.length}
            </span>
            <span className="text-xs text-slate-500">
              Aptos para Libre Deuda
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/90 p-5 shadow-sm shadow-slate-900/[0.03]">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deuda tributaria del padrón</div>
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
          className="lg:col-span-4 rounded-2xl border border-blue-200 bg-blue-50/80 p-5 shadow-sm shadow-slate-900/[0.03]"
        >
          <div className="pb-4">
            <div>
              <h2 id="heading-alta-comercio" className="text-base font-bold text-slate-900">
                Alta de comercio
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Incorporá un contribuyente al padrón y generá sus períodos iniciales.
              </p>
            </div>
          </div>

          <details className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <summary className="min-h-8 cursor-pointer text-xs font-semibold text-slate-600 marker:text-slate-400">
              Herramientas de demostración
            </summary>
            <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={handleAutocompletarDemo}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-50 px-3 text-xs font-semibold text-blue-800 transition-colors hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>Completar datos de ejemplo</span>
              </button>
              <button
                type="button"
                onClick={handleCargarDuplicado409}
                title="Carga un CUIT ya existente para verificar la respuesta 409"
                className="inline-flex min-h-10 items-center rounded-lg bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 cursor-pointer"
              >
                Probar CUIT duplicado
              </button>
            </div>
          </details>
          <div className="border-t border-slate-200" />

          {pendientes.length > 0 && (
            <div className="mt-4 rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
              <p className="text-xs font-semibold text-amber-900">Inscriptos en ARCA sin habilitación municipal ({pendientes.length})</p>
              <ul className="mt-2 space-y-1">
                {pendientes.slice(0, 6).map((f) => (
                  <li key={f.cuit} className="flex items-center justify-between gap-2 text-xs text-slate-800">
                    <span>{f.razon_social} · {f.cuit}</span>
                    <button type="button" onClick={() => cargarDesdePadron(f)}
                      className="rounded-md bg-white px-2 py-1 font-semibold text-blue-800 ring-1 ring-blue-200 hover:bg-blue-50 cursor-pointer">Cargar</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {fichaPadron && <p className="mt-3 rounded-lg bg-blue-50 p-2 text-xs text-blue-900" role="status">{fichaPadron}</p>}

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
                El registro inicia una solicitud con estado <span className="font-mono font-medium text-amber-800">pendiente</span>. La autoridad municipal debe revisar y resolver la habilitación. Las tasas se liquidan cuando la jurisdicción determina conceptos, períodos y montos; no se crean automáticamente al registrar.
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
          className="lg:col-span-8 min-w-0 rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03] sm:p-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 id="heading-padron-registrados" className="text-base font-bold text-slate-900">
                Padrón de comercios
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Contribuyentes activos y situación tributaria.
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
                            <span className={`capitalize font-medium ${comercio.estado === 'habilitado' ? 'text-emerald-700' : comercio.estado === 'pendiente' ? 'text-amber-700' : 'text-slate-600'}`}>
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
                            <div className="inline-flex items-center justify-end gap-1.5">
                            {comercio.estado === 'pendiente' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const expediente = window.prompt(`Número de expediente para habilitar a ${comercio.razon_social}`, `EXP-${new Date().getFullYear()}-${comercio.cuit.slice(-4)}`);
                                  if (!expediente) return;
                                  const r = await resolverHabilitacion(comercio.cuit, 'activa', expediente);
                                  window.alert(r.ok ? 'Habilitación aprobada.' : (r.error?.mensaje || 'No se pudo aprobar.'));
                                  await onComercioCreado(comercio.cuit);
                                }}
                                aria-label={`Aprobar la habilitación de ${comercio.razon_social}`}
                                className="inline-flex min-h-10 items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Aprobar</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                const periodo = new Date().toISOString().slice(0, 7);
                                const r = await liquidarTasa(comercio.cuit, periodo);
                                window.alert(r.ok && r.data
                                  ? `Tasa ${periodo}: ${formatearArs(r.data.importe)} (base ${formatearArs(r.data.base_imponible)}, rubro "${r.data.rubro_aplicado}").`
                                  : (r.error?.mensaje || 'No se pudo liquidar.'));
                                await onComercioCreado(comercio.cuit);
                              }}
                              aria-label={`Liquidar la tasa del mes de ${comercio.razon_social}`}
                              className="inline-flex min-h-10 items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <span>Liquidar mes</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onIrACuentaCorriente(comercio.cuit)}
                              aria-label={`Ver cuenta corriente de ${comercio.razon_social}`}
                              className="inline-flex min-h-10 items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <span>Cuenta</span>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onIrACertificados(comercio.cuit)}
                              aria-label={`Gestionar certificado de ${comercio.razon_social}`}
                              className="inline-flex min-h-10 items-center gap-1 px-2 py-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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

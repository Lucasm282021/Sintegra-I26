import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { SummaryCards } from './components/SummaryCards';
import { FlowDiagram } from './components/FlowDiagram';
import { PadronTable } from './components/PadronTable';
import { PadronDetailModal } from './components/PadronDetailModal';
import { PercepcionForm } from './components/PercepcionForm';
import { PercepcionResult } from './components/PercepcionResult';
import { AuditHistory } from './components/AuditHistory';
import { ApiContract } from './components/ApiContract';
import { ComerciosPanel } from './components/ComerciosPanel';
import { arbaApi } from './services/arbaApi';
import { demoEngine } from './services/demoEngine';
import { AccessPanel, LoginPanel } from './components/AccessPanel';
import { AlertCircle, RefreshCw, ServerOff } from 'lucide-react';

export function App() {
  const [activeView, setActiveView] = useState('login');
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');
  // Modo explícito seleccionado por el usuario ('api' | 'demo')
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('arba_app_mode') || 'demo';
  });

  const [apiBaseUrl, setApiBaseUrl] = useState(() => {
    return localStorage.getItem('arba_api_base_url') || '/api';
  });

  const [healthStatus, setHealthStatus] = useState({
    connected: false,
    latency: null,
    checked: false,
  });
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Estado del Padrón
  const [padronItems, setPadronItems] = useState([]);
  const [padronTotal, setPadronTotal] = useState(null);
  const [padronPage, setPadronPage] = useState(1);
  const [padronLimit, setPadronLimit] = useState(10);
  const [isPadronLoading, setIsPadronLoading] = useState(false);
  const [padronError, setPadronError] = useState(null);
  const [comercioItems, setComercioItems] = useState([]);
  const [isComercioLoading, setIsComercioLoading] = useState(false);
  const [comercioError, setComercioError] = useState(null);

  // Modales y selección cruzada
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [selectedCuitForSimulator, setSelectedCuitForSimulator] = useState(null);

  // Estado del Simulador de Percepciones
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [lastSuccessfulPayload, setLastSuccessfulPayload] = useState(null);

  // Historial y Auditoría
  const [percepcionesHistory, setPercepcionesHistory] = useState(() => {
    return demoEngine.getAllPercepciones();
  });
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);

  // Sincronizar arbaApi con el modo y baseUrl
  useEffect(() => {
    arbaApi.setMode(mode);
    arbaApi.setBaseUrl(apiBaseUrl);
    localStorage.setItem('arba_app_mode', mode);
  }, [mode, apiBaseUrl]);

  useEffect(() => {
    let alive = true;
    arbaApi.auth('/auth/me').then((res) => {
      if (!alive) return;
      if (res.ok && res.data?.usuario) { setUser(res.data.usuario); setActiveView(res.data.usuario.rol === 'admin' ? 'panel' : 'altas'); }
      else { setUser(null); setActiveView('login'); }
    });
    return () => { alive = false; };
  }, [mode, apiBaseUrl]);

  const handleLogin = async (event) => {
    event.preventDefault(); setAuthError('');
    const form = new FormData(event.currentTarget);
    const res = await arbaApi.auth('/auth/login', 'POST', { email: form.get('email'), password: form.get('password') });
    if (!res.ok) { setAuthError(res.data?.error || 'No se pudo iniciar sesión.'); return; }
    setUser(res.data.usuario); setActiveView(res.data.usuario.rol === 'admin' ? 'panel' : 'altas');
    if (res.data.usuario.rol === 'admin') loadComercios();
  };
  const handleLogout = async () => { await arbaApi.auth('/auth/logout', 'POST'); setUser(null); setActiveView('login'); };

  // Verificar Salud del Servicio
  const checkHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    const start = performance.now();
    try {
      const res = await arbaApi.health();
      const latency = `${Math.round(performance.now() - start)}ms`;
      setHealthStatus({
        connected: res.ok,
        latency,
        checked: true,
      });
    } catch {
      setHealthStatus({
        connected: false,
        latency: null,
        checked: true,
      });
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  // Cargar Padrón
  const loadPadron = useCallback(async (page = padronPage, limit = padronLimit) => {
    setIsPadronLoading(true);
    setPadronError(null);
    try {
      const res = await arbaApi.listPadron(page, limit);
      if (res.ok && res.data) {
        setPadronItems(res.data.items || []);
        setPadronTotal(res.data.total ?? null);
      } else {
        setPadronError(
          res.isNetworkError
            ? `API desconectada: No se pudo conectar con ${apiBaseUrl}. Asegúrese de que el backend ARBA esté corriendo en el puerto 3003 o cambie a Modo Demo.`
            : (res.data?.error || 'Error al obtener contribuyentes del padrón.')
        );
        setPadronItems([]);
      }
    } catch (err) {
      setPadronError('Error de red al consultar el padrón.');
      setPadronItems([]);
    } finally {
      setIsPadronLoading(false);
    }
  }, [padronPage, padronLimit, apiBaseUrl]);

  const loadComercios = useCallback(async () => {
    setIsComercioLoading(true);
    setComercioError(null);
    const res = await arbaApi.listComercios();
    if (res.ok && res.data) setComercioItems(res.data.items || []);
    else setComercioError(res.data?.error || 'No se pudo cargar el padrón de comercios.');
    setIsComercioLoading(false);
  }, []);

  const refreshComercios = async () => {
    await Promise.all([loadComercios(), loadPadron(padronPage, padronLimit)]);
  };

  const handleCreateComercio = async (comercio) => {
    const res = await arbaApi.createComercio(comercio);
    if (res.ok) await refreshComercios();
    return res;
  };

  const handleUpdateComercio = async (cuit, comercio) => {
    const res = await arbaApi.updateComercio(cuit, comercio);
    if (res.ok) await refreshComercios();
    return res;
  };

  const handleDeleteComercio = async (cuit) => {
    const res = await arbaApi.deleteComercio(cuit);
    if (res.ok) await refreshComercios();
    else setComercioError(res.data?.error || 'No se pudo eliminar el comercio.');
    return res;
  };

  // Consulta puntual de un CUIT directo
  const handleLookupDirectCuit = useCallback(async (cuit) => {
    return arbaApi.getPadronByCuit(cuit);
  }, []);

  // Inicialización y recarga ante cambio de modo o URL
  useEffect(() => {
    checkHealth();
    loadPadron(1, padronLimit);
    setPadronPage(1);

    if (mode === 'demo') {
      setPercepcionesHistory(demoEngine.getAllPercepciones());
    }
    loadComercios();
  }, [mode, apiBaseUrl, checkHealth, loadPadron, padronLimit, loadComercios]);

  // Manejar cambio explícito de modo (sin fallback automático)
  const handleModeChange = (newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setSimulationResult(null);
    setPadronError(null);
  };

  // Manejar cambio de URL base
  const handleApiBaseUrlChange = (newUrl) => {
    setApiBaseUrl(newUrl);
    localStorage.setItem('arba_api_base_url', newUrl);
  };

  // Enviar Simulación de Percepción
  const handleCalculatePercepcion = async (payload) => {
    setIsSubmitting(true);
    try {
      const res = await arbaApi.createPercepcion(payload);
      setSimulationResult(res);

      if (res.ok && res.data) {
        setLastSuccessfulPayload({
          id_venta: payload.id_venta,
          cuit: payload.cuit,
          monto_venta: payload.monto_venta,
        });

        // Si fue una nueva percepción (201), incorporarla al historial visible
        if (res.status === 201) {
          const itemConOrigen = {
            ...res.data,
            origen: res.origin || (mode === 'demo' ? 'Demo' : 'API'),
          };
          setPercepcionesHistory((prev) => {
            const exists = prev.some((p) => p.id_venta === itemConOrigen.id_venta);
            return exists ? prev : [itemConOrigen, ...prev];
          });
        }
      }
    } catch (err) {
      setSimulationResult({
        ok: false,
        status: 0,
        isNetworkError: true,
        error: 'Error inesperado al conectar con el backend.',
        origin: 'Error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Consulta de auditoría de un CUIT
  const handleQueryAuditByCuit = async (cuit) => {
    setIsAuditLoading(true);
    setAuditError(null);
    try {
      const res = await arbaApi.getPercepcionesByCuit(cuit);
      if (res.ok && res.data && Array.isArray(res.data.percepciones)) {
        const nuevos = res.data.percepciones.map((p) => ({
          ...p,
          origen: res.origin || (mode === 'demo' ? 'Demo' : 'API'),
        }));

        setPercepcionesHistory((prev) => {
          // Combinar registros sin duplicar id_venta
          const map = new Map();
          nuevos.forEach((item) => map.set(item.id_venta, item));
          prev.forEach((item) => {
            if (!map.has(item.id_venta)) map.set(item.id_venta, item);
          });
          return Array.from(map.values());
        });
      }
      return res;
    } catch (err) {
      setAuditError('Error de red al consultar auditoría.');
      return { ok: false, error: 'Error de red' };
    } finally {
      setIsAuditLoading(false);
    }
  };

  // Calcular métricas derivadas (estrictamente sobre registros cargados)
  const loadedTotalPerceptionsAmount = useMemo(() => {
    return percepcionesHistory.reduce((sum, item) => {
      const val = Number(item.monto_percepcion);
      return sum + (Number.isFinite(val) ? val : 0);
    }, 0);
  }, [percepcionesHistory]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-400">
      {/* Encabezado */}
      <Header
        mode={mode}
        onModeChange={handleModeChange}
        healthStatus={healthStatus}
        apiBaseUrl={apiBaseUrl}
        onApiBaseUrlChange={handleApiBaseUrlChange}
        onCheckHealth={checkHealth}
        isCheckingHealth={isCheckingHealth}
        activeView={activeView}
        onViewChange={setActiveView}
        user={user}
        onLogout={handleLogout}
      />

      {/* Alerta de API Desconectada cuando el usuario está en Modo API y no hay respuesta */}
      {user && mode === 'api' && healthStatus.checked && !healthStatus.connected && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 py-2.5 px-4 text-xs text-rose-300">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ServerOff className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong>API desconectada:</strong> El backend ARBA en <code className="font-mono text-white">{apiBaseUrl}</code> no responde al endpoint <code className="font-mono text-white">/health</code>. Las operaciones en Modo API fallarán hasta que se inicie el backend.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={checkHealth}
                className="px-2.5 py-1 bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500/30 rounded text-[11px] font-mono transition-colors flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('demo')}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-mono transition-colors"
              >
                Cambiar a Modo Demo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {!user ? <LoginPanel onLogin={handleLogin} error={authError} /> : user.rol === 'convencional' ? <AccessPanel user={user} api={arbaApi} onDataChanged={loadPadron} /> : activeView === 'sujetos' ? <AccessPanel user={user} api={arbaApi} onDataChanged={refreshComercios} /> : <>
        {/* Resumen Principal de Métricas */}
        <SummaryCards
          mode={mode}
          healthStatus={healthStatus}
          padronCount={padronTotal !== null ? padronTotal : padronItems.length}
          loadedPerceptionsCount={percepcionesHistory.length}
          loadedTotalPerceptionsAmount={loadedTotalPerceptionsAmount}
        />

        {/* Flujo de una Percepción (TPV → ARBA → ARCA) */}
        <FlowDiagram />

        {/* Grid: Simulador (Izquierda) + Resultado (Derecha) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PercepcionForm
            padronItems={comercioItems.length ? comercioItems.filter((item) => item.estado !== 'inactivo' && item.aplicaciones?.arba_iibb !== false) : padronItems}
            selectedCuit={selectedCuitForSimulator}
            onCalculate={handleCalculatePercepcion}
            isSubmitting={isSubmitting}
            lastSuccessfulPayload={lastSuccessfulPayload}
          />

          <PercepcionResult result={simulationResult} />
        </div>

        {/* Consulta y Búsqueda del Padrón */}
        <PadronTable
          items={padronItems}
          total={padronTotal}
          page={padronPage}
          limit={padronLimit}
          onPageChange={(p) => {
            setPadronPage(p);
            loadPadron(p, padronLimit);
          }}
          onLimitChange={(l) => {
            setPadronLimit(l);
            setPadronPage(1);
            loadPadron(1, l);
          }}
          isLoading={isPadronLoading}
          error={padronError}
          onRefresh={() => loadPadron(padronPage, padronLimit)}
          onSelectDetail={(item) => setSelectedDetailItem(item)}
          onSelectForSimulation={(cuit) => {
            setSelectedCuitForSimulator(cuit);
            window.scrollTo({ top: 380, behavior: 'smooth' });
          }}
          onLookupDirectCuit={handleLookupDirectCuit}
          mode={mode}
        />

        {/* Historial de Auditoría */}
        <AuditHistory
          percepciones={percepcionesHistory}
          onQueryAuditByCuit={handleQueryAuditByCuit}
          isLoading={isAuditLoading}
          error={auditError}
          mode={mode}
          padronList={padronItems}
        />

        {/* Panel Técnico: Contrato del Servicio */}
        <ApiContract />
        </>}
      </main>

      {/* Footer sobrio */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Ecosistema Fintech simulado · Módulo ARBA (Percepciones IIBB)</span>
          <span>Valores ficticios y deterministas con fines didácticos</span>
        </div>
      </footer>

      {/* Modal de Detalle de Contribuyente */}
      {selectedDetailItem && (
        <PadronDetailModal
          item={selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
          onSelectForSimulation={(cuit) => {
            setSelectedCuitForSimulator(cuit);
            window.scrollTo({ top: 380, behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
}

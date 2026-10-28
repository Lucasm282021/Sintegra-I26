import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { PadronTable } from './components/PadronTable';
import { PadronDetailModal } from './components/PadronDetailModal';
import { PercepcionForm } from './components/PercepcionForm';
import { PercepcionResult } from './components/PercepcionResult';
import { AuditHistory } from './components/AuditHistory';
import { arbaApi } from './services/arbaApi';
import { demoEngine } from './services/demoEngine';
import { AccessPanel, LoginPanel } from './components/AccessPanel';

export function App() {
  const [activeView, setActiveView] = useState('login');
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');
  // Modo explícito seleccionado por el usuario ('api' | 'demo')
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('arba_app_mode') || 'api';
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
            ? 'No se pudo cargar el padrón. Intentá actualizar la información.'
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
            origen: res.origin || (mode === 'demo' ? 'Demo' : 'Sistema'),
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
          origen: res.origin || (mode === 'demo' ? 'Demo' : 'Sistema'),
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

  const viewNames = { panel: 'Inicio', altas: 'Mis altas', sujetos: 'Gestión de sujetos', usuarios: 'Usuarios', auditoria: 'Auditoría', percepciones: 'Percepciones', padron: 'Consulta de padrón' };
  const contentView = user?.rol === 'convencional' ? 'altas' : activeView;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <Header activeView={contentView} onViewChange={setActiveView} user={user} onLogout={handleLogout} />
      <div className={`dashboard-main ${user ? '' : 'login-layout'}`}>
        {user && <div className="dashboard-topbar"><div><p className="text-xs text-slate-500">Panel <span className="px-1">/</span> {viewNames[contentView] || 'Inicio'}</p><h2 className="mt-1 text-lg font-semibold text-white">{viewNames[contentView] || 'Inicio'}</h2></div><div className="academic-badge"><span/>Entorno académico</div></div>}
        <main id="contenido" tabIndex={-1} className={user ? 'dashboard-content' : 'login-content'}>
          {!user ? <LoginPanel onLogin={handleLogin} error={authError} /> : contentView === 'percepciones' ? <div className="space-y-6"><div className="page-heading"><div><p className="page-eyebrow">Simulación</p><h1>Percepciones</h1><p className="page-description">Consultá una operación de ejemplo y revisá su resultado.</p></div></div><div className="grid grid-cols-1 gap-5 xl:grid-cols-2"><PercepcionForm padronItems={comercioItems.length ? comercioItems.filter((item) => item.estado !== 'inactivo' && item.aplicaciones?.arba_iibb !== false) : padronItems} selectedCuit={selectedCuitForSimulator} onCalculate={handleCalculatePercepcion} isSubmitting={isSubmitting} lastSuccessfulPayload={lastSuccessfulPayload}/><PercepcionResult result={simulationResult}/></div><AuditHistory percepciones={percepcionesHistory} onQueryAuditByCuit={handleQueryAuditByCuit} isLoading={isAuditLoading} error={auditError}/></div> : contentView === 'padron' ? <PadronTable items={padronItems} total={padronTotal} page={padronPage} limit={padronLimit} onPageChange={(page) => { setPadronPage(page); loadPadron(page, padronLimit); }} onLimitChange={(limit) => { setPadronLimit(limit); setPadronPage(1); loadPadron(1, limit); }} isLoading={isPadronLoading} error={padronError} onRefresh={() => loadPadron(padronPage, padronLimit)} onSelectDetail={setSelectedDetailItem} onSelectForSimulation={(cuit) => { setSelectedCuitForSimulator(cuit); setActiveView('percepciones'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} onLookupDirectCuit={handleLookupDirectCuit} mode={mode}/> : <AccessPanel user={user} api={arbaApi} view={contentView} onDataChanged={refreshComercios}/>}
        </main>
        {user && <footer className="dashboard-footer">Datos ficticios para uso académico. No constituye una inscripción fiscal oficial.</footer>}
      </div>
      {selectedDetailItem && <PadronDetailModal item={selectedDetailItem} onClose={() => setSelectedDetailItem(null)} onSelectForSimulation={(cuit) => { setSelectedCuitForSimulator(cuit); setActiveView('percepciones'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}/>}
    </div>
  );
}

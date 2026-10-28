import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ToastContainer from './components/Toast';
import InicioView from './components/InicioView';
import PadronView from './components/PadronView';
import SimuladorView from './components/SimuladorView';
import HistorialView from './components/HistorialView';
import ReportesView from './components/ReportesView';
import AdminView from './components/AdminView';
import ModalCreatePadron from './components/ModalCreatePadron';
import ModalEditPadron from './components/ModalEditPadron';
import ModalDeletePadron from './components/ModalDeletePadron';
import ModalViewPadron from './components/ModalViewPadron';
import IntroOverlay, { shouldShowIntro } from './components/IntroOverlay';
import AuthView from './components/AuthView';
import { arbaService, getMode, setMode, getSession, MODES } from './services/arbaService';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const s = getSession();
    return s?.user || null;
  });

  const [activeSection, setActiveSection] = useState('inicio');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mode, setModeState] = useState(getMode);
  const [healthStatus, setHealthStatus] = useState({ online: false, checked: false });
  const [showIntro, setShowIntro] = useState(shouldShowIntro);

  // Datos
  const [stats, setStats] = useState({
    totalContribuyentes: 0,
    totalPercepciones: 0,
    totalRecaudado: 0,
    totalVentas: 0,
    alicuotaPromedio: 0,
  });
  const [padron, setPadron] = useState([]);
  const [percepciones, setPercepciones] = useState([]);
  const [toasts, setToasts] = useState([]);

  // Estados de Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTaxpayer, setEditingTaxpayer] = useState(null);
  const [deletingTaxpayer, setDeletingTaxpayer] = useState(null);
  const [viewingTaxpayer, setViewingTaxpayer] = useState(null);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Health check
  const checkHealth = useCallback(async () => {
    const r = await arbaService.health();
    setHealthStatus({ online: r.ok && r.data?.status === 'ok', checked: true });
  }, []);

  // Carga de Estadísticas
  const loadStats = useCallback(async () => {
    const r = await arbaService.stats();
    if (r.ok) setStats(r.data);
  }, []);

  // Carga de Padrón
  const loadPadron = useCallback(async () => {
    const r = await arbaService.listPadron(1, 100);
    if (r.ok) {
      setPadron(r.data.items || []);
    } else if (r.networkError) {
      setPadron([]);
      addToast('No se pudo conectar con el padrón fiscal. Podés activar el Modo Demo.', 'error');
    }
  }, [addToast]);

  // Carga de Percepciones
  const loadHistory = useCallback(async () => {
    const r = await arbaService.listPercepciones(1, 100);
    if (r.ok) setPercepciones(r.data.items || []);
    else if (r.networkError) setPercepciones([]);
  }, []);

  // Inicialización y recarga completa al cambiar de modo o de usuario
  useEffect(() => {
    checkHealth();
    if (currentUser) {
      loadStats();
      loadPadron();
      loadHistory();
    }
    const timer = setInterval(checkHealth, 15000);
    return () => clearInterval(timer);
  }, [mode, currentUser, checkHealth, loadStats, loadPadron, loadHistory]);

  const handleChangeMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setModeState(nextMode);
    addToast(
      nextMode === MODES.DEMO
        ? 'Modo Demo activo: los datos y autenticación se simulan en este navegador'
        : 'Modo API activo: conectando con el servicio ARBA',
      'info'
    );
  };

  // Manejadores de Autenticación
  const handleAuth = async (action, payload) => {
    const res = action === 'register' ? await arbaService.register(payload) : await arbaService.login(payload);
    if (res.ok && res.data?.user) {
      setCurrentUser(res.data.user);
      addToast(`Bienvenido/a, ${res.data.user.nombre} (${res.data.user.rol === 'admin' ? 'Administrador' : 'Operador'})`, 'success');
      loadStats();
      loadPadron();
      loadHistory();
    }
    return res;
  };

  const handleLogout = async () => {
    await arbaService.logout();
    setCurrentUser(null);
    addToast('Sesión cerrada correctamente', 'info');
  };

  // Manejadores CRUD
  const handleCreateTaxpayer = async (newTaxpayer, callback) => {
    const r = await arbaService.createPadron(newTaxpayer);
    if (r.networkError) return callback('Error de conexión con el servidor.');
    if (!r.ok) {
      return callback(
        r.status === 409
          ? 'Este CUIT ya se encuentra registrado en el padrón fiscal.'
          : r.data.error || 'Error al guardar contribuyente.'
      );
    }
    addToast(`Contribuyente ${newTaxpayer.cuit} incorporado con éxito`, 'success');
    loadPadron();
    loadStats();
    callback(null);
  };

  const handleUpdateTaxpayer = async (cuit, updates) => {
    const r = await arbaService.updatePadron(cuit, updates);
    if (!r.ok) {
      addToast(r.networkError ? 'Error de red al actualizar contribuyente' : r.data.error || 'Error al actualizar contribuyente', 'error');
      return;
    }
    addToast(`Contribuyente ${cuit} actualizado con éxito`, 'success');
    loadPadron();
    loadStats();
  };

  const handleDeleteTaxpayer = async (cuit) => {
    if (currentUser?.rol !== 'admin') {
      addToast('Solo los administradores pueden dar de baja contribuyentes del padrón', 'error');
      return;
    }
    const r = await arbaService.deletePadron(cuit);
    if (!r.ok) {
      addToast(r.networkError ? 'Error de red al eliminar contribuyente' : r.data.error || 'Error al eliminar contribuyente', 'error');
      return;
    }
    addToast(`Contribuyente ${cuit} eliminado del padrón`, 'success');
    loadPadron();
    loadStats();
  };

  const handleResetSeed = async () => {
    if (currentUser?.rol !== 'admin') {
      addToast('Solo los administradores pueden restablecer la base de datos', 'error');
      return;
    }
    if (!confirm('¿Desea restablecer el padrón a la semilla determinista inicial y reiniciar el historial?')) {
      return;
    }
    const r = await arbaService.resetSeed();
    if (r.ok) {
      addToast('Padrón restablecido a la semilla inicial', 'success');
      loadPadron();
      loadStats();
      loadHistory();
    } else {
      addToast(r.networkError ? 'Error de red al restablecer datos' : 'Error al restablecer datos', 'error');
    }
  };

  const handlePercepcionExecuted = (statusCode, data) => {
    if (statusCode === 201) {
      addToast(`Percepción liquidada: $${data.monto_percepcion}`, 'success');
      loadStats();
      loadHistory();
    } else if (statusCode === 200) {
      addToast('Respuesta idempotente: venta ya registrada sin duplicar cobro', 'info');
    } else if (statusCode === 409) {
      addToast(data.error || 'Conflicto: id_venta con datos diferentes', 'error');
    } else if (statusCode === 404) {
      addToast(data.error || 'CUIT no encontrado en padrón', 'error');
    }
  };

  // Si no está autenticado, el login es OBLIGATORIO
  if (!currentUser) {
    return (
      <div className="auth-wrapper">
        <AuthView
          onLoginSuccess={handleAuth}
          mode={mode}
          onChangeMode={handleChangeMode}
          status={healthStatus}
        />
        <ToastContainer toasts={toasts} />
        {showIntro && <IntroOverlay onClose={() => setShowIntro(false)} />}
      </div>
    );
  }

  return (
    <div className="app-layout">
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={(sec) => {
          setActiveSection(sec);
          setSidebarOpen(false);
        }}
        padronCount={padron.length}
        historialCount={percepciones.length}
        status={healthStatus}
        mode={mode}
        isOpen={sidebarOpen}
        currentUser={currentUser}
      />

      <div className="app-main">
        {/* Topbar */}
        <Topbar
          activeSection={activeSection}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          mode={mode}
          onChangeMode={handleChangeMode}
          status={healthStatus}
          onShowIntro={() => setShowIntro(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Contenedor de Vistas */}
        <main id="contenido" tabIndex={-1} className="page-container">
          {activeSection === 'inicio' && (
            <InicioView
              stats={stats}
              recentPercepciones={percepciones.slice(0, 5)}
              onNavigate={setActiveSection}
              onOpenNewTaxpayer={() => setIsCreateOpen(true)}
            />
          )}

          {activeSection === 'padron' && (
            <PadronView
              padron={padron}
              onOpenCreate={() => setIsCreateOpen(true)}
              onOpenEdit={(taxpayer) => setEditingTaxpayer(taxpayer)}
              onOpenDelete={(taxpayer) => {
                if (currentUser.rol !== 'admin') {
                  addToast('Acción restringida: solo administradores pueden eliminar contribuyentes', 'error');
                  return;
                }
                setDeletingTaxpayer(taxpayer);
              }}
              onOpenView={(taxpayer) => setViewingTaxpayer(taxpayer)}
              onRefresh={loadPadron}
            />
          )}

          {activeSection === 'simulador' && (
            <SimuladorView
              padron={padron}
              mode={mode}
              onExecutePercepcion={handlePercepcionExecuted}
            />
          )}

          {activeSection === 'historial' && (
            <HistorialView
              percepciones={percepciones}
              onRefresh={loadHistory}
            />
          )}

          {activeSection === 'reportes' && (
            <ReportesView
              stats={stats}
              padron={padron}
            />
          )}

          {activeSection === 'admin' && (
            <AdminView onResetSeed={handleResetSeed} mode={mode} />
          )}
        </main>
      </div>

      {/* Modales */}
      <ModalCreatePadron
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSave={handleCreateTaxpayer}
      />

      <ModalEditPadron
        isOpen={Boolean(editingTaxpayer)}
        taxpayer={editingTaxpayer}
        onClose={() => setEditingTaxpayer(null)}
        onUpdate={handleUpdateTaxpayer}
      />

      <ModalDeletePadron
        isOpen={Boolean(deletingTaxpayer)}
        taxpayer={deletingTaxpayer}
        onClose={() => setDeletingTaxpayer(null)}
        onConfirm={handleDeleteTaxpayer}
      />

      <ModalViewPadron
        isOpen={Boolean(viewingTaxpayer)}
        taxpayer={viewingTaxpayer}
        onClose={() => setViewingTaxpayer(null)}
        onEdit={(taxpayer) => setEditingTaxpayer(taxpayer)}
      />

      {/* Notificaciones Toast */}
      <ToastContainer toasts={toasts} />

      {/* Intro institucional */}
      {showIntro && <IntroOverlay onClose={() => setShowIntro(false)} />}
    </div>
  );
}

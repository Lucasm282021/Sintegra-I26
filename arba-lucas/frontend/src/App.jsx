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
import { apiUrl } from './apiUrl';

export default function App() {
  const [activeSection, setActiveSection] = useState('inicio');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState({ online: false });

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
    try {
      const res = await fetch(apiUrl('/health'));
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ok') {
          setHealthStatus({ online: true });
          return;
        }
      }
      setHealthStatus({ online: false });
    } catch {
      setHealthStatus({ online: false });
    }
  }, []);

  // Carga de Estadísticas
  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/arba/stats'));
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error cargando estadísticas:', err);
    }
  }, []);

  // Carga de Padrón
  const loadPadron = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/arba/padron?page=1&limit=100'));
      if (res.ok) {
        const data = await res.json();
        setPadron(data.items || []);
      }
    } catch (err) {
      console.error('Error cargando padrón:', err);
      addToast('No se pudo conectar con el padrón fiscal', 'error');
    }
  }, [addToast]);

  // Carga de Percepciones
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/arba/percepciones?page=1&limit=100'));
      if (res.ok) {
        const data = await res.json();
        setPercepciones(data.items || []);
      }
    } catch (err) {
      console.error('Error cargando historial:', err);
    }
  }, []);

  // Inicialización
  useEffect(() => {
    checkHealth();
    loadStats();
    loadPadron();
    loadHistory();
    const timer = setInterval(checkHealth, 15000);
    return () => clearInterval(timer);
  }, [checkHealth, loadStats, loadPadron, loadHistory]);

  // Manejadores CRUD
  const handleCreateTaxpayer = async (newTaxpayer, callback) => {
    try {
      const res = await fetch(apiUrl('/arba/padron'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTaxpayer),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          callback('Este CUIT ya se encuentra registrado en el padrón fiscal.');
        } else {
          callback(data.error || 'Error al guardar contribuyente.');
        }
        return;
      }

      addToast(`Contribuyente ${newTaxpayer.cuit} incorporado con éxito`, 'success');
      loadPadron();
      loadStats();
      callback(null);
    } catch {
      callback('Error de conexión con el servidor.');
    }
  };

  const handleUpdateTaxpayer = async (cuit, updates) => {
    try {
      const res = await fetch(apiUrl(`/arba/padron/${cuit}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || 'Error al actualizar contribuyente', 'error');
        return;
      }

      addToast(`Contribuyente ${cuit} actualizado con éxito`, 'success');
      loadPadron();
      loadStats();
    } catch {
      addToast('Error de red al actualizar contribuyente', 'error');
    }
  };

  const handleDeleteTaxpayer = async (cuit) => {
    try {
      const res = await fetch(apiUrl(`/arba/padron/${cuit}`), { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || 'Error al eliminar contribuyente', 'error');
        return;
      }

      addToast(`Contribuyente ${cuit} eliminado del padrón`, 'success');
      loadPadron();
      loadStats();
    } catch {
      addToast('Error de red al eliminar contribuyente', 'error');
    }
  };

  const handleResetSeed = async () => {
    if (!confirm('¿Desea restablecer el padrón a la semilla determinista inicial (5 contribuyentes) y reiniciar el historial?')) {
      return;
    }
    try {
      const res = await fetch(apiUrl('/arba/seed/reset'), { method: 'POST' });
      if (res.ok) {
        addToast('Padrón restablecido a la semilla inicial', 'success');
        loadPadron();
        loadStats();
        loadHistory();
      } else {
        addToast('Error al restablecer datos', 'error');
      }
    } catch {
      addToast('Error de red al restablecer datos', 'error');
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

  return (
    <div className="app-layout">
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
        isOpen={sidebarOpen}
      />

      <div className="app-main">
        {/* Topbar */}
        <Topbar
          activeSection={activeSection}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />

        {/* Contenedor de Vistas */}
        <main className="page-container">
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
              onOpenDelete={(taxpayer) => setDeletingTaxpayer(taxpayer)}
              onOpenView={(taxpayer) => setViewingTaxpayer(taxpayer)}
              onRefresh={loadPadron}
            />
          )}

          {activeSection === 'simulador' && (
            <SimuladorView
              padron={padron}
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
            <AdminView onResetSeed={handleResetSeed} />
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
    </div>
  );
}

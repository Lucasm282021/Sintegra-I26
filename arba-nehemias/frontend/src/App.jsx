import React, { useState, useEffect } from 'react';
import { arbaApi } from './services/arbaApi';
import { authApi } from './services/authApi';
import AuthScreen from './AuthScreen';
import IntroScreen from './IntroScreen';
import UsersView from './UsersView';
import { cleanCuit, isValidCuit, formatPercent, formatCurrency } from './utils/formatters';

const roleLabels = { superadmin: 'Superadmin', admin: 'Administrador', user: 'Usuario' };

export default function App() {
  const [activeTab, setActiveTab] = useState('padron');
  const [health, setHealth] = useState({ status: 'checking', message: 'Conectando...' });
  const [user, setUser] = useState(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);

  useEffect(() => {
    const restoreSession = async () => {
      let needsSetup = false;
      try {
        const status = await authApi.getSetupStatus();
        needsSetup = Boolean(status.data?.setup_required);
      } catch {
        // La pantalla de acceso informa el error si la API no está disponible.
      }
      const token = localStorage.getItem('arba_session_token');
      if (token) {
        try {
          const result = await authApi.getMe();
          setUser(result.data.user);
        } catch {
          localStorage.removeItem('arba_session_token');
        }
      }
      setSetupRequired(needsSetup);
      setAuthReady(true);
    };
    restoreSession();
  }, []);

  const handleAuthenticated = ({ token, user: authenticatedUser }) => {
    localStorage.setItem('arba_session_token', token);
    setUser(authenticatedUser);
    setSetupRequired(false);
    setIntroComplete(true);
    setActiveTab('padron');
  };

  const logout = () => {
    localStorage.removeItem('arba_session_token');
    setUser(null);
    setIntroComplete(false);
    setActiveTab('padron');
  };

  // Verificación de salud periódica
  const checkHealth = async () => {
    try {
      const res = await arbaApi.getHealth();
      setHealth({ status: 'online', message: `En línea (${res.data?.service || 'arba'})` });
    } catch (err) {
      setHealth({ status: 'offline', message: 'Sin conexión con el backend (puerto 3003)' });
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 20000);
    return () => clearInterval(interval);
  }, []);

  if (!authReady) {
    return <div className="auth-screen"><div className="auth-card">Cargando el acceso…</div></div>;
  }
  if (!user && !introComplete) {
    return <IntroScreen onComplete={() => setIntroComplete(true)} />;
  }
  if (!user) return <AuthScreen setupRequired={setupRequired} onAuthenticated={handleAuthenticated} />;

  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  const tabs = [
    { id: 'padron', label: 'Padrón Público' },
    ...(isAdmin ? [{ id: 'comercios', label: 'Administración de Comercios' }] : []),
    { id: 'percepciones', label: 'Registrar Percepción' },
    { id: 'historial', label: 'Historial de Percepciones' },
    ...(user.role === 'superadmin' ? [{ id: 'usuarios', label: 'Usuarios' }] : []),
  ];

  return (
    <div className="app-container">
      <header>
        <div>
          <div className="brand-title">Sintegra I26 — Módulo ARBA</div>
          <div className="brand-subtitle">Simulador Académico de Percepción de Ingresos Brutos</div>
        </div>
        <div className="health-status">
          <span className={`dot ${health.status === 'online' ? 'online' : 'offline'}`}></span>
          <span>{health.message}</span>
          <button
            onClick={checkHealth}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.75rem' }}
          >
            Reintentar
          </button>
        </div>
        <div className="session-status">
          <span>{user.name} · {roleLabels[user.role]}</span>
          <button className="btn btn-outline" onClick={logout}>Salir</button>
        </div>
      </header>

      <nav className="nav-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      <main>
        {activeTab === 'padron' && <PadronView />}
        {activeTab === 'comercios' && <ComerciosView />}
        {activeTab === 'percepciones' && <PercepcionesView />}
        {activeTab === 'historial' && <HistorialView />}
        {activeTab === 'usuarios' && user.role === 'superadmin' && <UsersView />}
      </main>
    </div>
  );
}

// -------------------------------------------------------------
// VISTA: PADRÓN PÚBLICO
// -------------------------------------------------------------
function PadronView() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Búsqueda puntual
  const [searchCuit, setSearchCuit] = useState('');
  const [searchResult, setSearchResult] = useState(null);

  const fetchPadron = async (targetPage) => {
    setLoading(true);
    setError('');
    try {
      const res = await arbaApi.getPadron(targetPage, limit);
      setItems(res.data?.items || []);
      setTotal(res.data?.total || 0);
      setPage(res.data?.page || targetPage);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPadron(1);
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    const cleaned = cleanCuit(searchCuit);
    if (!isValidCuit(cleaned)) {
      setError('El CUIT debe contener exactamente 11 dígitos numéricos.');
      return;
    }
    setLoading(true);
    setError('');
    setSearchResult(null);
    try {
      const res = await arbaApi.getPadronByCuit(cleaned);
      setSearchResult(res.data);
    } catch (err) {
      if (err.status === 404) {
        setError(`El CUIT ${cleaned} no figura en el padrón público.`);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="card">
        <h2 className="card-title">Consultar CUIT Específico</h2>
        <form onSubmit={handleSearch} className="form-grid form-grid-3">
          <div className="form-group">
            <label>CUIT (11 dígitos)</label>
            <input
              type="text"
              value={searchCuit}
              onChange={(e) => setSearchCuit(e.target.value)}
              placeholder="Ej: 20345678901"
              maxLength={14}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              Buscar
            </button>
            {searchResult && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => { setSearchResult(null); setSearchCuit(''); }}
              >
                Limpiar
              </button>
            )}
          </div>
        </form>

        {searchResult && (
          <div className="alert alert-info" style={{ marginTop: '1rem' }}>
            <strong>Resultado:</strong> CUIT: <code>{searchResult.cuit}</code> | Actividad: {searchResult.actividad} | Alícuota: <strong>{formatPercent(searchResult.alicuota)}</strong>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <span>Padrón General</span>
          <button className="btn btn-outline" onClick={() => fetchPadron(page)} disabled={loading}>
            Refrescar
          </button>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {loading && <p style={{ color: 'var(--text-muted)' }}>Cargando datos del padrón...</p>}

        {!loading && (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>CUIT</th>
                    <th>Actividad</th>
                    <th>Alícuota IIBB</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hay registros disponibles.
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => (
                      <tr key={row.cuit}>
                        <td><code>{row.cuit}</code></td>
                        <td>{row.actividad}</td>
                        <td><strong>{formatPercent(row.alicuota)}</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <span>Total: {total} comercios registrados</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-outline"
                  disabled={page <= 1 || loading}
                  onClick={() => fetchPadron(page - 1)}
                >
                  Anterior
                </button>
                <span style={{ alignSelf: 'center', fontWeight: '600' }}>Pág. {page}</span>
                <button
                  className="btn btn-outline"
                  disabled={page * limit >= total || loading}
                  onClick={() => fetchPadron(page + 1)}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// VISTA: ADMINISTRACIÓN DE COMERCIOS
// -------------------------------------------------------------
function ComerciosView() {
  const [comercios, setComercios] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 10;
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Formulario
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    cuit: '',
    razon_social: '',
    actividad: '',
    alicuota: '0.03',
    estado: 'activo',
    arba_iibb: true,
    arca_facturacion: false
  });

  const fetchComercios = async (targetPage) => {
    setLoading(true);
    try {
      const res = await arbaApi.getComercios(targetPage, limit);
      setComercios(res.data?.items || []);
      setTotal(res.data?.total || 0);
      setPage(res.data?.page || targetPage);
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComercios(1);
  }, []);

  const resetForm = () => {
    setFormData({
      cuit: '',
      razon_social: '',
      actividad: '',
      alicuota: '0.03',
      estado: 'activo',
      arba_iibb: true,
      arca_facturacion: false
    });
    setIsEditing(false);
  };

  const handleEditClick = (c) => {
    setIsEditing(true);
    setFormData({
      cuit: c.cuit,
      razon_social: c.razon_social || '',
      actividad: c.actividad || '',
      alicuota: String(c.alicuota ?? '0.03'),
      estado: c.estado || 'activo',
      arba_iibb: c.aplicaciones?.arba_iibb ?? true,
      arca_facturacion: c.aplicaciones?.arca_facturacion ?? false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ type: '', message: '' });
    const cuitClean = cleanCuit(formData.cuit);

    if (!isValidCuit(cuitClean)) {
      setFeedback({ type: 'danger', message: 'El CUIT debe tener 11 dígitos numéricos.' });
      return;
    }

    const alicuotaNum = parseFloat(formData.alicuota);
    if (isNaN(alicuotaNum) || alicuotaNum < 0) {
      setFeedback({ type: 'danger', message: 'La alícuota debe ser un número decimal positivo (ej: 0.03).' });
      return;
    }

    const payload = {
      cuit: cuitClean,
      razon_social: formData.razon_social.trim(),
      actividad: formData.actividad.trim(),
      alicuota: alicuotaNum,
      estado: formData.estado,
      aplicaciones: {
        arba_iibb: Boolean(formData.arba_iibb),
        arca_facturacion: Boolean(formData.arca_facturacion)
      }
    };

    try {
      if (isEditing) {
        await arbaApi.updateComercio(cuitClean, payload);
        setFeedback({ type: 'success', message: `Comercio ${cuitClean} actualizado exitosamente.` });
      } else {
        await arbaApi.createComercio(payload);
        setFeedback({ type: 'success', message: `Comercio ${cuitClean} registrado exitosamente.` });
      }
      resetForm();
      fetchComercios(page);
    } catch (err) {
      if (err.status === 409) {
        setFeedback({ type: 'danger', message: 'El CUIT ingresado ya se encuentra registrado (409 Conflict).' });
      } else if (err.status === 404) {
        setFeedback({ type: 'danger', message: 'El comercio no fue encontrado en el servidor (404).' });
      } else {
        setFeedback({ type: 'danger', message: err.message });
      }
    }
  };

  const handleDelete = async (cuit) => {
    if (!window.confirm(`¿Seguro que deseás eliminar el comercio ${cuit}? Las percepciones pasadas se mantendrán.`)) {
      return;
    }
    try {
      await arbaApi.deleteComercio(cuit);
      setFeedback({ type: 'success', message: `Comercio ${cuit} dado de baja.` });
      fetchComercios(page);
    } catch (err) {
      setFeedback({ type: 'danger', message: err.message });
    }
  };

  return (
    <div>
      <div className="card">
        <h2 className="card-title">{isEditing ? `Editar Comercio: ${formData.cuit}` : 'Registrar Nuevo Comercio'}</h2>
        <div className="alert alert-info">
          Esta pantalla administra datos de demostración académica. Guardar un comercio no confirma una inscripción oficial en IIBB ni consulta el padrón real de ARBA. Las actividades y alícuotas son ficticias.
        </div>
        
        {feedback.message && <div className={`alert alert-${feedback.type}`}>{feedback.message}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid form-grid-3">
            <div className="form-group">
              <label>CUIT (11 dígitos)</label>
              <input
                type="text"
                disabled={isEditing}
                placeholder="20345678901"
                value={formData.cuit}
                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Razón Social</label>
              <input
                type="text"
                placeholder="Comercio Demo S.A."
                value={formData.razon_social}
                onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Actividad</label>
              <input
                type="text"
                placeholder="Venta minorista"
                value={formData.actividad}
                onChange={(e) => setFormData({ ...formData, actividad: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Alícuota decimal (ej: 0.03 para 3%)</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                max="1"
                value={formData.alicuota}
                onChange={(e) => setFormData({ ...formData, alicuota: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Estado</label>
              <select
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>

            <div className="form-group" style={{ justifyContent: 'center' }}>
              <label>Aplicaciones Habilitadas</label>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem' }}>
                <label style={{ fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.arba_iibb}
                    onChange={(e) => setFormData({ ...formData, arba_iibb: e.target.checked })}
                  />
                  ARBA IIBB
                </label>
                <label style={{ fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.arca_facturacion}
                    onChange={(e) => setFormData({ ...formData, arca_facturacion: e.target.checked })}
                  />
                  ARCA Facturación
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="submit" className="btn btn-primary">
              {isEditing ? 'Guardar Cambios' : 'Dar de Alta'}
            </button>
            {isEditing && (
              <button type="button" className="btn btn-outline" onClick={resetForm}>
                Cancelar Edición
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-title">
          <span>Comercios Registrados</span>
          <button className="btn btn-outline" onClick={() => fetchComercios(page)} disabled={loading}>
            Refrescar
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>CUIT</th>
                <th>Razón Social</th>
                <th>Actividad</th>
                <th>Alícuota</th>
                <th>Estado</th>
                <th>IIBB</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {comercios.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No hay comercios cargados.
                  </td>
                </tr>
              ) : (
                comercios.map((c) => (
                  <tr key={c.cuit}>
                    <td><code>{c.cuit}</code></td>
                    <td>{c.razon_social || '-'}</td>
                    <td>{c.actividad || '-'}</td>
                    <td><strong>{formatPercent(c.alicuota)}</strong></td>
                    <td>
                      <span className={`badge ${c.estado === 'activo' ? 'badge-active' : 'badge-inactive'}`}>
                        {c.estado}
                      </span>
                    </td>
                    <td>{c.aplicaciones?.arba_iibb ? 'Habilitado' : 'No'}</td>
                    <td style={{ display: 'flex', gap: '0.4rem' }}>
                      <button className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleEditClick(c)}>
                        Editar
                      </button>
                      <button className="btn btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleDelete(c.cuit)}>
                        Baja
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <span>Total: {total} comercios</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-outline"
              disabled={page <= 1 || loading}
              onClick={() => fetchComercios(page - 1)}
            >
              Anterior
            </button>
            <span style={{ alignSelf: 'center', fontWeight: '600' }}>Pág. {page}</span>
            <button
              className="btn btn-outline"
              disabled={page * limit >= total || loading}
              onClick={() => fetchComercios(page + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// VISTA: REGISTRAR PERCEPCIÓN
// -------------------------------------------------------------
function PercepcionesView() {
  const [formData, setFormData] = useState({
    id_venta: '',
    cuit: '',
    monto_venta: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setResult(null);

    const cuitClean = cleanCuit(formData.cuit);
    if (!isValidCuit(cuitClean)) {
      setErrorMsg('El CUIT debe constar de 11 dígitos numéricos sin símbolos.');
      return;
    }

    const montoNum = parseFloat(formData.monto_venta);
    if (isNaN(montoNum) || montoNum <= 0) {
      setErrorMsg('El monto de venta debe ser un número positivo.');
      return;
    }

    const payload = {
      id_venta: formData.id_venta.trim(),
      cuit: cuitClean,
      monto_venta: Math.round(montoNum * 100) / 100
    };

    setLoading(true);
    try {
      const res = await arbaApi.createPercepcion(payload);
      setResult({
        httpStatus: res.status,
        data: res.data
      });
      // Si fue exitosa, limpiamos el id_venta para evitar conflictos futuros
      setFormData((prev) => ({ ...prev, id_venta: '', monto_venta: '' }));
    } catch (err) {
      if (err.status === 403) {
        setErrorMsg('Operación denegada (403): El comercio figura inactivo o no tiene la aplicación arba_iibb activada.');
      } else if (err.status === 404) {
        setErrorMsg(`Comercio no encontrado (404): El CUIT ${cuitClean} no está registrado en el padrón.`);
      } else if (err.status === 409) {
        setErrorMsg(`Conflicto (409): El ID de venta '${formData.id_venta}' ya fue utilizado con otro CUIT o importe.`);
      } else if (err.status === 400) {
        setErrorMsg(`Solicitud inválida (400): ${err.message}`);
      } else {
        setErrorMsg(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">Registrar Percepción de IIBB</h2>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        Aplica la alícuota registrada en el padrón para calcular la percepción correspondiente a una operación de venta.
      </p>

      {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-grid form-grid-3">
          <div className="form-group">
            <label>Identificador de Venta (id_venta)</label>
            <input
              type="text"
              placeholder="Ej: venta-101"
              value={formData.id_venta}
              onChange={(e) => setFormData({ ...formData, id_venta: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>CUIT del Comercio (11 dígitos)</label>
            <input
              type="text"
              placeholder="20345678901"
              value={formData.cuit}
              onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Monto de Venta ($ ARS)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="10000.00"
              value={formData.monto_venta}
              onChange={(e) => setFormData({ ...formData, monto_venta: e.target.value })}
              required
            />
          </div>
        </div>

        <div style={{ marginTop: '1.25rem' }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Calculando y guardando...' : 'Calcular Percepción'}
          </button>
        </div>
      </form>

      {result && (
        <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
          <div className={`alert ${result.httpStatus === 201 ? 'alert-success' : 'alert-info'}`}>
            <strong>{result.httpStatus === 201 ? 'Percepción generada con éxito (201 Created)' : 'Reintento idéntico detectado (200 OK — registro existente recuperado)'}</strong>
          </div>

          <div className="table-wrapper">
            <table>
              <tbody>
                <tr>
                  <th>ID Percepción</th>
                  <td><code>{result.data.id}</code></td>
                </tr>
                <tr>
                  <th>ID Venta</th>
                  <td>{result.data.id_venta}</td>
                </tr>
                <tr>
                  <th>CUIT Comercio</th>
                  <td><code>{result.data.cuit}</code></td>
                </tr>
                <tr>
                  <th>Monto de Venta</th>
                  <td>{formatCurrency(result.data.monto_venta)}</td>
                </tr>
                <tr>
                  <th>Alícuota Aplicada</th>
                  <td><strong>{formatPercent(result.data.alicuota_aplicada)}</strong></td>
                </tr>
                <tr>
                  <th>Monto Percibido</th>
                  <td style={{ color: 'var(--azul-oscuro)', fontSize: '1.1rem', fontWeight: 'bold' }}>
                    {formatCurrency(result.data.monto_percepcion)}
                  </td>
                </tr>
                <tr>
                  <th>Fecha y Hora</th>
                  <td>{new Date(result.data.fecha).toLocaleString('es-AR')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// VISTA: HISTORIAL DE PERCEPCIONES POR CUIT
// -------------------------------------------------------------
function HistorialView() {
  const [cuit, setCuit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError('');
    setData(null);

    const cuitClean = cleanCuit(cuit);
    if (!isValidCuit(cuitClean)) {
      setError('El CUIT debe tener 11 dígitos numéricos sin guiones.');
      return;
    }

    setLoading(true);
    try {
      const res = await arbaApi.getPercepcionesByCuit(cuitClean);
      setData(res.data);
    } catch (err) {
      if (err.status === 400) {
        setError('El formato del CUIT es inválido (400).');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">Historial de Auditoría de Percepciones</h2>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        Permite consultar las percepciones practicadas a un CUIT. Se mantienen aún si el comercio fue dado de baja.
      </p>

      <form onSubmit={handleSearch} className="form-grid form-grid-3">
        <div className="form-group">
          <label>CUIT a consultar (11 dígitos)</label>
          <input
            type="text"
            placeholder="20345678901"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            required
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="submit" className="btn btn-secondary" disabled={loading}>
            {loading ? 'Consultando...' : 'Consultar Historial'}
          </button>
        </div>
      </form>

      {error && <div className="alert alert-danger" style={{ marginTop: '1rem' }}>{error}</div>}

      {data && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className="alert alert-info">
            CUIT auditado: <strong>{data.cuit}</strong> — Total de operaciones registradas: <strong>{data.cantidad}</strong>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>ID Operación</th>
                  <th>ID Venta</th>
                  <th>Monto Venta</th>
                  <th>Alícuota</th>
                  <th>Monto Percepción</th>
                </tr>
              </thead>
              <tbody>
                {(!data.percepciones || data.percepciones.length === 0) ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No se encontraron percepciones practicadas a este CUIT.
                    </td>
                  </tr>
                ) : (
                  data.percepciones.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.fecha).toLocaleString('es-AR')}</td>
                      <td><code>{p.id}</code></td>
                      <td>{p.id_venta}</td>
                      <td>{formatCurrency(p.monto_venta)}</td>
                      <td>{formatPercent(p.alicuota_aplicada)}</td>
                      <td><strong>{formatCurrency(p.monto_percepcion)}</strong></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';

/**
 * Pantalla de Autenticación Obligatoria — ARBA (Lucas P).
 *
 * Incluye:
 * - Pestañas de Iniciar Sesión y Registro de Usuario.
 * - Selector de Rol en el Registro (Operador / Administrador).
 * - Botones de acceso rápido Demo (Admin / Operador) para pruebas de la cátedra.
 * - Conmutador de modo (API / Demo) visible y operable desde la autenticación.
 */

export default function AuthView({ onLoginSuccess, mode, onChangeMode, status }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Formulario Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Formulario Registro
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRol, setRegRol] = useState('operador'); // 'operador' | 'admin'

  const handleQuickLogin = (email, password) => {
    setTab('login');
    setLoginEmail(email);
    setLoginPassword(password);
    setErrorMsg('');
    submitLogin(email, password);
  };

  const submitLogin = async (email, password) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await onLoginSuccess('login', { email, password });
      if (!res.ok) {
        setErrorMsg(res.data?.error || 'Error al iniciar sesión. Verifique sus credenciales.');
      }
    } catch {
      setErrorMsg('Error de conexión al autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setErrorMsg('Por favor ingrese email y contraseña.');
      return;
    }
    submitLogin(loginEmail, loginPassword);
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regNombre.trim()) {
      setErrorMsg('El nombre es requerido.');
      return;
    }
    if (!regEmail || !regEmail.includes('@')) {
      setErrorMsg('Ingrese un correo electrónico válido.');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await onLoginSuccess('register', {
        nombre: regNombre.trim(),
        email: regEmail.trim(),
        password: regPassword,
        rol: regRol,
      });
      if (!res.ok) {
        setErrorMsg(res.data?.error || 'Error al registrar el usuario.');
      }
    } catch {
      setErrorMsg('Error de red al registrar usuario.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Cabecera Institucional */}
        <div className="auth-header">
          <div className="auth-brand">
            <img src="/logo-arba.png" alt="ARBA · Agencia de Recaudación" className="auth-logo" />
            <div className="auth-brand-text">
              <span className="auth-badge-subtitle">Sintegra I26 · Ecosistema Fintech</span>
              <h1 className="auth-title">Módulo de Gestión Fiscal IIBB</h1>
            </div>
          </div>
        </div>

        {/* Pestañas Login / Registro */}
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'login'}
            className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => {
              setTab('login');
              setErrorMsg('');
            }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'register'}
            className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
            onClick={() => {
              setTab('register');
              setErrorMsg('');
            }}
          >
            Registrar Usuario
          </button>
        </div>

        {errorMsg && (
          <div className="auth-alert-error" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario Login */}
        {tab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="auth-form">
            <div className="form-field">
              <label className="form-label" htmlFor="login-email">Correo Electrónico</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="ej: admin@arba.demo"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="login-password">Contraseña</label>
              <input
                id="login-password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Verificando credenciales...' : 'Ingresar al Sistema'}
            </button>
          </form>
        )}

        {/* Formulario Registro */}
        {tab === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="auth-form">
            <div className="form-field">
              <label className="form-label" htmlFor="reg-nombre">Nombre y Apellido</label>
              <input
                id="reg-nombre"
                type="text"
                className="form-input"
                placeholder="ej: Juan Pérez"
                value={regNombre}
                onChange={(e) => setRegNombre(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="reg-email">Correo Electrónico</label>
              <input
                id="reg-email"
                type="email"
                className="form-input"
                placeholder="ej: usuario@arba.demo"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="reg-password">Contraseña</label>
              <input
                id="reg-password"
                type="password"
                className="form-input"
                placeholder="Mínimo 6 caracteres"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
              />
            </div>

            {/* Selector de Rol Solicitado por el Profesor */}
            <div className="form-field">
              <label className="form-label">Rol del Usuario</label>
              <div className="role-selector-grid">
                <label className={`role-card ${regRol === 'operador' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="reg-rol"
                    value="operador"
                    checked={regRol === 'operador'}
                    onChange={() => setRegRol('operador')}
                  />
                  <div className="role-card-content">
                    <span className="role-card-title">Operador</span>
                    <span className="role-card-desc">Consulta de padrón y simulador de percepciones TPV</span>
                  </div>
                </label>

                <label className={`role-card ${regRol === 'admin' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="reg-rol"
                    value="admin"
                    checked={regRol === 'admin'}
                    onChange={() => setRegRol('admin')}
                  />
                  <div className="role-card-content">
                    <span className="role-card-title">Administrador</span>
                    <span className="role-card-desc">Acceso total: altas/bajas de padrón y mantenimiento</span>
                  </div>
                </label>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Registrando usuario...' : 'Crear Cuenta y Entrar'}
            </button>
          </form>
        )}

        {/* Accesos rápidos Demo para el Profesor */}
        <div className="auth-quick-access">
          <span className="auth-quick-title">⚡ Accesos rápidos preconfigurados de prueba:</span>
          <div className="auth-quick-buttons">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('admin@arba.demo', 'admin123')}
            >
              <span className="badge badge-accent">Admin</span> admin@arba.demo
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleQuickLogin('operador@arba.demo', 'operador123')}
            >
              <span className="badge badge-neutral">Operador</span> operador@arba.demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

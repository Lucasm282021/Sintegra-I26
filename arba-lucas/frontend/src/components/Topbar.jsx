import React from 'react';

const sectionTitles = {
  inicio: 'Inicio',
  padron: 'Padrón de contribuyentes',
  simulador: 'Simulador de percepciones',
  historial: 'Historial de percepciones',
  reportes: 'Reportes fiscales',
  admin: 'Administración y API técnica',
};

function ConnectionBadge({ mode, status }) {
  if (mode === 'demo') {
    return (
      <div className="conn-badge conn-demo" title="Datos simulados y guardados en este navegador">
        <span className="conn-dot" />
        Modo demo activo
      </div>
    );
  }
  if (!status.checked) {
    return (
      <div className="conn-badge conn-pending">
        <span className="conn-dot" />
        Conectando…
      </div>
    );
  }
  return status.online ? (
    <div className="conn-badge conn-online" title="Servicio ARBA respondiendo en /health">
      <span className="conn-dot" />
      API conectada
    </div>
  ) : (
    <div className="conn-badge conn-offline" title="El servicio ARBA no responde">
      <span className="conn-dot" />
      API desconectada
    </div>
  );
}

export default function Topbar({
  activeSection,
  onToggleSidebar,
  mode,
  onChangeMode,
  status,
  onShowIntro,
  currentUser,
  onLogout,
}) {
  const apiDown = mode === 'api' && status.checked && !status.online;

  return (
    <>
      <header className="app-topbar">
        <div className="topbar-left">
          <button className="btn-toggle-sidebar" onClick={onToggleSidebar} aria-label="Alternar menú lateral">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="topbar-breadcrumb">
            <span className="breadcrumb-root">ARBA</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{sectionTitles[activeSection] || 'Módulo ARBA'}</span>
          </div>
        </div>

        <div className="topbar-right">
          <ConnectionBadge mode={mode} status={status} />

          <div className="mode-switch" role="radiogroup" aria-label="Modo de operación">
            <button
              id="mode-api"
              role="radio"
              aria-checked={mode === 'api'}
              className={`mode-option ${mode === 'api' ? 'active' : ''}`}
              onClick={() => onChangeMode('api')}
            >
              API
            </button>
            <button
              id="mode-demo"
              role="radio"
              aria-checked={mode === 'demo'}
              className={`mode-option ${mode === 'demo' ? 'active' : ''}`}
              onClick={() => onChangeMode('demo')}
            >
              Demo
            </button>
          </div>

          <button id="btn-ver-intro" className="btn-intro" onClick={onShowIntro} title="Ver la intro del módulo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/>
            </svg>
            <span>Ver intro</span>
          </button>

          {currentUser && (
            <div className="topbar-user-section">
              <div className="user-pill" title={`Sesión iniciada como ${currentUser.email}`}>
                <span className="user-avatar">{currentUser.nombre.charAt(0).toUpperCase()}</span>
                <span className="user-name">{currentUser.nombre}</span>
                <span className={`badge ${currentUser.rol === 'admin' ? 'badge-accent' : 'badge-neutral'} badge-sm`}>
                  {currentUser.rol === 'admin' ? 'Admin' : 'Operador'}
                </span>
              </div>
              <button
                type="button"
                className="btn-logout"
                onClick={onLogout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      </header>

      {apiDown && (
        <div className="api-down-banner" role="alert">
          <span>
            <strong>API desconectada.</strong> El servicio ARBA no responde; no se mostrarán resultados inventados.
          </span>
          <button id="btn-activar-demo" className="btn btn-secondary btn-xs" onClick={() => onChangeMode('demo')}>
            Usar Modo Demo
          </button>
        </div>
      )}
    </>
  );
}

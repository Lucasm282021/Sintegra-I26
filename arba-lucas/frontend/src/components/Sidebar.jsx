import React from 'react';

export default function Sidebar({ activeSection, onSelectSection, padronCount, historialCount, status, mode, isOpen, currentUser }) {
  const isDemo = mode === 'demo';
  const navItems = [
    {
      id: 'inicio',
      label: 'Inicio',
      group: 'Operaciones',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
    {
      id: 'padron',
      label: 'Padrón de contribuyentes',
      group: 'Operaciones',
      count: padronCount,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="8.5" cy="7" r="4"/>
          <line x1="20" y1="8" x2="20" y2="14"/>
          <line x1="23" y1="11" x2="17" y2="11"/>
        </svg>
      ),
    },
    {
      id: 'simulador',
      label: 'Simulador de percepciones',
      group: 'Operaciones',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="2" width="16" height="20" rx="2"/>
          <line x1="8" y1="6" x2="16" y2="6"/>
          <line x1="16" y1="14" x2="16" y2="18"/>
          <path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>
        </svg>
      ),
    },
    {
      id: 'historial',
      label: 'Historial de percepciones',
      group: 'Operaciones',
      count: historialCount,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
    },
    {
      id: 'reportes',
      label: 'Reportes fiscales',
      group: 'Operaciones',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
    },
    {
      id: 'admin',
      label: 'Administración y API',
      group: 'Sistema',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      ),
    },
  ];

  let lastGroup = null;

  return (
    <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`} id="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-logo">
          <img src="/logo-arba.png" alt="i26 ARBA · Impuestos Provinciales" />
        </div>
        <span className="brand-caption">Gestión fiscal · IIBB</span>
      </div>

      {/* Nav items */}
      <nav className="sidebar-nav" aria-label="Menú principal">
        {navItems.map((item) => {
          const showGroup = item.group !== lastGroup;
          lastGroup = item.group;
          return (
            <React.Fragment key={item.id}>
              {showGroup && <div className="nav-group-title">{item.group}</div>}
              <button
                className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                onClick={() => onSelectSection(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.count !== undefined && <span className="nav-counter">{item.count}</span>}
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Footer Status */}
      <div className="sidebar-footer">
        {currentUser && (
          <div className="sidebar-user-info">
            <span className="sidebar-user-avatar">{currentUser.nombre.charAt(0).toUpperCase()}</span>
            <div className="sidebar-user-meta">
              <span className="sidebar-user-name">{currentUser.nombre}</span>
              <span className="sidebar-user-role">{currentUser.rol === 'admin' ? 'Administrador' : 'Operador'}</span>
            </div>
          </div>
        )}
        <div className="system-status-indicator">
          <span className={`status-dot ${isDemo ? 'status-demo' : status.online ? 'status-online' : 'status-offline'}`} />
          <div className="status-meta">
            <span className="status-text">
              {isDemo ? 'Modo demo' : status.online ? 'Servicio conectado' : 'Desconectado'}
            </span>
            <span className="status-sub">{isDemo ? 'Simulación en el navegador' : 'API REST ARBA'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

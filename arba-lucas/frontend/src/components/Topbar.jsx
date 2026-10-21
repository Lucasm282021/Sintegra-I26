import React from 'react';

const sectionTitles = {
  inicio: 'Inicio',
  padron: 'Padrón de contribuyentes',
  simulador: 'Simulador de percepciones',
  historial: 'Historial de percepciones',
  reportes: 'Reportes fiscales',
  admin: 'Administración y API técnica',
};

export default function Topbar({ activeSection, onToggleSidebar }) {
  return (
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
        <div className="topbar-badge" title="Entorno de simulación fiscal">
          <span className="badge-dot" />
          Ecosistema Fintech
        </div>
      </div>
    </header>
  );
}

import React from 'react';
import { formatCurrency, formatPercent, formatCuit, formatDateTime } from '../utils/formatters';

export default function InicioView({ stats, recentPercepciones, onNavigate, onOpenNewTaxpayer }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inicio</h1>
          <p className="page-subtitle">Resumen general del estado del padrón fiscal y operaciones de percepción de Ingresos Brutos.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('padron')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            Ver padrón
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('simulador')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="2" width="16" height="20" rx="2"/>
              <line x1="8" y1="6" x2="16" y2="6"/>
            </svg>
            Nueva percepción
          </button>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Contribuyentes en padrón</span>
            <span className="stat-icon-wrap stat-icon-blue">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
            </span>
          </div>
          <div className="stat-value font-tabular">{stats.totalContribuyentes ?? 0}</div>
          <div className="stat-caption">Comercios y profesionales registrados</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total recaudado</span>
            <span className="stat-icon-wrap stat-icon-green">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </span>
          </div>
          <div className="stat-value font-tabular text-success">{formatCurrency(stats.totalRecaudado ?? 0)}</div>
          <div className="stat-caption">Percepciones fiscales acumuladas</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Operaciones procesadas</span>
            <span className="stat-icon-wrap stat-icon-purple">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </span>
          </div>
          <div className="stat-value font-tabular">{stats.totalPercepciones ?? 0}</div>
          <div className="stat-caption">Percepciones registradas</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Alícuota media</span>
            <span className="stat-icon-wrap stat-icon-amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="m15 9-6 6M9 9h.01M15 15h.01"/>
              </svg>
            </span>
          </div>
          <div className="stat-value font-tabular text-accent">{formatPercent(stats.alicuotaPromedio ?? 0)}</div>
          <div className="stat-caption">Tasa fiscal promedio del padrón</div>
        </div>
      </div>

      <div className="layout-columns-2">
        {/* Últimas Operaciones */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Últimas percepciones registradas</h2>
              <p className="panel-subtitle">Operaciones fiscales recientes procesadas por el módulo</p>
            </div>
            <button className="btn btn-link btn-xs" onClick={() => onNavigate('historial')}>Ver todo &rarr;</button>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID Venta</th>
                  <th>CUIT</th>
                  <th className="text-right">Monto venta</th>
                  <th className="text-center">Alícuota</th>
                  <th className="text-right">Percepción IIBB</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentPercepciones.length === 0 ? (
                  <tr><td colSpan={6} className="table-empty-cell">No se registran operaciones recientes.</td></tr>
                ) : (
                  recentPercepciones.map((p) => (
                    <tr key={p.id}>
                      <td><code className="font-tabular font-bold">{p.id_venta}</code></td>
                      <td><code className="font-tabular">{formatCuit(p.cuit)}</code></td>
                      <td className="text-right font-tabular">{formatCurrency(p.monto_venta)}</td>
                      <td className="text-center"><span className="badge badge-info">{formatPercent(p.alicuota_aplicada)}</span></td>
                      <td className="text-right font-tabular font-bold text-success">{formatCurrency(p.monto_percepcion)}</td>
                      <td className="text-muted text-xs">{formatDateTime(p.fecha)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tareas Frecuentes */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Tareas frecuentes</h2>
              <p className="panel-subtitle">Acciones comunes de administración fiscal</p>
            </div>
          </div>
          <div className="quick-tasks-list">
            <div className="quick-task-card" onClick={onOpenNewTaxpayer}>
              <div className="quick-task-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <line x1="20" y1="8" x2="20" y2="14"/>
                  <line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
              </div>
              <div className="quick-task-info">
                <strong>Registrar nuevo contribuyente</strong>
                <span>Incorporar un nuevo CUIT con su alícuota y actividad al padrón</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); onOpenNewTaxpayer(); }}>Dar de alta</button>
            </div>

            <div className="quick-task-card" onClick={() => onNavigate('simulador')}>
              <div className="quick-task-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="2" width="16" height="20" rx="2"/>
                  <line x1="8" y1="6" x2="16" y2="6"/>
                  <line x1="16" y1="14" x2="16" y2="18"/>
                </svg>
              </div>
              <div className="quick-task-info">
                <strong>Simular liquidación de IIBB</strong>
                <span>Calcular y probar la percepción para una venta específica con validación de idempotencia</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); onNavigate('simulador'); }}>Simular</button>
            </div>

            <div className="quick-task-card" onClick={() => onNavigate('reportes')}>
              <div className="quick-task-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <div className="quick-task-info">
                <strong>Consultar estadísticas fiscales</strong>
                <span>Ver distribución de alícuotas y recaudación acumulada por actividad</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); onNavigate('reportes'); }}>Ver reportes</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

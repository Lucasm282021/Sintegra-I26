import React, { useState, useMemo } from 'react';
import { formatCuit, formatPercent, formatDecimal } from '../utils/formatters';

export default function PadronView({
  padron,
  onOpenCreate,
  onOpenEdit,
  onOpenDelete,
  onOpenView,
  onRefresh,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [alicuotaFilter, setAlicuotaFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return padron.filter((p) => {
      const matchesSearch =
        !q || p.cuit.includes(q) || (p.actividad && p.actividad.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (alicuotaFilter === 'low') return p.alicuota <= 0.025;
      if (alicuotaFilter === 'mid') return p.alicuota > 0.025 && p.alicuota <= 0.035;
      if (alicuotaFilter === 'high') return p.alicuota > 0.035;
      return true;
    });
  }, [padron, searchQuery, alicuotaFilter]);

  const totalPages = Math.ceil(filteredItems.length / limit) || 1;
  const page = Math.min(currentPage, totalPages);
  const offset = (page - 1) * limit;
  const pageItems = filteredItems.slice(offset, offset + limit);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Padrón de contribuyentes</h1>
          <p className="page-subtitle">Consulta, registro y modificación de alícuotas impositivas de Ingresos Brutos (IIBB).</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={onOpenCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nuevo contribuyente
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="filter-toolbar panel">
        <div className="filter-search-wrap">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="filter-search-input"
            placeholder="Buscar por CUIT o actividad comercial..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchQuery && (
            <button className="btn-clear-search" onClick={() => setSearchQuery('')} aria-label="Limpiar búsqueda">
              &times;
            </button>
          )}
        </div>

        <div className="filter-controls">
          <select
            className="filter-select"
            value={alicuotaFilter}
            onChange={(e) => {
              setAlicuotaFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Todas las alícuotas</option>
            <option value="low">Hasta 2.5% (Tasa reducida)</option>
            <option value="mid">Entre 2.6% y 3.5% (Tasa general)</option>
            <option value="high">Más de 3.5% (Tasa incrementada)</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={onRefresh} title="Actualizar lista">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            Actualizar
          </button>
        </div>
      </div>

      {/* Tabla del Padrón */}
      <div className="panel">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>CUIT</th>
                <th>Actividad comercial</th>
                <th className="text-center">Alícuota IIBB</th>
                <th className="text-center">Fracción decimal</th>
                <th>Estado fiscal</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? null : (
                pageItems.map((p) => (
                  <tr key={p.cuit}>
                    <td><code className="font-tabular font-bold">{formatCuit(p.cuit)}</code></td>
                    <td>{p.actividad}</td>
                    <td className="text-center"><span className="badge badge-info">{formatPercent(p.alicuota)}</span></td>
                    <td className="text-center font-tabular text-muted">{formatDecimal(p.alicuota)}</td>
                    <td><span className="badge badge-success">Activo</span></td>
                    <td>
                      <div className="table-actions-group">
                        <button className="btn btn-secondary btn-xs" onClick={() => onOpenView(p)} title="Ver detalle completo">
                          Ver
                        </button>
                        <button className="btn btn-secondary btn-xs" onClick={() => onOpenEdit(p)} title="Modificar alícuota o actividad">
                          Editar
                        </button>
                        <button className="btn btn-danger-outline btn-xs" onClick={() => onOpenDelete(p)} title="Dar de baja">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Estado Vacío */}
        {filteredItems.length === 0 && (
          <div className="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="empty-state-icon">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <h3 className="empty-state-title">No se encontraron contribuyentes</h3>
            <p className="empty-state-desc">No existen registros en el padrón que coincidan con los filtros aplicados.</p>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearchQuery('');
                setAlicuotaFilter('all');
                setCurrentPage(1);
              }}
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Paginación */}
        {filteredItems.length > 0 && (
          <div className="pagination-bar">
            <div className="pagination-info">
              Mostrando {offset + 1}-{Math.min(offset + limit, filteredItems.length)} de {filteredItems.length} contribuyentes
            </div>
            <div className="pagination-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                &larr; Anterior
              </button>
              <span className="pagination-page-indicator">Página {page} de {totalPages}</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Siguiente &rarr;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

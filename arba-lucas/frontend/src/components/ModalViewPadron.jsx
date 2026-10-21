import React from 'react';
import { formatCuit, formatPercent, formatDecimal } from '../utils/formatters';

export default function ModalViewPadron({ isOpen, taxpayer, onClose, onEdit }) {
  if (!isOpen || !taxpayer) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog">
        <div className="modal-header">
          <h2 className="modal-title">Detalle del contribuyente</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">&times;</button>
        </div>
        <div className="modal-body">
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">CUIT Formateado</span>
              <span className="detail-value font-tabular font-bold">{formatCuit(taxpayer.cuit)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">CUIT Crudo (11 dígitos)</span>
              <span className="detail-value font-tabular text-muted">{taxpayer.cuit}</span>
            </div>
            <div className="detail-item detail-item-full">
              <span className="detail-label">Actividad comercial registrada</span>
              <span className="detail-value">{taxpayer.actividad}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Alícuota IIBB (%)</span>
              <span className="detail-value font-tabular text-accent">{formatPercent(taxpayer.alicuota)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Fracción decimal normativa</span>
              <span className="detail-value font-tabular">{formatDecimal(taxpayer.alicuota)}</span>
            </div>
            <div className="detail-item detail-item-full">
              <span className="detail-label">Estado en padrón</span>
              <span className="badge badge-success">Activo y habilitado</span>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onClose();
              onEdit(taxpayer);
            }}
          >
            Editar contribuyente
          </button>
        </div>
      </div>
    </div>
  );
}

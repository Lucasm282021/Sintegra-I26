import React from 'react';
import { formatCuit } from '../utils/formatters';

export default function ModalDeletePadron({ isOpen, taxpayer, onClose, onConfirm }) {
  if (!isOpen || !taxpayer) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-dialog-sm">
        <div className="modal-header">
          <h2 className="modal-title text-danger">Confirmar baja de padrón</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">&times;</button>
        </div>
        <div className="modal-body">
          <p className="modal-confirm-desc">¿Confirma que desea eliminar del padrón fiscal al siguiente contribuyente?</p>

          <div className="summary-box">
            <div className="summary-line">
              <span className="summary-key">CUIT:</span>
              <span className="summary-val font-tabular font-bold">{formatCuit(taxpayer.cuit)}</span>
            </div>
            <div className="summary-line">
              <span className="summary-key">Actividad:</span>
              <span className="summary-val">{taxpayer.actividad}</span>
            </div>
          </div>

          <p className="modal-confirm-warning">
            El comercio dejará de figurar en el padrón y las futuras solicitudes de percepción para este CUIT retornarán código 404.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              onConfirm(taxpayer.cuit);
              onClose();
            }}
          >
            Eliminar contribuyente
          </button>
        </div>
      </div>
    </div>
  );
}

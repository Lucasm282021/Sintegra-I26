import React, { useState, useEffect } from 'react';
import { formatCuit } from '../utils/formatters';

export default function ModalEditPadron({ isOpen, taxpayer, onClose, onUpdate }) {
  const [actividad, setActividad] = useState('');
  const [alicuotaPct, setAlicuotaPct] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (taxpayer) {
      setActividad(taxpayer.actividad || '');
      setAlicuotaPct(((taxpayer.alicuota || 0) * 100).toFixed(2));
      setErrors({});
    }
  }, [taxpayer]);

  if (!isOpen || !taxpayer) return null;

  const alicuotaDecimal = !isNaN(parseFloat(alicuotaPct))
    ? (parseFloat(alicuotaPct) / 100).toFixed(4)
    : '0.0000';

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!actividad.trim()) {
      newErrors.actividad = 'La actividad comercial no puede estar vacía.';
    }

    const pct = parseFloat(alicuotaPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      newErrors.alicuota = 'Ingrese un porcentaje válido entre 0 y 100.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onUpdate(taxpayer.cuit, {
      actividad: actividad.trim(),
      alicuota: Number((pct / 100).toFixed(4)),
    });
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog">
        <div className="modal-header">
          <h2 className="modal-title">Editar contribuyente</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">&times;</button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            <div className="form-field">
              <label className="form-label">CUIT (Identificador no editable)</label>
              <input
                type="text"
                className="form-input font-tabular input-readonly"
                value={formatCuit(taxpayer.cuit)}
                readOnly
                disabled
              />
            </div>

            <div className="form-field">
              <label htmlFor="edit-actividad" className="form-label">
                Actividad comercial <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="edit-actividad"
                className={`form-input ${errors.actividad ? 'input-error' : ''}`}
                value={actividad}
                onChange={(e) => {
                  setActividad(e.target.value);
                  if (errors.actividad) setErrors((prev) => ({ ...prev, actividad: null }));
                }}
                required
              />
              <span className="field-error">{errors.actividad}</span>
            </div>

            <div className="form-field">
              <label htmlFor="edit-alicuota-pct" className="form-label">
                Alícuota IIBB (% Porcentaje) <span className="text-danger">*</span>
              </label>
              <div className="input-suffix-wrap">
                <input
                  type="number"
                  id="edit-alicuota-pct"
                  className={`form-input font-tabular ${errors.alicuota ? 'input-error' : ''}`}
                  step="0.01"
                  min="0"
                  max="100"
                  value={alicuotaPct}
                  onChange={(e) => {
                    setAlicuotaPct(e.target.value);
                    if (errors.alicuota) setErrors((prev) => ({ ...prev, alicuota: null }));
                  }}
                  required
                />
                <span className="input-suffix">%</span>
              </div>
              <span className="field-error">{errors.alicuota}</span>
              <div className="form-converted-value">
                Fracción decimal para la API: <strong>{alicuotaDecimal}</strong>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
}

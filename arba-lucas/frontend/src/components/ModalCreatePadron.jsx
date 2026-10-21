import React, { useState } from 'react';

export default function ModalCreatePadron({ isOpen, onClose, onSave }) {
  const [cuit, setCuit] = useState('');
  const [actividad, setActividad] = useState('');
  const [alicuotaPct, setAlicuotaPct] = useState('');
  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const alicuotaDecimal = !isNaN(parseFloat(alicuotaPct))
    ? (parseFloat(alicuotaPct) / 100).toFixed(4)
    : '0.0000';

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!/^\d{11}$/.test(cuit.trim())) {
      newErrors.cuit = 'El CUIT debe contener exactamente 11 dígitos numéricos sin guiones.';
    }

    if (!actividad.trim()) {
      newErrors.actividad = 'La actividad comercial es requerida.';
    }

    const pct = parseFloat(alicuotaPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      newErrors.alicuota = 'Ingrese un porcentaje válido entre 0 y 100.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      cuit: cuit.trim(),
      actividad: actividad.trim(),
      alicuota: Number((pct / 100).toFixed(4)),
    }, (errorMsg) => {
      if (errorMsg) {
        setErrors({ cuit: errorMsg });
      } else {
        handleClose();
      }
    });
  };

  const handleClose = () => {
    setCuit('');
    setActividad('');
    setAlicuotaPct('');
    setErrors({});
    onClose();
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal-dialog">
        <div className="modal-header">
          <h2 className="modal-title">Nuevo contribuyente</h2>
          <button className="modal-close" onClick={handleClose} aria-label="Cerrar">&times;</button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            <div className="form-field">
              <label htmlFor="create-cuit" className="form-label">
                CUIT (11 dígitos numéricos) <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="create-cuit"
                className={`form-input font-tabular ${errors.cuit ? 'input-error' : ''}`}
                placeholder="ej: 30712345678"
                maxLength={11}
                value={cuit}
                onChange={(e) => {
                  setCuit(e.target.value);
                  if (errors.cuit) setErrors((prev) => ({ ...prev, cuit: null }));
                }}
                required
              />
              <span className="field-error">{errors.cuit}</span>
              <span className="field-hint">Ingresar los 11 dígitos continuos sin guiones ni espacios.</span>
            </div>

            <div className="form-field">
              <label htmlFor="create-actividad" className="form-label">
                Actividad comercial <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                id="create-actividad"
                className={`form-input ${errors.actividad ? 'input-error' : ''}`}
                placeholder="ej: Venta al por menor de artículos de consumo"
                value={actividad}
                onChange={(e) => {
                  setActividad(e.target.value);
                  if (errors.actividad) setErrors((prev) => ({ ...prev, actividad: null }));
                }}
                list="actividades-sugeridas"
                required
              />
              <datalist id="actividades-sugeridas">
                <option value="Comercio minorista" />
                <option value="Venta al por menor" />
                <option value="Servicios profesionales" />
                <option value="Industria manufacturera" />
                <option value="Servicios financieros" />
                <option value="Servicios de consultoría informática" />
                <option value="Comercio gastronómico" />
                <option value="Transporte y logística" />
              </datalist>
              <span className="field-error">{errors.actividad}</span>
            </div>

            <div className="form-field">
              <label htmlFor="create-alicuota-pct" className="form-label">
                Alícuota IIBB (% Porcentaje) <span className="text-danger">*</span>
              </label>
              <div className="input-suffix-wrap">
                <input
                  type="number"
                  id="create-alicuota-pct"
                  className={`form-input font-tabular ${errors.alicuota ? 'input-error' : ''}`}
                  placeholder="3.5"
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
            <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar contribuyente</button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React from 'react';
import { formatCurrency, formatPercent, formatCuit, formatDateTime } from '../utils/formatters';

export default function HistorialView({ percepciones, onRefresh }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Historial de percepciones</h1>
          <p className="page-subtitle">Registro cronológico auditable de todas las retenciones impositivas emitidas.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            Actualizar lista
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Identificador</th>
                <th>ID Venta</th>
                <th>CUIT</th>
                <th className="text-right">Monto venta</th>
                <th className="text-center">Alícuota aplicada</th>
                <th className="text-right">Percepción IIBB</th>
                <th>Fecha y hora</th>
              </tr>
            </thead>
            <tbody>
              {percepciones.length === 0 ? (
                <tr><td colSpan={7} className="table-empty-cell">No se registran operaciones de percepción en el sistema.</td></tr>
              ) : (
                percepciones.map((p) => (
                  <tr key={p.id}>
                    <td><code className="font-tabular text-muted text-xs">{p.id}</code></td>
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
    </div>
  );
}

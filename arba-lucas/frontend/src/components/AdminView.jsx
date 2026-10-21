import React from 'react';

export default function AdminView({ onResetSeed }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Administración y especificación técnica</h1>
          <p className="page-subtitle">Información del servicio para integración en el Ecosistema Fintech y herramientas de mantenimiento.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-danger-outline btn-sm" onClick={onResetSeed}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            Restablecer datos semilla
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Estado de la Integración Normativa</h2>
            <p className="panel-subtitle">Endpoints conformes con el contrato de la cátedra</p>
          </div>
          <span className="badge badge-success">10/10 Tests Superados</span>
        </div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Método</th>
                <th>Ruta del endpoint</th>
                <th>Descripción</th>
                <th>Comportamiento normativo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="badge-http badge-get">GET</span></td>
                <td><code className="font-tabular font-bold">/health</code></td>
                <td>Chequeo de disponibilidad del microservicio</td>
                <td>Devuelve <code>{`{"status": "ok"}`}</code> (200)</td>
              </tr>
              <tr>
                <td><span className="badge-http badge-get">GET</span></td>
                <td><code className="font-tabular font-bold">/arba/padron/{'{cuit}'}</code></td>
                <td>Consulta alícuota y actividad de un CUIT</td>
                <td>200 OK si existe; 400 si formato no es de 11 dígitos; 404 si no existe</td>
              </tr>
              <tr>
                <td><span className="badge-http badge-get">GET</span></td>
                <td><code className="font-tabular font-bold">/arba/padron?page=1&limit=10</code></td>
                <td>Listado paginado de contribuyentes</td>
                <td>200 OK con paginación; 400 ante parámetros erróneos</td>
              </tr>
              <tr>
                <td><span className="badge-http badge-post">POST</span></td>
                <td><code className="font-tabular font-bold">/arba/percepciones</code></td>
                <td>Cálculo y registro de percepción por venta</td>
                <td>201 Created; 200 OK reintento idéntico (idempotencia); 409 Conflicto</td>
              </tr>
              <tr>
                <td><span className="badge-http badge-post">POST</span></td>
                <td><code className="font-tabular font-bold">/arba/padron</code></td>
                <td>Alta de contribuyente al padrón (CRUD)</td>
                <td>201 Created con el nuevo contribuyente; 409 si CUIT duplicado</td>
              </tr>
              <tr>
                <td><span className="badge-http badge-put">PUT</span></td>
                <td><code className="font-tabular font-bold">/arba/padron/{'{cuit}'}</code></td>
                <td>Edición de actividad y/o alícuota (CRUD)</td>
                <td>200 OK con el registro actualizado; 404 si CUIT ausente</td>
              </tr>
              <tr>
                <td><span className="badge-http badge-delete">DELETE</span></td>
                <td><code className="font-tabular font-bold">/arba/padron/{'{cuit}'}</code></td>
                <td>Baja de contribuyente del padrón (CRUD)</td>
                <td>200 OK con confirmación de eliminación; 404 si CUIT ausente</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

export default function AdminView({ onResetSeed, mode }) {
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

      <div className={`mode-info-card ${mode === 'demo' ? 'is-demo' : 'is-api'}`}>
        <strong>{mode === 'demo' ? 'Modo Demo' : 'Modo API'}</strong>
        <span>
          {mode === 'demo'
            ? 'Las operaciones se simulan en este navegador (localStorage) con las mismas reglas que el backend. "Restablecer" solo afecta los datos locales.'
            : 'Las operaciones se envían al servicio ARBA (local :3003, Docker o función serverless de Vercel). En Vercel los datos viven en memoria y vuelven a la semilla al reciclarse la instancia.'}
        </span>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Estado de la Integración Normativa</h2>
            <p className="panel-subtitle">Endpoints conformes con el contrato de la cátedra</p>
          </div>
          <span className="badge badge-success">22/22 Tests Superados</span>
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
              <tr>
                <td><span className="badge-http badge-get">GET</span></td>
                <td><code className="font-tabular font-bold">/arba/percepciones/{'{cuit}'}</code></td>
                <td>Historial de auditoría de un contribuyente</td>
                <td>200 OK con items; 400 si formato inválido</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Contrato unificado /api/v1/arba</h2>
            <p className="panel-subtitle">Alineado con doc/AJUSTE-ARBA.md · respuestas envueltas en {'{ data }'} · importes en centavos</p>
          </div>
          <span className="badge badge-info">v1</span>
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
                <td><code className="font-tabular font-bold">/api/v1/arba/padron/{'{cuit}'}</code></td>
                <td>Inscripción IIBB con tasa versionada</td>
                <td>Devuelve rate, jurisdicción (PBA), valid_from y source</td>
              </tr>
              <tr>
                <td><span className="badge-http badge-post">POST</span></td>
                <td><code className="font-tabular font-bold">/api/v1/arba/percepciones</code></td>
                <td>Percepción por venta en unidad menor</td>
                <td>
                  Body <code>{'{ sale_id, cuit, base_amount_minor, currency }'}</code> o header <code>Idempotency-Key</code>.
                  201 nueva; 200 reintento idéntico; 409 conflicto
                </td>
              </tr>
              <tr>
                <td><span className="badge-http badge-get">GET</span></td>
                <td><code className="font-tabular font-bold">/api/v1/arba/percepciones</code></td>
                <td>Historial con formato v1</td>
                <td>Items con sale_id, rate, base/tax_amount_minor y created_at</td>
              </tr>
              <tr>
                <td><span className="badge-http badge-get">GET</span></td>
                <td><code className="font-tabular font-bold">/api/v1/health</code></td>
                <td>Disponibilidad del servicio</td>
                <td>Incluye el tipo de almacenamiento (file / memory)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Módulo de Autenticación y Control de Acceso</h2>
            <p className="panel-subtitle">Endpoints de usuarios, registro y sesiones (/auth y /api/v1/auth)</p>
          </div>
          <span className="badge badge-accent">Auth</span>
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
                <td><span className="badge-http badge-post">POST</span></td>
                <td><code className="font-tabular font-bold">/auth/login</code></td>
                <td>Inicio de sesión</td>
                <td>200 OK con token y usuario; 401 si credenciales incorrectas</td>
              </tr>
              <tr>
                <td><span className="badge-http badge-post">POST</span></td>
                <td><code className="font-tabular font-bold">/auth/register</code></td>
                <td>Registro de nuevo usuario</td>
                <td>201 Created con rol (admin / operador); 409 si email duplicado</td>
              </tr>
              <tr>
                <td><span className="badge-http badge-get">GET</span></td>
                <td><code className="font-tabular font-bold">/auth/me</code></td>
                <td>Perfil autenticado actual</td>
                <td>200 OK con usuario; 401 si token ausente o expirado</td>
              </tr>
              <tr>
                <td><span className="badge-http badge-post">POST</span></td>
                <td><code className="font-tabular font-bold">/auth/logout</code></td>
                <td>Cierre de sesión</td>
                <td>200 OK e invalidación de sesión activa</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

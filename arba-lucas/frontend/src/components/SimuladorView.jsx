import React, { useState } from 'react';
import { apiUrl } from '../apiUrl';
import { formatCurrency, formatPercent, formatDecimal, formatCuit, generateSaleId } from '../utils/formatters';

export default function SimuladorView({ padron, onExecutePercepcion }) {
  const [idVenta, setIdVenta] = useState(generateSaleId());
  const [cuit, setCuit] = useState('');
  const [montoVenta, setMontoVenta] = useState('');
  const [cuitStatus, setCuitStatus] = useState(null);
  const [verifiedTaxpayer, setVerifiedTaxpayer] = useState(null);
  const [apiResponse, setApiResponse] = useState({
    status: 'En espera',
    body: '{\n  "mensaje": "Aguardando ejecución de cálculo..."\n}',
  });
  const [lastPayload, setLastPayload] = useState(null);

  const handleCuitSelect = (e) => {
    const selected = e.target.value;
    if (selected) {
      setCuit(selected);
      verifyCuit(selected);
    }
  };

  const verifyCuit = async (cuitToVerify) => {
    if (cuitToVerify.length !== 11) {
      setCuitStatus(null);
      setVerifiedTaxpayer(null);
      return;
    }
    try {
      const res = await fetch(apiUrl(`/arba/padron/${cuitToVerify}`));
      if (res.status === 200) {
        const data = await res.json();
        setVerifiedTaxpayer(data);
        setCuitStatus({ valid: true, text: `✓ Contribuyente en padrón: ${data.actividad} (${formatPercent(data.alicuota)})` });
      } else {
        setVerifiedTaxpayer(null);
        setCuitStatus({ valid: false, text: '✗ CUIT no registrado en el padrón (Devolverá 404 Not Found)' });
      }
    } catch {
      setCuitStatus({ valid: false, text: 'Error al verificar CUIT con el servidor' });
    }
  };

  const handleAutoFill = () => {
    const newId = generateSaleId();
    setIdVenta(newId);
    if (padron.length > 0) {
      const random = padron[Math.floor(Math.random() * padron.length)];
      setCuit(random.cuit);
      verifyCuit(random.cuit);
    }
    const montos = [5400, 10200, 24500, 89000, 150000];
    setMontoVenta(String(montos[Math.floor(Math.random() * montos.length)]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      id_venta: idVenta.trim(),
      cuit: cuit.trim(),
      monto_venta: parseFloat(montoVenta),
    };
    setLastPayload(payload);
    await runPercepcion(payload);
  };

  const runPercepcion = async (payload) => {
    setApiResponse({ status: 'Procesando...', body: 'Enviando petición POST /arba/percepciones...' });
    try {
      const res = await fetch(apiUrl('/arba/percepciones'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const statusText =
        res.status === 201 ? '201 Created (Nueva percepción)' :
        res.status === 200 ? '200 OK (Idempotente)' :
        res.status === 409 ? '409 Conflict' :
        res.status === 404 ? '404 Not Found' : `${res.status} Error`;

      setApiResponse({
        status: statusText,
        statusCode: res.status,
        body: JSON.stringify(data, null, 2),
      });

      if (onExecutePercepcion) onExecutePercepcion(res.status, data);
    } catch (err) {
      setApiResponse({ status: 'Error de red', statusCode: 500, body: JSON.stringify({ error: err.message }, null, 2) });
    }
  };

  const montoNum = parseFloat(montoVenta) || 0;
  const estimacionPercepcion = verifiedTaxpayer && montoNum > 0
    ? Math.round((montoNum * verifiedTaxpayer.alicuota + Number.EPSILON) * 100) / 100
    : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Simulador de percepciones</h1>
          <p className="page-subtitle">Liquidación y registro impositivo de IIBB para ventas recibidas desde el TPV (POST /arba/percepciones).</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleAutoFill}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            Generar datos de prueba
          </button>
        </div>
      </div>

      <div className="layout-columns-2">
        {/* Formulario */}
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Datos de la operación de venta</h2>
              <p className="panel-subtitle">Ingrese los parámetros normativos requeridos por la cátedra</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="form-standard">
            <div className="form-field">
              <label htmlFor="sim-id-venta" className="form-label">
                ID de Venta (Clave única de idempotencia) <span className="text-danger">*</span>
              </label>
              <div className="input-with-action">
                <input
                  type="text"
                  id="sim-id-venta"
                  className="form-input font-tabular"
                  placeholder="ej: venta-102938"
                  value={idVenta}
                  onChange={(e) => setIdVenta(e.target.value)}
                  required
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIdVenta(generateSaleId())}>
                  Nuevo ID
                </button>
              </div>
              <span className="field-hint">Mismo ID con idénticos datos devuelve 200 OK. Con datos distintos devuelve 409 Conflicto.</span>
            </div>

            <div className="form-field">
              <label htmlFor="sim-cuit" className="form-label">
                CUIT del Contribuyente <span className="text-danger">*</span>
              </label>
              <div className="form-cuit-group">
                <select className="form-select" value={cuit} onChange={handleCuitSelect}>
                  <option value="">-- Seleccionar de los contribuyentes registrados --</option>
                  {padron.map((p) => (
                    <option key={p.cuit} value={p.cuit}>
                      {formatCuit(p.cuit)} — {p.actividad} ({formatPercent(p.alicuota)})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  id="sim-cuit"
                  className="form-input font-tabular"
                  placeholder="30712345678"
                  maxLength={11}
                  value={cuit}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setCuit(val);
                    verifyCuit(val);
                  }}
                  required
                />
              </div>
              {cuitStatus && (
                <div className={`cuit-validation-status ${cuitStatus.valid ? 'cuit-status-valid' : 'cuit-status-invalid'}`}>
                  {cuitStatus.text}
                </div>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="sim-monto-venta" className="form-label">
                Monto de la Venta (ARS) <span className="text-danger">*</span>
              </label>
              <div className="input-prefix-wrap">
                <span className="input-prefix">$</span>
                <input
                  type="number"
                  id="sim-monto-venta"
                  className="form-input font-tabular"
                  placeholder="10200.00"
                  step="0.01"
                  min="0.01"
                  value={montoVenta}
                  onChange={(e) => setMontoVenta(e.target.value)}
                  required
                />
              </div>
              <span className="field-hint">Importe bruto gravado sobre el que se aplica la alícuota de IIBB.</span>
            </div>

            <div className="form-footer">
              <button type="submit" className="btn btn-primary">
                Calcular y registrar percepción
              </button>
            </div>
          </form>
        </div>

        {/* Liquidación estimada y respuesta técnica */}
        <div className="panel-stack">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Liquidación fiscal estimada</h2>
                <p className="panel-subtitle">Cálculo en tiempo real según alícuota del padrón</p>
              </div>
              <span className={`badge ${verifiedTaxpayer ? 'badge-success' : 'badge-neutral'}`}>
                {verifiedTaxpayer ? 'Contribuyente verificado' : 'Listo para calcular'}
              </span>
            </div>
            <div className="tax-breakdown-card">
              <div className="tax-row">
                <span className="tax-row-label">Actividad comercial:</span>
                <span className="tax-row-value font-medium">{verifiedTaxpayer ? verifiedTaxpayer.actividad : 'Sin seleccionar'}</span>
              </div>
              <div className="tax-row">
                <span className="tax-row-label">Alícuota aplicable:</span>
                <span className="tax-row-value font-tabular">
                  {verifiedTaxpayer ? `${formatPercent(verifiedTaxpayer.alicuota)} (${formatDecimal(verifiedTaxpayer.alicuota)})` : '0,00% (0.0000)'}
                </span>
              </div>
              <div className="tax-row">
                <span className="tax-row-label">Base imponible (Venta):</span>
                <span className="tax-row-value font-tabular font-medium">{formatCurrency(montoNum)}</span>
              </div>
              <div className="tax-divider" />
              <div className="tax-row tax-total-row">
                <span className="tax-total-label">Percepción IIBB calculada:</span>
                <span className="tax-total-value font-tabular text-success">{formatCurrency(estimacionPercepcion)}</span>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2 className="panel-title">Respuesta del servidor</h2>
                <p className="panel-subtitle">Inspección técnica de respuesta HTTP para auditoría de cátedra</p>
              </div>
              <span
                className={`badge ${
                  apiResponse.statusCode === 201 ? 'badge-success' :
                  apiResponse.statusCode === 200 ? 'badge-info' :
                  apiResponse.statusCode >= 400 ? 'badge-danger' : 'badge-neutral'
                }`}
              >
                {apiResponse.status}
              </span>
            </div>
            <div className="panel-body-padded">
              <pre className="json-code-box">{apiResponse.body}</pre>

              {lastPayload && (
                <div className="idempotence-test-box">
                  <div className="idempotence-title">Pruebas normativas de idempotencia:</div>
                  <div className="idempotence-btn-group">
                    <button className="btn btn-secondary btn-xs" onClick={() => runPercepcion(lastPayload)}>
                      Reintentar misma venta (200 OK)
                    </button>
                    <button
                      className="btn btn-danger-outline btn-xs"
                      onClick={() => runPercepcion({ ...lastPayload, monto_venta: lastPayload.monto_venta + 5000 })}
                    >
                      Mismo ID con monto distinto (409 Conflict)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

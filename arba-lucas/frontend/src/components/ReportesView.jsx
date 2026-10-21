import React, { useMemo } from 'react';
import { formatCurrency, formatPercent } from '../utils/formatters';

export default function ReportesView({ stats, padron }) {
  const activityDistribution = useMemo(() => {
    const map = {};
    padron.forEach((p) => {
      const act = p.actividad || 'General';
      if (!map[act]) {
        map[act] = { count: 0, alicuotas: [] };
      }
      map[act].count++;
      map[act].alicuotas.push(p.alicuota);
    });

    return Object.entries(map).map(([act, info]) => ({
      actividad: act,
      count: info.count,
      promedio: info.alicuotas.reduce((a, b) => a + b, 0) / info.alicuotas.length,
    }));
  }, [padron]);

  const tasaEfectiva = stats.totalVentas > 0
    ? ((stats.totalRecaudado / stats.totalVentas) * 100).toFixed(2).replace('.', ',')
    : '0,00';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reportes fiscales</h1>
          <p className="page-subtitle">Consolidado estadístico del módulo de recaudación provincial de Ingresos Brutos.</p>
        </div>
      </div>

      <div className="report-summary-cards">
        <div className="panel stat-report-box">
          <span className="report-label">Monto total transaccionado (Ventas TPV)</span>
          <span className="report-value font-tabular">{formatCurrency(stats.totalVentas ?? 0)}</span>
          <span className="report-caption">Base imponible bruta informada</span>
        </div>
        <div className="panel stat-report-box">
          <span className="report-label">Monto total retenido (Percepciones ARBA)</span>
          <span className="report-value font-tabular text-success">{formatCurrency(stats.totalRecaudado ?? 0)}</span>
          <span className="report-caption">Impuesto liquidado y registrado</span>
        </div>
        <div className="panel stat-report-box">
          <span className="report-label">Tasa efectiva de retención global</span>
          <span className="report-value font-tabular text-accent">{tasaEfectiva}%</span>
          <span className="report-caption">Relación recaudación / ventas</span>
        </div>
      </div>

      <div className="panel mt-4">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Estructura del Padrón por Actividad</h2>
            <p className="panel-subtitle">Distribución de contribuyentes registrados y tasas vigentes</p>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Actividad comercial</th>
                <th className="text-center">Cantidad de comercios</th>
                <th className="text-center">Alícuota representativa</th>
                <th className="text-center">Régimen aplicable</th>
              </tr>
            </thead>
            <tbody>
              {activityDistribution.length === 0 ? (
                <tr><td colSpan={4} className="table-empty-cell">Sin datos disponibles.</td></tr>
              ) : (
                activityDistribution.map((row) => (
                  <tr key={row.actividad}>
                    <td><strong>{row.actividad}</strong></td>
                    <td className="text-center font-tabular">{row.count}</td>
                    <td className="text-center font-tabular">
                      <span className="badge badge-info">{formatPercent(row.promedio)}</span>
                    </td>
                    <td className="text-center">
                      <span className="badge badge-neutral">Régimen General IIBB</span>
                    </td>
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

import React from 'react';
import { ArrowRight, ShoppingCart, Search, Calculator, Database, CheckCircle, FileText, Info } from 'lucide-react';

export function FlowDiagram() {
  const steps = [
    {
      num: '01',
      actor: 'TPV (Punto de Venta)',
      action: 'Envía CUIT y Monto',
      desc: 'POST /arba/percepciones con id_venta único.',
      icon: ShoppingCart,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10 border-sky-500/20',
    },
    {
      num: '02',
      actor: 'ARBA (Padrón)',
      action: 'Consulta Contribuyente',
      desc: 'Valida CUIT en padrón para obtener alícuota.',
      icon: Search,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      num: '03',
      actor: 'ARBA (Cálculo)',
      action: 'Aplica Alícuota Decimal',
      desc: 'monto_percepcion = round2(monto × alicuota).',
      icon: Calculator,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      num: '04',
      actor: 'ARBA (Persistencia)',
      action: 'Registra Percepción',
      desc: 'Almacena en tabla percepciones (SQLite).',
      icon: Database,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
    {
      num: '05',
      actor: 'TPV (Respuesta)',
      action: 'Recibe Resultado',
      desc: 'Código HTTP 201 (nuevo) o 200 (idempotente).',
      icon: CheckCircle,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      num: '06',
      actor: 'ARCA / Facturación',
      action: 'Emite Factura Final',
      desc: 'Incorpora el monto de percepción en el ticket/CAE.',
      icon: FileText,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
    },
  ];

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Ciclo de Vida de una Transacción Fintech
          </h2>
          <p className="text-xs text-slate-400">
            Flujo coordinado entre TPV, ARBA y el subsistema de facturación
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 text-[11px] text-slate-300 font-mono">
          <Info className="w-3.5 h-3.5 text-sky-400" />
          <span>Frontera de responsabilidades</span>
        </div>
      </div>

      {/* Steps Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className={`p-3.5 rounded-lg border ${step.bg} flex flex-col justify-between relative group hover:border-slate-700 transition-colors`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-slate-500 font-bold">{step.num}</span>
                  <Icon className={`w-4 h-4 ${step.color}`} />
                </div>
                <div className="text-[11px] font-semibold text-slate-300 mb-0.5">{step.actor}</div>
                <div className="text-xs font-bold text-white mb-1.5 leading-snug">{step.action}</div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-mono">{step.desc}</p>
              </div>

              {idx < steps.length - 1 && (
                <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-slate-600">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Regla clave */}
      <div className="mt-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs text-slate-300 flex items-start gap-2.5">
        <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 font-bold text-[10px]">
          ✓
        </div>
        <div className="leading-relaxed">
          <strong className="text-emerald-300">Delimitación del rol fiscal:</strong> ARBA{' '}
          <span className="text-white font-medium">únicamente calcula y registra</span> la percepción correspondiente a la provincia según la alícuota del padrón.{' '}
          <span className="text-slate-400">
            ARBA no cobra dinero (esa es función de la billetera o pasarela de pagos) ni emite facturas ni autoriza CAE (responsabilidad de ARCA / AFIP).
          </span>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Code2, BookOpen, Layers, CheckSquare } from 'lucide-react';

export function ApiContract() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-4 h-4 text-sky-400" />
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Contrato Técnico del Servicio REST
            </h2>
            <p className="text-xs text-slate-400">
              Especificación de endpoints, esquemas JSON, códigos de respuesta e idempotencia (Puerto 3003)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span>{isOpen ? 'Ocultar especificación' : 'Ver contrato'}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-5 border-t border-slate-800 space-y-6 bg-slate-950/40 text-xs">
          {/* Base URL & Arquitectura */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-mono block">Puerto Backend ARBA</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">:3003</span>
              <p className="text-[11px] text-slate-500 mt-1">Servicio Express + SQLite nativo.</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-mono block">Puerto Frontend Vite</span>
              <span className="text-sm font-bold text-sky-400 font-mono">:3000</span>
              <p className="text-[11px] text-slate-500 mt-1">Dashboard React con proxy a :3003.</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-mono block">Formato de Alícuota</span>
              <span className="text-sm font-bold text-amber-400 font-mono">Fracción Decimal</span>
              <p className="text-[11px] text-slate-500 mt-1">0.03 representa 3%, no se multiplica por 100.</p>
            </div>
          </div>

          {/* Tabla de Endpoints */}
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Matriz de Rutas Disponibles</span>
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left font-mono">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 text-[11px]">
                    <th className="py-2 px-3">Método</th>
                    <th className="py-2 px-3">Ruta</th>
                    <th className="py-2 px-3">Parámetros / Body</th>
                    <th className="py-2 px-3">Códigos HTTP</th>
                    <th className="py-2 px-3">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/60">
                  <tr>
                    <td className="py-2 px-3 text-emerald-400 font-bold">GET</td>
                    <td className="py-2 px-3 text-white">/health</td>
                    <td className="py-2 px-3 text-slate-500">—</td>
                    <td className="py-2 px-3 text-emerald-300">200</td>
                    <td className="py-2 px-3 text-slate-300 font-sans">Chequeo de salud del módulo</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-sky-400 font-bold">GET</td>
                    <td className="py-2 px-3 text-white">/arba/padron</td>
                    <td className="py-2 px-3 text-slate-300">?page=1&limit=10</td>
                    <td className="py-2 px-3 text-emerald-300">200, 400</td>
                    <td className="py-2 px-3 text-slate-300 font-sans">Listado paginado de contribuyentes</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-sky-400 font-bold">GET</td>
                    <td className="py-2 px-3 text-white">/arba/padron/{'{cuit}'}</td>
                    <td className="py-2 px-3 text-slate-300">cuit (11 dígitos)</td>
                    <td className="py-2 px-3 text-emerald-300">200, 400, 404</td>
                    <td className="py-2 px-3 text-slate-300 font-sans">Consulta de un contribuyente puntual</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-amber-400 font-bold">POST</td>
                    <td className="py-2 px-3 text-white">/arba/percepciones</td>
                    <td className="py-2 px-3 text-slate-300">{'{ id_venta, cuit, monto_venta }'}</td>
                    <td className="py-2 px-3 text-emerald-300">201, 200, 400, 404, 409</td>
                    <td className="py-2 px-3 text-slate-300 font-sans">Calcula y persiste percepción con idempotencia</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-purple-400 font-bold">GET</td>
                    <td className="py-2 px-3 text-white">/arba/percepciones/{'{cuit}'}</td>
                    <td className="py-2 px-3 text-slate-300">cuit (11 dígitos)</td>
                    <td className="py-2 px-3 text-emerald-300">200, 400</td>
                    <td className="py-2 px-3 text-slate-300 font-sans">Historial de auditoría para un CUIT</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Ejemplos de Request / Response */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                Ejemplo Request (POST /arba/percepciones)
              </h4>
              <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-emerald-400 font-mono text-[11px]">
{`{
  "id_venta": "venta-101",
  "cuit": "30712345678",
  "monto_venta": 10200.00
}`}
              </pre>
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 font-mono">
                Ejemplo Response 201 (Nueva Percepción)
              </h4>
              <pre className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-sky-400 font-mono text-[11px]">
{`{
  "id": "1",
  "id_venta": "venta-101",
  "cuit": "30712345678",
  "monto_venta": 10200,
  "alicuota_aplicada": 0.03,
  "monto_percepcion": 306,
  "fecha": "2026-10-14T12:00:00.000Z"
}`}
              </pre>
            </div>
          </div>

          {/* Tabla de Códigos HTTP & Reglas de Negocio */}
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 font-mono flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Reglas de Idempotencia y Códigos HTTP</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 font-mono">
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-emerald-400 font-bold block">HTTP 201</span>
                <span className="text-white font-semibold text-[11px] block mt-0.5">Creado</span>
                <p className="text-[10px] text-slate-400 mt-1 font-sans">Nueva percepción registrada en la base de datos.</p>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-sky-400 font-bold block">HTTP 200</span>
                <span className="text-white font-semibold text-[11px] block mt-0.5">Idempotente</span>
                <p className="text-[10px] text-slate-400 mt-1 font-sans">Mismo id_venta, CUIT y monto. Se devuelve el registro sin duplicar.</p>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-rose-400 font-bold block">HTTP 409</span>
                <span className="text-white font-semibold text-[11px] block mt-0.5">Conflicto</span>
                <p className="text-[10px] text-slate-400 mt-1 font-sans">El id_venta ya existe asociado a otro CUIT o monto.</p>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-amber-400 font-bold block">HTTP 404</span>
                <span className="text-white font-semibold text-[11px] block mt-0.5">No Encontrado</span>
                <p className="text-[10px] text-slate-400 mt-1 font-sans">El CUIT enviado no figura en el padrón provincial.</p>
              </div>
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                <span className="text-rose-400 font-bold block">HTTP 400</span>
                <span className="text-white font-semibold text-[11px] block mt-0.5">Invalidez</span>
                <p className="text-[10px] text-slate-400 mt-1 font-sans">Formato incorrecto en CUIT (no 11 dígitos), monto no positivo o id_venta vacío.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

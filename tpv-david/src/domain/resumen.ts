// Cálculos puros para el panel: sin Express ni base de datos.
// Los totales los calcula siempre el backend (nunca el navegador).

import { EstadoVenta, Venta } from "./venta";

const ZONA = "America/Argentina/Buenos_Aires";

// Fecha local (AAAA-MM-DD) de un instante ISO, en horario argentino.
export function diaLocal(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date(iso));
}

// Hora local (0-23) de un instante ISO, en horario argentino.
export function horaLocal(iso: string): number {
  const h = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    hour: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return Number(h) % 24;
}

export interface FiltroVentas {
  estado?: EstadoVenta;
  medioPago?: string;
  cuit?: string;
  desde?: string; // AAAA-MM-DD, inclusive
  hasta?: string; // AAAA-MM-DD, inclusive
}

export function filtrarVentas(ventas: Venta[], f: FiltroVentas): Venta[] {
  return ventas.filter((v) => {
    if (f.estado && v.estado !== f.estado) return false;
    if (f.medioPago && v.medioPago !== f.medioPago) return false;
    if (f.cuit && v.comercio.cuit !== f.cuit) return false;
    const dia = diaLocal(v.createdAt);
    if (f.desde && dia < f.desde) return false;
    if (f.hasta && dia > f.hasta) return false;
    return true;
  });
}

export interface ResumenPanel {
  actualizadoEn: string;
  ventasHoy: number;
  ventasAyer: number;
  totalCobradoHoy: number;
  ticketPromedioHoy: number;
  ventasConError: number;
  productoMasVendido: { descripcion: string; unidades: number } | null;
  ventasPorHora: Array<{ hora: number; total: number }>;
  ultimasVentas: Venta[];
}

function sumarDias(dia: string, delta: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function calcularResumen(ventas: Venta[], ahora: Date = new Date()): ResumenPanel {
  const hoy = diaLocal(ahora.toISOString());
  const ayer = sumarDias(hoy, -1);
  const hace7 = sumarDias(hoy, -6);

  const completadas = ventas.filter((v) => v.estado === "completada");
  const deHoy = completadas.filter((v) => diaLocal(v.createdAt) === hoy);
  const totalHoy = deHoy.reduce((a, v) => a + v.total, 0);

  // Producto más vendido en los últimos 7 días (hoy incluido)
  const unidades = new Map<string, number>();
  for (const v of completadas) {
    const d = diaLocal(v.createdAt);
    if (d < hace7 || d > hoy) continue;
    for (const it of v.items) {
      unidades.set(it.descripcion, (unidades.get(it.descripcion) ?? 0) + it.cantidad);
    }
  }
  let mas: ResumenPanel["productoMasVendido"] = null;
  for (const [descripcion, u] of unidades) {
    if (!mas || u > mas.unidades) mas = { descripcion, unidades: u };
  }

  const porHora = Array.from({ length: 24 }, (_, hora) => ({ hora, total: 0 }));
  for (const v of deHoy) porHora[horaLocal(v.createdAt)].total += v.total;

  const ultimas = [...ventas]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  return {
    actualizadoEn: ahora.toISOString(),
    ventasHoy: deHoy.length,
    ventasAyer: completadas.filter((v) => diaLocal(v.createdAt) === ayer).length,
    totalCobradoHoy: totalHoy,
    ticketPromedioHoy: deHoy.length ? Math.round(totalHoy / deHoy.length) : 0,
    ventasConError: ventas.filter((v) => v.estado === "error").length,
    productoMasVendido: mas,
    ventasPorHora: porHora,
    ultimasVentas: ultimas,
  };
}
// Chequea el estado de los servicios de los que depende (o va a depender)
// el TPV, para la sección "Conexiones" del panel. No forma parte del flujo
// de venta: es solo diagnóstico.

export type EstadoConexion = "simulado" | "conectado" | "sin_conexion";

export interface ServicioConfigurado {
  id: "municipio" | "arba" | "banco" | "billetera" | "arca";
  nombre: string;
  url: string;
  simulado: boolean;
}

export interface EstadoServicio {
  id: string;
  nombre: string;
  url: string;
  estado: EstadoConexion;
  tiempoRespuestaMs: number | null;
  verificadoEn: string;
}

const TIMEOUT_MS = 2500;

async function chequearSalud(url: string): Promise<{ ok: boolean; tiempoMs: number }> {
  const inicio = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    return { ok: res.ok, tiempoMs: Date.now() - inicio };
  } catch {
    return { ok: false, tiempoMs: Date.now() - inicio };
  } finally {
    clearTimeout(timer);
  }
}

export class ConexionesService {
  constructor(private readonly servicios: ServicioConfigurado[]) {}

  async verificarTodas(): Promise<EstadoServicio[]> {
    return Promise.all(
      this.servicios.map(async (s): Promise<EstadoServicio> => {
        const verificadoEn = new Date().toISOString();
        if (s.simulado) {
          return { id: s.id, nombre: s.nombre, url: s.url, estado: "simulado", tiempoRespuestaMs: null, verificadoEn };
        }
        const { ok, tiempoMs } = await chequearSalud(s.url);
        return {
          id: s.id,
          nombre: s.nombre,
          url: s.url,
          estado: ok ? "conectado" : "sin_conexion",
          tiempoRespuestaMs: tiempoMs,
          verificadoEn,
        };
      })
    );
  }
}
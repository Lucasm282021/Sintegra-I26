import { UpstreamUnavailableError } from "../domain/errors";

export interface ConsultaHabilitacion {
  cuit: string;
}

export interface Habilitacion {
  habilitado: boolean;
  rubro: string | null;
}

// Contrato ASUMIDO — el módulo de Municipio todavía no publicó el suyo.
// Nos basamos en el mismo patrón que ARBA/ARCA (POST con el cuit, 200/201 si
// está habilitado, 404 si no está en el padrón). Falta confirmarlo con el
// dueño del módulo de Municipio.
//
// Request esperado:
//   POST /municipio/habilitaciones/consultar
//   { "cuit": "20345678901" }
//
// Response esperado:
//   { "habilitado": true, "rubro": "Kiosco" }
export interface MunicipioClient {
  consultarHabilitacion(consulta: ConsultaHabilitacion): Promise<Habilitacion>;
}

export class HttpMunicipioClient implements MunicipioClient {
  constructor(private readonly baseUrl: string) {}

  async consultarHabilitacion(consulta: ConsultaHabilitacion): Promise<Habilitacion> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/municipio/habilitaciones/consultar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(consulta),
      });
    } catch {
      throw new UpstreamUnavailableError("municipio no disponible");
    }

    if (response.status === 200 || response.status === 201) {
      const data = (await response.json()) as { habilitado: boolean; rubro?: string | null };
      return { habilitado: data.habilitado, rubro: data.rubro ?? null };
    }

    if (response.status === 404) {
      return { habilitado: false, rubro: null };
    }

    throw new UpstreamUnavailableError("municipio no disponible");
  }
}

// Mock: todo CUIT que termine en dígito par queda habilitado, con un rubro
// fijo de ejemplo. Es solo para poder probar la pantalla de Comercios sin
// depender de que el módulo de Municipio esté levantado.
export class MockMunicipioClient implements MunicipioClient {
  async consultarHabilitacion(consulta: ConsultaHabilitacion): Promise<Habilitacion> {
    const ultimoDigito = Number(consulta.cuit.slice(-1));
    const habilitado = ultimoDigito % 2 === 0;
    console.log(
      `[municipio:mock] cuit ${consulta.cuit} → ${habilitado ? "habilitado" : "NO habilitado"} (simulado)`
    );
    return { habilitado, rubro: habilitado ? "Comercio minorista" : null };
  }
}
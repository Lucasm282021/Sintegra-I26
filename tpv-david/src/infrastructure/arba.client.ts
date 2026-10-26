import { PercepcionAplicada } from "../domain/venta";
import { UpstreamNotRegisteredError, UpstreamUnavailableError } from "../domain/errors";

export interface PedidoDePercepcion {
  id_venta: string;
  cuit: string;
  monto: number;
}

// Contrato asumido para /arba/percepciones. El panel de integración del
// equipo de ARBA documenta los códigos de respuesta:
//   - 201: percepción calculada y registrada por primera vez
//   - 200: la venta (id_venta) ya se había procesado antes → idempotente
//   - 404: el cuit no está en el padrón de ARBA
// El body exacto no está confirmado — esto es lo que asumimos.
//
// Request esperado:
//   POST /arba/percepciones
//   { "id_venta": "...", "cuit": "20345678901", "monto": 3800 }
//
// Response 200/201 esperado:
//   { "monto_percepcion": 190, "alicuota": 0.05 }
export interface ArbaClient {
  calcularPercepcion(pedido: PedidoDePercepcion): Promise<PercepcionAplicada>;
}

export class HttpArbaClient implements ArbaClient {
  constructor(private readonly baseUrl: string) {}

  async calcularPercepcion(pedido: PedidoDePercepcion): Promise<PercepcionAplicada> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/arba/percepciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pedido),
      });
    } catch {
      throw new UpstreamUnavailableError("arba no disponible");
    }

    if (response.status === 200 || response.status === 201) {
      const data = (await response.json()) as {
        monto_percepcion: number;
        alicuota: number;
      };
      return {
        montoPercepcion: data.monto_percepcion,
        alicuotaAplicada: data.alicuota,
      };
    }

    if (response.status === 404) {
      throw new UpstreamNotRegisteredError("comercio no encontrado en el padrón de ARBA");
    }

    if (response.status >= 400 && response.status < 500) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new UpstreamNotRegisteredError(data.error ?? "arba rechazó el cálculo de percepción");
    }

    throw new UpstreamUnavailableError("arba no disponible");
  }
}

// Mock para desarrollar/probar sin depender de que el servicio de ARBA esté
// levantado. Aplica una alícuota fija del 5% para simular la percepción.
export class MockArbaClient implements ArbaClient {
  private readonly ALICUOTA_SIMULADA = 0.05;

  async calcularPercepcion(pedido: PedidoDePercepcion): Promise<PercepcionAplicada> {
    const montoPercepcion = Math.round(pedido.monto * this.ALICUOTA_SIMULADA * 100) / 100;
    console.log(
      `[arba:mock] percepción simulada de $${montoPercepcion} (alícuota ${this.ALICUOTA_SIMULADA}) para cuit ${pedido.cuit}`
    );
    return { montoPercepcion, alicuotaAplicada: this.ALICUOTA_SIMULADA };
  }
}

import { PagoConfirmado } from "../domain/venta";
import { UpstreamRejectedError, UpstreamUnavailableError } from "../domain/errors";

export interface PedidoDePago {
  ventaId: string;
  cuit: string;
  monto: number;
  medioPago: string;
}

// Contrato asumido para /banco/pagos, siguiendo las reglas comunes (json, cuit
// sin guiones, errores {"error": "..."}). El handbook no especifica el body
// exacto — esto hay que confirmarlo con Rodrigo (dueño de Banco) apenas se pueda.
//
// Request esperado:
//   POST /banco/pagos
//   { "ventaId": "...", "cuit": "20345678901", "monto": 3800, "medioPago": "efectivo" }
//
// Response 201 esperado:
//   { "id": "...", "estado": "confirmado", "confirmadoEn": "2026-09-16T20:00:00.000Z" }
//
// Response 400/402 esperado (rechazo, ej. fondos insuficientes):
//   { "error": "saldo insuficiente" }
export interface BancoClient {
  pagar(pedido: PedidoDePago): Promise<PagoConfirmado>;
}

export interface PedidoDeBilletera {
  id_venta: string;
  cuit: string;
  comercio_cuit: string;
  monto: number;
  terminal_id: string;
}

export interface BilleteraClient {
  pagar(pedido: PedidoDeBilletera): Promise<PagoConfirmado>;
}

/** Cliente del contrato común. El Banco provisiona la billetera y el endpoint
 * común registra el débito, acredita la cuenta destino y notifica al terminal. */
export class HttpBilleteraClient implements BilleteraClient {
  constructor(private readonly baseUrl: string) {}

  async pagar(pedido: PedidoDeBilletera): Promise<PagoConfirmado> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/billetera/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pedido),
      });
    } catch {
      throw new UpstreamUnavailableError("billetera no disponible");
    }
    const data = (await response.json().catch(() => ({}))) as {
      movimiento?: { id?: string };
      id?: string;
      confirmadoEn?: string;
      error?: string;
      message?: string;
    };
    if (response.status === 200 || response.status === 201) {
      const id = data.movimiento?.id ?? data.id;
      if (!id) throw new UpstreamUnavailableError("billetera respondió sin referencia de pago");
      return { movimientoId: id, confirmadoEn: data.confirmadoEn ?? new Date().toISOString() };
    }
    if (response.status >= 400 && response.status < 500) {
      throw new UpstreamRejectedError(data.error ?? data.message ?? "pago rechazado por la billetera");
    }
    throw new UpstreamUnavailableError("billetera no disponible");
  }
}

/** Solo desarrollo aislado; nunca debe confundirse con un débito real. */
export class MockBilleteraClient implements BilleteraClient {
  async pagar(pedido: PedidoDeBilletera): Promise<PagoConfirmado> {
    console.log(`[billetera:mock] pago simulado de $${pedido.monto} para comercio ${pedido.comercio_cuit}`);
    return { movimientoId: `mock-wallet-${pedido.id_venta}`, confirmadoEn: new Date().toISOString() };
  }
}

export class HttpBancoClient implements BancoClient {
  constructor(private readonly baseUrl: string) {}

  async pagar(pedido: PedidoDePago): Promise<PagoConfirmado> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/banco/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pedido),
      });
    } catch {
      throw new UpstreamUnavailableError("banco no disponible");
    }

    if (response.status === 201 || response.status === 200) {
      const data = (await response.json()) as { id: string; confirmadoEn?: string };
      return {
        movimientoId: data.id,
        confirmadoEn: data.confirmadoEn ?? new Date().toISOString(),
      };
    }

    if (response.status >= 400 && response.status < 500) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new UpstreamRejectedError(data.error ?? "pago rechazado por el banco");
    }

    throw new UpstreamUnavailableError("banco no disponible");
  }
}

// Mock para desarrollar/probar sin depender de que el servicio de Banco esté
// levantado. Se activa con BANCO_MOCK=true en el .env.
export class MockBancoClient implements BancoClient {
  async pagar(pedido: PedidoDePago): Promise<PagoConfirmado> {
    console.log(`[banco:mock] cobrando $${pedido.monto} a cuit ${pedido.cuit} (simulado)`);
    return {
      movimientoId: `mock-${Date.now()}`,
      confirmadoEn: new Date().toISOString(),
    };
  }
}

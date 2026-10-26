import { ComprobanteEmitido } from "../domain/venta";
import { UpstreamNotRegisteredError, UpstreamRejectedError, UpstreamUnavailableError } from "../domain/errors";

export interface PedidoDeFactura {
  id_venta: string;
  cuit: string;
  razonSocial: string;
  monto: number; // total ya incluyendo la percepción de IIBB (calcularTotalFinal)
}

// Contrato asumido para /arca/comprobantes. El handbook oficial confirma las
// entidades (Comprobante: tipo, punto de venta, CAE, fecha) y el endpoint,
// pero NO el body exacto ni los códigos de error — eso queda pendiente de
// confirmar con quien termine construyendo este módulo.
//
// ⚠️ A la fecha de este código, ARCA figura como "módulo del profesor" con un
// conflicto de asignación sin resolver (Keving/Teo). Este cliente está pensado
// para quedarse en modo mock (ARCA_MOCK=true) más tiempo que Banco/ARBA.
//
// Request esperado:
//   POST /arca/comprobantes
//   { "id_venta": "...", "cuit": "20345678901", "razonSocial": "...", "monto": 3990 }
//
// Response 201 esperado:
//   { "cae": "...", "vencimiento_cae": "...", "tipo_comprobante": "B", "punto_venta": "0001", "numero": "123" }
//
// Response 404 esperado (cuit no está en el padrón de ARCA):
//   { "error": "contribuyente no encontrado" }
export interface ArcaClient {
  emitirComprobante(pedido: PedidoDeFactura): Promise<ComprobanteEmitido>;
}

export class HttpArcaClient implements ArcaClient {
  constructor(private readonly baseUrl: string) {}

  async emitirComprobante(pedido: PedidoDeFactura): Promise<ComprobanteEmitido> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/arca/comprobantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pedido),
      });
    } catch {
      throw new UpstreamUnavailableError("arca no disponible");
    }

    if (response.status === 200 || response.status === 201) {
      const data = (await response.json()) as {
        cae: string;
        vencimiento_cae: string;
        tipo_comprobante: string;
        punto_venta: string;
        numero: string;
      };
      return {
        cae: data.cae,
        vencimientoCae: data.vencimiento_cae,
        tipoComprobante: data.tipo_comprobante,
        puntoVenta: data.punto_venta,
        numero: data.numero,
      };
    }

    if (response.status === 404) {
      throw new UpstreamNotRegisteredError("comercio no encontrado en el padrón de ARCA");
    }

    if (response.status >= 400 && response.status < 500) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new UpstreamRejectedError(data.error ?? "arca rechazó la emisión del comprobante");
    }

    throw new UpstreamUnavailableError("arca no disponible");
  }
}

// Mock para desarrollar/probar sin depender de que exista un servicio real de
// ARCA (a la fecha, ni siquiera hay un dueño confirmado del módulo). Genera un
// CAE y numeración falsos, con vencimiento a 10 días.
export class MockArcaClient implements ArcaClient {
  private contador = 1;

  async emitirComprobante(pedido: PedidoDeFactura): Promise<ComprobanteEmitido> {
    const vencimiento = new Date();
    vencimiento.setDate(vencimiento.getDate() + 10);

    const comprobante: ComprobanteEmitido = {
      cae: `MOCK${Date.now()}`,
      vencimientoCae: vencimiento.toISOString().slice(0, 10),
      tipoComprobante: "B",
      puntoVenta: "0001",
      numero: String(this.contador++).padStart(8, "0"),
    };

    console.log(
      `[arca:mock] comprobante simulado ${comprobante.tipoComprobante} ${comprobante.puntoVenta}-${comprobante.numero} por $${pedido.monto} (cuit ${pedido.cuit})`
    );
    return comprobante;
  }
}

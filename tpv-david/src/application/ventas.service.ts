import { randomUUID } from "crypto";
import {
  calcularTotal,
  calcularTotalFinal,
  esCantidadValida,
  esCuitValido,
  esMedioPagoValido,
  ItemVenta,
  NuevaVentaInput,
  Venta,
} from "../domain/venta";
import {
  ConflictError,
  NotFoundError,
  UpstreamNotRegisteredError,
  UpstreamRejectedError,
  UpstreamUnavailableError,
  ValidationError,
} from "../domain/errors";
import { VentaRepository } from "../infrastructure/venta.repository";
import { ProductoRepository } from "../infrastructure/producto.repository";
import { BancoClient } from "../infrastructure/banco.client";
import { ArbaClient } from "../infrastructure/arba.client";
import { ArcaClient } from "../infrastructure/arca.client";

// Errores "conocidos" de integraciones externas: los dejamos pasar tal cual
// para que la capa HTTP les asigne el status correcto. Cualquier otro error
// se trata como desconocido.
function esErrorDeIntegracionConocido(err: unknown): boolean {
  return (
    err instanceof UpstreamRejectedError ||
    err instanceof UpstreamUnavailableError ||
    err instanceof UpstreamNotRegisteredError
  );
}

export class VentasService {
  constructor(
    private readonly repo: VentaRepository,
    private readonly productoRepo: ProductoRepository,
    private readonly bancoClient: BancoClient,
    private readonly arbaClient: ArbaClient,
    private readonly arcaClient: ArcaClient
  ) {}

  async crear(input: NuevaVentaInput): Promise<Venta> {
    await this.validar(input);

    // Resolvemos cada productoId contra el catálogo: el nombre y el precio
    // salen de ahí, nunca del request.
    const items: ItemVenta[] = [];
    for (const itemInput of input.items) {
      const producto = await this.productoRepo.findById(itemInput.productoId);
      if (!producto) {
        throw new NotFoundError(`producto ${itemInput.productoId} no encontrado en el catálogo`);
      }
      items.push({
        productoId: producto.id,
        descripcion: producto.nombre,
        cantidad: itemInput.cantidad,
        precioUnitario: producto.precio,
      });
    }

    const venta: Venta = {
      id: randomUUID(),
      comercio: input.comercio,
      items,
      total: calcularTotal(items),
      medioPago: input.medioPago,
      estado: "pendiente_cobro",
      createdAt: new Date().toISOString(),
    };

    return this.procesar(venta);
  }

  // Reintenta una venta que quedó en "error". NO revierte nada: retoma desde
  // el primer paso que todavía no se confirmó (recuperación hacia adelante).
  // Se reusa el mismo id de venta en cada llamada, para que Banco/ARBA/ARCA
  // puedan reconocer el pedido repetido y no duplicarlo.
  async reintentar(id: string): Promise<Venta> {
    const venta = await this.obtenerPorId(id);
    if (venta.estado !== "error") {
      throw new ConflictError(
        `solo se pueden reintentar ventas en estado error (estado actual: ${venta.estado})`
      );
    }
    venta.estado = venta.percepcion ? "percibida" : venta.pago ? "cobrada" : "pendiente_cobro";
    venta.errorDetalle = undefined;
    return this.procesar(venta);
  }

  // Orquesta los pasos y se saltea los que ya están confirmados.
  private async procesar(venta: Venta): Promise<Venta> {
    // --- Paso 2: cobro contra Banco ---
    if (!venta.pago) {
      try {
        const pago = await this.bancoClient.pagar({
          ventaId: venta.id,
          cuit: venta.comercio.cuit,
          monto: venta.total,
          medioPago: venta.medioPago,
        });
        venta.estado = "cobrada";
        venta.pago = pago;
        await this.repo.save(venta);
      } catch (err) {
        venta.estado = "error";
        venta.errorDetalle = esErrorDeIntegracionConocido(err)
          ? (err as Error).message
          : "error desconocido al cobrar la venta";
        await this.repo.save(venta);
        throw err;
      }
    }

    // --- Paso 3: percepción de IIBB contra ARBA ---
    // Si esto falla, el cobro de Banco YA SE HIZO. No hay reversa automática:
    // la venta queda en "error" y se retoma con reintentar().
    if (!venta.percepcion) {
      try {
        const percepcion = await this.arbaClient.calcularPercepcion({
          id_venta: venta.id,
          cuit: venta.comercio.cuit,
          monto: venta.total,
        });
        venta.estado = "percibida";
        venta.percepcion = percepcion;
        await this.repo.save(venta);
      } catch (err) {
        venta.estado = "error";
        venta.errorDetalle = esErrorDeIntegracionConocido(err)
          ? `pago ya confirmado, pero falló el cálculo de percepción: ${(err as Error).message}`
          : "error desconocido al calcular la percepción (pago ya confirmado)";
        await this.repo.save(venta);
        throw err;
      }
    }

    // --- Paso 4: emisión de comprobante contra ARCA ---
    try {
      const factura = await this.arcaClient.emitirComprobante({
        id_venta: venta.id,
        cuit: venta.comercio.cuit,
        razonSocial: venta.comercio.razonSocial,
        monto: calcularTotalFinal(venta),
      });
      venta.estado = "completada";
      venta.factura = factura;
      await this.repo.save(venta);
      return venta;
    } catch (err) {
      venta.estado = "error";
      venta.errorDetalle = esErrorDeIntegracionConocido(err)
        ? `pago y percepción ya confirmados, pero falló la emisión del comprobante: ${(err as Error).message}`
        : "error desconocido al emitir el comprobante (pago y percepción ya confirmados)";
      await this.repo.save(venta);
      throw err;
    }
  }

  async obtenerPorId(id: string): Promise<Venta> {
    const venta = await this.repo.findById(id);
    if (!venta) {
      throw new NotFoundError("venta no encontrada");
    }
    return venta;
  }

  private async validar(input: NuevaVentaInput): Promise<void> {
    if (!input.comercio || !esCuitValido(input.comercio.cuit)) {
      throw new ValidationError(
        "comercio.cuit inválido: debe ser un string de 11 dígitos, sin puntos ni guiones"
      );
    }
    if (!input.comercio.razonSocial || typeof input.comercio.razonSocial !== "string") {
      throw new ValidationError("comercio.razonSocial es requerido");
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new ValidationError("items debe ser un array con al menos un elemento");
    }
    for (const item of input.items) {
      if (!item.productoId || typeof item.productoId !== "string") {
        throw new ValidationError("cada item requiere un productoId");
      }
      if (!esCantidadValida(item.cantidad)) {
        throw new ValidationError("cada item requiere una cantidad numérica mayor a 0");
      }
    }
    if (!esMedioPagoValido(input.medioPago)) {
      throw new ValidationError(
        "medioPago inválido: debe ser efectivo, tarjeta, transferencia o billetera_virtual"
      );
    }
  }
}
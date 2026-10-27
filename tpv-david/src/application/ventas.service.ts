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
import { calcularResumen, filtrarVentas, FiltroVentas, ResumenPanel } from "../domain/resumen";
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
  // el primer paso que todavía no se confirmó
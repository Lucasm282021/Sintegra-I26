// Implementaciones de los repositorios sobre el backend común de Sintegra
// (https://sintegra-backend.vercel.app). Con TPV_BACKEND_URL configurada, el
// catálogo, los comercios y las ventas de este TPV viven en la base compartida
// (tpv.*) y la venta se procesa con el motor común: cobro en Banco, IVA y
// factura en ARCA, percepción en ARBA. Ver doc/IMPUESTOS-Y-PERCEPCIONES.md.
import { Comercio } from "../domain/comercio";
import { Producto } from "../domain/producto";
import { EstadoVenta, MedioPago, Venta } from "../domain/venta";
import { NotFoundError, UpstreamRejectedError, UpstreamUnavailableError, ValidationError } from "../domain/errors";
import { ComercioRepository } from "./comercio.repository";
import { ListarOpciones, ListarResultado, ProductoRepository } from "./producto.repository";
import { VentaRepository } from "./venta.repository";

export interface BackendConfig {
  url: string;          // p. ej. https://sintegra-backend.vercel.app
  terminalId: string;   // terminal de este TPV en tpv.terminales
  comercioCuit: string; // comercio cuyo catálogo muestra la caja
}

export class BackendTpv {
  constructor(readonly cfg: BackendConfig) {}

  async pedir<T>(ruta: string, init?: { method?: string; body?: unknown }): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.cfg.url.replace(/\/$/, "")}${ruta}`, {
        method: init?.method ?? "GET",
        headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}) },
        body: init?.body ? JSON.stringify(init.body) : undefined,
      });
    } catch {
      throw new UpstreamUnavailableError("el backend común no responde");
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 404) throw new NotFoundError(data.error ?? "no encontrado");
    if (res.status === 400) throw new ValidationError(data.error ?? "datos inválidos");
    if (res.status >= 400 && res.status < 500) throw new UpstreamRejectedError(data.error ?? `rechazado (${res.status})`);
    if (!res.ok) throw new UpstreamUnavailableError(data.error ?? "el backend común no responde");
    return data as T;
  }
}

// ---------- Productos ----------
interface ProductoBackend { id: string; nombre: string; precio: number; codigo?: string | null; comercio_cuit: string }
const aProducto = (p: ProductoBackend): Producto => ({ id: p.id, nombre: p.nombre, precio: Number(p.precio), ...(p.codigo ? { codigo: p.codigo } : {}) });

export class BackendProductoRepository implements ProductoRepository {
  constructor(private readonly api: BackendTpv) {}

  private async todos(): Promise<Producto[]> {
    const { terminalId, comercioCuit } = this.api.cfg;
    const lista = await this.api.pedir<ProductoBackend[]>(`/tpv/productos?terminal_id=${encodeURIComponent(terminalId)}&cuit=${comercioCuit}`);
    return lista.filter((p) => p.comercio_cuit === comercioCuit).map(aProducto);
  }
  async save(producto: Producto): Promise<Producto> {
    const p = await this.api.pedir<ProductoBackend>("/tpv/productos", { method: "POST", body: {
      terminal_id: this.api.cfg.terminalId, comercio_cuit: this.api.cfg.comercioCuit,
      nombre: producto.nombre, precio: producto.precio, codigo: producto.codigo } });
    return aProducto(p);
  }
  async saveMany(productos: Producto[]): Promise<Producto[]> {
    const out: Producto[] = [];
    for (const p of productos) out.push(await this.save(p));
    return out;
  }
  async findById(id: string): Promise<Producto | null> {
    return (await this.todos()).find((p) => p.id === id) ?? null;
  }
  async findAll({ page, limit }: ListarOpciones): Promise<ListarResultado> {
    const todos = await this.todos();
    return { productos: todos.slice((page - 1) * limit, page * limit), total: todos.length, page, limit };
  }
}

// ---------- Comercios ----------
interface ComercioBackend { cuit: string; razon_social: string; rubro: string | null; activo: boolean }
export class BackendComercioRepository implements ComercioRepository {
  constructor(private readonly api: BackendTpv) {}
  async save(comercio: Comercio): Promise<Comercio> {
    await this.api.pedir("/tpv/comercios", { method: "POST", body: {
      terminal_id: this.api.cfg.terminalId, cuit: comercio.cuit, razon_social: comercio.razonSocial, rubro: comercio.rubro ?? undefined } });
    return comercio;
  }
  async findByCuit(cuit: string): Promise<Comercio | null> {
    return (await this.findAll()).find((c) => c.cuit === cuit) ?? null;
  }
  async findAll(): Promise<Comercio[]> {
    const lista = await this.api.pedir<ComercioBackend[]>(`/tpv/comercios?terminal_id=${encodeURIComponent(this.api.cfg.terminalId)}`);
    // La habilitación municipal ya se exige al vincular el comercio con la terminal.
    return lista.map((c) => ({ cuit: c.cuit, razonSocial: c.razon_social, rubro: c.rubro, habilitado: c.activo, verificadoEn: new Date().toISOString() }));
  }
}

// ---------- Ventas ----------
interface VentaBackend {
  id_venta: string; comercio_cuit: string; razon_social: string; estado: string; medio_pago: string; medio_detalle: string | null;
  creado_en: string; subtotal: number; percepcion: number | null; ref_pago: string | null; alicuota_percepcion: number | null;
  cuit_cliente: string | null; lineas: { producto_id: string; nombre: string; cantidad: number; precio_unitario: number }[];
  comprobante: { tipo_comprobante: string; punto_venta: string; numero: string; cae: string; vencimiento_cae: string } | null;
}
const ESTADOS: Record<string, EstadoVenta> = { completada: "completada", error: "error", pendiente: "pendiente_cobro", cobrada: "cobrada", percibida: "percibida" };
const MEDIOS: MedioPago[] = ["efectivo", "tarjeta", "transferencia", "billetera_virtual"];

export function aVenta(v: VentaBackend): Venta {
  const medio = (v.medio_detalle === "billetera" ? "billetera_virtual" : v.medio_detalle) as MedioPago;
  return {
    id: v.id_venta,
    comercio: { cuit: v.comercio_cuit, razonSocial: v.razon_social },
    items: v.lineas.map((l) => ({ productoId: l.producto_id, descripcion: l.nombre, cantidad: l.cantidad, precioUnitario: l.precio_unitario })),
    total: v.subtotal,
    medioPago: MEDIOS.includes(medio) ? medio : v.medio_pago === "billetera" ? "billetera_virtual" : "transferencia",
    ...(v.cuit_cliente ? { cuitCliente: v.cuit_cliente } : {}),
    estado: ESTADOS[v.estado] ?? "error",
    createdAt: v.creado_en,
    ...(v.ref_pago ? { pago: { movimientoId: v.ref_pago, confirmadoEn: v.creado_en } } : {}),
    ...(v.percepcion !== null ? { percepcion: { montoPercepcion: Number(v.percepcion), alicuotaAplicada: Number(v.alicuota_percepcion ?? 0) } } : {}),
    ...(v.comprobante ? { factura: { cae: v.comprobante.cae, vencimientoCae: v.comprobante.vencimiento_cae,
      tipoComprobante: v.comprobante.tipo_comprobante, puntoVenta: v.comprobante.punto_venta, numero: v.comprobante.numero } } : {}),
  };
}

export class BackendVentaRepository implements VentaRepository {
  constructor(private readonly api: BackendTpv) {}
  // El backend ya guardó la venta al procesarla: no hay nada que escribir acá.
  async save(venta: Venta): Promise<Venta> { return venta; }
  async findById(id: string): Promise<Venta | null> {
    const r = await this.api.pedir<VentaBackend[]>(`/tpv/ventas?detalle=1&terminal_id=${encodeURIComponent(this.api.cfg.terminalId)}&id_venta=${encodeURIComponent(id)}`);
    return r[0] ? aVenta(r[0]) : null;
  }
  async findAll(): Promise<Venta[]> {
    return (await this.api.pedir<VentaBackend[]>(`/tpv/ventas?detalle=1&terminal_id=${encodeURIComponent(this.api.cfg.terminalId)}`)).map(aVenta);
  }
}

// Procesa la venta con el motor común (una sola transacción en el backend).
export async function checkoutEnBackend(api: BackendTpv, venta: Venta): Promise<Venta> {
  await api.pedir("/tpv/ventas", { method: "POST", body: {
    id_venta: venta.id, terminal_id: api.cfg.terminalId, comercio_cuit: venta.comercio.cuit,
    medio_pago: venta.medioPago, cuit_cliente: venta.cuitCliente || undefined,
    items: venta.items.map((i) => ({ producto_id: i.productoId, cantidad: i.cantidad })),
  } });
  const guardada = await new BackendVentaRepository(api).findById(venta.id);
  if (!guardada) throw new UpstreamUnavailableError("la venta no quedó registrada en el backend común");
  return guardada;
}

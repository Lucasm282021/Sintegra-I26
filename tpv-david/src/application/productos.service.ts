import { randomUUID } from "crypto";
import { esProductoInputValido, NuevoProductoInput, Producto } from "../domain/producto";
import { NotFoundError, ValidationError } from "../domain/errors";
import { ListarResultado, ProductoRepository } from "../infrastructure/producto.repository";

export class ProductosService {
  constructor(private readonly repo: ProductoRepository) {}

  async crear(input: NuevoProductoInput): Promise<Producto> {
    const error = esProductoInputValido(input);
    if (error) {
      throw new ValidationError(error);
    }
    const producto: Producto = {
      id: randomUUID(),
      nombre: input.nombre,
      precio: input.precio,
      codigo: input.codigo,
    };
    return this.repo.save(producto);
  }

  // Carga masiva: pensado para cuando el comercio tiene muchos productos y no
  // tiene sentido cargarlos uno por uno con N requests distintos.
  async crearVarios(inputs: NuevoProductoInput[]): Promise<Producto[]> {
    if (!Array.isArray(inputs) || inputs.length === 0) {
      throw new ValidationError("se requiere un array con al menos un producto");
    }
    for (const input of inputs) {
      const error = esProductoInputValido(input);
      if (error) {
        throw new ValidationError(`producto inválido (${input?.nombre ?? "sin nombre"}): ${error}`);
      }
    }
    const productos: Producto[] = inputs.map((input) => ({
      id: randomUUID(),
      nombre: input.nombre,
      precio: input.precio,
      codigo: input.codigo,
    }));
    return this.repo.saveMany(productos);
  }

  async listar(page: number, limit: number): Promise<ListarResultado> {
    return this.repo.findAll({ page, limit });
  }

  async obtenerPorId(id: string): Promise<Producto> {
    const producto = await this.repo.findById(id);
    if (!producto) {
      throw new NotFoundError("producto no encontrado");
    }
    return producto;
  }
}

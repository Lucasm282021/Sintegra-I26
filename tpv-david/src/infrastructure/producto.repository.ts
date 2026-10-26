import path from "path";
import { Producto } from "../domain/producto";
import { JsonFileStore } from "./json-file-store";

export interface ListarOpciones {
  page: number;
  limit: number;
}

export interface ListarResultado {
  productos: Producto[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductoRepository {
  save(producto: Producto): Promise<Producto>;
  saveMany(productos: Producto[]): Promise<Producto[]>;
  findById(id: string): Promise<Producto | null>;
  findAll(opciones: ListarOpciones): Promise<ListarResultado>;
}

function paginar(todos: Producto[], { page, limit }: ListarOpciones): ListarResultado {
  const inicio = (page - 1) * limit;
  return {
    productos: todos.slice(inicio, inicio + limit),
    total: todos.length,
    page,
    limit,
  };
}

// Implementación en memoria. Se pierde al reiniciar el proceso.
export class InMemoryProductoRepository implements ProductoRepository {
  private readonly productos = new Map<string, Producto>();

  async save(producto: Producto): Promise<Producto> {
    this.productos.set(producto.id, producto);
    return producto;
  }

  async saveMany(productos: Producto[]): Promise<Producto[]> {
    for (const producto of productos) {
      this.productos.set(producto.id, producto);
    }
    return productos;
  }

  async findById(id: string): Promise<Producto | null> {
    return this.productos.get(id) ?? null;
  }

  async findAll(opciones: ListarOpciones): Promise<ListarResultado> {
    return paginar(Array.from(this.productos.values()), opciones);
  }
}

// Implementación en archivo JSON (data/productos.json) — la que usa el
// servicio por defecto.
export class FileProductoRepository implements ProductoRepository {
  private readonly store = new JsonFileStore<Producto>(
    path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "productos.json")
  );

  async save(producto: Producto): Promise<Producto> {
    this.store.set(producto.id, producto);
    return producto;
  }

  async saveMany(productos: Producto[]): Promise<Producto[]> {
    this.store.setMany(productos.map((p) => [p.id, p] as [string, Producto]));
    return productos;
  }

  async findById(id: string): Promise<Producto | null> {
    return this.store.get(id);
  }

  async findAll(opciones: ListarOpciones): Promise<ListarResultado> {
    return paginar(this.store.values(), opciones);
  }
}

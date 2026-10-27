import path from "path";
import { Venta } from "../domain/venta";
import { JsonFileStore } from "./json-file-store";

// Interfaz del repositorio: la capa de aplicación depende de esto, no de la
// implementación concreta. Así, cambiar a SQLite/Postgres más adelante no
// rompe nada fuera de este archivo.
export interface VentaRepository {
  save(venta: Venta): Promise<Venta>;
  findById(id: string): Promise<Venta | null>;
  findAll(): Promise<Venta[]>;
}

// Implementación en memoria — útil para tests rápidos o para correr sin
// tocar el disco. Se pierde al reiniciar el proceso.
export class InMemoryVentaRepository implements VentaRepository {
  private readonly ventas = new Map<string, Venta>();

  async save(venta: Venta): Promise<Venta> {
    this.ventas.set(venta.id, venta);
    return venta;
  }

  async findById(id: string): Promise<Venta | null> {
    return this.ventas.get(id) ?? null;
  }

  async findAll(): Promise<Venta[]> {
    return Array.from(this.ventas.values());
  }
}

// Implementación en archivo JSON (data/ventas.json). Esta es la que usa el
// servicio por defecto: sobrevive a un reinicio del proceso o del contenedor
// (si el volumen de data/ está montado).
export class FileVentaRepository implements VentaRepository {
  private readonly store = new JsonFileStore<Venta>(
    path.join(process.cwd(), "data", "ventas.json")
  );

  async save(venta: Venta): Promise<Venta> {
    this.store.set(venta.id, venta);
    return venta;
  }

  async findById(id: string): Promise<Venta | null> {
    return this.store.get(id);
  }

  async findAll(): Promise<Venta[]> {
    return this.store.values();
  }
}
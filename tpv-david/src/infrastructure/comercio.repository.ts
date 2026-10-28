import path from "path";
import { Comercio } from "../domain/comercio";
import { JsonFileStore } from "./json-file-store";

export interface ComercioRepository {
  save(comercio: Comercio): Promise<Comercio>;
  findByCuit(cuit: string): Promise<Comercio | null>;
  findAll(): Promise<Comercio[]>;
}

// Implementación en memoria. Se pierde al reiniciar el proceso.
export class InMemoryComercioRepository implements ComercioRepository {
  private readonly comercios = new Map<string, Comercio>();

  async save(comercio: Comercio): Promise<Comercio> {
    this.comercios.set(comercio.cuit, comercio);
    return comercio;
  }

  async findByCuit(cuit: string): Promise<Comercio | null> {
    return this.comercios.get(cuit) ?? null;
  }

  async findAll(): Promise<Comercio[]> {
    return Array.from(this.comercios.values());
  }
}

// Implementación en archivo JSON (data/comercios.json) — la que usa el
// servicio por defecto. La clave es el cuit, así que dar de alta el mismo
// comercio dos veces actualiza (re-verifica) en vez de duplicar.
export class FileComercioRepository implements ComercioRepository {
  private readonly store = new JsonFileStore<Comercio>(
    path.join(process.cwd(), "data", "comercios.json")
  );

  async save(comercio: Comercio): Promise<Comercio> {
    this.store.set(comercio.cuit, comercio);
    return comercio;
  }

  async findByCuit(cuit: string): Promise<Comercio | null> {
    return this.store.get(cuit);
  }

  async findAll(): Promise<Comercio[]> {
    return this.store.values();
  }
}
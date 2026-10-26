import fs from "fs";
import path from "path";

// Store genérico clave-valor persistido en un archivo JSON en disco.
// No es una base de datos real (sin índices, sin transacciones, sin
// concurrencia segura) — es la opción más simple que evita perder todo al
// reiniciar el proceso, sin agregar dependencias nativas ni un motor de DB.
// Para producción real, esto es lo primero que se reemplazaría por
// SQLite/Postgres (la interfaz de los repositorios ya está pensada para eso).
export class JsonFileStore<T> {
  private cache: Map<string, T> | null = null;

  constructor(private readonly filePath: string) {}

  private ensureLoaded(): Map<string, T> {
    if (this.cache) return this.cache;
    if (fs.existsSync(this.filePath)) {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const obj = raw.trim() ? JSON.parse(raw) : {};
      this.cache = new Map(Object.entries(obj) as [string, T][]);
    } else {
      this.cache = new Map();
    }
    return this.cache;
  }

  private persist(): void {
    const map = this.ensureLoaded();
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const obj = Object.fromEntries(map.entries());
    fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), "utf-8");
  }

  get(id: string): T | null {
    return this.ensureLoaded().get(id) ?? null;
  }

  set(id: string, value: T): void {
    this.ensureLoaded().set(id, value);
    this.persist();
  }

  setMany(entries: Array<[string, T]>): void {
    const map = this.ensureLoaded();
    for (const [id, value] of entries) map.set(id, value);
    this.persist();
  }

  values(): T[] {
    return Array.from(this.ensureLoaded().values());
  }
}

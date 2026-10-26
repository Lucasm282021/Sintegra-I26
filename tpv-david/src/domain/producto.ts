// Entidad de catálogo. Se carga una vez y se reutiliza en muchas ventas —
// por eso vive separada de Venta, no adentro.

export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  codigo?: string; // código interno del comercio, opcional
}

export interface NuevoProductoInput {
  nombre: string;
  precio: number;
  codigo?: string;
}

export function esProductoInputValido(input: NuevoProductoInput): string | null {
  if (!input.nombre || typeof input.nombre !== "string") {
    return "nombre es requerido";
  }
  if (typeof input.precio !== "number" || input.precio < 0) {
    return "precio debe ser un número mayor o igual a 0";
  }
  if (input.codigo !== undefined && typeof input.codigo !== "string") {
    return "codigo debe ser un string";
  }
  return null;
}

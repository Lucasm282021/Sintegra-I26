// Entidad de comercio: los que venden con esta terminal de TPV.
// Se da de alta por CUIT y se consulta la habilitación municipal antes de
// permitir que venda (ver ComerciosService).

export interface Comercio {
  cuit: string;
  razonSocial: string;
  rubro: string | null;
  habilitado: boolean;
  verificadoEn: string;
}

export interface NuevoComercioInput {
  cuit: string;
  razonSocial: string;
}

export function esComercioInputValido(input: NuevoComercioInput): string | null {
  if (!input || typeof input.cuit !== "string" || !/^\d{11}$/.test(input.cuit)) {
    return "cuit inválido: debe ser un string de 11 dígitos, sin puntos ni guiones";
  }
  if (!input.razonSocial || typeof input.razonSocial !== "string") {
    return "razonSocial es requerida";
  }
  return null;
}
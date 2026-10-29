/**
 * El proveedor de pago no permitió saber con certeza si el cobro se realizó.
 * Nunca debe reintentarse automáticamente: requiere conciliación manual.
 */
export class PagoIndeterminadoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PagoIndeterminadoError';
  }
}

/**
 * El proveedor respondió de forma explícita que rechazó el pago.
 * No hubo cobro, por lo que el reintento puede volver a intentar el pago.
 */
export class PagoRechazadoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PagoRechazadoError';
  }
}

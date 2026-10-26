// Errores de dominio. Cada uno sabe con qué status HTTP debería traducirse,
// pero no sabe nada de Express: eso lo resuelve la capa de interfaces/http.

export class AppError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

// El módulo externo (Banco, ARBA, ARCA) respondió, pero rechazó la operación
// (ej: fondos insuficientes). Es un error del negocio, no de nuestro código.
export class UpstreamRejectedError extends AppError {
  constructor(message: string) {
    super(message, 402);
  }
}

// El comercio no está registrado en el padrón del organismo externo
// (ej. ARBA/ARCA no tienen el CUIT dado de alta). Es un problema de datos, no de red.
export class UpstreamNotRegisteredError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}

// El módulo externo no respondió (caído, timeout, red). Distinto del rechazo:
// acá no sabemos si la operación hubiera sido válida o no.
export class UpstreamUnavailableError extends AppError {
  constructor(message: string) {
    super(message, 503);
  }
}

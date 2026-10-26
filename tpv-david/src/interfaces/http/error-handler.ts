import { NextFunction, Request, Response } from "express";
import { AppError } from "../../domain/errors";

// Traduce errores de dominio (y cualquier error inesperado) al formato que
// exige el contrato común: { "error": "mensaje" } + status 4xx/5xx.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error("Error inesperado:", err);
  res.status(500).json({ error: "error interno del servidor" });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: "recurso no encontrado" });
}

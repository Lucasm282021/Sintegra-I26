import { Router } from "express";
import { EstadoVenta } from "../../domain/venta";
import { VentasService } from "../../application/ventas.service";

export function buildVentasRouter(ventasService: VentasService): Router {
  const router = Router();

  router.post("/", async (req, res, next) => {
    try {
      const venta = await ventasService.crear(req.body);
      res.status(201).json(venta);
    } catch (err) {
      next(err);
    }
  });

  router.post("/:id/reintentar", async (req, res, next) => {
    try {
      const venta = await ventasService.reintentar(req.params.id);
      res.status(200).json(venta);
    } catch (err) {
      next(err);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const q = req.query;
      const texto = (v: unknown) => (typeof v === "string" && v !== "" ? v : undefined);
      const resultado = await ventasService.listar(
        {
          estado: texto(q.estado) as EstadoVenta | undefined,
          medioPago: texto(q.medioPago),
          cuit: texto(q.cuit),
          desde: texto(q.desde),
          hasta: texto(q.hasta),
        },
        Number(q.page ?? 1),
        Number(q.limit ?? 20)
      );
      res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const venta = await ventasService.obtenerPorId(req.params.id);
      res.status(200).json(venta);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
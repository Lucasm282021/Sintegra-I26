import { Router } from "express";
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
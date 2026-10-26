import { Router } from "express";
import { VentasService } from "../../application/ventas.service";

// Las rutas son "finitas": reciben el request, delegan en el servicio de
// aplicación, y traducen el resultado a HTTP. No tienen lógica de negocio.
export function buildVentasRouter(ventasService: VentasService): Router {
  const router = Router();

  // POST /tpv/ventas
  router.post("/", async (req, res, next) => {
    try {
      const venta = await ventasService.crear(req.body);
      res.status(201).json(venta);
    } catch (err) {
      next(err);
    }
  });

  // GET /tpv/ventas/:id
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

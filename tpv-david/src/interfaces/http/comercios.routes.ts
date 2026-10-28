import { Router } from "express";
import { ComerciosService } from "../../application/comercios.service";

export function buildComerciosRouter(comerciosService: ComerciosService): Router {
  const router = Router();

  router.post("/", async (req, res, next) => {
    try {
      const comercio = await comerciosService.crear(req.body);
      res.status(201).json(comercio);
    } catch (err) {
      next(err);
    }
  });

  router.get("/", async (_req, res, next) => {
    try {
      res.status(200).json({ comercios: await comerciosService.listar() });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
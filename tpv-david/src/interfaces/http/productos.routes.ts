import { Router } from "express";
import { ProductosService } from "../../application/productos.service";

export function buildProductosRouter(productosService: ProductosService): Router {
  const router = Router();

  // POST /tpv/productos → cargar un producto
  router.post("/", async (req, res, next) => {
    try {
      const producto = await productosService.crear(req.body);
      res.status(201).json(producto);
    } catch (err) {
      next(err);
    }
  });

  // POST /tpv/productos/bulk → cargar muchos productos de una sola vez
  router.post("/bulk", async (req, res, next) => {
    try {
      const productos = await productosService.crearVarios(req.body?.productos ?? req.body);
      res.status(201).json({ creados: productos.length, productos });
    } catch (err) {
      next(err);
    }
  });

  // GET /tpv/productos?page=1&limit=20 → listar catálogo (paginado)
  router.get("/", async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
      const resultado = await productosService.listar(page, limit);
      res.status(200).json(resultado);
    } catch (err) {
      next(err);
    }
  });

  // GET /tpv/productos/:id
  router.get("/:id", async (req, res, next) => {
    try {
      const producto = await productosService.obtenerPorId(req.params.id);
      res.status(200).json(producto);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

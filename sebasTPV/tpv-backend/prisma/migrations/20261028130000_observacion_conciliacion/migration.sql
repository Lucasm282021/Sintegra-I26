-- Observación operativa de la conciliación manual.
-- Se guarda sanitizada y separada de errorDetalle para que no se pierda
-- cuando la venta reanuda su flujo y limpia el detalle de error.
ALTER TABLE "Venta" ADD COLUMN "observacionConciliacion" TEXT;

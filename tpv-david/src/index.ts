import "dotenv/config";
import path from "path";
import express from "express";
import { FileVentaRepository } from "./infrastructure/venta.repository";
import { FileProductoRepository } from "./infrastructure/producto.repository";
import { HttpBancoClient, MockBancoClient } from "./infrastructure/banco.client";
import { HttpArbaClient, MockArbaClient } from "./infrastructure/arba.client";
import { HttpArcaClient, MockArcaClient } from "./infrastructure/arca.client";
import { VentasService } from "./application/ventas.service";
import { ProductosService } from "./application/productos.service";
import { buildVentasRouter } from "./interfaces/http/ventas.routes";
import { buildProductosRouter } from "./interfaces/http/productos.routes";
import { errorHandler, notFoundHandler } from "./interfaces/http/error-handler";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

const BANCO_URL = process.env.BANCO_URL ?? "http://localhost:3002";
const BANCO_MOCK = process.env.BANCO_MOCK === "true";

const ARBA_URL = process.env.ARBA_URL ?? "http://localhost:3003";
const ARBA_MOCK = process.env.ARBA_MOCK === "true";

const ARCA_URL = process.env.ARCA_URL ?? "http://localhost:3004";
// Default a "true" acá (a diferencia de Banco/ARBA): ARCA todavía no tiene
// dueño confirmado en la cátedra, así que no hay a quién apuntarle de verdad.
const ARCA_MOCK = process.env.ARCA_MOCK !== "false";

// Repositorios en archivo JSON (data/ventas.json, data/productos.json):
// sobreviven a un reinicio del proceso, a diferencia de los In-Memory.
const ventaRepository = new FileVentaRepository();
const productoRepository = new FileProductoRepository();

const bancoClient = BANCO_MOCK ? new MockBancoClient() : new HttpBancoClient(BANCO_URL);
const arbaClient = ARBA_MOCK ? new MockArbaClient() : new HttpArbaClient(ARBA_URL);
const arcaClient = ARCA_MOCK ? new MockArcaClient() : new HttpArcaClient(ARCA_URL);

if (BANCO_MOCK) {
  console.log("[tpv] BANCO_MOCK=true → usando MockBancoClient (no llama al servicio real de Banco)");
}
if (ARBA_MOCK) {
  console.log("[tpv] ARBA_MOCK=true → usando MockArbaClient (no llama al servicio real de ARBA)");
}
if (ARCA_MOCK) {
  console.log(
    "[tpv] ARCA_MOCK=true → usando MockArcaClient (ARCA aún sin dueño confirmado en la cátedra)"
  );
}

const ventasService = new VentasService(ventaRepository, productoRepository, bancoClient, arbaClient, arcaClient);
const productosService = new ProductosService(productoRepository);

const app = express();
app.use(express.json());

// Sirve la interfaz visual simple (public/index.html) en la raíz del servicio.
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => {
  const simulados = [BANCO_MOCK && "banco", ARBA_MOCK && "arba", ARCA_MOCK && "arca"].filter(Boolean);
  res.status(200).json({ status: "ok", servicio: "tpv", modulo: "tpv", simulados });
});

app.use("/tpv/ventas", buildVentasRouter(ventasService));
app.use("/tpv/productos", buildProductosRouter(productosService));

app.use(notFoundHandler);
app.use(errorHandler);

// En Vercel la app corre como función (api/index.ts); localmente escucha en PORT.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[tpv] escuchando en http://localhost:${PORT}`);
  });
}

export default app;

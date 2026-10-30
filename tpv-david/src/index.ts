import "dotenv/config";
import path from "path";
import express from "express";
import { BackendComercioRepository, BackendProductoRepository, BackendTpv, BackendVentaRepository, checkoutEnBackend } from "./infrastructure/backend.repositories";
import { FileVentaRepository } from "./infrastructure/venta.repository";
import { FileProductoRepository } from "./infrastructure/producto.repository";
import { FileComercioRepository } from "./infrastructure/comercio.repository";
import { HttpBancoClient, MockBancoClient, HttpBilleteraClient, MockBilleteraClient } from "./infrastructure/banco.client";
import { HttpArbaClient, MockArbaClient } from "./infrastructure/arba.client";
import { HttpArcaClient, MockArcaClient } from "./infrastructure/arca.client";
import { HttpMunicipioClient, MockMunicipioClient } from "./infrastructure/municipio.client";
import { VentasService } from "./application/ventas.service";
import { ProductosService } from "./application/productos.service";
import { ComerciosService } from "./application/comercios.service";
import { ConexionesService, ServicioConfigurado } from "./application/conexiones.service";
import { buildVentasRouter } from "./interfaces/http/ventas.routes";
import { buildProductosRouter } from "./interfaces/http/productos.routes";
import { buildComerciosRouter } from "./interfaces/http/comercios.routes";
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

const MUNICIPIO_URL = process.env.MUNICIPIO_URL ?? "http://localhost:3005";
const MUNICIPIO_MOCK = process.env.MUNICIPIO_MOCK !== "false";

// La Billetera todavía no participa del flujo de venta (solo se muestra su
// estado en "Conexiones"), por eso no tiene un cliente propio todavía.
const BILLETERA_URL = process.env.BILLETERA_URL ?? "http://localhost:3000";
// La billetera se simula solo si la configuración lo pide expresamente.
const BILLETERA_MOCK = process.env.BILLETERA_MOCK === "true";

// Repositorios en archivo JSON (data/*.json): sobreviven a un reinicio del
// proceso, a diferencia de los In-Memory.
// Con TPV_BACKEND_URL, catálogo, comercios y ventas viven en la base común del
// ecosistema y la venta se procesa con el motor común (impuestos incluidos).
// Sin esa variable, se usan los archivos JSON locales como antes.
const TPV_BACKEND_URL = process.env.TPV_BACKEND_URL?.trim();
const backendTpv = TPV_BACKEND_URL
  ? new BackendTpv({ url: TPV_BACKEND_URL, terminalId: process.env.TPV_TERMINAL_ID?.trim() || "david",
      comercioCuit: process.env.TPV_COMERCIO_CUIT?.trim() || "30712345678" })
  : null;
const ventaRepository = backendTpv ? new BackendVentaRepository(backendTpv) : new FileVentaRepository();
const productoRepository = backendTpv ? new BackendProductoRepository(backendTpv) : new FileProductoRepository();
const comercioRepository = backendTpv ? new BackendComercioRepository(backendTpv) : new FileComercioRepository();
if (backendTpv) console.log(`[tpv] usando el backend común ${TPV_BACKEND_URL} (terminal ${backendTpv.cfg.terminalId})`);

const bancoClient = BANCO_MOCK ? new MockBancoClient() : new HttpBancoClient(BANCO_URL);
const billeteraClient = BILLETERA_MOCK ? new MockBilleteraClient() : new HttpBilleteraClient(BILLETERA_URL);
const arbaClient = ARBA_MOCK ? new MockArbaClient() : new HttpArbaClient(ARBA_URL);
const arcaClient = ARCA_MOCK ? new MockArcaClient() : new HttpArcaClient(ARCA_URL);
const municipioClient = MUNICIPIO_MOCK ? new MockMunicipioClient() : new HttpMunicipioClient(MUNICIPIO_URL);

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
if (MUNICIPIO_MOCK) {
  console.log("[tpv] MUNICIPIO_MOCK=true → usando MockMunicipioClient (no llama al servicio real de Municipio)");
}
if (BILLETERA_MOCK) {
  console.log("[tpv] BILLETERA_MOCK=true → pagos con billetera simulados, no se debita Banco M");
}

const ventasService = new VentasService(ventaRepository, productoRepository, bancoClient, arbaClient, arcaClient, billeteraClient,
  process.env.TPV_TERMINAL_ID?.trim() || "david", backendTpv ? (venta) => checkoutEnBackend(backendTpv, venta) : undefined);
const productosService = new ProductosService(productoRepository);
const comerciosService = new ComerciosService(comercioRepository, municipioClient);

// Config de la sección "Conexiones": un servicio por módulo del ecosistema.
// No es el flujo de venta — es solo un chequeo de GET /health de cada uno.
const SERVICIOS_CONFIGURADOS: ServicioConfigurado[] = [
  { id: "municipio", nombre: "Municipio", url: MUNICIPIO_URL, simulado: MUNICIPIO_MOCK },
  { id: "arba", nombre: "ARBA", url: ARBA_URL, simulado: ARBA_MOCK },
  { id: "banco", nombre: "Banco", url: BANCO_URL, simulado: BANCO_MOCK },
  { id: "billetera", nombre: "Billetera", url: BILLETERA_URL, simulado: BILLETERA_MOCK },
  { id: "arca", nombre: "ARCA", url: ARCA_URL, simulado: ARCA_MOCK },
];
const conexionesService = new ConexionesService(SERVICIOS_CONFIGURADOS);

const app = express();
app.use(express.json());

// Sirve la interfaz visual simple (public/index.html) en la raíz del servicio.
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => {
  const simulados = [BANCO_MOCK && "banco", ARBA_MOCK && "arba", ARCA_MOCK && "arca"].filter(Boolean);
  res.status(200).json({ status: "ok", servicio: "tpv", modulo: "tpv", simulados });
});

app.get("/tpv/resumen", async (_req, res, next) => {
  try {
    res.status(200).json(await ventasService.resumen());
  } catch (err) {
    next(err);
  }
});

app.get("/tpv/conexiones", async (_req, res, next) => {
  try {
    res.status(200).json({ servicios: await conexionesService.verificarTodas() });
  } catch (err) {
    next(err);
  }
});

app.use("/tpv/ventas", buildVentasRouter(ventasService));
app.use("/tpv/productos", buildProductosRouter(productosService));
app.use("/tpv/comercios", buildComerciosRouter(comerciosService));

app.use(notFoundHandler);
app.use(errorHandler);

// En Vercel la app corre como función (api/index.ts); localmente escucha en PORT.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[tpv] escuchando en http://localhost:${PORT}`);
  });
}

export default app;

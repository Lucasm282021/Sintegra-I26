-- Etapa 1 multiempresa
-- Empresa inicial: Supermercado Central S.A.
-- Los datos existentes se asignan a esta empresa sin borrar, fusionar ni inventar IDs.

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Empresa inicial determinista
INSERT INTO "Empresa" ("id", "nombre", "estado", "createdAt", "updatedAt")
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'Supermercado Central S.A.',
    'ACTIVA',
    CAST(strftime('%s', 'now') AS INTEGER) * 1000,
    CAST(strftime('%s', 'now') AS INTEGER) * 1000
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT,
    "rol" TEXT NOT NULL,
    "empresaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "ultimoAcceso" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmpresaModulo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empresaId" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmpresaModulo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Módulos iniciales habilitados para la empresa existente
INSERT INTO "EmpresaModulo" ("empresaId", "modulo", "habilitado", "createdAt", "updatedAt") VALUES
    ('00000000-0000-4000-8000-000000000001', 'caja', true, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
    ('00000000-0000-4000-8000-000000000001', 'productos', true, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
    ('00000000-0000-4000-8000-000000000001', 'ventas', true, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000),
    ('00000000-0000-4000-8000-000000000001', 'comercios', true, CAST(strftime('%s', 'now') AS INTEGER) * 1000, CAST(strftime('%s', 'now') AS INTEGER) * 1000);

-- CreateTable
CREATE TABLE "AuditoriaAcceso" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuarioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "recursoId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "resultado" TEXT,
    "detalle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditoriaAcceso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditoriaAcceso_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Comercio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empresaId" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "direccion" TEXT,
    "rubro" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Comercio_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Comercio" ("id", "empresaId", "cuit", "razonSocial", "direccion", "rubro", "activo", "createdAt", "updatedAt")
SELECT "id", '00000000-0000-4000-8000-000000000001', "cuit", "razonSocial", "direccion", "rubro", "activo", "createdAt", "updatedAt" FROM "Comercio";
DROP TABLE "Comercio";
ALTER TABLE "new_Comercio" RENAME TO "Comercio";
CREATE UNIQUE INDEX "Comercio_cuit_key" ON "Comercio"("cuit");
CREATE INDEX "Comercio_empresaId_idx" ON "Comercio"("empresaId");

CREATE TABLE "new_Producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "empresaId" TEXT NOT NULL,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" REAL NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 100,
    "categoria" TEXT NOT NULL DEFAULT 'General',
    "imagenUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Producto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Producto" ("id", "empresaId", "codigo", "nombre", "descripcion", "precio", "stock", "categoria", "imagenUrl", "createdAt", "updatedAt")
SELECT "id", '00000000-0000-4000-8000-000000000001', "codigo", "nombre", "descripcion", "precio", "stock", "categoria", "imagenUrl", "createdAt", "updatedAt" FROM "Producto";
DROP TABLE "Producto";
ALTER TABLE "new_Producto" RENAME TO "Producto";
CREATE INDEX "Producto_empresaId_idx" ON "Producto"("empresaId");
CREATE UNIQUE INDEX "Producto_empresaId_codigo_key" ON "Producto"("empresaId", "codigo");

CREATE TABLE "new_Venta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idVentaExternal" TEXT,
    "empresaId" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "medioPago" TEXT NOT NULL,
    "cuentaOrigen" TEXT,
    "cuentaDestino" TEXT,
    "cuitPagador" TEXT,
    "subtotal" REAL NOT NULL,
    "percepcionArba" REAL NOT NULL DEFAULT 0,
    "montoTotal" REAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "etapaPendiente" TEXT,
    "lockToken" TEXT,
    "lockExpiresAt" DATETIME,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "cae" TEXT,
    "comprobanteNumero" TEXT,
    "fechaVencimientoCae" TEXT,
    "tipoComprobante" TEXT,
    "bancoTransaccionId" TEXT,
    "billeteraTransaccionId" TEXT,
    "arbaPercepcionId" TEXT,
    "arcaComprobanteId" TEXT,
    "errorDetalle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Venta_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Venta_cuit_fkey" FOREIGN KEY ("cuit") REFERENCES "Comercio" ("cuit") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Venta" (
    "id", "empresaId", "idVentaExternal", "cuit", "medioPago", "cuentaOrigen", "cuentaDestino", "cuitPagador",
    "subtotal", "percepcionArba", "montoTotal", "estado", "cae", "comprobanteNumero", "fechaVencimientoCae",
    "tipoComprobante", "bancoTransaccionId", "billeteraTransaccionId", "arbaPercepcionId", "arcaComprobanteId",
    "errorDetalle", "createdAt", "updatedAt"
)
SELECT
    "id", '00000000-0000-4000-8000-000000000001', "idVentaExternal", "cuit", "medioPago", "cuentaOrigen", "cuentaDestino", "cuitPagador",
    "subtotal", "percepcionArba", "montoTotal", "estado", "cae", "comprobanteNumero", "fechaVencimientoCae",
    "tipoComprobante", "bancoTransaccionId", "billeteraTransaccionId", "arbaPercepcionId", "arcaComprobanteId",
    "errorDetalle", "createdAt", "updatedAt"
FROM "Venta";
DROP TABLE "Venta";
ALTER TABLE "new_Venta" RENAME TO "Venta";
CREATE UNIQUE INDEX "Venta_idVentaExternal_key" ON "Venta"("idVentaExternal");
CREATE INDEX "Venta_empresaId_idx" ON "Venta"("empresaId");
CREATE INDEX "Venta_empresaId_createdAt_idx" ON "Venta"("empresaId", "createdAt");

-- Mapeo de estados legados a la nueva máquina de estados.
-- Se preservan los IDs, CAE, comprobantes y referencias externas.
--
-- Regla de seguridad: si no hay una referencia de pago persistida y la venta
-- ya había superado ARBA, no puede saberse con certeza si el proveedor llegó a
-- cobrar. Esas ventas quedan en PENDIENTE / conciliacion_pago y NO se asignan
-- a una etapa que reintente el pago. REVISION_MANUAL ya no se escribe.
UPDATE "Venta"
SET
    "estado" = CASE
        WHEN (
            ("bancoTransaccionId" IS NOT NULL AND "bancoTransaccionId" <> '')
            OR ("billeteraTransaccionId" IS NOT NULL AND "billeteraTransaccionId" <> '')
        ) THEN
            CASE
                WHEN "cae" IS NOT NULL AND "cae" <> '' THEN 'COMPLETADA'
                ELSE 'PENDIENTE'
            END
        WHEN "estado" = 'COMPLETADA' THEN 'COMPLETADA'
        WHEN "estado" = 'BORRADOR' THEN 'PENDIENTE'
        WHEN "estado" = 'VALIDADO_MUNICIPIO' THEN 'PENDIENTE'
        WHEN "estado" = 'ERROR_RECUPERABLE'
             AND ("arbaPercepcionId" IS NULL OR "arbaPercepcionId" = '') THEN 'ERROR_RECUPERABLE'
        ELSE 'PENDIENTE'
    END,
    "etapaPendiente" = CASE
        WHEN (
            ("bancoTransaccionId" IS NOT NULL AND "bancoTransaccionId" <> '')
            OR ("billeteraTransaccionId" IS NOT NULL AND "billeteraTransaccionId" <> '')
        ) THEN
            CASE
                WHEN "cae" IS NOT NULL AND "cae" <> '' THEN NULL
                ELSE 'arca'
            END
        WHEN "estado" = 'COMPLETADA' THEN NULL
        WHEN "estado" = 'BORRADOR' THEN 'municipio'
        WHEN "estado" = 'VALIDADO_MUNICIPIO' THEN 'arba'
        WHEN "estado" = 'ERROR_RECUPERABLE'
             AND ("arbaPercepcionId" IS NULL OR "arbaPercepcionId" = '') THEN 'arba'
        ELSE 'conciliacion_pago'
    END;

UPDATE "Venta"
SET "errorDetalle" = CASE
    WHEN "errorDetalle" IS NULL OR "errorDetalle" = '' THEN
        'Estado legado con pago no confirmado; requiere conciliación manual antes de reintentar'
    ELSE
        "errorDetalle" || ' | Estado legado con pago no confirmado; requiere conciliación manual antes de reintentar'
END
WHERE "etapaPendiente" = 'conciliacion_pago';

UPDATE "Venta"
SET "errorDetalle" = COALESCE("errorDetalle", 'Estado legado no reconocido; requiere revisión manual')
WHERE "estado" = 'ERROR_RECUPERABLE' AND "errorDetalle" IS NULL;

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");
CREATE INDEX "Usuario_empresaId_idx" ON "Usuario"("empresaId");
CREATE UNIQUE INDEX "EmpresaModulo_empresaId_modulo_key" ON "EmpresaModulo"("empresaId", "modulo");
CREATE INDEX "AuditoriaAcceso_empresaId_createdAt_idx" ON "AuditoriaAcceso"("empresaId", "createdAt");
CREATE INDEX "AuditoriaAcceso_usuarioId_createdAt_idx" ON "AuditoriaAcceso"("usuarioId", "createdAt");

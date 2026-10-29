-- CreateTable
CREATE TABLE "Comercio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cuit" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "direccion" TEXT,
    "rubro" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" REAL NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 100,
    "categoria" TEXT NOT NULL DEFAULT 'General',
    "imagenUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idVentaExternal" TEXT,
    "cuit" TEXT NOT NULL,
    "medioPago" TEXT NOT NULL,
    "cuentaOrigen" TEXT,
    "cuentaDestino" TEXT,
    "cuitPagador" TEXT,
    "subtotal" REAL NOT NULL,
    "percepcionArba" REAL NOT NULL DEFAULT 0,
    "montoTotal" REAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
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
    CONSTRAINT "Venta_cuit_fkey" FOREIGN KEY ("cuit") REFERENCES "Comercio" ("cuit") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DetalleVenta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ventaId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioUnitario" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    CONSTRAINT "DetalleVenta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DetalleVenta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Comercio_cuit_key" ON "Comercio"("cuit");

-- CreateIndex
CREATE UNIQUE INDEX "Producto_codigo_key" ON "Producto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Venta_idVentaExternal_key" ON "Venta"("idVentaExternal");

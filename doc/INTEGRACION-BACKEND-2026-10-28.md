# Informe de integración — Backend Sintegra I26

> **Corte histórico:** este informe describe una versión previamente desplegada. Las correcciones locales del 28/10/2026 (PV obligatorio, CAE marcado como ficticio y alta municipal pendiente) no están incluidas en ese despliegue. Consultá [AVANCES-UNIFICACION.md](AVANCES-UNIFICACION.md) para la validación local y el estado de la migración.

**Fecha:** 28/10/2026  
**Resultado:** módulos Municipio y TPV implementados sobre PostgreSQL; migración de base aplicada; prueba de integración automatizada aprobada.

## Qué quedó integrado

- API común: `backend/`, Express y PostgreSQL en Supabase.
- Municipio: listado y alta de comercios, ficha, obligaciones por período, pago con débito, comprobantes y certificado de libre deuda.
- TPV: terminales y catálogo compartido; una venta valida productos y existencias, calcula precio del catálogo, cobra por Banco o Billetera, registra percepción ARBA y emite comprobante ARCA dentro de una transacción. `id_venta` evita duplicados.
- Padrón, Banco, Billetera, ARBA y ARCA conservan sus módulos y tablas existentes.
- Municipio quedó con el cliente listo para consumir el backend unificado en build de producción. En desarrollo se configura `VITE_BACKEND_URL`; sin ella sigue disponible el simulador local.
- Landing actualizada con acceso al estado de la API y descripciones que distinguen API disponible de interfaz ya conectada.

## Base de datos

Se aplicaron `backend/supabase/migrations/20261028000004_municipio_tpv_operativos.sql` y `20261028000005_municipio_operacion_bancaria.sql` mediante `npm run migrar`. Añaden a tasas municipales el desglose, concepto, vencimiento, recibo y referencia del movimiento bancario; agregan una huella de payload al TPV para idempotencia y crean la cuenta demo de tesorería municipal. No eliminan ni reemplazan datos. No se volvió a ejecutar `seed.sql`.

La migración se guarda en `public.sintegra_migraciones`. Puede comprobarse con:

```sql
select nombre, aplicada_en
from public.sintegra_migraciones
order by aplicada_en;
```

## Verificación

- `backend/npm test`: 7 pruebas de integración aprobadas sobre PGlite efímero; incluye alta y pago municipal, idempotencia, conciliación de saldos y venta TPV completa.
- `municipio-cristian/frontend/npm run lint`: aprobado.
- `municipio-cristian/frontend/npm run build`: aprobado. Vite mostró una advertencia existente de `__dirname` en `vite.config.ts`; no impidió el build.
- El test usa datos ficticios; no produce movimientos en Supabase.

## Contrato rápido

```http
GET  /health
GET  /municipio/comercios
POST /municipio/comercios
GET  /municipio/tributos/{cuit}
POST /municipio/tributos/pagos
GET  /municipio/comprobantes?cuit={cuit}
GET  /municipio/certificados/libre-deuda/{cuit}
GET  /tpv/terminales
GET  /tpv/productos?terminal_id=david&cuit=30712345678
POST /tpv/ventas
```

El backend de TPV ya está listo, pero las interfaces de Sebastián y David todavía conservan sus repositorios/clientes propios de ventas; hay que migrar cada frontend al contrato compartido para que todas las ventas queden en `tpv.ventas`. Municipio tiene el cliente API preparado y se desplegó a `https://municipio-cristian.vercel.app`; la landing se desplegó a `https://sintegrai26.vercel.app`.

## Límites del entorno de prueba

Es una simulación académica. Los cobros se reflejan entre cuentas ficticias; las percepciones y comprobantes son registros demo; el CAE generado no es oficial ni válido para facturación. No usar CUIT, cuentas ni importes de personas o comercios reales.
# Consolidación de aplicaciones (actualización 28/10/2026)

## Cambios agregados en esta pasada

- Brisa queda servida como interfaz estática en `/brisa/` y su catálogo/ventas usan el backend compartido.
- Se agregó la terminal `brisa` y la tabla `tpv.comercios` para vincular comercios con CUIT del padrón central, rubro y cuenta de cobro.
- `tpv.productos` suma categoría, necesaria para el catálogo de Brisa. Productos, stock, ventas, cobros, percepciones ARBA y comprobantes ARCA persisten en la base compartida.
- Se cargó una semilla acotada para el CUIT demo `30712345678`, ya presente en la base. No se importaron las identidades ficticias restantes de SQLite ni se crearon cuentas por fuera del padrón.
- Brisa y Sebastián usan terminales distintas (`brisa`, `sebastian`) y catálogos propios en `tpv.productos`; ambos liquidan sus ventas contra las mismas cuentas, percepciones y comprobantes.
- El portal agrega el acceso `TPV · Brisa`; Banco M en `/banco/` identifica clientes por CUIT y consulta conjuntamente cuenta bancaria y billetera virtual.
- Banco M permite crear billetera para un CUIT del padrón, consultar saldo/movimientos y cargar saldo desde su cuenta vinculada. La carga conserva la operación bancaria y el saldo de billetera en una transacción compartida.
- Los pagos con QR de Billetera pueden liquidar en la cuenta bancaria del comercio cuando no tiene billetera. El QR se genera con un payload opaco, vence en cinco minutos y es de un solo pago.
- Banco, Billetera y TPV generan eventos `payment.confirmed` por `terminal_id`; el backend común entrega un callback HMAC al dominio Vercel de Brisa, Sebastián o David y guarda el estado/los intentos del envío en `tpv.webhook_eventos`.

## Estado de cada solución

| App | Interfaz | Datos y API | Estado de integración |
|---|---|---|---|
| Brisa | HTML/JS bajo `/brisa/` | API compartida `/tpv`; tablas `tpv.*`, `padron`, `banco`, `arba`, `arca` | Integrada. El CUIT del comercio tiene que estar en el padrón y la cuenta de cobro en Banco. |
| Banco M · Rodrigo | `/banco/` consolidado dentro del portal | Lee `banco.*`, `billetera.*` y `padron.*`; alta de billetera y carga via API común | CUIT como identidad y billetera conectada. La app React original de Rodrigo no se usa todavía; transferencias/QR desde esa interfaz siguen pendientes. |
| TPV · Sebastián | Proyecto Vercel `tpv-sebastian` actualizado | Frontend consume `/tpv` de la API común; terminal `sebastian` y catálogo demo en `tpv.*` | Integrado y publicado. El backend NestJS/Prisma local conserva SQLite y no participa en producción; no se ejecutaron sus migraciones en Supabase. La API común cubre las ventas de la interfaz y sus integraciones Banco, ARBA y ARCA. |

## Verificación / publicación

Las migraciones `20261028000006_tpv_brisa_banco_m.sql` a `20261028000010_webhooks_tpv.sql` están aplicadas. Backend común, portal, TPV Sebastián, TPV David y sus callbacks están publicados. Se verificaron en producción `/health`, la lista de terminales y los tres receptores (firma inválida rechazada con HTTP 401). La suite local ampliada pasó 13 pruebas: QR con liquidación a Banco, alta de punto de venta, venta TPV con percepción/factura, pago entre billeteras, recaudación municipal y entrega HMAC a receptor local. No se crearon transacciones QA en producción.

## Pendientes de fase 2

1. La pantalla de Banco M publicada es la vista unificada del portal. Falta llevar estas operaciones a la interfaz React original de Rodrigo y completar sus transferencias/QR contra `banco.*` y `billetera.*`.
2. Sebastián conserva su backend NestJS/Prisma SQLite en el repo; el frontend productivo usa la API común. Si se decide desplegar también NestJS, migrarlo a un esquema PostgreSQL propio y evitar sincronizar tablas/saldos por fuera de `tpv.*`.
3. Conciliar CUIT, saldo y movimientos antes de importar datos locales de SQLite/Prisma; no duplicar libros de banco o billetera.

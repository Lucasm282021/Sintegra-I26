# Backend unificado y base de datos — Sintegra I26

**Estado al 28/10/2026:** API Express desplegada en Vercel y conectada a PostgreSQL de Supabase. Los módulos de Municipio y TPV ya tienen endpoints operativos en el repositorio; la migración `20261028000004_municipio_tpv_operativos.sql` extiende el esquema sin borrar datos. Las pruebas de integración corren contra PGlite y no tocan datos productivos.

## Arquitectura y límites

- API común: `https://sintegra-backend.vercel.app`.
- PostgreSQL único en Supabase, separado por esquemas: `padron`, `municipio`, `arba`, `arca`, `banco`, `billetera`, `tpv`.
- Los clientes web llaman al backend; no deben conectarse directamente a Supabase.
- CUIT/CUIL se transporta como texto de 11 dígitos; importes en ARS con dos decimales; operaciones de cobro/pago idempotentes.
- El entorno es académico: cuentas, cobros, tasas, comprobantes y CAE son simulados. No usar para operaciones fiscales, bancarias ni datos reales. ARCA no está conectado a los servicios oficiales y no emite CAE válido.

## Contratos implementados

| Módulo | Endpoints principales | Persistencia y coordinación |
|---|---|---|
| Estado | `GET /health` | Comprueba PostgreSQL e informa módulos activos |
| Padrón | `GET /padron/contribuyentes/{cuit}` | Vista compartida por CUIT |
| Municipio | `GET /municipio/health`, `/comercios`, `/comercios/{cuit}`, `/tributos/{cuit}`, `/comprobantes[?cuit]`; `POST /comercios`, `/tributos/pagos`; `GET /certificados/libre-deuda/{cuit}` | Alta compartida en `padron` + habilitación + obligación inicial; pago de tasa y débito bancario en una transacción; recibos y libre deuda derivados de Postgres |
| Banco | `GET /banco/cuentas[?cuit]`, `/cuentas/{id}`, `/cuentas/{id}/saldo`, `/cuentas/{id}/movimientos`; `POST /pagos` | Saldos y movimientos con clave idempotente |
| Billetera | `/billetera/auth/login`, `/auth/registro`, `/cuentas`, `/cargas`, `/pagos`, `/qr/pagos`, `/qr/{cuit}`, `/demo/clientes` | Saldos y movimientos; cargas con reflejo bancario cuando hay cuenta vinculada |
| ARBA | `GET /arba/padron/{cuit}`, `/percepciones/{cuit}`; `POST /percepciones` | Alícuota del padrón y percepción idempotente |
| ARCA | `GET /arca/contribuyentes/{cuit}`, `/comprobantes[?cuit]`; `POST /comprobantes` | Numeración correlativa y CAE ficticio |
| TPV | `GET /tpv/health`, `/terminales`, `/productos[?terminal_id&cuit]`, `/ventas[?terminal_id]`, `/ventas/{id}`; `POST /productos`, `/ventas` | Catálogo y venta en `tpv`; checkout transaccional con Banco o Billetera, percepción ARBA y comprobante ARCA |

### Venta TPV

`POST /tpv/ventas` acepta `id_venta` (o `id`), `terminal_id` (por omisión `david`), `comercio_cuit` (o `comercio.cuit`), `items: [{producto_id, cantidad}]`, `medio_pago` y opcionalmente `cuenta_origen` o `cuit_cliente` para Billetera. Se valida el producto contra la terminal y el CUIT; el nombre/precio provienen del catálogo. La venta, el stock, el movimiento, la percepción y el comprobante se confirman dentro de la misma transacción. Si falla una etapa, se revierte el conjunto. Un reintento con igual `id_venta` y contenido devuelve el resultado previo; contenido distinto recibe `409`.

### Municipio

El alta acepta `cuit`, `razon_social`, `condicion_fiscal`, `direccion`, `rubro_principal` y `rubro_secundario`. Crea la ficha compartida y una obligación municipal inicial del período corriente. El pago acepta `{cuit, periodo, monto, cuenta_origen?}`; usa la cuenta bancaria del contribuyente cuando existe, o exige `cuenta_origen`. Debita y acredita la tesorería demo junto con el marcado de la tasa como pagada. Un reintento idéntico es idempotente.

Para pagos, Municipio necesita una cuenta bancaria asociada al contribuyente. Las altas nuevas no crean una cuenta ficticia por defecto: Banco debe incorporar/asociar una cuenta antes de permitir el débito.

## Migraciones y datos

- `backend/supabase/migrations/20261026000001_esquema_inicial.sql`: esquema y tablas base.
- `backend/supabase/migrations/20261026000002_usuarios_billetera.sql`: autenticación demo de Billetera.
- `backend/supabase/migrations/20261027000003_integracion.sql`: cuentas técnicas demo y ledger de migraciones.
- `backend/supabase/migrations/20261028000004_municipio_tpv_operativos.sql`: detalle de tasas, identificador de recibo, huella idempotente TPV y cuenta recaudadora municipal demo. Solo añade columnas y datos faltantes; no elimina ni reinicia registros.
- `backend/supabase/migrations/20261028000005_municipio_operacion_bancaria.sql`: referencia cruzada del movimiento bancario del pago municipal.
- `backend/supabase/seed.sql`: exclusivamente datos ficticios para ambiente nuevo o base local vacía; no reejecutar sobre una base que ya tiene datos.

La migración se ejecuta con `npm run migrar`, lee `backend/.env.supabase.local` y registra cada archivo en `public.sintegra_migraciones`. Confirmar el ledger y `/health` al terminar. No compartir ni versionar credenciales.

## Frontends

Configurar `VITE_BACKEND_URL=https://sintegra-backend.vercel.app` en el proyecto Vercel del frontend. Municipio usa el backend automáticamente en build de producción y admite esa misma variable en desarrollo; sin variable en desarrollo sigue usando su simulador local. El backend ya expone contratos para TPV, pero cada cliente TPV debe dejar de usar su repositorio/mocks locales y enviar `terminal_id`, productos y `id_venta` al endpoint común. Sebastián y el cliente TPV de David aún requieren esa conexión en sus respectivas interfaces.

## Ejecutar la prueba de integración

```powershell
cd backend
npm ci
npm test
```

Las pruebas levantan PGlite en memoria, aplican las migraciones y seed de demostración, y prueban padrón, Billetera, Banco, ARBA, ARCA, Municipio y TPV. No se conectan a Supabase.

## Despliegue

Backend Vercel: `backend/` como raíz de proyecto, Node.js y `DATABASE_URL` configurada como secreto en Vercel (pooler transaccional). Revisar `backend/vercel.json`. Frontends: cada carpeta tiene su propio proyecto Vercel; la landing sirve desde la raíz pública del monorepo según `doc/VERCEL-MONOREPO.md`. Al desplegar cada app se debe probar su URL y el health API, no inferir disponibilidad a partir de un HTTP 200 aislado.

# Integración de extremo a extremo y datos sintéticos

**Estado:** publicado en producción y verificado  
**Fecha:** 28 de octubre de 2026  
**Uso:** guía compartida para el equipo y para Claude; el contrato vigente vive en el backend de este repositorio.

## Arquitectura acordada

- Una API Express y una base PostgreSQL/Supabase compartidas. El CUIT de 11 dígitos identifica al sujeto entre Municipio, ARBA, ARCA, Banco, Billetera y TPV.
- Los datos comunes de identidad viven en `padron.contribuyentes`. Cada sistema es dueño de sus tablas y las operaciones que cruzan módulos se coordinan desde el backend.
- `id_venta` identifica de forma idempotente ventas, cobros y solicitudes QR. Un reintento con los mismos datos devuelve la operación existente; reutilizar el ID con otros datos responde `409`.
- Las migraciones se agregan en `backend/supabase/migrations/`; no se reinicializa ni se vacía una base con datos existentes.
- El conjunto de cinco casos QA se crea dentro de PGlite en memoria y desaparece al terminar el proceso. No usa credenciales ni escribe en Supabase.

## Batería de cinco sujetos QA

Todos los nombres, CUIT, saldos, tasas y ventas son sintéticos y se limitan a la base efímera de pruebas.

| CUIT sintético | Perfil de prueba | Sistemas usados |
|---|---|---|
| `30700010001` | Almacén Sintético Uno SRL | Padrón, ARBA, ARCA, Banco y TPV |
| `20300010002` | Alicia Sintética | Padrón, Banco y Billetera pagadora |
| `30700010003` | Servicios Sintéticos Dos SA | Padrón, ARBA, Banco y Billetera receptora |
| `20300010004` | Bruno Sintético | Padrón, Municipio, Banco y Billetera |
| `30000010005` | Tesorería Sintética I26 | Cuenta de custodia y recaudación municipal |

El fixture agrega productos, terminal, cuentas y una obligación municipal para poder seguir el dinero. La prueba comprueba que el padrón y las cuentas de negocio se limitan a esos cinco CUIT; la cuenta municipal y la de custodia son infraestructura de esos sujetos.

## Flujos cubiertos

1. **QR dinámico:** crear solicitud por importe y CUIT comercio; recibir un `data:image/png;base64`; confirmar con CUIT pagador; debitar su billetera; acreditar al comercio en Banco si no tiene billetera; conservar referencia del movimiento bancario; rechazar otro pagador y hacer idempotente el reintento.
2. **Alta de punto de venta:** `POST /arca/puntos-venta` valida sujeto y número, y crea los tipos permitidos por condición fiscal. `GET /arca/puntos-venta?cuit=...` lista puntos y numeración.
3. **Venta TPV:** procesa inventario, cobro Banco o Billetera, percepción ARBA, comprobante ARCA simulado y estado final en una transacción. El punto se selecciona con `punto_venta` y se refleja en el comprobante.
4. **Pago con billetera a comercio con billetera:** debita al comprador y acredita al comercio; la venta incluye percepción de ARBA y comprobante ARCA.
5. **Municipio:** debita una cuenta bancaria, acredita la recaudación municipal, actualiza la tasa, emite comprobante y habilita la consulta de libre deuda.
6. **Webhook por terminal:** crea el evento dentro de la transacción del pago, entrega un `POST` firmado con HMAC SHA-256 al endpoint TPV seleccionado y conserva intentos/estado. Una caída del receptor no revierte un pago asentado y deja el evento pendiente.

## Contratos principales

### Punto de venta

```http
POST /arca/puntos-venta
Content-Type: application/json
```

```json
{"cuit":"30700010001","punto_venta":27}
```

Para responsable inscripto, el alta predeterminada configura `FACTURA_A` y `FACTURA_B`; para el resto, `FACTURA_C`. `tipos_comprobante` permite pedir tipos explícitos dentro de esa lista fiscal.

### QR de cobro

```http
POST /billetera/qr/generar
{"id_venta":"cobro-123","cuit_destino":"30700010001","monto":1000}
```

La respuesta incluye `payload`, `qr_data_url`, terminal, estado y vencimiento (cinco minutos). Al generarlo desde TPV, enviar `terminal_id`. El QR contiene un identificador opaco; no expone CUIT ni importe dentro del payload.

```http
POST /billetera/qr/confirmar
{"payload":"SINTEGRA-PAGO:<uuid>","cuit_origen":"20300010002"}
```

La confirmación requiere una billetera de origen con saldo suficiente. El comercio puede recibir en su billetera o en su cuenta bancaria. La respuesta conserva el movimiento de billetera y la liquidación bancaria cuando corresponde.

### Venta TPV

`POST /tpv/ventas` acepta `punto_venta`, `cuenta_origen`, `medio_pago`, `cuit_cliente` (si paga con Billetera) e `items`. Cada pago exitoso genera el evento `payment.confirmed` para el `terminal_id`. La respuesta comunica el estado, subtotal, percepción, total y resultado del webhook; el detalle de la factura y pago se consulta con `GET /tpv/ventas/:id`.

### Receptores en Vercel

| TPV | Terminal | Callback |
|---|---|---|
| Sebastián | `sebastian` | `https://tpv-sebastian.vercel.app/api/webhooks/payment` |
| Brisa | `brisa` | `https://sintegrai26.vercel.app/api/webhooks/payment` |
| TPV David | `david` | `https://tpv-david.vercel.app/api/webhooks/payment` |

Cada receptor valida `X-Sintegra-Event`, `X-Sintegra-Event-Id` y `X-Sintegra-Signature: sha256=<hex>`. Configurar `TPV_TERMINAL_ID` y `SINTEGRA_WEBHOOK_SECRET` en cada proyecto; la misma clave debe registrarse en `tpv.webhook_config.secret`. El alta/actualización de destino usa `PUT /tpv/terminales/:id/webhook`, protegido con `X-Sintegra-Admin-Token` y `SINTEGRA_WEBHOOK_ADMIN_TOKEN` en backend. La respuesta de configuración no devuelve el secreto.

El cuerpo incluye el CUIT del comercio y pagador, monto, medio, referencias a movimientos de Banco/Billetera y, para una venta TPV, percepción y comprobante. Un `2xx` confirma recepción. Los eventos pendientes y sus intentos quedan en `tpv.webhook_eventos`; el receptor debe usar `X-Sintegra-Event-Id` como clave idempotente.

## Ejecutar QA

Desde `backend/`:

```powershell
npm ci
npm test
```

`npm test` ejecuta la suite existente y la batería aislada de cinco sujetos sintéticos. Levanta PostgreSQL efímero PGlite y un receptor HTTP local para verificar firma y enrutamiento. No se requiere `.env` ni se llama a servicios externos.

## Alcance fiscal y financiero

Este repositorio implementa una **simulación académica**: los saldos son internos, el QR mueve registros de prueba y los CAE se generan como números ficticios. No se envía una factura válida a ARCA, no se ejecutan percepciones ante ARBA, y Banco no se conecta a una entidad financiera real. No usar para cobros, declaraciones ni comprobantes fiscales reales.

Para operación real se requieren credenciales y certificados autorizados por organismo, integración con sus servicios oficiales, validaciones fiscales vigentes, conciliación, autenticación/autorización robusta, auditoría y revisión de seguridad. Estas conexiones quedan fuera de la batería sintética.

## Despliegue

- El frontend de la landing y las aplicaciones está servido por `sintegrai26`.
- El backend común está publicado en [sintegra-backend.vercel.app](https://sintegra-backend.vercel.app); sus migraciones QR y webhook ya están aplicadas.
- Los callbacks de Brisa, Sebastián y David están desplegados y asociados a sus terminales. Una firma inválida devuelve `401` en los tres destinos.
- La batería sintética pasó **13/13 pruebas** en PGlite. No se generó ningún pago sintético en la base productiva.
- Una aplicación no debe publicar un backend local duplicado si sus datos y transacciones deben usar el contrato central.
- Aplicar migraciones aditivas con `npm run migrar` solo después de validar el cambio en QA y verificar el proyecto/credenciales de base. Nunca ejecutar `seed.sql` sobre una base ya poblada.

## Cambios de esquema de esta entrega

`20261028000009_qr_pagos_liquidacion.sql` agrega solicitudes QR, vencimiento, estado, idempotencia y referencias a movimientos de billetera/Banco. `20261028000010_webhooks_tpv.sql` agrega configuración y outbox de eventos por terminal y vincula el QR al TPV seleccionado. Son migraciones aditivas; no borran filas de negocio.

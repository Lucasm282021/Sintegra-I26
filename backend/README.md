# Backend común Sintegra I26

API Express 4 sobre PostgreSQL de Supabase, desplegable en Vercel. La arquitectura, contratos completos, límites académicos y guía de conexión están en [BACKEND-Y-BASE-DE-DATOS.md](../consolidacion/BACKEND-Y-BASE-DE-DATOS.md).

## Módulos

`/health`, `/padron`, `/municipio`, `/banco`, `/billetera`, `/arba`, `/arca` y `/tpv`. Municipio comparte padrón, cuenta corriente, pagos bancarios, comprobantes y certificados. TPV mantiene catálogo/ventas y coordina Banco o Billetera, ARBA y ARCA en una transacción SQL.

Los saldos, tasas, pagos y CAE corresponden a una simulación educativa. No es integración con ARCA oficial ni con bancos reales y no debe cargarse información real.

## Migrar, probar y ejecutar

```powershell
npm ci
npm test          # integración contra PGlite efímero; no modifica Supabase
npm run migrar    # aplica migraciones pendientes de forma registrada
npm start         # API local, puerto por defecto 3010
```

`npm run migrar` requiere `DATABASE_URL` en `backend/.env.supabase.local` o en el entorno. No versionar esa credencial. Las migraciones son incrementales; `seed.sql` es para una base vacía y no debe ejecutarse para actualizar una base existente.

## Endpoints

- Municipio: `/municipio/comercios`, `/municipio/tributos/{cuit}`, `/municipio/tributos/pagos`, `/municipio/comprobantes`, `/municipio/certificados/libre-deuda/{cuit}`.
- TPV: `/tpv/terminales`, `/tpv/productos`, `/tpv/ventas`; altas con `POST` en productos y ventas. Las ventas aceptan `punto_venta`.
- ARCA: `POST/GET /arca/puntos-venta`; las ventas TPV numeran el comprobante en el punto seleccionado.
- Billetera: `POST /billetera/qr/generar` crea un QR dinámico y `POST /billetera/qr/confirmar` lo paga desde una billetera. Los comercios sin billetera reciben la liquidación en Banco.
- Webhooks: `PUT /tpv/terminales/:id/webhook` configura el receptor con token administrativo. Las confirmaciones de Banco/Billetera/TPV se guardan en outbox y se entregan firmadas al endpoint de ese terminal.
- Banco, Billetera, ARBA, ARCA y Padrón: ver la guía principal de consolidación.

HTTP 409 indica duplicidad/conflicto; errores comunes responden `{ "error": "..." }`. En TPV `id_venta` es la clave idempotente.

La batería de integración con cinco sujetos sintéticos aislados, contratos, pasos de ejecución y límites de la simulación está en [../doc/INTEGRACION-E2E-SINTETICA-Y-QA.md](../doc/INTEGRACION-E2E-SINTETICA-Y-QA.md). Los CAE y pagos son simulados, no hay conexión fiscal ni bancaria real.

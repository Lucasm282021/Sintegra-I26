# Ajuste de contrato — Billetera

## Estado actual

La API Express usa SQLite `node:sqlite` en Node 24, puerto 3006. Rutas: `POST /billetera/cuentas`, `GET /billetera/cuentas/:id`, `GET /billetera/cuentas/:id/movimientos`, `POST /billetera/cargas`, `POST /billetera/pagos`. La interfaz HTML/JS consume esas rutas. CUIT es string de 11 dígitos y montos son enteros positivos en pesos.

La carga puede llamar opcionalmente a `BANCO_URL/banco/pagos` con `{ cuit, monto, tipo, billetera_id, alias }`, pero la respuesta/llave idempotente no está acordada. La actualización de saldo y el registro de movimiento se realizan como consultas separadas; no hay idempotencia documentada para cargas ni pagos.

## Ajuste a la API unificada

- Migrar las rutas a `/api/v1/billeteras/...`; usar `wallet_id` interno en rutas y pagos, no localizar siempre la cuenta por CUIT.
- Estandarizar importes como `amount_minor` (centavos) + `currency: "ARS"`; migrar los enteros actuales (pesos) convirtiéndolos a centavos de forma explícita.
- Modelar el ledger de movimientos como append-only. Actualización de saldo y movimiento deben confirmarse dentro de una transacción SQL.
- Requerir `Idempotency-Key` para carga y pago; guardar clave, hash del request y resultado. Un reintento no debe acreditar/debitar dos veces.
- Para pago a comercio, exigir referencia `sale_id`, CUIT/comercio receptor y destino. No usar `descripcion` como sustituto de identificador de venta.
- Definir que la Billetera sea el único medio elegido por la venta cuando se usa; no cobrar también por Banco.
- Reemplazar acceso por ID local con autenticación/autorización antes de cualquier despliegue fuera de demo; ID no constituye credencial.
- Incluir `public/` en el Dockerfile; el README indica que hoy se copia `src/` pero se sirve `public/`.

### Rutas objetivo orientativas

- `POST /api/v1/billeteras` — titular, CUIT, alias; no crear dos por CUIT sin una regla de negocio explícita.
- `GET /api/v1/billeteras/{wallet_id}` y `/movimientos?limit&cursor`.
- `POST /api/v1/billeteras/{wallet_id}/cargas` — amount_minor y referencia externa.
- `POST /api/v1/billeteras/{wallet_id}/pagos` — amount_minor, `sale_id`, comercio y llave idempotente.

## Persistencia y migración

Conservar cuentas y movimientos; crear claves internas UUID/ID estable, ledger transaccional, `payment_id`, idempotency records y referencia a `sale_id`. Mantener restricción unique en alias según política acordada. Migrar el monto en pesos a unidad menor con auditoría de conteos/saldos antes/después.

## Criterios de aceptación del ajuste

- Saldo nunca cambia sin su movimiento correspondiente.
- Repetir carga/pago con la misma llave no produce un segundo asiento.
- La respuesta incluye ID de operación, estado, monto y saldo en unidades comunes.
- El Docker publicado incluye la UI documentada.

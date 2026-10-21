# Ajuste de contrato — ARCA / comprobantes

## Estado actual

No se encontró una aplicación/backend de ARCA en este checkout. `doc/sistema.md` la ubica después del pago y prevé un comprobante de prueba con CAE ficticio. El frontend ARBA tiene un indicador `arca_facturacion`, pero ese toggle no prueba inscripción ni emisión de comprobante.

## Contrato que debe acordarse

- Mantener clara la responsabilidad: ARCA de la simulación emite comprobantes de prueba; no representa conexión con ARCA oficial.
- Emitir el comprobante solo con una venta/pago confirmado y datos congelados de la operación. Definir primero tipos de comprobante, numeración y qué campos son obligatorios para el alcance académico.
- Enlazar cada comprobante a `sale_id` único; registrar respuesta idempotente y evitar doble emisión.
- Acordar si se emite un comprobante único por venta y cómo se representa el desglose de subtotal/percepción.
- Usar importes y moneda del contrato común, CUIT string y fechas ISO 8601.

### Rutas objetivo orientativas

- `POST /api/v1/arca/comprobantes` con `Idempotency-Key` y `{ sale_id, emisor_cuit, receptor_cuit?, subtotal_minor, tax_minor, total_minor, currency, lines }`.
- `GET /api/v1/arca/comprobantes/{receipt_id}` y `GET /api/v1/arca/comprobantes?sale_id=...` para consulta/reconciliación.

Éxito sugerido: `{ "data": { "receipt_id": "...", "sale_id": "VENTA-123", "status": "issued", "cae": "CAE-DEMO-...", "issued_at": "...", "currency": "ARS", "total_minor": 0, "is_simulated": true } }`.

## Persistencia requerida

Guardar solicitud inmutable, resultado, número/CAE ficticio, estado y timestamp. Aplicar unique a `sale_id` para comprobante principal y conservar auditoría si se anula o reemite según reglas futuras.

## Criterios de aceptación

- No se emite dos veces para el mismo `sale_id` en reintentos.
- Una venta sin pago confirmado no recibe estado `issued`.
- UI/TPV identifican el comprobante como simulado y consultable.

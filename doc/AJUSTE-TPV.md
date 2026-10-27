# Ajuste de contrato — TPV

Para requerimientos de interfaz del panel de operación, consultar [TPV-PANEL-CONTROL-SEBASTIAN.md](TPV-PANEL-CONTROL-SEBASTIAN.md).

## Estado actual

`doc/sistema.md` especifica la intención: `GET /health`, `POST /tpv/ventas` con `id_venta`, `comercio_cuit`, productos `{ producto_id, cantidad }` y `medio_pago`; `GET /tpv/ventas/{id}` entrega desglose y estados. Esa documentación aclara que los precios se resuelven en servidor y que `id_venta` permite reintentar.

En el checkout, `sebasTPV` contiene archivos Nginx/Docker de despliegue y declara que no contiene la app; el Dockerfile espera fuentes externas. No se pudo contrastar el contrato con un backend TPV implementado aquí.

## Ajuste requerido antes de integración

- Convertir la especificación en contrato ejecutable versionado/OpenAPI junto con los clientes de ARBA, Municipio, Banco/Billetera y ARCA.
- Cambiar `id_venta` por `sale_id` canónico (alias de transición), generado una sola vez por el cliente y conservado en cada reintento.
- Solicitar `commerce_id` o CUIT y líneas `{ product_id, quantity }`; calcular precios, subtotal, impuestos y total en servidor.
- Usar `payment_method: "bank" | "wallet"`, elegir exactamente uno; añadir llave idempotente.
- Acordar moneda/importe (`amount_minor`, centavos ARS) y no enviar total autoritativo desde el navegador.
- Persistir venta, líneas, snapshot de precio/tasa y etapas de integración. Exponer consulta/recuperación por `sale_id`.
- Estados mínimos: `pending`, `processing`, `confirmed`, `failed`, `requires_review`; no declarar venta exitosa si una etapa aguas abajo falló.
- Evitar transacción distribuida ficticia: aplicar flujo reintentable con outbox/compensaciones y referencias de cada módulo.

### Contrato objetivo orientativo

`POST /api/v1/tpv/ventas` con `Idempotency-Key`:

```json
{
  "sale_id": "VENTA-123",
  "cuit_comercio": "30712345678",
  "items": [{ "product_id": "SKU-01", "quantity": 2 }],
  "payment_method": "wallet",
  "currency": "ARS"
}
```

Responder con `{ "data": { "sale_id": "VENTA-123", "status": "pending", "subtotal_minor": 0, "tax_minor": 0, "total_minor": 0, "payment": null, "receipt": null } }`. Los valores se completan desde el backend y las integraciones, no desde el ejemplo.

`GET /api/v1/tpv/ventas/{sale_id}` debe devolver snapshot de líneas, montos, percepción, estado de cobro, comprobante y errores recuperables sin volver a ejecutar etapas confirmadas.

## Persistencia requerida

Tablas/entidades: catálogo y precios vigentes; venta; líneas; transiciones de venta; idempotency key; referencias de percepción, pago y comprobante. El TPV no escribe directamente en tablas de otros dominios.

## Criterios de aceptación del ajuste

- Fuentes completas de UI/API y contrato disponibles dentro del repositorio/versionado.
- Reintento de la venta no duplica ninguna etapa.
- Una falla de integración deja la operación consultable y recuperable.
- Precio, percepción y total se recomputan/validan en servidor.

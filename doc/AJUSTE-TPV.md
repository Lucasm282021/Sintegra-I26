# Ajuste de contrato — TPV

Para el panel de operación propuesto para Sebastián, consultar [TPV-PANEL-CONTROL-SEBASTIAN.md](TPV-PANEL-CONTROL-SEBASTIAN.md). El contrato ejecutable vive en el backend común y su prueba está en `backend/test/integracion.test.js`.

## Estado

`backend/src/modulos/tpv.js` expone catálogo y ventas en `https://sintegra-backend.vercel.app/tpv`. David y Sebastián tienen terminales independientes (`david`, `sebastian`) y catálogo aislado por terminal y CUIT. El checkout central valida precio/stock, acepta Banco o Billetera, registra ARBA y emite comprobante ARCA dentro de una sola transacción de la misma base. Un fallo revierte todo; la repetición de `id_venta` con el mismo payload devuelve la venta ya completada, y payload diferente se rechaza con 409.

El checkout es académico y genera CAE ficticio. La interfaz TPV de David conserva todavía sus repositorios/clientes propios; los archivos disponibles para Sebastián son configuración/despliegue, no su frontend fuente completo. Ambos frontends deben migrarse para que todas las ventas se guarden en `tpv.ventas`.

## Rutas disponibles

- `GET /health` dentro del módulo común se publica como `/tpv/health`.
- `GET /tpv/terminales` lista terminales.
- `GET /tpv/productos?terminal_id=david&cuit=30712345678` lista catálogo; `POST /tpv/productos` crea una línea de catálogo.
- `GET /tpv/ventas[?terminal_id=david]` lista las últimas ventas.
- `GET /tpv/ventas/{id_venta}` trae venta y líneas.
- `POST /tpv/ventas` completa el checkout.

Ejemplo de creación de venta:

```json
{
  "id_venta": "venta-2026-0001",
  "terminal_id": "david",
  "comercio_cuit": "30712345678",
  "medio_pago": "banco",
  "items": [{ "producto_id": "UUID-del-catalogo", "cantidad": 2 }]
}
```

Para Billetera usar `medio_pago: "billetera"` e incluir `cuit_cliente`. Para Banco puede omitirse `cuenta_origen` en el entorno demo; se usa la cuenta mostrador. En ambos casos el CUIT del comercio debe existir en el padrón y tener cuenta bancaria si cobra por Banco. Productos, precio y stock se resuelven por catálogo, nunca se toman del total que envía el cliente.

## Persistencia y consistencia

La venta guarda estado, subtotal, percepción, total y referencias; `tpv.venta_items` conserva el snapshot de cantidad/precio. La transacción incluye el cobro, la percepción, la numeración y comprobante. Los identificadores de los sistemas integrados quedan en `ref_pago`, `ref_percepcion` y `ref_comprobante`. El backend monolítico puede usar una transacción común de Postgres; si luego se separan los servicios, habrá que reemplazar esa garantía por outbox, estados intermedios y recuperación idempotente.

Migración aditiva: `20261028000004_municipio_tpv_operativos.sql` agrega huella de payload a `tpv.ventas`; no reinicia catálogo ni ventas existentes.

## Trabajo pendiente de los frontends

- Cambiar cada TPV a `VITE_BACKEND_URL=https://sintegra-backend.vercel.app` y usar la terminal correcta.
- Reemplazar almacenamiento JSON/local por `GET/POST /tpv/productos` y `GET/POST /tpv/ventas`.
- Mostrar respuesta `completada`, falta de fondos, stock, conflicto 409 y errores de red sin simular éxito.
- Para TPV Sebastián hace falta obtener el fuente editable de la interfaz; el checkout actual solo aporta artefactos de despliegue.
- No enviar operaciones con CUIT o dinero real: Banco y ARCA son demos.

# Ajuste de contrato — Banco

## Estado actual

No se encontró backend ni contrato de API de Banco en el checkout. La única integración descrita está en `doc/BILLETERA-VIRTUAL.md`: cuando se configura `BANCO_URL`, Billetera llama a `POST /banco/pagos` con `{ cuit, monto, tipo: "carga_billetera", billetera_id, alias }`. La respuesta exitosa hace que Billetera acredite localmente. No se describe llave idempotente común ni compensación.

## Contrato que debe acordarse

- Formalizar Banco como servicio del ecosistema o módulo del backend unificado; definir primero si procesa cobro TPV, fondeo de billetera o ambos como operaciones distintas.
- No reutilizar el endpoint genérico ambiguo `/banco/pagos` para flujos con semánticas distintas sin `operation_type` explícito.
- Todo movimiento recibe `Idempotency-Key`, referencia de origen (`sale_id` o `wallet_load_id`), cuenta de origen/destino y `amount_minor` + moneda.
- Responder un `payment_id` estable y estado `pending`, `succeeded`, `failed` o `reversed`; la Billetera no debe asumir éxito solo por recibir una respuesta no validada.
- Acordar timeout, consulta por ID y política de reversa; no dar por completado un cobro que quedó indeterminado por corte de red.

### Rutas objetivo orientativas

- `POST /api/v1/banco/pagos` con `Idempotency-Key` y `{ operation_type, sale_id?, wallet_load_id?, payer_cuit, payee_cuit, amount_minor, currency }`.
- `GET /api/v1/banco/pagos/{payment_id}` para reconciliación de estado.
- `POST /api/v1/banco/pagos/{payment_id}/reversiones` si la regla del negocio autoriza reversas, también idempotente.

## Persistencia requerida

Registrar órdenes de pago, llaves idempotentes, estados/eventos y referencias de origen; no persistir datos de tarjeta o credenciales sensibles en claro. Definir la relación con el ledger de billetera para que cada carga se refleje una sola vez.

## Criterios de aceptación

- El contrato y la simulación de Banco existen y están documentados antes de conectar billetera/TPV.
- La misma llave/request devuelve el mismo `payment_id` y resultado.
- Billetera/TPV pueden consultar un pago incierto y reconciliar sin volver a debitar.

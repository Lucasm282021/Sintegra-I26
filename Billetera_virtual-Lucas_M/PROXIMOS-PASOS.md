# Próximos pasos — Lucas-M (módulo Billetera Virtual)

## Estado actual
El único módulo con **código real funcionando**: servicio standalone en el puerto 3006, con los 5 endpoints del contrato, SQLite propio, Dockerfile, panel web en `public/` y ejemplos con curl. Es la referencia de "módulo terminado" para el resto del curso.

## Tareas concretas
- [ ] Integrar con `BANCO /banco/pagos` (puerto 3002) para respaldar la billetera en una cuenta bancaria real del ecosistema — coordiná el contrato exacto con Rodrigo.
- [ ] Integrar con TPV para que un comercio pueda cobrar una venta directamente desde una billetera, como medio de pago alternativo a tarjeta/transferencia.
- [ ] Probar contra los otros módulos (Postman/curl) simulando pedidos reales del TPV.
- [ ] Sumarte al `docker-compose.yml` de la integración final cuando esté armado.

## Contrato ya implementado (para que otros lo consuman)
- `POST /billetera/cuentas` → 201 / 409 (cuit o alias duplicado)
- `GET /billetera/cuentas/{id}` → 200 / 404
- `GET /billetera/cuentas/{id}/movimientos` → últimos 50
- `POST /billetera/cargas` → acredita saldo
- `POST /billetera/pagos` → 400 si el saldo es insuficiente

## Prompt para tu agente de IA

```
Ya tengo el módulo Billetera Virtual funcionando (puerto 3006, Node.js 24 +
Express + SQLite vía node:sqlite, Dockerfile, panel web en public/) dentro de
un ecosistema fintech simulado de 6 módulos: TPV, BANCO, ARBA, ARCA, MUNICIPIO
y BILLETERA, que se integran por API REST con este contrato común:
- JSON en request y response
- cuit como string, sin puntos ni guiones
- éxito con 200/201 + recurso, errores con {"error": "mensaje"} y status 4xx/5xx

Mis endpoints ya implementados:
- POST /billetera/cuentas (201 / 409 duplicado)
- GET /billetera/cuentas/{id} (200 / 404)
- GET /billetera/cuentas/{id}/movimientos (últimos 50)
- POST /billetera/cargas (acredita saldo)
- POST /billetera/pagos (400 si el saldo es insuficiente)

Lo que sigue es integrar con otros dos módulos que corren en otros puertos:

1. BANCO (puerto 3002, expone POST /banco/pagos y GET /banco/cuentas/{id}/saldo):
   quiero que cuando alguien cargue saldo en su billetera, esa carga quede
   respaldada por un movimiento real en el Banco (débito de la cuenta bancaria
   del titular hacia su billetera). Ayudame a diseñar y codear esa llamada
   HTTP desde mi servicio de Billetera hacia el de Banco, con manejo de error
   si el Banco no responde o rechaza el pago.

2. TPV: quiero exponer la Billetera como medio de pago alternativo, para que
   cuando el TPV registre una venta con medio de pago "billetera", llame a mi
   endpoint POST /billetera/pagos en vez de al Banco.

Ayudame a implementar la integración con Banco primero, con tests manuales
por curl, y después a documentar en mi README cómo el TPV debería llamarme.
```

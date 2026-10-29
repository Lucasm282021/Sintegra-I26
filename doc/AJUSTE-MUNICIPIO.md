# Ajuste de contrato — Municipio

**Estado al 28/10/2026:** API común disponible en `https://sintegra-backend.vercel.app/municipio`. El frontend de Cristian consume este contrato en producción desde `municipioService.ts`; en desarrollo se configura `VITE_BACKEND_URL` o se deja vacío para usar el simulador local.

## Contrato implementado

- `GET /health`: estado de módulo.
- `GET /comercios`: lista habilitaciones con condición fiscal, rubro y resumen de deuda.
- `POST /comercios`: `{ cuit, razon_social, condicion_fiscal, direccion, rubro_principal, rubro_secundario? }`. Da de alta en el padrón compartido, crea la habilitación y genera una obligación demo para el período corriente.
- `GET /comercios/{cuit}`: ficha municipal del contribuyente.
- `GET /tributos/{cuit}`: períodos, importes, estado y deuda agregada.
- `POST /tributos/pagos`: `{ cuit, periodo, monto, cuenta_origen? }`. Debita Banco y marca la tasa pagada dentro de una transacción PostgreSQL.
- `GET /comprobantes[?cuit=...]`: devuelve recibos persistidos, incluyendo la referencia de pago.
- `GET /certificados/libre-deuda/{cuit}`: emite el certificado solo si no hay obligaciones pendientes.

Los errores de negocio usan HTTP apropiado y `{ "error": "mensaje" }`; CUIT y período se validan en el servidor. Un pago repetido con mismo contenido no duplica el movimiento. Un importe incorrecto, saldo insuficiente o pago previo se rechaza.

## Ajustes pendientes en la aplicación

- El simulador local conserva datos de muestra distintos del seed compartido. En producción la fuente del servicio API es el backend; al probar altas y pagos, tener presente que se usan registros ficticios persistentes y compartidos.
- Un contribuyente nuevo requiere una cuenta de Banco asociada antes de pagar. No crear una cuenta bancaria ficticia desde Municipio; informar el caso al usuario o permitir asociar una cuenta a través del módulo Banco.
- Mantener claro en pantalla que los importes, comprobantes y certificados son demos. No son trámites ni pagos reales.
- El detalle fiscal está simplificado a una obligación municipal por período en este prototipo. No representa liquidación municipal oficial ni todos los conceptos jurisdiccionales.

## Persistencia

`padron.contribuyentes` es el perfil compartido; `municipio.habilitaciones` y `municipio.tasas` pertenecen a Municipio. La tasa guarda concepto, desglose, vencimiento, recibo, huella idempotente y referencia bancaria. El débito y la actualización se confirman juntos. La migración aditiva está en `backend/supabase/migrations/20261028000004_municipio_tpv_operativos.sql` y `...00005_municipio_operacion_bancaria.sql`.

## Verificación

La prueba `Municipio: padrón, pago transaccional, comprobante e idempotencia` en `backend/test/integracion.test.js` corre contra PGlite efímero. `npm run lint` y `npm run build` del frontend pasan.

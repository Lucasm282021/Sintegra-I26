# Ajuste de contrato — Municipio

## Estado actual

La API de `municipio-cristian` usa Express/SQLite en 3005: `POST /municipio/comercios` recibe `{ cuit, razon_social, rubro }`; `GET /municipio/comercios/:cuit` consulta; `POST /municipio/tributos/pagos` recibe `{ cuit, periodo, monto }`; `GET /municipio/tributos/:cuit` lista pagos. La DB tiene `comercios_habilitados` y `tasas_municipales`.

La interfaz Next/React tiene un modal React con CUIT, razón social y rubro. `page.tsx` carga tres comercios de ejemplo y `comercios-panel.tsx` solo agrega el formulario al estado de React; no llama a la API. Su objeto enviado usa `razonSocial` camelCase, mientras que la API espera `razon_social`.

## Ajuste a la API unificada

- Conectar el frontend a `/api/v1/municipio/comercios` y quitar datos hardcodeados como fuente visible cuando la API está activa.
- Añadir carga, error de API, reintento y estado vacío; convertir el request con un cliente tipado y no mantener altas solo en memoria.
- Normalizar `razon_social` a `legal_name`/referencia `commerce_id`; mantener CUIT como string.
- Separar habilitación del comercio, liquidación de tasa y pago. El endpoint actual marca `estado_pago='pagado'` al insertar monto directo, sin liquidación ni pago externo; no usarlo como registro real de cobro.
- Definir estados de habilitación explícitos (`pending`, `active`, `suspended`, `rejected`) y respuesta con metadata de jurisdicción/fecha.
- La tasa municipal se calcula/consulta para un período `YYYY-MM`; una tasa no se agrega automáticamente al total de cada venta.

### Rutas objetivo orientativas

- `GET /api/v1/municipio/comercios/{cuit}/habilitacion`
- `POST /api/v1/municipio/comercios/{commerce_id}/habilitaciones` (solicitud)
- `GET /api/v1/municipio/comercios/{commerce_id}/tasas?periodo=YYYY-MM`
- `POST /api/v1/municipio/tasas/{tax_assessment_id}/pagos` con `Idempotency-Key` y referencia al proveedor de pago.

Las rutas deberán respetar el contrato común descrito en `INFORME-UNIFICACION-APPS.md`; no mantener el campo `monto` ambiguo: usar importe menor y moneda.

## Persistencia y migración

Migrar `comercios_habilitados` hacia la entidad compartida de comercio y una tabla propia de habilitaciones municipales; `tasas_municipales` se divide en liquidación por período y pagos. Añadir índices únicos por comercio/jurisdicción y período si la regla lo establece. No borrar pagos históricos ni fijar todo registro nuevo como pagado.

## Criterios de aceptación del ajuste

- Alta React persiste por API y sobrevive al refrescar.
- API y UI usan el mismo esquema validado y los mismos estados.
- Verificar habilitación no depende de una tabla local duplicada de comercios.
- Crear liquidación y confirmar pago son operaciones distintas e idempotentes.

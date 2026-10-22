# ARBA — módulo de percepción de IIBB

Backend del módulo ARBA para **Sintegra I26**, actividad académica de fintech simulada. Mantiene un padrón ficticio, calcula percepciones de Ingresos Brutos y guarda las operaciones en un archivo JSON local.

Los CUIT, nombres de demostración y alícuotas son datos ficticios. No se conecta con ARBA oficial ni representa valores fiscales reales. La alícuota es una fracción decimal: `0.03` equivale a 3%.

## Requisitos y ejecución local

Se necesita Node.js 18 o superior.

```powershell
npm ci
npm start
```

El servicio escucha en `http://localhost:3003`. La primera ejecución crea `data/db.json` con cinco comercios de demostración. Los cambios y percepciones se conservan en ese archivo al reiniciar el servicio.

Variables opcionales (ver `.env.example`):

| Variable | Valor por defecto | Uso |
| --- | --- | --- |
| `PORT` | `3003` | Puerto HTTP |
| `DB_PATH` | `./data/db.json` | Ubicación de la persistencia JSON |

Node no carga `.env` automáticamente. Si necesitás cambiar estas variables en PowerShell, definilas en la terminal antes de iniciar el servicio.

## Contrato HTTP

Todas las solicitudes y respuestas usan JSON. Los errores tienen la forma `{"error":"mensaje"}`. El CUIT debe enviarse como string de 11 dígitos, sin guiones ni puntos. Los importes son pesos positivos con hasta dos decimales.

### Salud

`GET /health` → `200`

```json
{"status":"ok","service":"arba"}
```

### Padrón público

`GET /arba/padron?page=1&limit=10` → `200`

Devuelve `{ "page", "limit", "total", "items" }`. Cada elemento incluye `cuit`, `actividad` y `alicuota`.

`GET /arba/padron/{cuit}` → `200` si existe; `400` si el CUIT no tiene formato válido; `404` si no figura en el padrón.

```json
{"cuit":"20345678901","actividad":"Comercio minorista","alicuota":0.03}
```

### Alta, edición, baja y listado de comercios

El contrato del frontend de referencia usa los campos `cuit`, `razon_social`, `actividad`, `alicuota`, `estado` y `aplicaciones`. Para el alta, CUIT, razón social, actividad y alícuota son obligatorios. `estado` puede ser `activo` o `inactivo`; si se omite, se usa `activo`. Si se omiten aplicaciones, se usan `{"arba_iibb":true,"arca_facturacion":false}`.

- `GET /arba/comercios?page=1&limit=100` → `200` con padrón paginado en el formato `{ "page", "limit", "total", "items" }`.
- `POST /arba/comercios` → `201`; un CUIT ya registrado da `409`.
- `PUT /arba/comercios/{cuit}` → `200`; CUIT inexistente da `404`.
- `DELETE /arba/comercios/{cuit}` → `200`; CUIT inexistente da `404`.
- CUIT inválido o campos inválidos → `400`.

Ejemplo de alta:

```json
{
  "cuit":"30700000001",
  "razon_social":"Comercio de prueba",
  "actividad":"Almacén",
  "alicuota":0.03,
  "estado":"activo",
  "aplicaciones":{"arba_iibb":true,"arca_facturacion":false}
}
```

La baja elimina el comercio del padrón, pero conserva las percepciones ya registradas para que el historial de auditoría siga disponible.

### Crear una percepción

`POST /arba/percepciones` recibe:

```json
{"id_venta":"venta-101","cuit":"20345678901","monto_venta":10000.00}
```

Respuestas:

- `201`: nueva percepción creada.
- `200`: reintento idéntico; devuelve el mismo registro sin duplicarlo.
- `400`: campos inválidos.
- `404`: CUIT válido no registrado.
- `403`: el comercio figura inactivo o tiene `arba_iibb` desactivado.
- `409`: `id_venta` ya se usó con otro CUIT o importe.

El monto se calcula como `round2(monto_venta × alicuota)`. Un resultado posible:

```json
{
  "id":"identificador-generado",
  "id_venta":"venta-101",
  "cuit":"20345678901",
  "monto_venta":10000,
  "alicuota_aplicada":0.03,
  "monto_percepcion":300,
  "fecha":"2026-10-21T12:00:00.000Z"
}
```

Los valores `id` y `fecha` se generan al crear la percepción; el ejemplo solo muestra la forma de la respuesta.

### Historial de auditoría

`GET /arba/percepciones/{cuit}` → `200` con `{ "cuit", "cantidad", "percepciones" }`. Un CUIT con formato válido pero sin operaciones devuelve una lista vacía; un CUIT con formato inválido devuelve `400`.

## Seed ficticio inicial

| CUIT | Etiqueta de razón social | Actividad | Alícuota de ejemplo |
| --- | --- | --- | ---: |
| `20345678901` | Comercio demo 1 | Comercio minorista | `0.03` |
| `27123456789` | Comercio demo 2 | Servicios profesionales | `0.02` |
| `30712345678` | Comercio demo 3 | Gastronomía | `0.035` |
| `20456789012` | Comercio demo 4 | Industria manufacturera | `0.025` |
| `23987654321` | Comercio demo 5 | Servicios financieros | `0.05` |

Estas son alícuotas de muestra que ya se habían definido para el módulo; no son porcentajes fiscales reales. El seed solo se crea si aún no existe el archivo de datos. Para empezar con el seed otra vez, detené el servicio y borrá `data/db.json` manualmente.

## Conectar el frontend de referencia

El frontend de Tomi usa `/api` como URL base y configura un proxy local hacia `http://localhost:3003`. Iniciá ambos procesos por separado desde sus carpetas:

1. En esta carpeta: `npm start`.
2. En la carpeta del frontend de Tomi: `npm install` y `npm run dev`.

El modo API del frontend no debería cambiar automáticamente a Demo cuando el backend no responda. El documento del frontend describe una respuesta distinta en modo Demo para comercios inactivos; el backend de referencia devuelve `403`, y este backend sigue ese comportamiento HTTP.

## Docker

```powershell
docker build -t arba-nehemias .
docker run --rm -p 3003:3003 -v arba-data:/app/data arba-nehemias
```

El volumen `arba-data` conserva el archivo de datos entre reinicios del contenedor.

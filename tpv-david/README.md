# TPV — Terminal de Punto de Venta

Módulo TPV del ecosistema fintech simulado. Tiene un catálogo de productos,
registra ventas de un comercio, cobra contra Banco, calcula la percepción de
IIBB contra ARBA y emite el comprobante contra ARCA. Incluye una interfaz
visual simple para operar la caja sin necesidad de Postman/curl.

**Estado actual: flujo completo + catálogo + interfaz visual + persistencia
en archivo.** Queda pendiente el paso de pruebas cruzadas con los servicios
reales de los otros equipos.

> ⚠️ Los bodies exactos de `/banco/pagos`, `/arba/percepciones` y
> `/arca/comprobantes` no están especificados en el handbook oficial más allá
> de las entidades — son contratos asumidos (ver comentarios en cada archivo
> de `src/infrastructure/`). Falta confirmarlos con los dueños de esos módulos.
>
> ⚠️ **ARCA sigue sin dueño confirmado en la cátedra** (conflicto sin resolver
> entre otros alumnos). Por eso `ARCA_MOCK=true` por defecto.
>
> ⚠️ **Importante (diseño):** si el cobro a Banco se confirma pero después
> falla ARBA o ARCA, la venta queda en estado `error` **con los pasos
> anteriores ya confirmados**. No hay ninguna lógica de reversa/compensación
> automática — es una decisión pendiente de validar con la cátedra o el equipo.
>
> ⚠️ Los ítems de una venta se mandan como `{ "productoId": "...", "cantidad": 2 }`,
> referenciando al catálogo, no como descripción/precio sueltos.

## Requisitos

- Node.js 20+
- npm

## Variables de entorno

Ver `.env.example`. Copiarlo a `.env` antes de correr el proyecto:

```bash
cp .env.example .env
```

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PORT` | Puerto donde escucha el servicio | `3001` |
| `NODE_ENV` | Entorno de ejecución | `development` |
| `BANCO_URL` | URL del módulo Banco | `http://localhost:3002` |
| `BANCO_MOCK` | Si es `true`, simula el cobro sin llamar a Banco de verdad | `true` |
| `ARBA_URL` | URL del módulo ARBA | `http://localhost:3003` |
| `ARBA_MOCK` | Si es `true`, simula la percepción sin llamar a ARBA de verdad | `true` |
| `ARCA_URL` | URL del módulo ARCA | `http://localhost:3004` |
| `ARCA_MOCK` | Si es `true` (o no está seteado), simula la factura sin llamar a ARCA de verdad | `true` |

## Cómo correrlo

```bash
npm install
npm run dev      # modo desarrollo, con recarga automática
```

O para producción:

```bash
npm run build
npm start
```

El servicio queda escuchando en `http://localhost:3001`.

## Persistencia

Las ventas y el catálogo de productos se guardan en archivos JSON dentro de
`data/` (`data/ventas.json`, `data/productos.json`), que se crean solos al
primer uso. Esto sobrevive a un reinicio del proceso — no es una base de
datos real (no hay índices ni transacciones), pero evita perder todo cada
vez que se reinicia el servidor. La carpeta `data/` está en `.gitignore`
(no se sube al repo).

Si preferís correr sin tocar el disco (por ejemplo, para tests), las clases
`InMemoryVentaRepository` e `InMemoryProductoRepository` siguen disponibles
en `src/infrastructure/` con la misma interfaz.

## Interfaz visual

Con el servicio corriendo, abrí **http://localhost:3001** en el navegador.
Vas a ver:

- **Catálogo** (izquierda): productos cargados, tocás uno para agregarlo a la
  venta actual. Abajo hay un formulario para cargar productos nuevos.
- **Venta actual** (derecha): el "ticket" con lo que se va a cobrar, con
  controles de `+`/`−` por cantidad, el total, y el botón **Cobrar**.
- Arriba: datos del comercio (CUIT, razón social) y medio de pago.

Al cobrar, la interfaz muestra el resultado: pago, percepción y CAE si salió
bien, o el motivo si algo falló en el camino.

Para cargar muchos productos de una sola vez, usá `POST /tpv/productos/bulk`
(ver más abajo).

## Cómo correrlo con Docker

```bash
docker build -t tpv .
docker run -p 3001:3001 --env-file .env -v $(pwd)/data:/app/data tpv
```

El `-v` monta la carpeta `data/` como volumen para que la persistencia
sobreviva también a un reinicio del contenedor (no solo del proceso).

## Endpoints

### `GET /health`

```bash
curl http://localhost:3001/health
```

### `POST /tpv/productos`

Carga un producto al catálogo.

**Request:**
```json
{ "nombre": "Coca Cola 500ml", "precio": 1500, "codigo": "COC500" }
```

`codigo` es opcional. **Response `201`:**
```json
{ "id": "a1b2c3...", "nombre": "Coca Cola 500ml", "precio": 1500, "codigo": "COC500" }
```

### `POST /tpv/productos/bulk`

Carga muchos productos de una sola vez.

**Request:**
```json
{
  "productos": [
    { "nombre": "Coca Cola 500ml", "precio": 1500 },
    { "nombre": "Alfajor", "precio": 800 }
  ]
}
```

**Response `201`:**
```json
{ "creados": 2, "productos": [ { "id": "...", "nombre": "...", "precio": 1500 }, ... ] }
```

### `GET /tpv/productos?page=1&limit=20`

Lista el catálogo, paginado.

**Response `200`:**
```json
{ "productos": [ ... ], "total": 137, "page": 1, "limit": 20 }
```

### `GET /tpv/productos/:id`

**Response `404`** si no existe:
```json
{ "error": "producto no encontrado" }
```

### `POST /tpv/ventas`

Registra una venta nueva. Los ítems referencian productos ya cargados.

**Request:**
```json
{
  "comercio": { "cuit": "20345678901", "razonSocial": "Kiosco Don José" },
  "items": [
    { "productoId": "a1b2c3...", "cantidad": 2 },
    { "productoId": "d4e5f6...", "cantidad": 1 }
  ],
  "medioPago": "efectivo"
}
```

**Response `201`** (venta creada, cobrada, con percepción y factura):
```json
{
  "id": "b3f1c2a0-...",
  "comercio": { "cuit": "20345678901", "razonSocial": "Kiosco Don José" },
  "items": [
    { "productoId": "a1b2c3...", "descripcion": "Coca Cola 500ml", "cantidad": 2, "precioUnitario": 1500 },
    { "productoId": "d4e5f6...", "descripcion": "Alfajor", "cantidad": 1, "precioUnitario": 800 }
  ],
  "total": 3800,
  "medioPago": "efectivo",
  "estado": "completada",
  "pago": { "movimientoId": "mock-1758067200000", "confirmadoEn": "2026-09-16T20:00:00.000Z" },
  "percepcion": { "montoPercepcion": 190, "alicuotaAplicada": 0.05 },
  "factura": {
    "cae": "MOCK1758067200000",
    "vencimientoCae": "2026-09-26",
    "tipoComprobante": "B",
    "puntoVenta": "0001",
    "numero": "00000001"
  },
  "createdAt": "2026-09-16T20:00:00.000Z"
}
```

**Errores de validación (`400`):**
```json
{ "error": "comercio.cuit inválido: debe ser un string de 11 dígitos, sin puntos ni guiones" }
```

**Producto inexistente (`404`):**
```json
{ "error": "producto a1b2c3... no encontrado en el catálogo" }
```

**Banco rechaza el pago (`402`):**
```json
{ "error": "saldo insuficiente" }
```

**ARBA o ARCA no tienen el comercio en su padrón (`422`):**
```json
{ "error": "comercio no encontrado en el padrón de ARCA" }
```

**Alguna integración no responde (`503`):**
```json
{ "error": "arca no disponible" }
```

Ejemplo con curl (primero cargá un producto, después vendé):

```bash
PRODUCTO_ID=$(curl -s -X POST http://localhost:3001/tpv/productos \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Coca Cola 500ml","precio":1500}' | jq -r .id)

curl -X POST http://localhost:3001/tpv/ventas \
  -H "Content-Type: application/json" \
  -d "{
    \"comercio\": { \"cuit\": \"20345678901\", \"razonSocial\": \"Kiosco Don José\" },
    \"items\": [{ \"productoId\": \"$PRODUCTO_ID\", \"cantidad\": 2 }],
    \"medioPago\": \"efectivo\"
  }"
```

### `GET /tpv/ventas/:id`

**Response `404`:**
```json
{ "error": "venta no encontrada" }
```

## Contrato común respetado

- Formato `application/json` en request y response.
- `cuit` siempre como string de 11 dígitos, sin puntos ni guiones.
- Errores como `{ "error": "mensaje" }` con status 4xx/5xx.
- Éxito con status 200/201 + el recurso creado o consultado.

## Arquitectura interna

```
src/
  domain/            → Entidades (Venta, Producto, Comercio) y reglas de negocio puras
  application/        → Casos de uso (VentasService, ProductosService)
  infrastructure/      → Persistencia (archivo JSON) y clientes HTTP (con mocks)
  interfaces/http/      → Rutas Express y manejo de errores
public/               → Interfaz visual (HTML/CSS/JS simple, sin build step)
data/                  → Archivos de persistencia (se crean solos, no se suben al repo)
```

## Próximos pasos

- [x] Integración con `BANCO /banco/pagos` — *contrato asumido, falta confirmar con Rodrigo*
- [x] Integración con `ARBA /arba/percepciones` — *contrato asumido, falta confirmar con Nehemias*
- [x] Integración con `ARCA /arca/comprobantes` — *contrato asumido; ARCA sin dueño confirmado*
- [x] Catálogo de productos + interfaz visual
- [x] Persistencia en archivo (sobrevive reinicios)
- [ ] Pruebas cruzadas con los otros módulos
- [ ] Decidir qué hacer si el cobro se confirma pero falla un paso posterior

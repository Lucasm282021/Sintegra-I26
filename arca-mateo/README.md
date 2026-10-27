# ARCA Service - módulo simulado

Servicio académico de padrón de contribuyentes y emisión de comprobantes con CAE ficticio. No llama servicios fiscales reales. Puerto por defecto: `3004`.

## Requisitos y ejecución

- Node.js 18 o superior.
- Dependencia Express declarada en `package.json`.

```bash
npm install
npm start
```

En desarrollo: `npm run dev`.

## Configuración

El proyecto no carga `.env` automáticamente para evitar agregar dependencias. Configurá estas variables en el entorno:

- `PORT`: puerto HTTP; por defecto `3004`.
- `ARCA_DATA_FILE`: JSON persistente; por defecto `data/arca.json`.
- `ARCA_PUNTO_VENTA`: punto de venta configurado para la instancia; por defecto `00001`, de 1 a 5 dígitos.
- `ARCA_SETUP_TOKEN`: token opcional de un solo uso lógico para permitir el primer superadmin cuando el servicio corre en Docker o detrás de una red privada.

El request mínimo no incluye punto de venta. Por eso se toma de la configuración de la instancia; el correlativo se conserva por punto de venta y tipo. Confirmar este supuesto con la cátedra antes de integrar con TPV.

## Contrato común

- HTTP REST y JSON UTF-8; campos `snake_case`.
- CUIT string de 11 dígitos, sin puntos ni guiones.
- `id_venta` string globalmente único e idempotente.
- `monto_total`: número positivo en pesos, con hasta dos decimales.
- Fecha de emisión ISO 8601 UTC.
- Errores: `{"error":"mensaje"}`.
- El CAE lleva prefijo `FICTICIO-`; no posee validez fiscal.

## Inicio de sesión y roles

Al iniciar por primera vez, abrí <http://localhost:3004/> y creá el superadmin. El correo debe tener formato `@gmail.com`, pero el sistema no inicia sesión en Google ni verifica la propiedad del correo. La contraseña es propia de ARCA: no ingreses la contraseña real de Gmail. Se almacena con `scrypt` y debe tener entre 10 y 128 caracteres. No hay registro público.

La configuración inicial solo puede hacerse desde el equipo local. En Docker o en una red privada, configurá `ARCA_SETUP_TOKEN` y escribí ese token en la pantalla inicial. Guardá ese secreto fuera del repositorio y retiralo del entorno después de crear la primera cuenta.

| Permiso | Superadmin | Admin | Usuario |
| --- | --- | --- | --- |
| Consultar padrón, emitir y consultar comprobantes | Sí | Sí | Sí, solo sus comprobantes |
| Crear cuentas comunes y activarlas/desactivarlas | Sí | Sí | No |
| Asignar roles o administrar cuentas admin/superadmin | Sí | No | No |
| Restablecer clave de otros usuarios | Sí | Solo cuentas comunes | No |
| Cambiar su propia clave | Sí | Sí | Sí |

El backend protege las rutas además de ocultar los controles de la interfaz. La sesión usa una cookie `HttpOnly`, vence a las 8 horas y se cierra al reiniciar el servidor. Cinco accesos incorrectos bloquean nuevos intentos durante un minuto.

### Endpoints de autenticación

- `GET /auth/status`: indica si falta crear el primer superadmin.
- `POST /auth/setup`: crea el primer superadmin una sola vez.
- `POST /auth/login`: inicia sesión y entrega la cookie.
- `GET /auth/me`: devuelve la cuenta autenticada.
- `POST /auth/logout`: cierra la sesión.
- `POST /auth/password`: cambia la propia contraseña; requiere `current_password` y `password`.
- `GET /admin/users`, `POST /admin/users`, `PATCH /admin/users/{id}` y `POST /admin/users/{id}/password`: administración autorizada de cuentas.

`/health`, `/auth/status`, `/auth/setup`, `/auth/login` y `/auth/logout` son públicos; `/auth/me` y `/auth/password` requieren sesión. Todas las rutas `/arca/...` y `/admin/...` requieren sesión. Los errores siguen el formato `{"error":"mensaje"}`. La integración de TPV ahora debe enviar la cookie de sesión autorizada.

## Interfaz web

El frontend está en `public/` y usa HTML, CSS y JavaScript nativos. No requiere dependencias adicionales. Con el backend iniciado, abrir <http://localhost:3004/>. La pantalla inicial guía la creación del primer superadmin o el inicio de sesión; después muestra las funciones disponibles según el rol.

Al abrir la página se reproduce la intro de marca desde `public/assets/arca-intro.mp4`. Se reproduce una vez por carga, avanza automáticamente al terminar y tiene un botón para saltarla. Si la reproducción automática no está disponible o el navegador solicita menos movimiento, la intro se omite y se muestra el acceso.

Para ejecutarlo desde Live Server u otro servidor local, iniciá también el backend en el puerto 3004. El backend permite solicitudes CORS únicamente desde orígenes `localhost` y `127.0.0.1`. No abras `index.html` como archivo `file://`; usá el servidor estático local o la interfaz servida por Express.

La búsqueda usa los filtros de API `tipo` y `pv`. El punto de venta no forma parte de la respuesta del comprobante; la interfaz muestra el valor configurado para el servicio, cuyo valor predeterminado es `00001`.

## Endpoints ARCA

### Salud

`GET /health` -> `200`:

```json
{"status":"ok","servicio":"arca"}
```

### Consultar contribuyente (requiere sesión)

`GET /arca/contribuyentes/{cuit}` -> contribuyente (`200`) o error (`404`). Un CUIT inválido devuelve `400`.

```bash
curl -b arca-cookies.txt http://localhost:3004/arca/contribuyentes/30712345678
```

### Emitir comprobante (requiere sesión)

`POST /arca/comprobantes`

Request:

```json
{"id_venta":"venta-1","cuit":"30712345678","monto_total":10506.00,"tipo_comprobante":"FACTURA_B"}
```

Una nueva emisión devuelve `201` y el recurso directamente:

```json
{"id":"<uuid>","id_venta":"venta-1","cuit":"30712345678","numero_comprobante":"00000001","tipo_comprobante":"FACTURA_B","monto_total":10506.00,"cae":"FICTICIO-<identificador>","fecha_emision":"<ISO-8601-UTC>","estado":"emitido"}
```

Tipos admitidos: `FACTURA_A`, `FACTURA_B`, `FACTURA_C`. El tipo se recibe en el request; esta versión no lo infiere de la condición fiscal del cliente.

### Consultar comprobante (requiere sesión)

Ruta adicional del análisis ARCA v2: `GET /arca/comprobantes/{numero}` -> recurso (`200`) o `404`. El número es de 8 dígitos, correlativo por punto de venta/tipo. Si el número coincide con más de una serie, usar filtros `cuit`, `tipo` y/o `pv`:

```bash
curl -b arca-cookies.txt 'http://localhost:3004/arca/comprobantes/00000001?tipo=FACTURA_B&pv=00001'
```

Una búsqueda que siga siendo ambigua devuelve `409` con formato de error común.

## Persistencia y numeración

`ARCA_DATA_FILE` guarda emisiones, padrón de prueba, correlativos por punto de venta/tipo y hashes de contraseña. Una repetición idempotente no consume otro número. Cada comprobante nuevo registra internamente la cuenta emisora; ese dato no se agrega a la respuesta del contrato. El archivo local de datos queda ignorado por Git; no subirlo al repositorio. No borrar el archivo si se desea conservar cuentas y numeración.

Los CUIT seed del proyecto son ficticios y reproducibles.

## Idempotencia y errores

- Misma `id_venta` y mismo contenido: `200` con el comprobante original.
- Misma `id_venta` con contenido diferente: `409`.
- Entrada inválida: `400`; recurso inexistente: `404`; error interno: `500`.
- Todos los errores: `{ "error": "mensaje" }`.

## Verificación manual reproducible

Con Express instalado, ejecutar la suite automática desde esta carpeta:

```bash
npm test
```

La suite usa un puerto temporal, configura un superadmin con contraseña de ARCA y un archivo JSON temporal; cubre salud, acceso autenticado, padrón, emisión, reintento idempotente, conflicto, validaciones y lectura tras recargar el módulo.

Con el servicio activo y con la cookie de sesión guardada en `arca-cookies.txt` (por ejemplo, tras iniciar sesión con `curl -c arca-cookies.txt -H "Content-Type: application/json" -d '{"email":"admin@gmail.com","password":"clave-ARCA-de-ejemplo"}' http://localhost:3004/auth/login`):

```bash
curl -i http://localhost:3004/health
curl -i -b arca-cookies.txt http://localhost:3004/arca/contribuyentes/30712345678
curl -i -b arca-cookies.txt -X POST http://localhost:3004/arca/comprobantes -H "Content-Type: application/json" -d '{"id_venta":"venta-demo-1","cuit":"30712345678","monto_total":10506.00,"tipo_comprobante":"FACTURA_B"}'
```

Repetir el POST idéntico debe devolver `200` con los mismos `id`, número y CAE. Cambiar el monto y conservar `id_venta` debe devolver `409`. CUIT mal formado devuelve `400`; CUIT válido no seed devuelve `404`. Consultar el número devuelto con la ruta de consulta y filtros.

## Docker

```bash
docker build -t arca-service .
docker run --rm -p 3004:3004 -e ARCA_SETUP_TOKEN=pon-un-token-secreto -v arca-data:/app/data arca-service
```

Al usar Docker, reemplazá el valor de ejemplo por un token secreto y escribilo en la pantalla de configuración inicial del superadmin. No lo guardes en Git.

## Despliegue en Vercel (cátedra)

Publicado en <https://arca-mateo.vercel.app> como proyecto `arca-mateo` (Root Directory `arca-mateo/`).

- `api/index.js` exporta la app de Express como función; `vercel.json` sirve `public/` y envía `/health`, `/auth/*`, `/admin/*` y `/arca/*` a la función.
- El disco de Vercel es temporal (`ARCA_DATA_FILE=/tmp/arca/arca.json`): usuarios y comprobantes se reinician cuando la función se apaga. Las sesiones también.
- Por eso, si no hay usuarios, el servidor crea un superadmin demo con `ARCA_ADMIN_EMAIL` y `ARCA_ADMIN_PASSWORD`. En Vercel no se acepta la configuración inicial "desde el equipo local".
- Cuenta demo de la cátedra: `demo.arca.i26@gmail.com` / `ArcaDemo2026` (solo para la simulación; no es un Gmail real).
- Cuando exista el backend unificado, estos datos pasan al esquema `arca` de Supabase.

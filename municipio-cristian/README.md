# Módulo Municipio — Cristian Mendiburu

Servicio REST para habilitaciones comerciales y pagos de tasas municipales (TSyH), implementado con Node.js, Express y SQLite.

## Documentación funcional

- [Habilitación municipal](habilitacion-municipal.html) — requisitos, flujo de solicitud, estados y evolución sugerida de la API.

## Ejecutar con Docker Compose

Requisitos: Docker Desktop con Docker Compose.

Desde esta carpeta:

```sh
docker compose up --build -d
```

Esto construye la imagen `municipio-cristian:local`, inicia el contenedor `municipio-cristian` y publica la API en `http://localhost:3005`. La base SQLite queda en el volumen persistente `municipio-data`.

### Controlar el servicio

```sh
docker compose ps
docker compose logs -f municipio
docker compose restart municipio
docker compose down
```

`docker compose down` detiene y elimina el contenedor, pero conserva la base de datos. Para reconstruir y desplegar cambios, ejecutar otra vez `docker compose up --build -d`.

Comprobar estado:

```sh
curl http://localhost:3005/health
```

La respuesta esperada es `{"status":"ok","servicio":"municipio"}`. El chequeo de salud también está configurado en Compose.

## API

- `POST /municipio/comercios` — registra una habilitación. JSON: `{"cuit":"30712345678","razon_social":"Comercio Demo","rubro":"Alimentos"}`.
- `GET /municipio/comercios/{cuit}` — consulta la habilitación.
- `POST /municipio/tributos/pagos` — registra un pago. JSON: `{"cuit":"30712345678","periodo":"2026-09","monto":12500}`.
- `GET /municipio/tributos/{cuit}` — consulta los tributos registrados.
- `GET /health` — estado del servicio.

El puerto predeterminado es `3005`. `PORT` y `DB_PATH` se pueden cambiar mediante variables de entorno. En Compose, la base se guarda en `/data/municipio.db` y los datos persisten en el volumen `municipio-data`.

## Ejecutar sin Docker

```sh
npm ci
npm start
```

La aplicación crea el archivo SQLite automáticamente. Por defecto se guarda en `municipio.db` junto al servidor.

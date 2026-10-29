# Módulo Municipio — Cristian Mendiburu

Servicio REST para habilitaciones comerciales y pagos de tasas municipales (TSyH), implementado con Node.js, Express y SQLite.

## Documentación funcional

- [Habilitación municipal](habilitacion-municipal.html) — requisitos, flujo de solicitud, estados y evolución sugerida de la API.
- [Manual de usuario del ecosistema](../doc/MANUAL-USUARIO-SINTEGRA.html) — recorrido común por Banco, Billetera, ARCA, ARBA, Municipio y TPV.

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

- `POST /municipio/comercios` — registra una solicitud en estado `pendiente`; no aprueba el local ni genera tasas. JSON de prueba: `{"cuit":"20123456786","razon_social":"Comercio Sintético","rubro":"Alimentos"}`. El CUIT pasa validación de dígito de control, pero eso no acredita su existencia ante ARCA.
- `GET /municipio/comercios/{cuit}` — consulta el registro y su estado. Los registros activos anteriores se conservan; las altas nuevas quedan pendientes.
- `POST /municipio/tributos/pagos` — permite registrar en SQLite el pago de una obligación pendiente ya emitida para un comercio habilitado, con período e importe coincidentes. No crea obligaciones ni mueve dinero bancario.
- `GET /municipio/tributos/{cuit}` — consulta los tributos registrados.
- `GET /health` — estado del servicio.

El puerto predeterminado es `3005`. `PORT` y `DB_PATH` se pueden cambiar mediante variables de entorno. En Compose, la base se guarda en `/data/municipio.db` y los datos persisten en el volumen `municipio-data`.

## Ejecutar sin Docker

```sh
npm ci
npm start
```

La aplicación crea el archivo SQLite automáticamente. Por defecto se guarda en `municipio.db` junto al servidor.

## Alcance e integración

Este servicio SQLite es una variante local/legacy separada del backend común PostgreSQL. La UI React también dispone de un servicio simulado y puede configurarse para consumir el backend común. No sincroniza automáticamente sus datos con esa base, ni con ARCA, ARBA, Banco o un municipio real. No usar datos personales ni pagos reales. Para cambiar registros existentes, primero definir y ejecutar una migración respaldada; el código actualizado no modifica la base persistente al arrancar.

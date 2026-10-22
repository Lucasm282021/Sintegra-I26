# ARBA — módulo académico de percepción de IIBB

Módulo individual para el parcial de Nehemías dentro de Sintegra I26. Incluye una API Express y una interfaz React/Vite en las carpetas `backend` (raíz de este paquete) y `frontend`.

**Es una simulación académica.** Los CUIT, comercios, actividades, códigos `DEMO-*` y alícuotas son ficticios. El sistema no consulta ARBA ni ARCA y no confirma inscripciones fiscales oficiales. La interfaz muestra este aviso al administrar comercios.

## Ejecutar en la computadora

Requiere Node.js 18 o superior. En una terminal, ejecutar primero dentro de esta carpeta:

```powershell
npm ci
npm start
```

Dejar esa terminal abierta. En otra terminal, entrar a `frontend` y ejecutar:

```powershell
npm install
npm run dev
```

Abrir `http://localhost:5173`. La API escucha en `http://localhost:3003`; Vite conecta el navegador con ella.

## Contrato versionado

Las rutas nuevas se publican bajo `/api/v1/arba`. El frontend las usa para salud, padrón, cálculo e historial. Durante la transición se conservan las rutas anteriores `/health` y `/arba/...`; el formulario administrativo actual sigue usando esas rutas antiguas.

- `GET /api/v1/arba/health`
- `GET /api/v1/arba/padron?page=1&limit=10`
- `GET /api/v1/arba/padron/{cuit}` y `GET /api/v1/arba/inscripciones-iibb/{cuit}`
- `GET|POST /api/v1/arba/comercios`, `PUT|DELETE /api/v1/arba/comercios/{cuit}` para el perfil comercial
- `POST /api/v1/arba/inscripciones-iibb` y `PUT|DELETE /api/v1/arba/inscripciones-iibb/{cuit}` para la inscripción simulada
- `POST /api/v1/arba/percepciones` y `GET /api/v1/arba/percepciones/{cuit}`
- `GET /api/v1/arba/auth/setup-status`, `POST /api/v1/arba/auth/bootstrap`, `POST /api/v1/arba/auth/login`, `GET /api/v1/arba/auth/me`
- `GET|POST /api/v1/arba/auth/users` (solo superadmin)

### Calcular percepción

Enviar `sale_id`, CUIT (o `commerce_id` generado), importe entero en centavos y moneda. La API obtiene la alícuota vigente y realiza el cálculo en el servidor. `sale_id` funciona como clave de idempotencia; también se acepta el encabezado `Idempotency-Key`.

```json
{
  "sale_id": "VENTA-DEMO-123",
  "cuit": "20345678901",
  "base_amount_minor": 1000000,
  "currency": "ARS"
}
```

`1000000` representa $10.000,00. La primera creación responde `201`; un reintento igual responde `200` con la misma operación; si se intenta reutilizar la clave con datos distintos responde `409`. El resultado incluye la tasa, su versión, fecha inicial de vigencia y fuente.

## Datos y persistencia

La primera ejecución crea `data/db.json` con cinco comercios de prueba y alícuotas de ejemplo (`0.03` equivale a 3%). La fuente está rotulada como semilla académica ficticia, con jurisdicción de demostración `AR-B`, vigencia `2026-01-01` y códigos inventados `DEMO-01` a `DEMO-05`; no son valores oficiales.

El archivo local se migra automáticamente al nuevo esquema separado (`comercios`, `inscripciones_iibb`, `alicuotas`, `percepciones` y `usuarios`) cuando se inicia el backend. La migración conserva las percepciones existentes y les agrega la información histórica disponible, marcando los datos sin fuente como heredados de demostración. No borrar `data/db.json` si querés conservar tu historial local.

El alta administrativa antigua crea un perfil junto con una inscripción **simulada** para que la interfaz del parcial siga funcionando. La ruta versionada de perfiles `/api/v1/arba/comercios` solo crea/edita el perfil y no crea una inscripción. En ambas rutas `is_official` es falso.

## Variables opcionales

| Variable | Valor inicial | Uso |
|---|---|---|
| `PORT` | `3003` | Puerto de la API |
| `DB_PATH` | `./data/db.json` | Archivo local de persistencia |
| `JWT_SECRET` | aleatoria mientras corre el backend | Clave para firmar sesiones; definir una clave privada y estable para desplegar |

## Cuentas y roles

Al abrir la app por primera vez, creá la cuenta inicial con nombre, correo y contraseña. Esa primera cuenta recibe el rol **superadmin** y es la única que puede crear cuentas **admin** y **user** desde la pestaña `Usuarios`. No hay registro público abierto.

- **user:** consulta el padrón, calcula percepciones y ve historial.
- **admin:** además administra comercios e inscripciones simuladas.
- **superadmin:** además crea y consulta cuentas.

Las contraseñas se guardan con hash `scrypt`, nunca en texto legible. La sesión vence a las 8 horas. En desarrollo, si no se define `JWT_SECRET`, el reinicio del backend invalida las sesiones y alcanza con volver a ingresar. El archivo `.env.example` es una referencia: Node no carga `.env` automáticamente.

## Alcance pendiente

- Integración real con TPV.
- Cambiar contraseñas y desactivar cuentas desde la app.
- Sustituir persistencia JSON por el almacenamiento que acuerde el ecosistema antes de integrar el padrón común.
- Pruebas de despliegue Docker: Docker Desktop no estuvo disponible en el equipo usado para la entrega.
- La elección de este módulo para el parcial no lo convierte automáticamente en la implementación principal del ecosistema.

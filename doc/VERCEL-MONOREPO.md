# Publicación del ecosistema

## Estructura elegida

El repo contiene varias apps independientes, no un solo frontend compilado en conjunto. Vercel publica **un proyecto por frontend** y cada proyecto debe apuntar a su carpeta. Los despliegues actuales de este ecosistema se hicieron desde el CLI porque la conexión Git del proyecto `sintegrai26` quedó asociada al repo equivocado (`mjsis20052/sintegrai26`). Vercel rechazó conectarla a `Lucasm282021/Sintegra-I26` por falta de acceso de su integración. Por eso los pushes al repo principal todavía no actualizan Vercel automáticamente.

No movemos las carpetas de los equipos: las rutas actuales son estables, fáciles de reconocer y pueden usarse directamente como Root Directory. Cada estudiante conserva su paquete, lockfile, documentación y ciclo de cambios.

## Configuración de Vercel

### Portal principal

| Ajuste | Valor |
|---|---|
| Repositorio | `Lucasm282021/Sintegra-I26` |
| Root Directory | `.` |
| Framework Preset | `Other` |
| Build Command | vacío |
| Output Directory | `public` |
| Install Command | vacío |

El `vercel.json` de la raíz fija `public` como salida. Allí está `index.html`, la identidad global, los logos por módulo y el video de presentación. La intro se reproduce automáticamente al entrar (salvo que el usuario tenga activada la preferencia de movimiento reducido), se puede pausar u omitir y luego muestra el menú de aplicaciones. El proyecto publicado es `https://sintegrai26.vercel.app`.

### Frontends Vercel dentro del repo

Importá el mismo repo una vez por cada frontend que se quiera publicar. Elegí los siguientes Root Directory. Los proyectos que usan Vercel Functions tienen su propia configuración dentro de la carpeta raíz del módulo.

| Módulo | Root Directory | Framework | Build Command | Output Directory | URL y estado |
|---|---|---|---|---|---|
| Portal y panel Banco | `.` | Other | — | `public` | [sintegrai26.vercel.app](https://sintegrai26.vercel.app) · portal y `/banco/` publicados; panel Banco consulta la API común |
| Backend compartido | `backend` | Other | — | `public` | [sintegra-backend.vercel.app](https://sintegra-backend.vercel.app) · Banco, Billetera, padrón, Municipio, ARBA, ARCA y TPV |
| ARBA Tomi | `arba-tomi` | Other | `vite build` | `dist` | [arba-tomi.vercel.app](https://arba-tomi.vercel.app) · UI y API demo en memoria |
| ARBA Lucas | `arba-lucas` | Other | `npm run build` | `dist` | [arba-lucas.vercel.app](https://arba-lucas.vercel.app) · interfaz publicada; API pendiente |
| Municipio Cristian | `municipio-cristian/frontend` | Vite | `npm run build` | `dist` | [municipio-cristian.vercel.app](https://municipio-cristian.vercel.app) · demo local en navegador |
| TPV Sebastián | `sebasTPV/tpv-frontend` | Vite | `npm run build` | `dist` | [tpv-sebastian.vercel.app](https://tpv-sebastian.vercel.app) · usa el backend común |
| TPV David | `tpv-david` | Other | — | `public` | [tpv-david.vercel.app](https://tpv-david.vercel.app) · UI demo y callback firmado |
| ARCA Mateo | `arca-mateo` | Other | — | `public` | [arca-mateo.vercel.app](https://arca-mateo.vercel.app) · UI y API demo (padrón y comprobantes con CAE ficticio; requiere usuario) |
| Billetera virtual | `Billetera_virtual-Lucas_M` | Other | — | `public` | [billetera-virtual-lucas-m.vercel.app](https://billetera-virtual-lucas-m.vercel.app) · interfaz publicada; backend pendiente |

La sección Banco de la landing sirve el panel estático desde `public/banco/`; consulta cuentas, saldos y movimientos del backend compartido por CUIT. No depende del API Prisma independiente de `banco-m`. No habilites **Include source files outside of the Root Directory** salvo que una app lo necesite de verdad.

### TPV Sebastián en este monorepo

El frontend está en `sebasTPV/tpv-frontend`, con build Vite (`npm ci`, `npm run build`, `dist`). Consume la API común para catálogo y ventas; el backend NestJS/Prisma local no es parte del flujo publicado. Su callback para pagos confirmados es `https://tpv-sebastian.vercel.app/api/webhooks/payment`.

El dominio de Vercel recibe el webhook firmado por terminal. El backend común guarda el evento antes de entregarlo; el receptor responde `2xx` cuando valida la firma y registra el evento en logs de Functions.

## APIs y persistencia

- **ARBA Tomi:** `arba-tomi/vercel.json` monta una función Express para demo. Su padrón está en memoria y puede volver al seed al reiniciar una instancia. No usarla como registro persistente. Para datos conservados, desplegá el Express/SQLite como contenedor con volumen y cambia `VITE_API_BASE_URL` al dominio de esa API.
- **ARBA Lucas:** Vercel sirve el frontend Vite. Su Dockerfile ahora compila el frontend y ejecuta la API Express. Desplegalo desde el root `arba-lucas` en un servicio Docker, agrega disco en `/data`, configura `DB_PATH=/data/db.json` y `FRONTEND_ORIGIN=https://arba-lucas.vercel.app`. Al proyecto Vercel del frontend agregá `VITE_API_BASE_URL=https://<dominio-api>` en Build & Development Settings y redeployá.
- **Municipio Cristian:** la interfaz usa una implementación simulada dentro del frontend; crear/pagar cambia solo datos de demo en memoria. El backend SQLite actual es otro servicio, y todavía no implementa todos los endpoints que la demo simula. Para conservar altas y pagos, primero hay que integrar ambos contratos y alojar la API con disco persistente.
- **Billetera:** el proyecto Vercel publica solo `public/`. El ingreso y las operaciones no funcionan todavía porque requieren el backend Express y una base persistente. No desplegar SQLite de archivo en Vercel; el Dockerfile usa `/data/billetera.db`, que requiere un servicio Docker con volumen en `/data`.
- **TPV David:** `tpv-david/vercel.json` sirve `public/` como estático y manda `/health` y `/tpv/*` a una función Express (`api/index.ts`). Variables del proyecto: `DATA_DIR=/tmp/tpv-data`, `BANCO_MOCK=true`, `ARBA_MOCK=true`, `ARCA_MOCK=true`. Productos y ventas se guardan en `/tmp` y se pierden cuando la función se reinicia: es una demo, no un registro persistente.
- **Webhooks TPV:** `brisa`, `sebastian` y `david` reciben `payment.confirmed` en sus dominios Vercel. Los endpoints validan HMAC SHA-256 con `SINTEGRA_WEBHOOK_SECRET` y comparan `TPV_TERMINAL_ID`; las URLs, estados e intentos están documentados en [INTEGRACION-E2E-SINTETICA-Y-QA.md](INTEGRACION-E2E-SINTETICA-Y-QA.md).
- **ARCA Mateo:** `arca-mateo/vercel.json` sirve `public/` como estático y manda `/health`, `/auth/*`, `/admin/*` y `/arca/*` a una función Express (`api/index.js`). Variables: `ARCA_DATA_FILE=/tmp/arca/arca.json`, `ARCA_ADMIN_EMAIL` y `ARCA_ADMIN_PASSWORD` (superadmin demo que se crea al arrancar si no hay usuarios). Usuarios, sesiones y comprobantes se reinician con la función.
- **TPV Sebastián:** el proyecto publicado usa la API común. El backend NestJS local de otra etapa no es autoridad de los saldos ni se despliega como backend duplicado.
- **ARCA:** el repo tiene la identidad visual, pero todavía no contiene una app desplegable.

Todos los CUIT, movimientos, alícuotas y comprobantes actuales son de simulación. No cargar información fiscal real ni credenciales reales.

## Convención para sumar el próximo equipo

1. Crear una carpeta de primer nivel, por ejemplo `arba-nombre`, y mantener ahí el `package.json`, lockfile, `README.md`, `.env.example` y el código fuente de esa app.
2. Añadir `npm run build` y documentar el directorio de salida (normalmente `dist`). No subir `node_modules`, archivos `.env`, bases locales ni builds generados.
3. Crear un proyecto Vercel con esa carpeta como Root Directory y su propio dominio.
4. Añadir una tarjeta en `public/index.html`. El logo debe enlazar al mismo dominio y llevar una etiqueta clara si el servicio es demo o requiere API.
5. Anotar aquí variables de entorno, hosting del backend, persistencia y URL de salud.
6. No reutilizar o editar el `vercel.json` de la raíz desde una app: los ajustes de cada aplicación van dentro de su propia carpeta.

## Comprobación local

Desde el root de cada frontend: `npm ci` y `npm run build`. En el portal estático basta abrir `public/index.html` o servir `public/` con un servidor estático. Para comprobar la API de un backend, arrancala en su propio servicio y validá `/health` antes de configurar el frontend.

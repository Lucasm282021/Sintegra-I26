# Módulo Billetera Virtual — Lucas-M

Módulo del ecosistema fintech simulado que administra **billeteras virtuales**:
cuentas de dinero digital para personas/comercios, con carga de saldo, pagos
hacia comercios y registro de movimientos. Es el **6° módulo** del ecosistema
y corre en el **puerto 3006**, respetando el contrato común definido en
`docs/handbook-ecosistema-fintech.html`.

## Stack tecnológico

Decisión tomada buscando coherencia con los demás módulos del ecosistema
(la integración es por HTTP REST + JSON, pero se prioriza unificar el
ecosistema de herramientas con lo que ya eligieron otros equipos):

| Capa | Elección |
|---|---|
| Runtime | Node.js 24 (LTS) |
| Framework HTTP | Express |
| Base de datos | SQLite (node:sqlite, built-in de Node), archivo propio del módulo |
| Contenedor | Docker, imagen `node:24-alpine` |
| Puerto | 3006 |

## Entidades

- **Billetera**: id público string, titular, cuit, alias, saldo (pesos en la API; centavos enteros en SQLite), fecha de alta UTC.
- **Movimiento**: id público string, tipo (`carga` / `pago` / `cobro`), monto en pesos, contraparte, saldo resultante, fecha ISO 8601 UTC.

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/billetera/auth/login` | Valida CUIL y contraseña para el acceso simulado |
| POST | `/billetera/auth/registro` | Crea una cuenta con contraseña |
| POST | `/billetera/cuentas` | Crea una billetera (201) |
| GET | `/billetera/cuentas/{id}` | Datos y saldo de una billetera |
| GET | `/billetera/cuentas/{id}/movimientos` | Últimos 50 movimientos |
| GET | `/health` | Estado del servicio (`{"status":"ok","servicio":"billetera"}`) |
| POST | `/billetera/cargas` | Acredita saldo local (requiere `id_venta`, `cuit` y `monto`) |
| POST | `/billetera/pagos` | Debita saldo para una venta (requiere `id_venta`, `cuit`, `comercio_cuit` y `monto`) |
| POST | `/billetera/qr/pagos` | Transfiere saldo entre billeteras; requiere `id_venta` y es idempotente |
| GET | `/billetera/qr/{cuit}` | Valida el QR y devuelve los datos para reconocer al destinatario |
| GET | `/billetera/demo/clientes` | Lista clientes ficticios disponibles para pruebas |
| POST | `/billetera/demo/clientes/{codigo}/activar` | Crea o abre una billetera demo con saldo inicial simulado |

Contrato común: `application/json`, CUIT como string de 11 dígitos sin puntos
ni guiones, IDs string y montos JSON numéricos positivos en pesos con hasta dos
decimales (internamente se guardan en centavos), éxito con 200/201 + recurso,
errores con `{"error": "mensaje"}` y status 4xx/5xx. Todas las operaciones con
efecto (cargas, pagos TPV y pagos QR) reciben `id_venta` como clave global
idempotente: repetir la misma clave y payload devuelve la respuesta original
con 200; reutilizarla con otro payload devuelve 409. El saldo, el movimiento y
la clave se guardan en una única transacción.
En una venta, TPV calcula el total desde su catálogo, agrega la percepción de
ARBA y elige un único medio: envía el total y la misma `id_venta` a
`/billetera/pagos` o a `/banco/pagos`, nunca a ambos. La billetera debita al
pagador y registra `comercio_cuit` como contraparte; no consulta la base del
Banco ni del TPV. La carga documentada aquí es un crédito local simulado y no
inicia un cobro bancario. Una futura carga financiada por Banco debe ser un
flujo separado e idempotente, explícitamente documentado.

## Cómo ejecutar (local)

```bash
npm install
npm start          # escucha en http://localhost:3006
```

Copiá `.env.example` a `.env` y ajustá `PORT` o `DB_PATH` si necesitás otros
valores. El proceso también acepta esas variables directamente desde el entorno.

## Cómo ejecutar (Docker)

```bash
docker build -t billetera-virtual .
docker run -p 3006:3006 billetera-virtual
```

## Identidad visual y bienvenida

La interfaz aplica la paleta del Manual de Marca I26 —azul institucional `#14214F`, dorado ocre `#89743A`, arena dorada `#AF9B63` y azul cielo `#3F78B6`— junto con el logo general de Sintegra. Al abrir la aplicación se reproduce la animación institucional en silencio; se puede omitir con **Continuar**. El video finaliza automáticamente y la bienvenida se omite si el dispositivo tiene activada la preferencia de movimiento reducido.

Los recursos de la interfaz se sirven desde `public/assets/`.

El **Entorno de pruebas** es una pantalla independiente en `/demo.html`, separada del login y del panel habitual. Consume el catálogo simulado del propio servicio. Al ingresar con un perfil se crea su billetera local con saldo inicial y un movimiento identificado como saldo de prueba; si la cuenta ya existe, se abre sin duplicarla. Los perfiles incluyen saldo normal, cliente nuevo y saldo bajo para probar pagos rechazados.

Al iniciar, la animación de marca conduce a una pantalla móvil limpia de acceso con CUIL y contraseña. Desde el enlace separado **Acceso al entorno de pruebas** se abre `/demo.html`; selecciona un perfil y pulsa **Usar perfil** para completar el acceso. La contraseña común de prueba es `demo1234`. También se puede crear una billetera desde el formulario de registro; la contraseña se almacena como hash scrypt. El acceso es una simulación académica y no reemplaza autenticación de producción; los endpoints de integración del servicio siguen disponibles para el TPV.

En el panel, **QR** permite pagar escaneando con la cámara, leyendo una imagen o pegando el código. El lector `jsQR` se ejecuta localmente, sin transmitir imágenes ni datos a terceros. **Cobrar** genera localmente un QR propio, con importe opcional. El formato de prueba es `SINTEGRA|1|CUIL|MONTO` (el monto puede omitirse). Un pago QR debita al pagador y acredita al destinatario, dejando movimientos `pago` y `cobro`. Todo el flujo es simulado y no mueve dinero real.

## Cambios de esta entrega · 2026-10-21

- Se conservó el acceso con CUIL y contraseña, la bienvenida animada y el acceso al entorno de pruebas en una pantalla separada del login. Se documentó la creación o recuperación de perfiles ficticios desde el servicio local.
- Se rediseñó el panel operativo con la marca Sintegra, tarjetas y controles redondeados, y una superficie blanca contenida sobre un fondo azul institucional. En pantallas móviles el contenido pasa a una sola columna y conserva la navegación inferior y el acceso central a QR.
- Se incorporaron las acciones de cargar saldo, pagar, copiar alias, pagar con QR y generar un QR de cobro. El lector acepta cámara, imagen o código pegado; el generador QR y el decodificador funcionan localmente. Las operaciones QR actualizan pagador, destinatario y movimientos dentro de una transacción.
- Se alineó el contrato HTTP con la guía fundacional: `/health` informa el nombre del servicio; CUIT e identificadores se exponen como strings; importes aceptan hasta dos decimales y se guardan en centavos; fechas salen en ISO 8601 UTC; errores usan `{"error":"mensaje"}`.
- Cargas locales, pagos de TPV y pagos QR guardan saldo, movimiento y clave idempotente en una transacción. Repetir `id_venta` con el mismo contenido devuelve el resultado guardado con HTTP 200; reutilizarla con contenido distinto responde 409. Los pagos rechazan saldo insuficiente y requieren CUIT de comercio en el endpoint TPV.
- Se agregó una migración de una sola ejecución para convertir saldos e historial previos, guardados en pesos enteros, a centavos; la API sigue presentando los importes en pesos.
- Se actualizó la imagen Docker para incluir `public/`, se agregó `.env.example`, se ignoran `.env`, la base local y los logs, y se incorporó `jsqr` con versión fijada en el lockfile.

**Límites de esta entrega:** no se agregó una llamada directa de la Billetera al Banco. TPV debe elegir Banco o Billetera por venta y enviar la misma `id_venta`; la carga actual es una acreditación local simulada. El código backend de TPV no está presente en el repo para comprobar esa integración punta a punta. Se comprobaron sintaxis JavaScript y formato del diff; quedan pendientes las pruebas HTTP y cruzadas indicadas al final.

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `3006` | Puerto HTTP del servicio |
| `DB_PATH` | `./billetera.db` | Ruta del archivo SQLite |

## Ejemplos con curl

```bash
# Crear billetera
curl -X POST localhost:3006/billetera/cuentas -H "Content-Type: application/json" \
  -d '{"titular":"Almacén Don Mateo","cuit":"30712345679","alias":"almacen.mateo.mp"}'

# Cargar saldo
curl -X POST localhost:3006/billetera/cargas -H "Content-Type: application/json" \
  -d '{"id_venta":"carga-demo-1","cuit":"30712345679","monto":50000}'

# Pagar a un comercio
curl -X POST localhost:3006/billetera/pagos -H "Content-Type: application/json" \
  -d '{"id_venta":"venta-demo-1","cuit":"30712345679","monto":9000,"comercio_cuit":"30112233445"}'

# Consultar saldo y movimientos
curl localhost:3006/billetera/cuentas/1
curl localhost:3006/billetera/cuentas/1/movimientos
curl localhost:3006/health
```

La respuesta de carga/pago incluye directamente la billetera, `id_venta`, el
`movimiento` creado y `saldo_resultante`; el pago incluye `estado: "confirmado"`.
Un reintento exacto de `venta-demo-1` devuelve esa misma respuesta con HTTP 200.
Los IDs de recursos se exponen como strings y las fechas como ISO 8601 UTC.

## Pendiente

- [ ] Si se acuerda con el equipo BANCO, diseñar una carga financiada por banco como operación separada e idempotente, sin cambiar el significado de la carga local
- [ ] Integración con `TPV` para pagar ventas directamente desde la billetera
- [ ] Pruebas cruzadas con los otros módulos
- [ ] Sumarse al `docker-compose.yml` de la integración final

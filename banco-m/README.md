# banco-m — Banco Boreal

Módulo bancario del sistema i26sintegra. Incluye la API REST y el frontend
responsive de Boreal. Gestiona cuentas virtuales vinculadas por CUIT con CBU y
alias propios, movimientos auditados, transferencias y pagos QR.

## Setup

1. Copiar y editar variables de entorno:
   cp .env.example .env

2. Instalar dependencias:
   npm install

3. Crear la base de datos:
   npm run db:push

4. Iniciar en desarrollo:
   npm run dev

5. Instalar las dependencias del frontend (una sola vez):
   npm --prefix frontend install

6. Iniciar el frontend en otra terminal:
   npm run dev:frontend

7. Abrir http://localhost:3000. Vite envía las llamadas `/api` a la API local
   en http://localhost:3001.

La carpeta `frontend/` contiene la app React/Vite. Para compilarla o verificarla
desde la raíz de `banco-m/`:

```bash
npm run build:frontend
npm run lint:frontend
```

Para una compilación desplegada fuera del proxy local, definí
`VITE_BANK_API_URL` con la URL pública de la API. La plantilla está en
`frontend/.env.example`.

La interfaz carga y crea cuentas por CUIT; el backend no implementa
autenticación de usuarios. Los pagos de servicios registran un débito bancario,
pero la liquidación con proveedores externos no está conectada.

## Frontend Boreal

El código está en [`frontend/`](frontend/). La interfaz carga y crea cuentas por
CUIT, consulta saldos y movimientos y conecta transferencias, depósitos y pagos
QR. La lectura de QR usa el escáner nativo cuando el navegador lo soporta; también
se puede pegar el identificador o el contenido del QR. La pantalla de servicios
registra un débito, pero no liquida con proveedores externos.

## Endpoints

| Método | Ruta                        | Descripción                     |
|--------|-----------------------------|---------------------------------|
| POST   | /api/cuentas                | Crear cuenta por CUIT           |
| GET    | /api/cuentas/:cuit          | Obtener cuenta                  |
| GET    | /api/cuentas/:cuit/saldo    | Consultar saldo                 |
| GET    | /api/cuentas/cbu/:cbu       | Buscar por CBU                  |
| GET    | /api/cuentas/alias/:alias   | Buscar por alias                |
| PATCH  | /api/cuentas/:cuit/activar  | Activar/desactivar              |
| POST   | /api/movimientos/deposito   | Registrar depósito              |
| POST   | /api/movimientos/debito     | Registrar débito                |
| GET    | /api/movimientos/:cuentaId  | Listar movimientos paginados    |
| POST   | /api/transferencias         | Transferir entre cuentas        |
| GET    | /api/transferencias/:cuentaId | Listar transferencias de cuenta |
| GET    | /api/health                 | Estado del servicio             |
| POST   | /api/comercios              | Crear comercio y cuenta asociada |
| GET    | /api/comercios              | Listar comercios                 |
| GET    | /api/comercios/:cuit        | Consultar comercio               |
| POST   | /api/pagos/qr/generar       | Crear pago QR con vencimiento    |
| POST   | /api/pagos/qr/pagar         | Pagar un QR desde una cuenta     |
| GET    | /api/pagos/qr/estado/:pagoId| Consultar estado del QR          |
| POST   | /api/webhooks/pago-confirmado | Confirmación TPPV/organismo     |

## Integración con i26sintegra

- Campo `origen` en Movimiento: `ARBA` | `ARCA` | `MUNICIPALIDAD` | `DEPOSITO` | `OTRO`
- Campo `referencia`: guarda el ID externo del sistema origen
- Vinculación por CUIT con el resto del sistema

## Pagos QR y webhooks

Un QR se genera con `POST /api/pagos/qr/generar` y se devuelve como `qrCode`
(Data URL PNG) junto con `pagoId`, `qrPayload` y `expiresAt`. El QR dura 15 minutos
por defecto (configurable entre 1 y 60). Los tipos válidos son `COMERCIO`, `ARCA`,
`ARBA` y `MUNICIPALIDAD`. Para `COMERCIO` debe existir un comercio activo asociado
a la cuenta destino.

Para pagar, enviar `POST /api/pagos/qr/pagar` con `pagoId` y `cuitPagador`.
El débito, crédito, transferencia, movimientos y estado del QR se guardan dentro
de una transacción. Un QR no puede utilizarse dos veces ni después de vencido.

El webhook `POST /api/webhooks/pago-confirmado` acepta `x-webhook-secret` y
`x-idempotency-key`. Si no se envía clave de idempotencia, se calcula una a partir
del evento. Las claves repetidas no vuelven a acreditar fondos. Para eventos de
organismos sin `pagoId`, se requiere `referencia`, `monto` y el CUIT destino en
`CUIT_ARCA`, `CUIT_ARBA` o `CUIT_MUNICIPALIDAD`.

Una confirmación del TPPV cambia un QR pagado a `COMPLETADO`. Un rechazo lo marca
`CANCELADO`; la reversión de una transferencia ya ejecutada no forma parte de este
alcance, tal como indica el material de implementación.

## Verificación del esquema

Después de copiar `.env.example` a `.env` y configurar la conexión, ejecutar:

```bash
npx prisma generate
npx tsc --noEmit
```

`npm run db:push` crea/actualiza las tablas y se ejecuta cuando la base de datos
esté configurada. No hace falta para generar el cliente de Prisma ni verificar
los tipos.

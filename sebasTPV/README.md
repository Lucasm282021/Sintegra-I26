# Módulo TPV — Terminal Punto de Venta

**Alumno**: Sebastián

**Cátedra**: Tecnicatura Superior en Desarrollo de Software

**Puerto Asignado**: `3001`

---

## 📌 Descripción

El **Módulo TPV** es la terminal de punto de venta encargada de registrar las transacciones del comercio, procesar los cobros con el **Módulo BANCO (3002)**, calcular las percepciones de Ingresos Brutos con el **Módulo ARBA (3003)** y emitir los comprobantes electrónicos con C.A.E. a través del **Módulo ARCA (3004)**.

El proyecto está diseñado con **Clean Architecture** en NestJS/TypeScript (Backend) y una interfaz de usuario moderna en React/Vite (Frontend).

---

## 🔐 Etapa 1 — Multiempresa y autenticación

Esta etapa agrega empresas, usuarios, roles, módulos y aislamiento de datos. **El frontend actual todavía no tiene login**: por eso esta etapa no se publica. La publicación será coordinada después de completar y validar las Etapas 1, 2 y 3.

### Roles

- `SUPERADMIN`: administra empresas, módulos y estados. Puede consultar datos operativos en modo lectura, con auditoría y sin acceso a contraseñas, hashes, tokens ni credenciales.
- `ADMIN`: administrador de una empresa. Solo opera sobre los datos de su empresa.

Las rutas `/auth/*` y `/admin/*` quedaron aprobadas para esta etapa. `GET /health` sigue siendo público. El resto de las rutas requiere `Authorization: Bearer <token>`.

### Variables de entorno

Copiar `tpv-backend/.env.example` a `tpv-backend/.env` y completar como mínimo:

```bash
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="un-secreto-largo-y-aleatorio"
AUTH_TOKEN_TTL_SECONDS=7200
SUPERADMIN_EMAIL="superadmin@example.com"
SUPERADMIN_PASSWORD="contraseña-temporal-segura"
SUPERADMIN_NOMBRE="Superadministrador"
```

En producción, `JWT_SECRET` es obligatorio y `CORS_ORIGINS` debe contener el origen exacto del frontend. El token se envía como Bearer y no se guarda en cookies.

### Bootstrap del primer superadmin

Con la base ya migrada, ejecutar una sola vez:

```bash
cd tpv-backend
SUPERADMIN_EMAIL="superadmin@example.com" \
SUPERADMIN_PASSWORD="contraseña-temporal-segura" \
npx ts-node prisma/bootstrap-superadmin.ts
```

El script no crea un segundo superadmin si ya existe uno y no imprime la contraseña. El superadmin deberá cambiarla en el primer login.

### Login y uso de la API

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@example.com","password":"contraseña-temporal-segura"}'
```

La respuesta incluye `access_token`. En las rutas protegidas:

```bash
curl http://localhost:3001/tpv/productos \
  -H "Authorization: Bearer <access_token>"
```

Si el usuario tiene `must_change_password`, solo podrá usar `/auth/me` y `/auth/change-password` hasta cambiarla.

### Migración segura

**No ejecutar migraciones sobre la base real.** Primero probar sobre una copia aislada:

```bash
cd tpv-backend
cp prisma/dev.db /tmp/opencode/tpv-copia.db
DATABASE_URL="file:/tmp/opencode/tpv-copia.db" npx prisma migrate resolve --applied 20261020120000_init
DATABASE_URL="file:/tmp/opencode/tpv-copia.db" npx prisma migrate deploy
```

La base actual no tiene `_prisma_migrations`; por eso el baseline de la migración inicial se hace únicamente después de comparar la estructura completa y solo sobre la copia. La migración asigna los datos existentes a **Supermercado Central S.A.** y conserva los 12 productos, los duplicados, las 2 ventas con `idVentaExternal = NULL` y los 4 detalles.

Para las ventas legadas, la migración es conservadora: si una venta ya había superado ARBA pero no tiene referencia de pago persistida, no puede saberse con certeza si el proveedor llegó a cobrar. Esas filas quedan en `PENDIENTE` con etapa `conciliacion_pago`, sin asignarlas a una etapa que reintente el pago. Solo las ventas con referencia de pago se reanudan en `arca`, y las que fallaron antes de ARBA se reanudan en `arba`. El estado legado `REVISION_MANUAL` ya no se escribe.

### Bloqueo persistido y reintentos

Cada venta usa `lockToken`, `lockExpiresAt` e `intentos` para impedir que dos solicitudes concurrentes —incluso de procesos distintos— ejecuten la misma etapa a la vez. La adquisición es un único `UPDATE` condicional sobre `lockToken IS NULL OR lockExpiresAt < now`; solo una solicitud obtiene la fila. El lock se libera únicamente con el token que lo adquirió y vence a los `VENTA_LOCK_TTL_MS` milisegundos (30 s por defecto), de modo que un proceso caído no bloquea la venta para siempre. `intentos` se incrementa al adquirir el lock.

Un reintento de una venta existente usa los datos persistidos: importes, líneas, cuentas y referencias. No recalcula precios ni cambia líneas con el request repetido. Las etapas ya completadas se omiten; por ejemplo, si ya existe una referencia de pago, no se vuelve a llamar a BANCO/BILLETERA.

### Pagos inciertos y conciliación manual

Antes de llamar al proveedor de pago se persiste `etapaPendiente = 'pago_en_curso'`. Si hay timeout, error de red, respuesta 5xx, una respuesta exitosa sin referencia, o el proceso se interrumpe durante el cobro, la venta pasa a `estado = 'PENDIENTE'` y `etapaPendiente = 'conciliacion_pago'`. En ese estado `POST /tpv/ventas` responde `409` y **nunca vuelve a cobrar automáticamente**. El estado legado `REVISION_MANUAL` no se escribe.

Para conciliar, un `ADMIN` de la empresa dueña, con módulo `caja` habilitado y contraseña temporal ya cambiada, verifica el `id_venta` en el portal o la API de BANCO/BILLETERA. La ruta devuelve `200 OK` con el mismo formato de `GET /tpv/ventas/{id}`:

- `resultado: "CONFIRMADO"`: requiere `transaccion_id`. La venta queda en `PENDIENTE`/`arca`; el siguiente reintento no repite el pago.
- `resultado: "NO_COBRADO"`: la venta queda en `PENDIENTE`/`pago` y un reintento puede volver a intentar el cobro.
- `resultado: "RECHAZADO"`: el proveedor confirmó el rechazo; la venta queda en `ERROR_RECUPERABLE`/`pago`.

`observacion` es obligatoria para los tres resultados, no puede estar vacía y admite hasta 500 caracteres. `transaccion_id` solo se acepta con `CONFIRMADO`. Solo se concilian ventas `BANCO` o `BILLETERA` que estén en `conciliacion_pago`.

En una conciliación exitosa, el cambio de venta y la auditoría se guardan en la misma transacción. La auditoría registra `resultado` y `detalle`; no guarda la observación cruda, referencias completas de pago, números completos de cuentas ni secretos. Los intentos fallidos que llegan al handler se auditan de forma best-effort, sin ocultar el error original. Los errores previos al handler, como `401`, `403` de guard o fallos de validación, quedan fuera de esta auditoría.

### Pruebas de la Etapa 1

Las pruebas usan bases SQLite aisladas en `/tmp/opencode` y no tocan `prisma/dev.db`:

```bash
cd tpv-backend
npx ts-node test/multiempresa.e2e.ts
npx ts-node test/superadmin-analitica.e2e.ts
npx ts-node test/pago-incierto.e2e.ts
npx ts-node test/migracion-legado.e2e.ts
# o todas:
npx ts-node test-e2e.ts
```

Cubren login, cambio obligatorio de contraseña, separación de roles, aislamiento de productos y ventas, `id_venta` globalmente único, dos solicitudes simultáneas con el mismo `id_venta`, suspensión, módulos, analítica de solo lectura, enmascarado de datos sensibles y auditoría. Además validan timeout de pago seguido de reintento sin recobro, respuesta sin referencia, los tres resultados de conciliación, reglas de observación y `transaccion_id` por presencia (incluyendo `null`, vacío y espacios), sanitización y persistencia de la observación después del reintento, atomicidad de la auditoría, reintento sin recalcular líneas y migración de ventas legadas ambiguas a `PENDIENTE`/`conciliacion_pago`.

---

## 🚀 Cómo Ejecutar

### Opción 1: Desarrollo Local (Standalone)

#### 1. Levantar el Backend (Puerto 3001)
```bash
cd tpv-backend
npm install
npx prisma migrate deploy
npx prisma db seed
# Configurar JWT_SECRET y credenciales del superadmin en .env
npx ts-node prisma/bootstrap-superadmin.ts
npm run start:dev
```
- La API REST estará corriendo en `http://localhost:3001`
- La documentación interactiva Swagger estará disponible en `http://localhost:3001/api/docs`

#### 2. Levantar el Frontend Terminal POS (Puerto 3000)
```bash
cd tpv-frontend
npm install
npm run dev
```
- Accedé a la interfaz visual en `http://localhost:3000`

---

### Opción 2: Docker Compose (Integración Ecosistema)

Para levantar ambos servicios empaquetados en contenedores Docker:
```bash
docker-compose up --build
```

---

## 📄 Contrato de Integración y Endpoints Expuestos

Todas las rutas de esta sección requieren un token Bearer de un usuario `ADMIN` y quedan acotadas a la empresa del token. El superadmin no escribe datos operativos.

### 1. `POST /tpv/ventas`
Registra una venta, procesa el pago, calcula la percepción de IIBB y genera el comprobante electrónico con CAE.

**Request Body**:
```json
{
  "id_venta": "TPV-2026-000123",
  "comercio_cuit": "30712345678",
  "medio_pago": "BANCO",
  "cuenta_origen": "0000000000000000000001",
  "cuenta_destino": "0000000000000000000002",
  "items": [
    { "producto_id": "1", "cantidad": 2 },
    { "producto_id": "TPV-CAFE-500", "cantidad": 1 }
  ]
}
```

`id_venta` es obligatorio y globalmente único. Si se reintenta dentro de la misma empresa, la venta completada se devuelve sin duplicar y sin recalcular importes ni líneas. Si pertenece a otra empresa, responde `409` sin revelar su dueño. Si la venta está en `PENDIENTE`/`conciliacion_pago`, responde `409` y no vuelve a cobrar.

**Response Body (201 Created)**:
```json
{
  "id": "TPV-2026-000123",
  "id_venta": "TPV-2026-000123",
  "estado": "completada",
  "etapa_pendiente": null,
  "requiere_conciliacion": false,
  "intentos": 1,
  "comercio_cuit": "30712345678",
  "subtotal": 10200,
  "percepcion": 306,
  "total": 10506,
  "medio_pago": "BANCO",
  "pago": {
    "monto": 10506,
    "medio_pago": "BANCO",
    "transaccion_id": "BNC-171182736",
    "cuenta_origen": "0000000000000000000001",
    "cuenta_destino": "0000000000000000000002",
    "cuit_pagador": null,
    "confirmado": true
  },
  "comprobante": {
    "cae": "78124589632541",
    "numero": "0001-00000123",
    "fecha_vencimiento": "2026-10-29",
    "tipo": "FACTURA_B"
  },
  "lineas": [ ... ],
  "error_detalle": null,
  "createdAt": "2026-09-29T22:16:00.000Z"
}
```

### 2. `GET /tpv/ventas/{id}`
Devuelve el detalle de una venta de la empresa autenticada, por ID numérico o `id_venta`.

### 3. `GET /tpv/ventas`
Lista las ventas de la empresa autenticada.

### 4. `POST /tpv/ventas/{id}/conciliar-pago`
Resuelve manualmente una venta en `PENDIENTE`/`conciliacion_pago`. Requiere rol `ADMIN` de la empresa dueña, empresa activa, módulo `caja` habilitado y contraseña temporal ya cambiada. El `SUPERADMIN` no puede conciliar. La venta se busca solo dentro del `empresaId` del token; una venta ajena o inexistente responde `404`.

Solo se aceptan ventas con `medio_pago` `BANCO` o `BILLETERA`. La respuesta es `200 OK` con el formato de `GET /tpv/ventas/{id}`.

**Confirmar un cobro verificado**:
```json
{
  "resultado": "CONFIRMADO",
  "transaccion_id": "BNC-171182736",
  "observacion": "Verificado en el portal del banco por id_venta"
}
```

**Declarar que no hubo cobro**:
```json
{
  "resultado": "NO_COBRADO",
  "observacion": "El proveedor no registra la operación"
}
```

**Registrar un rechazo confirmado por el proveedor**:
```json
{
  "resultado": "RECHAZADO",
  "observacion": "El proveedor confirmó el rechazo de la operación"
}
```

`resultado` es obligatorio. `transaccion_id` es obligatorio solo con `CONFIRMADO`, donde debe ser un string no vacío después de recortar espacios. Si la propiedad `transaccion_id` se envía con `NO_COBRADO` o `RECHAZADO`, la solicitud se rechaza aunque el valor sea `"   "`, `""` o `null`. `observacion` es obligatoria, no vacía y de hasta 500 caracteres.

Con `CONFIRMADO`, la venta guarda la referencia y queda en `PENDIENTE`/`arca`; un reintento no vuelve a cobrar. Con `NO_COBRADO`, queda en `PENDIENTE`/`pago` para que un reintento pueda intentar el cobro. Con `RECHAZADO`, queda en `ERROR_RECUPERABLE`/`pago`.

La observación se sanitiza antes de persistirse en el campo separado `Venta.observacionConciliacion` y se expone como `observacion_conciliacion` en el detalle. No se copia a `AuditoriaAcceso` ni a `errorDetalle`. El campo se conserva aunque la venta avance a ARCA, se complete o se limpien otros detalles operativos.

La conciliación no llama al proveedor ni emite ARCA. El cambio de venta y la auditoría exitosa se guardan en la misma transacción. La auditoría usa `resultado` y `detalle` y no guarda la observación cruda, referencias completas de pago, números completos de cuentas ni secretos. Los fallos que llegan al handler se auditan de forma best-effort sin ocultar el error original.

### 5. `GET /tpv/productos` & `POST /tpv/productos`
Catálogo de la empresa autenticada. El `codigo` es único dentro de cada empresa: dos empresas pueden usar el mismo código.

### 5. `GET /tpv/comercios` & `POST /tpv/comercios`
Comercios de la empresa autenticada. El CUIT sigue siendo único a nivel global.

### 6. `GET /auth/me` & `POST /auth/change-password`
Datos del usuario autenticado y cambio de contraseña. El cambio invalida los tokens anteriores.

### 7. Rutas `/admin/empresas`
Solo `SUPERADMIN`. Permiten crear empresas, asignar admins y contraseñas temporales, activar/suspender, configurar módulos y consultar resumen, ventas, productos y comercios en modo lectura. Cada consulta de datos de una empresa queda registrada en `AuditoriaAcceso`; las cuentas y datos financieros sensibles se enmascaran.

---

## 🛡️ Manejo de Errores
Todos los errores responden al contrato unificado del ecosistema:
```json
{
  "error": "Mensaje explicativo del fallo"
}
```
HTTP Status: `400 Bad Request`, `404 Not Found`, `500 Internal Server Error`.

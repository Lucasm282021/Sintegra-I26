# Módulo ARBA — Percepción de IIBB y Visualizador Web

Servicio y consola de visualización del **Ecosistema Fintech simulado** (proyecto académico). Mantiene un padrón provincial ficticio y calcula la percepción de Ingresos Brutos (IIBB) de cada venta generada por las terminales de punto de venta (TPV).

> **Aviso institucional:** Todas las alícuotas, razones sociales, CUITs y cálculos mostrados son **datos ficticios y deterministas** para uso académico. No representan valores fiscales reales de ARBA ni una conexión con organismos oficiales. La alícuota se expresa y almacena como fracción decimal: `0.03` equivale a 3%.

---

## 1. Arquitectura del Sistema

El proyecto está organizado en dos componentes claramente desacoplados:

- **Frontend (Consola React + Vite)**: Corre en el puerto `3000` (`http://localhost:3000`). Proporciona una interfaz gráfica moderna (estilo *fintech dark console*) para consultar el padrón, simular transacciones del TPV, verificar idempotencia y auditar operaciones.
- **Backend (API REST Express + SQLite)**: Corre en el puerto `3003` (`http://localhost:3003`). Gestiona la base de datos `arba.db`, valida esquemas fiscales y persiste transacciones.

### Flujo de la Transacción en el Ecosistema

```text
TPV (Punto de Venta) ──► envía CUIT y monto ──► ARBA (consulta padrón IIBB)
                                             ──► aplica alícuota decimal
                                             ──► registra percepción en BD
                                             ──► devuelve resultado al TPV
TPV ───────────────────► envía datos a ARCA ─► ARCA emite factura fiscal con CAE
```

> **Delimitación de responsabilidades:** ARBA **únicamente calcula y registra** la percepción correspondiente a la provincia. No cobra dinero (responsabilidad de la pasarela de pagos) ni emite facturas con CAE (responsabilidad de ARCA / AFIP).

---

## 2. Instalación y Ejecución

### Requisitos previos
- Node.js 18+ (compatible con Node 22)
- npm

### Instalación de dependencias

```bash
npm install
```

### Ejecutar el Frontend (Dashboard Visual)

```bash
npm run dev
```

El visualizador quedará accesible en `http://localhost:3000`.

### Ejecutar el Backend ARBA

En otra terminal:

```bash
npm run start:backend
# O alternativamente:
npm start
```

El servicio REST quedará escuchando en `http://localhost:3003`.

---

## 3. Modos de Operación del Dashboard

La interfaz cuenta con un selector explícito en el encabezado:

### A. Modo API
- Consume directamente el backend ARBA en `http://localhost:3003`.
- En desarrollo, utiliza el proxy interno de Vite (`/api/arba/... → http://localhost:3003/arba/...` y `/api/health → http://localhost:3003/health`), resolviendo problemas de CORS.
- **Comportamiento ante fallas:** Si el backend no está disponible, la interfaz **no cambia automáticamente a Demo ni inventa resultados silenciosos**. Muestra un cartel rojo de `API desconectada`, indicando el error de conexión y permitiendo al usuario decidir si reintentar o cambiar voluntariamente a Modo Demo.

### B. Modo Demo
- Simulación 100% en memoria para pruebas sin backend.
- Utiliza el padrón determinista `PADRON_DEMO` (5 contribuyentes).
- Reproduce con exactitud todas las reglas de negocio del backend:
  - Registro de percepción (`201 Created`).
  - Reintento idéntico por `id_venta` (`200 OK` sin duplicar).
  - Conflicto por `id_venta` alterando monto o CUIT (`409 Conflict`).
  - CUIT no encontrado en padrón (`404 Not Found`).
  - Parámetros inválidos (`400 Bad Request`).
  - Persistencia durante la sesión de navegación.

---

## 4. Configuración de Variables de Entorno

Crear un archivo `.env` o `.env.local` según sea necesario:

```env
# Backend
PORT=3003
DB_PATH=./arba.db
# Opcional para pruebas en memoria del backend:
# DB_PATH=:memory:

# Frontend (opcional si se desea sobreescribir la URL del backend)
VITE_API_BASE_URL=/api
```

También es posible modificar la `API_BASE_URL` en tiempo real desde el botón de configuración (ícono de engranaje) en el encabezado de la aplicación.

### Autenticación y usuarios del panel

Copiar `.env.example` a `.env` y definir `AUTH_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` antes de iniciar el backend. La cuenta administradora se crea al iniciar si todavía no existe. No guardar secretos reales en el repositorio. Las contraseñas se almacenan con scrypt; la sesión usa una cookie firmada `HttpOnly`.

En Modo Demo: `admin@arba.demo` / `demo-admin-123` y `usuario@arba.demo` / `demo-user-123`.

Los usuarios del panel (`admin`, `convencional`) son distintos de los sujetos del padrón (`persona_humana`, `persona_juridica`). El usuario convencional crea borradores y envía altas propias a revisión. El administrador revisa y aprueba, y luego configura el estado operativo, la alícuota decimal y las aplicaciones. Los estados de trámite son `borrador`, `pendiente_revision`, `observado`, `aprobado`, `activo` e `inactivo`. Datos fiscales nuevos quedan `pendiente_consulta`; el simulador solo admite sujetos `activo` con `arba_iibb` habilitado.

Rutas nuevas: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`; administración `GET/POST /arba/usuarios`, `PUT /arba/usuarios/:id`, `PATCH /arba/usuarios/:id/estado`, `GET /arba/auditoria`; sujetos `GET/POST /arba/sujetos`, `GET/PUT /arba/sujetos/:cuit`, `POST /arba/sujetos/:cuit/enviar-revision|aprobar|observar`, `PATCH /arba/sujetos/:cuit/estado-operativo`. Las rutas anteriores de percepciones y padrón se conservan.

El módulo es académico: no consulta ARBA/ARCA, no confirma datos fiscales y no constituye una inscripción ni habilitación oficial.

---

## 5. Especificación del Contrato REST

Todas las respuestas son JSON y los errores siguen la forma:

```json
{ "error": "mensaje" }
```

### Endpoints Oficiales

| Método | Endpoint | Parámetros / Body | Respuestas HTTP | Descripción |
|---|---|---|---|---|
| `GET` | `/health` | — | `200` | Estado de salud del servicio |
| `GET` | `/arba/padron/{cuit}` | `cuit` en ruta | `200`, `400`, `404` | Consulta alícuota de un CUIT |
| `GET` | `/arba/padron?page=1&limit=10` | `page`, `limit` en query | `200`, `400` | Listado paginado del padrón |
| `POST` | `/arba/percepciones` | `{ id_venta, cuit, monto_venta }` | `201`, `200`, `400`, `404`, `409` | Calcula y registra la percepción |
| `GET` | `/arba/percepciones/{cuit}` | `cuit` en ruta | `200`, `400` | Historial de auditoría para un CUIT |

### Reglas de Negocio
- `monto_percepcion = round2(monto_venta * alicuota)`.
- Todos los importes monetarios se redondean a 2 decimales.
- El CUIT se maneja siempre como string de 11 dígitos numéricos.
- La alícuota se almacena y opera como fracción decimal (`0.03` = 3%).
- **Idempotencia estricta por `id_venta`**:
  - Repetir la solicitud con mismo `id_venta`, CUIT y monto devuelve `200 OK` con el registro preexistente (sin duplicar).
  - Repetir el mismo `id_venta` con un CUIT o monto distinto devuelve `409 Conflict`.

---

## 6. Seed Ficticio Académico

| CUIT | Razón Social | Actividad Económica | Alícuota | Porcentaje | Condición |
|---|---|---|---:|---:|---|
| `30712345678` | Comercio Demo Uno | Comercio minorista | `0.03` | 3,00% | Contribuyente |
| `27304567891` | Servicios Demo Dos | Servicios profesionales | `0.02` | 2,00% | Contribuyente |
| `30556789012` | Alimentos Demo Tres | Producción de alimentos | `0.015` | 1,50% | Contribuyente |
| `20123456789` | Librería Demo Cuatro | Librería | `0.03` | 3,00% | Contribuyente |
| `30678901234` | Mayorista Demo Cinco | Comercio mayorista | `0` | 0,00% | Exento |

---

## 7. Pruebas y Validación

### Pruebas Automatizadas del Backend

```bash
npm test
```

Ejecuta los 10 tests unitarios con el runner nativo `node --test` verificando salud, padrón, errores 400/404, cálculos, redondeos, idempotencia 200 y conflicto 409.

### Matriz de Pruebas Manuales en la Interfaz

1. **Chequeo de Salud (`/health`)**:
   - En Modo API con backend activo: badge verde `API conectada` con latencia.
   - En Modo API con backend caído: badge rojo `API desconectada` y banner de alerta.
   - En Modo Demo: badge ámbar `Modo demo activo`.
2. **Alternancia de Modos**:
   - Cambiar de Demo a API: la interfaz reconecta inmediatamente sin recargar la página.
   - Cambiar de API a Demo: pasa a simulación en memoria sin perder los registros cargados.
3. **Consulta de Padrón**:
   - CUIT conocido: ingresar `30712345678` y verificar alícuota `0.03` (3,00%).
   - CUIT inexistente: ingresar `11111111111` y verificar error `404 CUIT no encontrado en padrón`.
   - CUIT con guiones o formato inválido: ingresar `30-71234567-8` en simulación y verificar error `400 CUIT inválido`.
4. **Búsqueda y Paginación**:
   - Probar el buscador local escribiendo "alimentos" o "27304567891".
   - Cambiar el selector de filas por página a 5 o 10.
5. **Simulación de Percepción**:
   - **Cálculo nuevo (`201`)**: `id_venta: "venta-auto-1"`, `cuit: "30712345678"`, `monto_venta: 10200.00`. Debe devolver `201 Created` con percepción `$306,00`.
   - **Previsualización**: Observar que la sección *"Estimación visual previa"* calcula el monto antes del envío y aclara que es una estimación.
   - **Reintento idéntico (`200`)**: Enviar nuevamente exactamente la misma solicitud. Debe devolver `200 OK` con badge azul *"Reintento idempotente"* sin crear un nuevo registro.
   - **Conflicto (`409`)**: Modificar el monto a `15000` conservando el mismo `id_venta`. Debe devolver `409 Conflicto de id_venta`.
   - **Monto cero o negativo**: Intentar enviar monto `<= 0` y verificar error `400`.
6. **Historial de Auditoría**:
   - Verificar que las percepciones creadas aparecen en la tabla de auditoría con su origen (`API` o `Demo`).
   - Hacer clic en el ícono de código para abrir el modal inspector del JSON completo.
   - Usar el botón *"Consultar CUIT"* en auditoría para invocar `GET /arba/percepciones/{cuit}`.

---

## 8. Despliegue con Docker

```bash
docker build -t arba .
docker run -p 3003:3003 -v arba-data:/data arba
```

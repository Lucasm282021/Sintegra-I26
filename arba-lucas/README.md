# Módulo ARBA — Percepción de Ingresos Brutos (IIBB)

> **Ecosistema:** Sintegra I26 — Sistema Integral Fiscal y Fintech simulado  
> **Responsable:** Lucas P (`arba-lucas`)  
> **Puerto normativo:** `3003` (`http://localhost:3003`)  
> **Tipo de servicio:** API REST HTTP/JSON + Consola Web Administrativa (React 19)

---

## 1. Propósito y Alcance del Módulo

Este servicio representa la implementación del módulo tributario provincial de **ARBA (Agencia de Recaudación de la Provincia de Buenos Aires)** dentro del ecosistema simulado de cátedra **Sintegra I26**.

### Responsabilidades del Módulo
- Mantener y administrar el **padrón de contribuyentes de Ingresos Brutos (IIBB)** de la provincia.
- Exponer endpoints REST para la consulta de alícuotas por CUIT y gestión de contribuyentes (CRUD completo).
- Calcular y registrar la **percepción impositiva de IIBB** que el Punto de Venta (TPV) debe aplicar sobre cada venta comercial.
- Garantizar **idempotencia estricta por `id_venta`**, evitando duplicaciones o inconsistencias en reintentos de red.
- Proveer una **interfaz gráfica web administrativa (React 19)** para visualización, simulación, auditoría y administración de datos fiscales.

### Delimitación en el Flujo de la Venta

```
TPV (Punto de Venta) 
       │
       ├──► 1. Municipio: valida habilitación del comercio
       │
       ├──► 2. ARBA (puerto 3003): consulta padrón y calcula percepción de IIBB ◄── [ESTE MÓDULO]
       │
       ├──► 3. Banco / Billetera: procesa el cobro del total (subtotal + percepción)
       │
       └──► 4. ARCA (ex AFIP): emite comprobante fiscal electrónico con CAE
```

> **Aviso de alcance académico:** Los datos, CUITs, razones sociales y alícuotas son **ficticios, deterministas y configurables**. No representan valores fiscales reales de ARBA ni se conectan a organismos oficiales. La alícuota se expresa y almacena como fracción decimal: `0.03` equivale al 3%. ARBA **no cobra dinero** (responsabilidad de la pasarela de pagos) ni **emite comprobantes con CAE** (responsabilidad de ARCA).

---

## 2. Pila Tecnológica (Stack)

- **Backend:** Node.js (v18+ / v20+ / v22+) con Express 5.
- **Persistencia:** Almacenamiento determinista en archivo JSON (`data/db.json`) con escritura atómica.
- **Frontend:** React 19, Vite, Lucide React y CSS administrativo moderno con diseño corporativo institucional claro (accesible en la raíz `http://localhost:3003/`).
- **Pruebas:** Suite de integración automatizada (`test.js`) ejecutada sin dependencias externas.

---

## 3. Instalación y Guía Rápida de Ejecución

### Requisitos previos
- Node.js instalado (v18 o superior).
- npm (en sistemas Windows con restricciones de PowerShell, utilizar `npm.cmd`).

### Instalación de dependencias
```bash
npm install
```

### Comandos disponibles (`package.json`)

| Comando | Acción |
|---|---|
| `npm start` | **Inicia el servicio en producción** en `http://localhost:3003`. Sirve tanto la API REST como la aplicación React compilada (`dist/`). |
| `npm run dev` | Inicia el backend con reinicio automático ante cambios (`nodemon`). |
| `npm run build` | Compila el frontend React con Vite hacia la carpeta `dist/`. |
| `npm run client` | Inicia el servidor de desarrollo de Vite con recarga rápida (HMR) y proxy a la API en el puerto 3003. |
| `npm test` | Ejecuta la suite de pruebas unitarias y de integración de cátedra (**10/10 tests pasando**). |

---

## 4. Especificación de la API REST

Todas las respuestas de la API utilizan `application/json` con codificación UTF-8. Ante errores, la estructura devuelta es uniforme:

```json
{
  "error": "Descripción detallada del motivo del error"
}
```

### Tabla Resumen de Endpoints

| Método | Endpoint | Descripción | Códigos HTTP |
|---|---|---|---|
| `GET` | `/health` | Verificación de disponibilidad del servicio | `200` |
| `GET` | `/arba/padron/:cuit` | Consulta actividad y alícuota de un CUIT | `200`, `400`, `404` |
| `GET` | `/arba/padron` | Listado paginado de contribuyentes | `200`, `400` |
| `POST` | `/arba/padron` | Alta de nuevo contribuyente en el padrón | `201`, `400`, `409` |
| `PUT` | `/arba/padron/:cuit` | Actualización de actividad y/o alícuota | `200`, `400`, `404` |
| `DELETE` | `/arba/padron/:cuit` | Baja de contribuyente del padrón | `200`, `400`, `404` |
| `POST` | `/arba/percepciones` | Cálculo y registro de percepción para una venta (Idempotente) | `201`, `200`, `400`, `404`, `409` |
| `GET` | `/arba/percepciones` | Listado paginado del historial de percepciones | `200` |
| `GET` | `/arba/stats` | Métricas consolidadas para el Dashboard | `200` |
| `POST` | `/arba/seed/reset` | Restablece los datos a la semilla inicial determinista | `200` |

---

### Detalle de Endpoints

#### 1. Verificación de salud
`GET /health`
- **Respuesta `200 OK`:**
  ```json
  { "status": "ok" }
  ```

---

#### 2. Consulta de Contribuyente por CUIT
`GET /arba/padron/{cuit}`
- **Validación:** El CUIT debe ser una cadena numérica de exactamente 11 dígitos.
- **Respuesta `200 OK`:**
  ```json
  {
    "cuit": "30712345678",
    "actividad": "Comercio minorista",
    "alicuota": 0.03
  }
  ```
- **Errores posibles:**
  - `400 Bad Request`: CUIT malformado (`"cuit debe ser un string de 11 dígitos"`).
  - `404 Not Found`: CUIT no registrado en el padrón (`"CUIT no encontrado en el padrón"`).

---

#### 3. Listado paginado del Padrón
`GET /arba/padron?page=1&limit=10`
- **Query Params:** `page` (default 1, mínimo 1), `limit` (default 10, rango permitido 1 a 100).
- **Respuesta `200 OK`:**
  ```json
  {
    "page": 1,
    "limit": 10,
    "total": 5,
    "items": [
      {
        "cuit": "30712345678",
        "actividad": "Comercio minorista",
        "alicuota": 0.03
      }
    ]
  }
  ```

---

#### 4. Alta en el Padrón (CRUD)
`POST /arba/padron`
- **Body:**
  ```json
  {
    "cuit": "20334455667",
    "actividad": "Distribución Mayorista",
    "alicuota": 0.025
  }
  ```
- **Respuestas:**
  - `201 Created`: Registro creado exitosamente.
  - `400 Bad Request`: Formato de CUIT inválido, alícuota fuera de rango (debe ser fracción entre 0 y 1) o actividad vacía.
  - `409 Conflict`: El CUIT ya se encuentra registrado.

---

#### 5. Modificación en el Padrón (CRUD)
`PUT /arba/padron/{cuit}`
- **Body:** Acepta `actividad` y/o `alicuota`.
  ```json
  {
    "actividad": "Distribución y Logística",
    "alicuota": 0.028
  }
  ```
- **Respuestas:**
  - `200 OK`: Devuelve el contribuyente modificado.
  - `400 Bad Request`: Datos inválidos o ningún campo provisto.
  - `404 Not Found`: CUIT inexistente.

---

#### 6. Baja en el Padrón (CRUD)
`DELETE /arba/padron/{cuit}`
- **Respuestas:**
  - `200 OK`: `{ "mensaje": "Contribuyente eliminado con éxito", "cuit": "..." }`
  - `404 Not Found`: CUIT no encontrado.

---

#### 7. Cálculo y Registro de Percepción (Flujo TPV)
`POST /arba/percepciones`

Solicitud enviada por la caja o TPV para liquidar la percepción provincial de Ingresos Brutos:

- **Body:**
  ```json
  {
    "id_venta": "venta-101",
    "cuit": "30712345678",
    "monto_venta": 15000.50
  }
  ```

- **Respuesta exitosa `201 Created`:**
  ```json
  {
    "id": "percepcion-a1b2c3d4",
    "id_venta": "venta-101",
    "cuit": "30712345678",
    "monto_venta": 15000.50,
    "alicuota_aplicada": 0.03,
    "monto_percepcion": 450.02,
    "fecha": "2026-10-21T18:00:00.000Z"
  }
  ```

##### Reglas de Negocio e Idempotencia Estricta
El campo `id_venta` actúa como clave de idempotencia:
1. **Reintento Idéntico (`200 OK`):** Si se vuelve a solicitar la percepción con el mismo `id_venta`, mismo `cuit` y mismo `monto_venta`, la API **no duplica** la operación y retorna `200 OK` con el registro preexistente.
2. **Conflicto de Idempotencia (`409 Conflict`):** Si se utiliza un `id_venta` ya registrado pero se altera el CUIT o el monto, el servidor rechaza la transacción con `409 Conflict` (`"Conflicto: id_venta ya existe con otros datos"`).
3. **Contribuyente no hallado (`404 Not Found`):** Si el CUIT no existe en el padrón, la venta no puede ser percibida.
4. **Validación de parámetros (`400 Bad Request`):** Monto no positivo o CUIT inválido.
5. **Cálculo impositivo:** `monto_percepcion = round2(monto_venta * alicuota_aplicada)` con redondeo bancario exacto a 2 decimales.

---

## 5. Padrón Inicial Determinista (Seed)

El sistema inicializa automáticamente con 5 contribuyentes de prueba para asegurar que las pruebas de integración sean deterministas y reproducibles:

| CUIT | Actividad | Alícuota Ficticia | Porcentaje |
|:---:|---|:---:|:---:|
| `30712345678` | Comercio minorista | `0.030` | 3.0% |
| `20345678901` | Venta al por menor | `0.035` | 3.5% |
| `27123456789` | Servicios profesionales | `0.020` | 2.0% |
| `20456789012` | Industria manufacturera | `0.025` | 2.5% |
| `23987654321` | Servicios financieros | `0.050` | 5.0% |

> Mediante `POST /arba/seed/reset` se puede restablecer el estado del padrón a estos 5 registros originales en cualquier momento.

---

## 6. Frontend y Consola Administrativa (React 19)

Al ingresar a **`http://localhost:3003/`**, el servidor entrega una aplicación Single Page Application (SPA) desarrollada con **React 19** y **Vite**, orientada a la gestión operativa:

- **Inicio (Dashboard General):** Vista consolidada de métricas clave (contribuyentes activos, total percibido, volumen fiscal y alícuota promedio).
- **Padrón (CRUD en React):**
  - Tabla dinámica con búsqueda instantánea por CUIT o Razón Social/Actividad.
  - Modales dedicados con validación en tiempo real: **Alta de contribuyente** (`ModalCreatePadron`), **Detalle** (`ModalViewPadron`), **Edición** (`ModalEditPadron`) y **Baja segura** (`ModalDeletePadron`).
- **Simulador de Percepciones:** Permite probar el cálculo de ventas simulando la llamada del TPV, desglosando la alícuota y validando visualmente el comportamiento de idempotencia (`200 OK` vs `409 Conflict`).
- **Historial de Operaciones:** Registro auditable de todas las percepciones generadas por las terminales de caja.
- **Reportes:** Gráficos y distribución de contribuyentes por rango de alícuota y actividad económica.
- **Herramientas de Administración:** Diagnóstico de salud del servicio, versión de API y botón para restablecer la base de datos a la semilla inicial.

---

## 7. Pruebas Automatizadas

El proyecto incluye una suite de pruebas de integración que valida el cumplimiento estricto de los contratos del ecosistema:

```bash
npm test
```

### Casos de prueba validados:
1. `GET /health` responde 200 con status "ok".
2. `GET /arba/padron/:cuit` encuentra CUIT conocido con alícuota y actividad.
3. `GET /arba/padron/:cuit` responde 404 ante CUIT no registrado.
4. `GET /arba/padron` soporta paginación determinista (`page`, `limit`, `total`, `items`).
5. `GET /arba/padron/:cuit` responde 400 ante CUIT con formato inválido.
6. `POST /arba/percepciones` calcula y persiste la percepción con redondeo a 2 decimales (`201 Created`).
7. `POST /arba/percepciones` es idempotente ante reintentos con mismos datos (`200 OK`).
8. `POST /arba/percepciones` rechaza reutilización de `id_venta` con otros datos (`409 Conflict`).
9. `POST /arba/percepciones` responde 404 si el CUIT no existe en el padrón.
10. `POST /arba/percepciones` responde 400 ante monto negativo o CUIT inválido.

---

## 8. Consideraciones para la Evaluación del Agente / Cátedra

1. **Autonomía:** El servicio no requiere configuración adicional; las dependencias están empaquetadas en `package.json` y la persistencia local determinista se autogenera en `data/db.json` si no existe.
2. **Compatibilidad:** Implementa fielmente las rutas normativas (`/health`, `/arba/padron`, `/arba/percepciones`) respetando tipos de datos numéricos exactos y cadenas de CUIT de 11 dígitos.
3. **Persistencia y Reproducibilidad:** Cualquier prueba puede ejecutarse de manera aislada reseteando la semilla mediante `POST /arba/seed/reset` o reiniciando el servicio.

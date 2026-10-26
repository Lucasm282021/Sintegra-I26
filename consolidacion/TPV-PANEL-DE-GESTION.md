# TPV — Panel de gestión

Instrucciones para **David** y **Sebastián**. Cada uno mantiene su propio TPV y los dos funcionan de forma independiente, pero ambos paneles tienen **las mismas secciones y el mismo diseño**, para que quien use cualquiera de los dos encuentre todo en el mismo lugar.

Leer junto con:
- [UNIFICACION-DISENO.md](UNIFICACION-DISENO.md): colores, tipografía, menú lateral, KPI, tablas y lista de accesibilidad.
- [BACKEND-Y-BASE-DE-DATOS.md](BACKEND-Y-BASE-DE-DATOS.md): dónde quedan los datos del TPV en la base única.
- La guía fundacional del curso, para el contrato de la API.

## 1. Cómo se separan los dos TPV

En la base única, cada TPV es una **terminal**: `david` o `sebastian` (`tpv.terminales`). Todo producto y toda venta pertenece a una terminal, y ninguna ve los datos de la otra. Mientras no exista el backend unificado, cada uno sigue con su propio backend; cuando exista, su panel apunta a él con la variable de URL de la API y manda su terminal.

## 2. Menú (igual en los dos)

| Orden | Sección | Ícono (Lucide) | Para qué sirve |
|---|---|---|---|
| 1 | Resumen | `layout-dashboard` | Ver de un vistazo cómo va el día |
| 2 | Caja | `shopping-cart` | Vender: lo que ya existe hoy |
| 3 | Ventas | `receipt` | Buscar y revisar ventas, reintentar las que fallaron |
| 4 | Productos | `package` | Administrar el catálogo |
| 5 | Comercios | `store` | Comercios que venden con esta terminal |
| 6 | Conexiones | `plug` | Estado de los servicios de los que depende el TPV |

Arriba del menú va el logo i26 TPV y el nombre de la terminal ("TPV David" o "TPV Sebastián"). Abajo, el chip de estado de la API.

## 3. Secciones

### 3.1 Resumen

**KPI (fila superior, 4 tarjetas):**

| KPI | Cálculo | Línea de contexto |
|---|---|---|
| Ventas de hoy | Cantidad de ventas `completada` de hoy | "vs. ayer: ±N" |
| Total cobrado hoy | Suma de `total` de las ventas `completada` de hoy | "Ticket promedio: $X" |
| Ventas con error | Cantidad en estado `error` | "Requieren reintento" (enlace a Ventas filtrado) |
| Producto más vendido | Producto con más unidades vendidas en los últimos 7 días | "N unidades" |

**Debajo:**
- **Ventas por hora** de hoy: gráfico de barras simple, con el total encima de cada barra.
- **Últimas 5 ventas**: tabla reducida con enlace a "Ver todas".

### 3.2 Caja

La pantalla de venta que ya tienen, adaptada al diseño común:
- Catálogo con buscador a la izquierda, ticket a la derecha (en celular, el ticket pasa abajo).
- Elegir comercio y **un solo** medio de pago: Banco **o** Billetera.
- El total lo calcula el backend; si el navegador muestra una estimación antes de cobrar, se rotula "Estimado".
- Al cobrar, el botón muestra que está procesando y no se puede apretar dos veces.
- El resultado muestra cada etapa con su estado real: Municipio, ARBA, pago y ARCA. Si una etapa está simulada, se rotula **"Simulado"**.

### 3.3 Ventas

**Filtros:** rango de fechas, estado, medio de pago, comercio.

**Tabla:**

| Columna | Detalle |
|---|---|
| Fecha | Fecha y hora local |
| N° de venta | `id_venta` |
| Comercio | Razón social y CUIT |
| Medio de pago | Banco o Billetera |
| Total | Alineado a la derecha |
| Estado | Chip con texto: Pendiente, Percibida, Cobrada, Completada, Error |

**Detalle de una venta** (al hacer clic): líneas con producto, cantidad y precio; subtotal, percepción y total; y una línea de tiempo con las cuatro etapas (Municipio → ARBA → pago → ARCA), cada una con su resultado y la referencia que devolvió el otro sistema.

**Reintentar:** si la venta quedó en `error`, el botón "Reintentar" repite solo la etapa que falló, con el mismo `id_venta`. **Nunca vuelve a cobrar** una venta ya cobrada.

### 3.4 Productos

- Tabla: código, nombre, precio, stock, activo.
- Acciones: alta, edición, baja (desactivar, no borrar si ya tiene ventas) y carga masiva.
- Validaciones: precio mayor a 0, stock entero no negativo, código único dentro de la terminal.

### 3.5 Comercios

- Tabla: CUIT, razón social, rubro y **estado de habilitación municipal** (consultado al padrón compartido).
- Alta de un comercio por CUIT: los datos se completan desde el padrón; si el CUIT no está habilitado por el Municipio, el TPV avisa y no permite vender con ese comercio.

### 3.6 Conexiones

Una tarjeta por servicio: Municipio, ARBA, Banco, Billetera, ARCA. Cada una muestra:
- Estado con texto: **Conectado**, **Simulado** o **Sin conexión**.
- Última verificación y tiempo de respuesta, a partir de su `GET /health`.
- La URL configurada (sin datos sensibles).

## 4. Reglas que valen para los dos

- Contrato común: JSON, CUIT string de 11 dígitos, errores `{"error":"mensaje"}`, `GET /health`, `id_venta` en snake_case.
- Un solo medio de pago por venta.
- Nunca mostrar un pago, una percepción o un CAE como exitoso si el servicio no lo confirmó.
- El precio y el total los calcula el backend.
- Diseño y accesibilidad según [UNIFICACION-DISENO.md](UNIFICACION-DISENO.md), incluida su lista de verificación.
- No subir `node_modules`, `.env`, bases de datos locales ni carpetas de build.

## 5. David

| | |
|---|---|
| App publicada | https://tpv-david.vercel.app (demo: Banco, ARBA y ARCA simulados) |
| Código | `tpv-david/` en este repo |
| Stack | Node.js + Express + TypeScript, interfaz en `public/index.html`, datos en archivos JSON |
| Terminal en la base única | `david` |
| Instrucciones detalladas | `alumnos/david/MEJORAS.md` en el repo Ecosistema-Fintech-simulado |

**Orden de trabajo:**
1. Trabajar sobre `tpv-david/`, que ya tiene la estructura completa y compila.
2. Pasar los campos de la API a snake_case y agregar `id_venta` (ver MEJORAS.md, etapa 2).
3. Armar el menú lateral y las seis secciones de este documento sobre su `public/index.html`, o pasar la interfaz a React si lo prefiere.
4. Agregar al backend: editar y desactivar productos, filtros de ventas, reintento y chequeo de conexiones.

**Prompt para su agente:**

```
Soy David y mantengo el TPV de la terminal "david" del ecosistema Sintegra
I26. Trabajo en el repo Lucasm282021/Sintegra-I26, carpeta tpv-david/. Hay
otro TPV, el de Sebastián, que es independiente: no toques su código.

Antes de cambiar nada, leé:
1. consolidacion/TPV-PANEL-DE-GESTION.md (secciones del panel)
2. consolidacion/UNIFICACION-DISENO.md (diseño común y accesibilidad)
3. consolidacion/BACKEND-Y-BASE-DE-DATOS.md (base única)
4. El código de tpv-david/

Objetivo: construir el panel de gestión con el menú y las seis secciones del
documento (Resumen, Caja, Ventas, Productos, Comercios, Conexiones), con el
diseño común. Conservá mi stack (Express + TypeScript); la interfaz puede
seguir en HTML o pasar a React si me lo proponés primero.

Trabajá por etapas. En cada una, contame qué archivos vas a tocar, esperá mi
OK, implementá y dame los comandos para probar. Empezá por el menú lateral,
la barra superior y la sección Resumen. Respetá la lista de verificación de
accesibilidad del documento de diseño. Si un cambio afecta el contrato de la
API, avisame antes.
```

## 6. Sebastián

| | |
|---|---|
| App publicada | https://tpv-sebastian.vercel.app (interfaz; falta conectar el backend) |
| Código | Ramas `sebastian` y `sebasRama2` del repo Ecosistema-Fintech-simulado, carpetas `tpv-backend/` y `tpv-frontend/` |
| Stack | NestJS + Prisma + SQLite en el backend; React + Vite en el frontend |
| Terminal en la base única | `sebastian` |
| Instrucciones detalladas | `alumnos/sebastian/MEJORAS.md` en el repo Ecosistema-Fintech-simulado |

**Orden de trabajo:**
1. Correcciones de MEJORAS.md: tomar la URL de la API de `VITE_TPV_API_BASE_URL`, quitar el catálogo de ejemplo que aparece cuando el backend no responde, no calcular la percepción en el navegador y no duplicar campos en snake_case y camelCase.
2. Separar `App.jsx` en componentes y armar el menú lateral con las seis secciones.
3. Agregar al backend: edición de productos, filtros de ventas, reintento y chequeo de conexiones. Su backend ya tiene los estados de venta (incluido `ERROR_RECUPERABLE`), que se mapean a los estados de este documento.

**Prompt para su agente:**

```
Soy Sebastián y mantengo el TPV de la terminal "sebastian" del ecosistema
Sintegra I26. Mi código está en el repo Lucasm282021/Ecosistema-Fintech-
simulado, rama sebasRama2, carpetas alumnos/sebastian/tpv-backend y
alumnos/sebastian/tpv-frontend. Hay otro TPV, el de David, que es
independiente: no toques su código.

Antes de cambiar nada, leé:
1. alumnos/sebastian/MEJORAS.md (correcciones pendientes)
2. Del repo Lucasm282021/Sintegra-I26: consolidacion/TPV-PANEL-DE-GESTION.md,
   consolidacion/UNIFICACION-DISENO.md y consolidacion/BACKEND-Y-BASE-DE-DATOS.md
3. El código de tpv-backend y tpv-frontend

Objetivo: construir el panel de gestión con el menú y las seis secciones del
documento (Resumen, Caja, Ventas, Productos, Comercios, Conexiones), con el
diseño común. Conservá mi stack (NestJS + Prisma en el backend, React + Vite
en el frontend). Usá lucide-react para los íconos, que ya está instalado.

Trabajá por etapas. En cada una, contame qué archivos vas a tocar, esperá mi
OK, implementá y dame los comandos para probar. Empezá por las correcciones
de MEJORAS.md y después por el menú lateral, la barra superior y Resumen.
Respetá la lista de verificación de accesibilidad del documento de diseño.
Si un cambio afecta el contrato de la API, avisame antes.
```

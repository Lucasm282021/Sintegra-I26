# Mejoras — TPV de Sebastián: panel de control

## Qué hay hoy

Tu TPV está en las ramas `sebastian` y `sebasRama2` (PR #3 y #6), todavía sin mergear a `main`:

- **Backend** (`tpv-backend/`): NestJS + Prisma + SQLite. Expone `tpv/ventas` (crear, listar, ver), `tpv/productos` (listar, ver, crear, borrar) y `tpv/comercios` (listar, ver, crear). La venta ya tiene estados: `BORRADOR`, `VALIDADO_MUNICIPIO`, `COBRADO`, `PERCIBIDO_ARBA`, `FACTURADO_ARCA`, `COMPLETADA`, `ERROR_RECUPERABLE`.
- **Frontend** (`tpv-frontend/`): React + Vite, todo en un solo `App.jsx` de ~580 líneas. Tiene la pantalla de caja (catálogo, carrito, cobro) y un historial simple.
- **Publicado** en https://tpv-sebastian.vercel.app, pero sin backend conectado.

## Qué falta: el panel de control

La caja sirve para vender. Falta la parte de **administración y seguimiento** del TPV, que es lo que va a usar el comercio para controlar su negocio. Tiene que tener estas secciones:

| Sección | Qué permite hacer | Usa |
|---|---|---|
| **Resumen** | Ventas del día, total cobrado, ventas pendientes o con error, producto más vendido | `GET /tpv/ventas` |
| **Ventas** | Listado con filtros (fecha, estado, medio de pago), detalle de cada venta con sus etapas (Municipio → ARBA → pago → ARCA) y las referencias externas guardadas | `GET /tpv/ventas`, `GET /tpv/ventas/{id}` |
| **Reintentar** | Desde el detalle de una venta en `ERROR_RECUPERABLE`, reintentar la etapa que falló con el mismo `id_venta`, sin volver a cobrar | Hay que agregarlo al backend |
| **Productos** | Alta, edición, baja, precio y stock | `GET/POST/DELETE /tpv/productos` + falta editar (`PUT` o `PATCH`) |
| **Comercios** | Alta y consulta de comercios, y ver si están habilitados en Municipio | `GET/POST /tpv/comercios` |
| **Conexiones** | Estado de cada servicio (Municipio, ARBA, Banco, Billetera, ARCA): disponible, caído o en modo demo | `GET /health` de cada uno |

## Cosas a corregir en lo que ya existe

1. **La URL de la API está fija** (`http://localhost:3001/tpv` en `App.jsx`). Tiene que salir de `import.meta.env.VITE_TPV_API_BASE_URL`, porque es lo que vamos a configurar en Vercel para conectar el backend.
2. **Productos inventados si el backend no responde.** Hoy, si la API falla, la caja muestra un catálogo de ejemplo como si fuera real. El contrato del curso prohíbe simular éxitos: hay que mostrar un aviso claro de "sin conexión con el servidor".
3. **La percepción del 3% se calcula en el navegador.** El navegador puede mostrar una estimación marcada como tal, pero el valor real lo calcula ARBA y lo devuelve el backend.
4. **El payload manda cada campo dos veces** (`id_venta` e `idVenta`, `cuit` y `comercio_cuit`, etc.). Hay que dejar solo los nombres en `snake_case` de la guía fundacional.
5. **Todo está en un solo archivo.** Hay que separar en componentes y pantallas para que el panel pueda crecer.

## Reglas que no cambian

- Contrato común de `docs/guia-fundacional-equipos.html`: JSON en `snake_case`, CUIT como string de 11 dígitos, errores `{"error":"mensaje"}`, `GET /health`.
- Un solo medio de pago por venta (Banco **o** Billetera).
- Nunca mostrar "aprobado" o un CAE si el servicio no lo confirmó.
- Identidad visual del ISFDyT N° 26, la misma del portal Sintegra: azul `#14214F` para navegación y acciones principales, azul cielo `#3F78B6` para estados activos, dorado `#89743A` y arena `#AF9B63` como acentos. Fondo claro, legible, sin recargar.
- No subir `node_modules`, `.env`, bases SQLite ni `dist/`.

## Prompt para tu agente de IA

Copiá y pegá esto en tu agente (Claude, Cursor, Copilot, etc.) con el repo abierto en la rama `sebasRama2`:

```
Soy Sebastián y mantengo el módulo TPV del Ecosistema Fintech simulado de la
Tecnicatura Superior en Desarrollo de Software (ISFDyT N° 26). Trabajo en el
repo Lucasm282021/Ecosistema-Fintech-simulado, rama sebasRama2, carpeta
alumnos/sebastian/.

Antes de tocar nada, leé:
1. alumnos/sebastian/MEJORAS.md (este pedido)
2. docs/guia-fundacional-equipos.html (contrato común del curso)
3. docs/prompts/comun.md y docs/prompts/tpv.md
4. El código actual de alumnos/sebastian/tpv-backend y alumnos/sebastian/tpv-frontend
   (rama sebasRama2).

Objetivo: convertir mi TPV en una aplicación con panel de control completo,
sin rehacerla desde cero. Conservá el stack (NestJS + Prisma + SQLite en el
backend, React + Vite en el frontend) y la pantalla de caja que ya funciona.

Trabajá por etapas. En cada una, primero contame qué archivos vas a tocar y
esperá mi OK; después implementá, y al final dame los comandos para probarlo.

Etapa 1 — Ordenar el frontend
- Separar App.jsx en componentes y pantallas (Caja, Panel, Ventas, Productos,
  Comercios, Conexiones) con navegación entre ellas.
- Tomar la URL de la API de import.meta.env.VITE_TPV_API_BASE_URL (sin el
  sufijo /tpv) y documentarla en un .env.example.
- Quitar el catálogo de ejemplo que aparece cuando el backend no responde:
  mostrar un aviso de "sin conexión con el servidor".
- Mandar el payload de venta solo con nombres snake_case de la guía.

Etapa 2 — Panel de control (frontend)
- Resumen: ventas del día, total cobrado, ventas pendientes/con error,
  producto más vendido.
- Ventas: listado con filtros por fecha, estado y medio de pago; detalle con
  las etapas Municipio → ARBA → pago → ARCA y sus referencias.
- Productos: alta, edición, baja, precio y stock.
- Comercios: alta y consulta.
- Conexiones: estado de Municipio, ARBA, Banco, Billetera y ARCA según su
  GET /health.

Etapa 3 — Backend
- Agregar edición de productos (PUT o PATCH /tpv/productos/{id}).
- Agregar filtros a GET /tpv/ventas.
- Agregar un endpoint para reintentar una venta en ERROR_RECUPERABLE desde la
  etapa que falló, usando el mismo id_venta y sin volver a cobrar.
- Agregar un endpoint que consulte /health de los servicios externos (URLs
  por variables MUNICIPIO_URL, ARBA_URL, BANCO_URL, BILLETERA_URL, ARCA_URL).
- Si alguna de estas rutas nuevas no está en la guía fundacional, avisame
  antes de crearla para acordarla con la cátedra.

Reglas:
- Respetá el contrato común: JSON snake_case, CUIT string de 11 dígitos,
  errores {"error":"mensaje"}, GET /health.
- Un solo medio de pago por venta. Nunca mostrar un pago, percepción o CAE
  como exitoso si el servicio no lo confirmó; mostrar el estado real.
- El precio y el total los calcula el backend; el navegador solo muestra.
- Identidad visual: azul #14214F (navegación y acciones), azul cielo #3F78B6
  (activos y enlaces), dorado #89743A y arena #AF9B63 como acentos. Fondo
  claro, tipografía legible, diseño simple.
- No subas node_modules, .env, bases SQLite ni dist/.
- Commits chicos y descriptivos en mi rama; nada directo a main.
```

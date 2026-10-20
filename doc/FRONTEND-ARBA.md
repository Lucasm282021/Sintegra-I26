# Documentación del frontend ARBA

## Propósito y alcance

El frontend de ARBA es un dashboard educativo para consultar un padrón ficticio de contribuyentes y simular el cálculo de percepciones de Ingresos Brutos (IIBB). También permite administrar comercios y consultar el historial de auditoría. Los datos y alícuotas son deterministas y de uso académico; la aplicación no se conecta con ARBA oficial ni emite facturas.

## Tecnologías y ejecución

- React 19 y Vite 8 para la aplicación de una sola página.
- Tailwind CSS 4 mediante el plugin de Vite.
- Lucide React para iconos.
- El punto de entrada HTML es `index.html`; `src/client/main.jsx` monta `App` en `#root` e importa los estilos globales.
- El servidor de desarrollo usa el puerto `3000`. Iniciar desde la carpeta `arba-tomi/arba` con `npm install` y `npm run dev`.
- `npm run build` genera la versión de producción y `npm run preview` permite servirla localmente.

## Organización del código

```text
src/client/
├── App.jsx                    # Estado de aplicación, carga de datos y composición de vistas
├── main.jsx                   # Montaje React y estilos globales
├── components/                # Header, formularios, paneles, tablas, modales y resultados
├── data/demoData.js           # Padrón y percepciones iniciales de demostración
├── services/
│   ├── arbaApi.js             # Interfaz común para API REST y modo demo
│   └── demoEngine.js          # Simulación local de las operaciones del backend
├── styles/index.css           # Tailwind, tipografías y estilos globales
└── utils/formatters.js        # Formato de importes, CUIT, porcentajes y redondeo
```

### Componentes principales

| Componente | Responsabilidad |
| --- | --- |
| `Header` | Navegación entre panel general y comercios, selector API/Demo, estado de conexión y configuración de URL. |
| `SummaryCards` | Indicadores del padrón e historial cargado y estado operativo. |
| `FlowDiagram` | Explica visualmente el flujo TPV → ARBA → ARCA. |
| `PercepcionForm` | Captura `id_venta`, CUIT y monto; muestra una estimación y accesos rápidos para probar respuestas 200, 404 y 409. |
| `PercepcionResult` | Presenta el resultado de la última solicitud y sus errores. |
| `PadronTable` / `PadronDetailModal` | Búsqueda, paginación, consulta individual, detalle y selección cruzada hacia el simulador. |
| `AuditHistory` | Historial de percepciones, consulta por CUIT e inspección de datos. |
| `ApiContract` | Referencia técnica del contrato REST desde la interfaz. |
| `ComerciosPanel` | Búsqueda, filtros, alta, edición y baja de comercios y sus aplicaciones fiscales. |

## Vistas y recorridos

### Panel general

La vista `panel` combina indicadores, diagrama de flujo, simulador, resultado, padrón paginado, auditoría y contrato de API. Seleccionar un contribuyente del padrón o su modal puede completar el CUIT del simulador.

El simulador limpia separadores del CUIT, comprueba que el identificador no esté vacío y que el importe sea positivo, y estima el importe de percepción cuando el contribuyente está en la lista disponible. La estimación es orientativa; el resultado del servicio es el dato autoritativo. El ejemplo inicial usa CUIT `30712345678`, venta `10200.00` e ID `venta-101`.

### Comercios

La vista `comercios` permite filtrar por texto y estado, crear, editar y eliminar registros. La alícuota se ingresa como fracción decimal (`0.03` equivale a 3%). El formulario administra el estado activo/inactivo y las aplicaciones `arba_iibb` y `arca_facturacion`. En modo demo, el borrado solicita confirmación del navegador.

## Modos de operación y persistencia

El modo se guarda en `localStorage` bajo `arba_app_mode` y la URL base bajo `arba_api_base_url`.

- **API:** `arbaApi.js` realiza `fetch` al backend. La URL predeterminada es `/api`; el proxy de Vite reenvía `/api/arba/*` a `http://localhost:3003/arba/*` y `/api/health` a `/health`. Se puede configurar una URL absoluta desde el engranaje; para una llamada directa entre orígenes, el backend debe permitir CORS.
- **Demo:** `demoEngine.js` emula salud, padrón, comercios, percepciones, validaciones e idempotencia sin solicitudes de red. Las percepciones se guardan en `sessionStorage` (`arba_demo_percepciones_v1`) y el padrón editable en `localStorage` (`arba_demo_padron_v1`).
- El cambio de modo es explícito. Un error de API muestra el estado desconectado y no cambia por sí mismo al modo demo.
- Cada respuesta del servicio contiene, además del estado y datos, un origen (`API`, `Demo` o `Error`) que la interfaz puede mostrar en auditoría.

## Contrato consumido por el cliente

| Operación | Solicitud del frontend |
| --- | --- |
| Salud | `GET /health` |
| Listado de padrón | `GET /arba/padron?page={page}&limit={limit}` |
| Consulta de contribuyente | `GET /arba/padron/{cuit}` |
| Alta de comercio | `POST /arba/comercios` con el registro JSON |
| Edición de comercio | `PUT /arba/comercios/{cuit}` con el registro JSON |
| Baja de comercio | `DELETE /arba/comercios/{cuit}` |
| Crear percepción | `POST /arba/percepciones` con `{ id_venta, cuit, monto_venta }` |
| Auditoría por contribuyente | `GET /arba/percepciones/{cuit}` |

El adaptador normaliza las respuestas como `{ ok, status, data, origin }` y agrega `isNetworkError` ante fallos de red. Para percepciones, una respuesta HTTP 200 marca un reintento idempotente y HTTP 201 un registro nuevo. El motor demo replica la validación básica, el CUIT de 11 dígitos, el monto positivo, el redondeo a dos decimales y el conflicto 409 al reutilizar `id_venta` con distintos datos.

## Estado de interfaz

`App.jsx` conserva la vista activa, modo y conexión, URL de API, datos paginados del padrón, comercios, selección de CUIT, resultado del simulador e historial. Los indicadores de percepciones se calculan sobre los registros actualmente cargados. Los efectos de inicialización vuelven a consultar salud, padrón y comercios al cambiar el modo o la URL base.

Los controles locales (búsqueda, filtros y formularios) guardan su estado dentro de cada componente. El diseño usa tema oscuro, utilidades Tailwind, tipografías Plus Jakarta Sans y JetBrains Mono, y distribución adaptable para pantallas pequeñas y grandes.

## Consideraciones para cambios

- Mantener `arbaApi.js` como punto común para que las vistas no dependan de `fetch` ni del motor demo directamente.
- Al agregar operaciones, implementar comportamiento equivalente en API y demo si la función debe poder usarse en ambos modos.
- Mantener coherentes los campos del comercio (`razon_social`, `actividad`, `alicuota`, `estado`, `aplicaciones`) entre formularios, servicio y backend.
- No presentar la estimación del cliente como cálculo fiscal oficial: el resultado confirmado es el que devuelve el backend.
- `apiBaseUrl` se persiste en `localStorage`; usar `/api` restablece el proxy local de Vite.

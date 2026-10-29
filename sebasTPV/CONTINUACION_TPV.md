# Continuación del TPV de Sebastián

Actualizado: 28/10/2026

Este archivo conserva el contexto para retomar el trabajo con el modelo desarrollador cuando vuelva a tener tokens.

## Nuevo requisito comunicado por el profesor (28/10/2026)

La aplicación debe ser multiempresa dentro de una misma instalación:

- Debe existir un panel de **superadministración** desde el que se puedan agregar y administrar empresas/comercios.
- Cada empresa usuaria debe ver y gestionar únicamente sus propios datos (por ejemplo, ventas, productos y configuración del comercio).
- El superadmin puede administrar las empresas de la plataforma; el alcance exacto de lo que puede consultar de sus datos debe definirse.
- Esto **no estaba especificado antes**. Los planes anteriores incluían una pantalla/listado de Comercios, pero no autenticación, roles ni aislamiento multiempresa. La pantalla “Comercios” por sí sola no cumple este requisito.
- Este requisito cambia el alcance y la arquitectura. No empezar la Etapa 1 ni el panel anterior hasta actualizar la propuesta para incluir el diseño multiempresa y obtener confirmación del usuario.

Decisiones que deben aclararse antes de implementar:

1. Roles y permisos: superadmin, administrador/usuario de empresa y si se necesitan empleados/cajeros con permisos limitados.
2. Login, recuperación de acceso y cómo se crea el primer superadmin.
3. Cada dato debe asociarse a una empresa (tenant); las consultas y escrituras deben restringirse en el backend por la empresa autenticada. No confiar en un `comercio_cuit` enviado por el frontend para autorizar acceso.
4. Qué ocurre con productos compartidos versus catálogo propio de cada empresa, y si la empresa puede tener más de un local/sucursal.
5. Visibilidad del superadmin: solo administrar cuentas/empresas o también consultar sus ventas y demás datos.
6. Persistencia y migración: cómo asignar los datos de demostración/ventas existentes a una empresa inicial sin mezclarlos con las nuevas.
7. El modelo de datos, índices/identificadores y los endpoints deben asegurar aislamiento entre empresas tanto al consultar como al crear, editar y borrar.

El desarrollador debe leer esta sección al retomar, actualizar el informe inicial y presentar una propuesta multiempresa antes de tocar archivos. El usuario aún no aprobó cambios de implementación.

## Último informe del desarrollador (28/10/2026)

El desarrollador informó que hizo solo lectura, no cambió de rama y no editó código. Confirmó `sebasRama2`, HEAD `18b80b4`, un commit local adelante del remoto y los dos documentos de continuidad/prompt sin seguimiento.

Inspeccionó una copia de `tpv-backend/prisma/dev.db` en `/tmp/opencode/` y reportó 1 comercio (`Supermercado Central S.A.`, CUIT `30712345678`), 12 productos, 2 ventas y 4 detalles. Las 2 ventas completadas tienen `idVentaExternal = NULL`; los 12 productos tienen `codigo = NULL` y hay 6 nombres duplicados en pares. No hay tabla `_prisma_migrations` en esa base y encontró diferencias de esquema que deben compararse estructuralmente antes de hacer baseline.

Su propuesta recomienda `Empresa` separada de `Comercio`, `Usuario` con rol `SUPERADMIN`/`ADMIN`, claves UUID, login Bearer/JWT, módulos habilitados por empresa y bloqueo atómico de ventas mediante token/lease persistidos. Propone 3 etapas: backend multiempresa/auth y migración; frontend de login/superadmin; luego adaptar caja y panel operativo. Su respuesta contiene una lista extensa de archivos y endpoints nuevos, pero **no tiene aprobación para editar**.

### Revisión pendiente de ese informe

- El usuario ya definió roles `superadmin` y `admin`, creación de empresa y contraseña por el superadmin, suspensión, módulos, acceso del superadmin a datos para análisis, catálogo independiente y ausencia de sucursales. No volver a preguntar esos requisitos como si no se hubieran respondido.
- La propuesta de limitar al superadmin a métricas agregadas no refleja completamente que el usuario dijo que podrá ver los datos de las empresas para analizarlos. Respetar ese permiso y preguntar solo qué pantallas/alcance de datos, excluyendo secretos/credenciales.
- No asumir que `id_venta` puede repetirse entre empresas. Banco/ARBA/ARCA pueden usarlo como clave de idempotencia fuera del TPV. Mantenerlo globalmente único o proponer un ID externo globalmente único/namespace aprobado por los equipos; sí puede ser composite por empresa para códigos internos de producto.
- El baseline de Prisma requiere comparar columnas, índices, defaults y claves foráneas; el orden físico de columnas SQLite por sí solo no demuestra diferencia de esquema. Baseline y migraciones solo sobre copia verificada primero; nunca asumir que `migrate resolve` valida la estructura.
- El mapeo de estados legados en operaciones inciertas no debe inferirse a ciegas. Si falta referencia de pago/percepción/comprobante y pudo haberse ejecutado externamente, dejarla protegida para conciliación y no repetirla.
- Empresa inicial: el informe encontró que los datos actuales pertenecen al comercio Supermercado Central S.A. El usuario aún debe confirmar si esa será la empresa/tenant inicial; preservar ventas legadas sin `id_venta` y productos duplicados sin fusionar es el comportamiento recomendado por ahora.
- Los endpoints `/auth/*` y `/admin/*` son nuevos respecto del contrato TPV y requieren aprobación del usuario/cátedra antes de implementarlos.
- El plan separa backend (Etapa 1) de login frontend (Etapa 2), lo que deja la app sin funcionar entre ambas si se fuerza autenticación en la primera. No desplegar ni dejar una versión operativa en ese estado; proponer una transición segura o aprobar ambas como una entrega conjunta.

Pendiente antes de codificar: decidir empresa inicial, revisar las observaciones anteriores y aprobar explícitamente una etapa con sus archivos. El desarrollador no debe instalar dependencias, correr migraciones en la base real ni cambiar el código hasta esa aprobación.

### Seguimiento del último informe

El desarrollador respondió a las observaciones y confirmó que no codificó, no ejecutó migraciones y no desplegó. El plan actualizado establece:

- No publicar ninguna etapa por separado; publicación coordinada solo tras validar Etapas 1, 2 y 3, el acuerdo de la cátedra, la migración, el backup y el volumen persistente de Railway.
- No correr migraciones contra la base real antes de probar en copia, presentar resultados y recibir aprobación explícita.
- Empresa inicial: `Supermercado Central S.A.`; asignar los registros existentes sin borrar/fusionar productos ni inventar IDs a las ventas legadas.
- Superadmin puede consultar datos operativos en modo lectura con auditoría y sin contraseñas, hashes, tokens ni credenciales.
- `Venta.idVentaExternal` conserva unicidad global; los códigos de producto son únicos por empresa.
- Login planeado con Bearer JWT porque el frontend Vercel y backend Railway se proyectan en dominios distintos.
- Preparó una propuesta de `/auth/*` y `/admin/*` para llevar a la cátedra. No se implementa hasta que la cátedra acuerde las rutas.

Estado para retomar: **esperar el acuerdo de la cátedra sobre autenticación, prefijo de administración, análisis y Bearer JWT; luego presentar al usuario la respuesta y esperar su aprobación explícita de Etapa 1.** No hay autorización de implementación todavía.

## Revisión del código actual para multiempresa (28/10/2026)

Revisión de lectura en `sebasRama2` (`18b80b4 Guardar avances del TPV`). No se modificó código. El único archivo local nuevo previo a esta revisión era este documento de continuidad.

### Backend y base de datos

- `alumnos/sebastian/tpv-backend/prisma/schema.prisma`: hay modelos `Comercio`, `Producto`, `Venta` y `DetalleVenta`; no hay `Empresa`, `Usuario`, roles, permisos ni pertenencia a tenant.
- `Comercio` se identifica por `cuit @unique`; `Venta.cuit` apunta a ese CUIT. `Comercio` contiene datos fiscales/operativos del comercio, pero todavía no modela la cuenta SaaS que el superadmin crea y puede suspender. Antes de cambiar el esquema, definir si `Comercio` se convierte en tenant o si habrá una entidad `Empresa` separada relacionada con `Comercio`.
- `Producto` no tiene empresa propietaria; `codigo` es único globalmente. Añadir pertenencia de tenant y revisar unicidad como mínimo por empresa (`empresa_id + codigo`) para que empresas distintas puedan reutilizar sus códigos.
- `Venta.idVentaExternal` es único globalmente; al añadir tenant, revisar la idempotencia como única por empresa (`empresa_id + id_venta`) para que cada empresa pueda tener su propio espacio de IDs. La venta usa CUIT y `DetalleVenta` enlaza a Producto, pero no se valida que venta y producto pertenezcan al mismo tenant.
- `DetalleVenta` hereda el ámbito desde la venta, pero la relación a producto debe comprobar que el producto también sea de la empresa de esa venta.
- Solo existe la migración inicial `prisma/migrations/20261020120000_init/migration.sql`. La migración multiempresa debe preservar datos y asociar explícitamente los registros legados a la empresa inicial.
- `prisma/seed.ts` crea un comercio de prueba por CUIT y productos globales; debe volverlo tenant-aware e idempotente por empresa, sin crear productos para todos los tenants ni apropiarse de filas ajenas.
- La revisión anterior sobre una copia segura de la base registró 1 comercio, 12 productos, 2 ventas y 4 detalles. Reconfirmar los datos de la base actual antes de diseñar/aplicar una migración; el archivo de base SQLite no está versionado.

### Rutas y lógica del backend

- No hay módulo de autenticación, login, usuarios, hashing de contraseñas, sesión/token, guardas ni control de roles. `AppModule` solo importa Prisma, Productos, Comercios, Ventas e Integraciones; `package.json` no declara librería JWT/hash.
- `productos.controller.ts` y `productos.service.ts`: `GET` de lista/detalle, `POST` y `DELETE` son actualmente globales. Cada lectura/escritura debe tomar el tenant desde la identidad autenticada del request y filtrar por ese tenant; nunca aceptar `empresa_id` del body como autorización.
- `comercios.controller.ts` y `comercios.service.ts`: `GET /tpv/comercios` lista todos y `POST` crea sin distinguir superadmin de admin de empresa. Separar autorización de administración global de las operaciones propias de una empresa.
- `ventas.controller.ts` y `ventas.service.ts`: `GET /tpv/ventas` y `GET /tpv/ventas/:id` consultan ventas globalmente. La creación toma `comercio_cuit` del payload, busca productos globalmente por ID/código, crea o busca el comercio por CUIT y enlaza detalles sin tenant. Asegurar tenant desde el usuario autenticado, acotar historial/detalle/productos y validar que el comercio y cada producto pertenecen a la misma empresa autorizada.
- La lógica de integraciones debe seguir recibiendo los CUIT y datos fiscales exigidos por los otros servicios, pero esos campos no deben decidir qué datos de TPV puede leer el usuario.
- `main.ts` actualmente configura CORS, validación, Swagger y puerto; no configura autenticación/autorización.

### Frontend

- `alumnos/sebastian/tpv-frontend/src/App.jsx` contiene toda la aplicación en un solo componente: caja, productos, carrito, cobro e historial. No tiene login, roles, token/sesión, navegación por rol ni contexto de empresa.
- El CUIT del comercio (`cuit`) está precargado y editable en la interfaz; en multiempresa los datos del comercio deben venir de la sesión/empresa seleccionada y el backend debe verificarlo.
- `cargarProductos()` y `cargarHistorial()` consumen endpoints globales sin identidad autenticada. Deben enviar credenciales/token de forma segura y recibir datos limitados por tenant.
- El menú y las pantallas deberán variar por rol: superadmin (empresas, suspensión, módulos y análisis autorizado) y admin (solo sus operaciones/datos y los módulos concedidos). Ocultar controles en el frontend mejora la UI, pero la autorización real debe aplicarse en el backend.
- `src/index.css` es el archivo de estilos actual; no hay router/dependencia de rutas. La propuesta puede mantener navegación simple si crece por etapas.

### Diseño que el desarrollador debe proponer antes de tocar código

1. Separación entre cuenta `Empresa` y entidad fiscal `Comercio`, o justificación de un modelo único; una empresa administra el supermercado y su CUIT habilitado para vender.
2. Modelo Prisma para `Empresa`, `Usuario` y módulos habilitados (o diseño equivalente), incluyendo estados activo/suspendido y asignación de admin a una empresa.
3. Inicialización segura del primer superadmin; creación de empresa y admin desde panel, contraseña almacenada solo como hash y mecanismo de cambio/recuperación de credenciales.
4. Identidad autenticada: tenant obtenido del token/sesión en el backend; no confiar en `empresa_id`, CUIT ni rol enviados por el frontend.
5. Ámbito de empresa en productos, ventas, consultas, detalles, stock, códigos e `id_venta`; definir índices y restricciones compuestas y evitar referencias cruzadas entre empresas.
6. Aplicar suspensión y permisos de módulos tanto en endpoints como en navegación UI. El superadmin puede consultar datos para análisis según autorización del profesor; registrar claramente ese permiso amplio.
7. Migración no destructiva de los registros existentes a una empresa demo/inicial (pendiente de definir el nombre/destino), y seed idempotente para esa empresa.
8. Pruebas de aislamiento: empresa A no puede leer/editar/borrar datos de B cambiando IDs/CUIT; admin no puede usar rutas de superadmin; empresa suspendida o sin módulo no puede usar endpoints asociados.

Importante: `alumnos/sebastian/MEJORAS.md` no está en el árbol de `sebasRama2`; sí fue leído desde `origin/main` como referencia. No traerlo ni modificarlo dentro de esta rama salvo pedido del usuario.

### Decisiones del usuario (28/10/2026)

- Roles iniciales: `superadmin` (propietario de la aplicación) y `admin` (administrador de una empresa). Por ahora no se requieren roles de cajero ni sucursales.
- El superadmin crea las empresas desde su panel y habilita una cuenta admin con contraseña para cada una.
- El superadmin puede desactivar el acceso de una empresa por falta de pago, asignarle los módulos disponibles y consultar sus datos para análisis.
- Cada empresa tiene su propio catálogo. Un producto de una empresa no es el mismo producto de otra aunque compartan nombre o código.
- Cada empresa tendrá un identificador interno único y estable; todos sus datos deben quedar relacionados con ese ID y aislados en el backend.

### Aclaración pendiente sobre datos existentes

El punto que el usuario no entendía se refiere a la base SQLite que ya tiene datos de prueba (productos y ventas): al agregar `empresa_id` a productos y ventas, hay que asignar esos registros existentes a una empresa para no dejarlos huérfanos o invisibles. Propuesta recomendada: crear una empresa inicial de prueba y asociarle todos los registros actuales mediante una migración que preserve los datos. Falta confirmar el nombre o si deben asociarse a una empresa real específica.

Notas para la propuesta técnica:

- El identificador de empresa debe ser una clave interna estable (preferiblemente UUID); no usar un ID enviado por el frontend como autorización. El backend obtiene el `empresa_id` de la sesión autenticada y limita por él todas las lecturas y escrituras.
- El superadmin inicial requiere una forma segura de bootstrap/configuración. La contraseña de los admins de empresa se guarda como hash, nunca en texto plano.
- La suscripción/estado activo y los módulos permitidos se deben aplicar también en el backend, no solo ocultar opciones de la interfaz.

## Rama y estado

- Repositorio: `Lucasm282021/Ecosistema-Fintech-simulado`.
- Rama elegida: `sebasRama2`.
- La rama local está 1 commit adelante de `origin/sebasRama2` (`Guardar avances del TPV`). Ese commit no está publicado.
- Al verificar este archivo, el árbol estaba limpio antes de agregarlo.
- Según el último informe pegado del modelo desarrollador, ya había cambiado a `sebasRama2`, comprobado que el árbol estaba limpio y todavía no había empezado los cambios nuevos de Etapa 1.
- No hacer commit, push ni despliegue sin autorización explícita.

## Qué versión continuar

Continuar la app existente de `sebasRama2`:

- Backend: `alumnos/sebastian/tpv-backend/` (NestJS, Prisma, SQLite).
- Frontend: `alumnos/sebastian/tpv-frontend/` (React, Vite).

No trabajar en `main`, `sebastian`, ni en la implementación alternativa `alumnos/sebastian/tpv/`. Esa alternativa existe en `main`; no mantener dos TPV de Sebastián en paralelo. Se pueden leer como referencia `docs/guia-fundacional-equipos.html`, `docs/prompts/comun.md`, `docs/prompts/tpv.md` y `alumnos/sebastian/MEJORAS.md`, pero el código de esta tarea debe quedar dentro de `alumnos/sebastian/`. No modificar documentos compartidos ni carpetas de otros alumnos.

## Objetivo acordado

Seguir la propuesta de `alumnos/sebastian/MEJORAS.md`: conservar la caja existente, corregir su conexión y alineación con el contrato del curso, y luego agregar por etapas un panel de control. El usuario pidió que el desarrollador primero explique lo que entendió y espere confirmación antes de editar; también pidió aprobación por cada etapa.

Por ahora solo se consideró la Etapa 1. **No está aprobada todavía.** El usuario pidió una aclaración final del diseño de persistencia, concurrencia y migraciones antes de autorizar cambios.

## Informe más reciente del modelo desarrollador

El modelo informó que no había editado nada y propuso:

- Agregar `etapaPendiente` (`municipio`, `arba`, `pago`, `arca` o vacío) a `Venta`, con una migración nueva.
- Representar estados de venta como `PENDIENTE`, `ERROR_RECUPERABLE` y `COMPLETADA`.
- Guardar la etapa antes de llamar a cada integración.
- En un resultado incierto del pago (timeout/red, 5xx o 2xx sin ID), dejar `PENDIENTE` en etapa `pago`; al repetir el mismo `id_venta`, responder 409 y no llamar de nuevo a Banco/Billetera.
- En una venta completada, devolver lo guardado. En error recuperable, continuar desde la etapa pendiente sin repetir pagos que tengan referencia.
- Corregir el contrato de ARCA y quitar referencias externas inventadas.
- Impedir el inicio en producción si hay mocks activos; conservar `ARCA_MOCK=true` y `NODE_ENV=development` en el compose local.
- Separar frontend en archivos de API, Caja, Ticket y aviso de conexión; usar `VITE_TPV_API_BASE_URL`, conservar `public/config.js` y quitar el catálogo de muestra cuando no hay backend.
- Modificar archivos solo dentro de `alumnos/sebastian/`, incluyendo frontend, backend, `docker-compose.yml` y `README.md`.
- Ejecutar migración y builds al terminar la etapa; no hacer commits.

El modelo afirma que Banco y Billetera actualmente no son idempotentes por `id_venta`. Por eso hay riesgo de cobro duplicado al reintentar un timeout. La guía pide reanudar con el mismo `id_venta` sin volver a cobrar ni recalcular recursos ya creados.

## Observaciones que deben resolverse antes de aprobar

1. **Concurrencia:** guardar `etapaPendiente` antes de llamar a un servicio no garantiza que dos solicitudes simultáneas del mismo `id_venta` no procesen ambas la etapa. El desarrollador debe explicar una exclusión o reclamación atómica en la base de datos que funcione también si hay más de un proceso; un bloqueo solo en memoria no alcanza.
2. **Migración de ventas existentes:** si se reemplazan los estados intermedios (`VALIDADO_MUNICIPIO`, `COBRADO`, `PERCIBIDO_ARBA`), la migración debe mapear cada estado existente a un estado nuevo y a la etapa siguiente correcta, preservando IDs y referencias. No alcanza con agregar una columna si la aplicación deja de reconocer los estados viejos.
3. **Idempotencia real:** verificar en el código/contrato de ARBA y ARCA que repetir con el mismo `id_venta` evita una percepción o comprobante duplicado. No asumirlo solo porque la guía mencione el ID. Para resultados inciertos, no repetir una operación externa si no hay idempotencia o consulta para reconciliarla.
4. **Pago:** una respuesta sin referencia después de un 2xx puede significar que el pago se hizo. Debe permanecer bloqueado y verificable; no convertirlo en un reintento de cobro. Tratar un 4xx como rechazo seguro solo si el contrato del servicio garantiza que no debitó.
5. **Base local:** probar la migración sobre una copia segura de la base primero, preservar la original y explicar exactamente qué base se usará. No modificar ni sobrescribir la base original durante la prueba.

## Condiciones de trabajo ya comunicadas

- Antes de modificar, informar rama actual, árbol limpio y lista revisada de archivos.
- Solo Etapa 1; no comenzar Etapas 2 o 3.
- Mantener mocks explícitos para desarrollo. En producción, impedir arranque si hay mocks activos.
- No agregar un estado `PAGO_INCIERTO`; usar los estados del contrato y representar el punto de reanudación con la etapa pendiente.
- No agregar una ruta de reintento nueva sin acuerdo. La guía plantea reutilizar `POST /tpv/ventas` con el mismo `id_venta`.
- No mostrar catálogo, pago, percepción o CAE inventados como reales.
- Esperar aprobación explícita antes de editar; luego esperar aprobación separada antes de pasar a otra etapa.
- Sin commits, push o despliegues sin autorización.

## Próximo paso

Pedir al modelo desarrollador que responda los cinco puntos de “Observaciones que deben resolverse antes de aprobar”, actualice su lista de archivos y espere. Cuando el usuario revise esa respuesta, decidir si autoriza solo la Etapa 1.

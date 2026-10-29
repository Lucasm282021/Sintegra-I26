# Instrucciones para el desarrollador — TPV multiempresa de Sebastián

## Mensaje inicial obligatorio

Soy Sebastián. Quiero continuar mi TPV en el repositorio `Lucasm282021/Ecosistema-Fintech-simulado`, en la rama `sebasRama2`, dentro de `alumnos/sebastian/`.

**Por ahora no edites, crees, borres ni muevas archivos.** Primero revisa el estado y el código, luego explícame qué entendiste, qué arquitectura propones, qué archivos tocarías por etapa y qué riesgos/decisiones quedan pendientes. Espera mi aprobación explícita antes de empezar a codificar. La aprobación para una etapa no autoriza las siguientes: al terminar cada etapa, informa los resultados y espera una nueva aprobación.

## Revisión previa, sin editar

1. Comprueba la raíz del repositorio, la rama actual y `git status`. La rama de trabajo debe ser exactamente `sebasRama2`. No cambies de rama automáticamente si estás en otra: informa el estado y espera instrucciones. Conserva cualquier cambio local.
2. Lee `alumnos/sebastian/CONTINUACION_TPV.md` y este archivo.
3. Lee `docs/guia-fundacional-equipos.html`, `docs/prompts/comun.md` y `docs/prompts/tpv.md` como referencia del contrato común.
4. Lee `alumnos/sebastian/MEJORAS.md` si está disponible en la rama. Si no existe en `sebasRama2`, puedes leer su versión de `origin/main` solo como referencia; no la copies ni la edites.
5. Inspecciona el código existente del TPV en `alumnos/sebastian/tpv-backend/` y `alumnos/sebastian/tpv-frontend/`, en particular el esquema Prisma, migraciones, seed, módulos/controladores/servicios de Comercios, Productos y Ventas, `AppModule`, `main.ts` y la interfaz actual.

## Alcance y ubicación obligatorios

- Toda modificación de código de esta tarea debe quedar dentro de `alumnos/sebastian/` en `sebasRama2`.
- No modificar `main`, la rama `sebastian`, la implementación alternativa `alumnos/sebastian/tpv/`, `docs/` ni carpetas de otros alumnos.
- La app existente que se conserva es NestJS + Prisma + SQLite en `tpv-backend/`, y React + Vite en `tpv-frontend/`. No rehacerla desde cero.
- No hacer commits, push, crear PR, publicar imágenes ni desplegar sin autorización explícita.
- No subir `.env`, contraseñas, tokens, bases SQLite, `node_modules/` ni `dist/`.

## Requisito multiempresa comunicado por el profesor

La misma aplicación debe servir a varias empresas/comercios, con aislamiento de los datos de cada empresa.

- Roles iniciales: `superadmin` (propietario de la app) y `admin` (administrador de una empresa). Por ahora no hay sucursales ni otros roles.
- El superadmin crea desde su panel la empresa y su cuenta admin con contraseña.
- El superadmin puede suspender el acceso de una empresa por falta de pago, configurar qué módulos tiene habilitados y consultar sus datos para análisis.
- Cada empresa ve y administra sus propios productos, ventas y datos operativos. Su catálogo es independiente: el producto con ID/código en una empresa no es el producto de otra empresa.
- Cada empresa necesita un identificador interno único y estable. El backend debe derivar el ámbito de empresa de la identidad autenticada; nunca debe confiar en un `empresa_id`, CUIT o rol que mande el frontend como prueba de autorización.
- Debe decidirse y explicarse antes de implementar si la cuenta multiempresa es el modelo `Comercio` existente o una entidad `Empresa` separada de los datos fiscales del comercio. No asumir que el CUIT por sí solo sirve como autorización.
- Hay datos de prueba existentes en la base SQLite. La propuesta debe asignarlos a una empresa demo/inicial mediante una migración segura, preservando registros y referencias. Falta confirmar el nombre de esa empresa inicial; no borrar ni reasignar datos sin describirlo y recibir aprobación.

## Diagnóstico ya realizado del código en `sebasRama2`

Estos hallazgos deben confirmarse durante la revisión inicial:

- `tpv-backend/prisma/schema.prisma` contiene `Comercio`, `Producto`, `Venta` y `DetalleVenta`; no hay modelo de empresa/tenant, usuario, contraseña, rol ni permisos.
- `Comercio` se identifica por CUIT. `Producto` no tiene dueño y su `codigo` es globalmente único. `Venta` enlaza a comercio por CUIT y `idVentaExternal` es globalmente único. Los detalles relacionan venta y producto, pero no se comprueba que pertenezcan al mismo tenant.
- La única migración existente es `prisma/migrations/20261020120000_init/migration.sql`. Una revisión anterior de una copia segura encontró 1 comercio, 12 productos, 2 ventas y 4 detalles; vuelve a comprobar el estado de la base actual antes de planear la migración.
- `prisma/seed.ts` crea un comercio y productos de prueba sin ámbito de empresa; deberá ser tenant-aware e idempotente.
- No hay módulo de autenticación, login, guardas, token/sesión ni hashing de contraseñas. `AppModule` importa Prisma, Productos, Comercios, Ventas e Integraciones.
- `ProductosService` lista, busca, crea y borra productos globalmente. `ComerciosService` lista y crea comercios globalmente. `VentasService` lista y busca ventas globalmente, busca productos globalmente y obtiene el CUIT de la venta del payload.
- `tpv-frontend/src/App.jsx` concentra caja e historial en una pantalla, no tiene login/roles y permite editar un CUIT precargado. El catálogo e historial se piden sin identidad autenticada.
- La guía de mejoras existente en `origin/main` pide además corregir URL API configurable, eliminar el catálogo ficticio cuando no hay conexión, usar `snake_case`, no mostrar resultados ficticios como reales y mantener el precio/total bajo autoridad del backend.

## Cambios que la propuesta debe cubrir y dónde

No edites estos archivos todavía. Primero presenta el diseño y la lista exacta según el código vigente.

### Backend — `alumnos/sebastian/tpv-backend/`

1. **Datos multiempresa y migración**
   - Revisar `prisma/schema.prisma` y crear/ajustar modelos para empresa/tenant, cuenta de usuario admin y permisos de módulos.
   - Añadir pertenencia a empresa a los datos que deban aislarse: catálogo/productos, ventas y sus referencias. Definir cómo se asocian los comercios fiscales.
   - Revisar restricciones únicas: los códigos de productos y `id_venta` deben tener el ámbito correcto por empresa; evitar colisiones entre empresas y referencias cruzadas.
   - Crear una migración nueva, no editar la migración ya aplicada. Mapear los estados/datos legados y asignar los registros actuales a la empresa inicial aprobada. Describir respaldo y ejecutar primero solo sobre una copia segura.
   - Adaptar `prisma/seed.ts` para crear datos de demostración dentro de una empresa determinada sin duplicar ni apropiarse de registros de otra empresa.

2. **Autenticación y autorización**
   - Proponer módulos nuevos bajo `src/modules/` para autenticación/usuarios y administración de empresas; especificar controladores, servicios, DTOs, guardas y decoradores que hagan falta.
   - Definir inicio seguro del primer superadmin. Guardar contraseñas solo como hashes; explicar cómo se entrega o cambia la contraseña inicial de un admin creado por el superadmin.
   - Usar la identidad autenticada para obtener el tenant en cada request. Superadmin puede operar globalmente; admin solo en su empresa.
   - Aplicar suspensión y permisos de módulos en el backend, no solo ocultar páginas en React.
   - Mantener `GET /health` accesible según el contrato común; definir explícitamente qué rutas son públicas y cuáles requieren autenticación.

3. **Aislamiento en todas las operaciones**
   - Adaptar `productos.controller.ts`/`productos.service.ts`, `comercios.controller.ts`/`comercios.service.ts`, `ventas.controller.ts`/`ventas.service.ts` y DTOs para filtrar por tenant autenticado en lista, detalle, alta, edición, baja, stock e historial.
   - Al vender, comprobar que cada producto y el comercio pertenecen a la empresa autenticada. No confiar en `comercio_cuit` del cliente para decidir qué datos puede leer/escribir.
   - Asegurar que un ID de otra empresa no permita leer, editar, borrar ni vender ese recurso.
   - Resolver solicitudes duplicadas/reintentos de venta con protección atómica en la base de datos; un bloqueo solo en memoria no es suficiente.

4. **Administración**
   - Diseñar las operaciones de superadmin para crear empresa y admin, suspender/reactivar empresa, configurar módulos habilitados y consultar análisis permitidos.
   - No inventar endpoints fuera del contrato acordado sin identificarlos como propuesta y esperar acuerdo de la cátedra/usuario.

### Frontend — `alumnos/sebastian/tpv-frontend/`

- Separar el actual `src/App.jsx` en pantallas/componentes para autenticación, navegación, panel de superadmin y app de empresa, en etapas aprobadas.
- Agregar login y manejo seguro de sesión/token según la arquitectura propuesta.
- Superadmin: lista/alta de empresas, alta de admin, suspensión/reactivación, módulos y análisis autorizado.
- Admin: caja, productos y ventas de su empresa; mostrar solo módulos habilitados.
- Quitar el CUIT editable como forma de seleccionar tenant. Cargar la identidad/configuración del comercio desde el backend autenticado.
- El frontend puede ocultar módulos no habilitados para la experiencia de usuario, pero el backend también debe denegar esas operaciones.
- Mantener la API configurable por entorno, quitar catálogo de ejemplo cuando el backend no responde y conservar los estados reales de la venta.
- Respetar el contrato del curso: JSON `snake_case`, CUIT como string, un único medio de pago, precios/totales calculados por backend y nunca inventar pago, percepción ni CAE.

## Riesgos y puntos que no se deben dar por resueltos

- Al migrar los estados actuales (`VALIDADO_MUNICIPIO`, `COBRADO`, `PERCIBIDO_ARBA`, etc.) se debe mapear cada registro a su nueva etapa sin perder los IDs externos ni marcar como fallida una venta ya cobrada.
- Verificar idempotencia real con Banco, Billetera, ARBA y ARCA. Si una operación externa queda incierta y no se puede consultar/reconciliar o repetir idempotentemente, no volver a cobrar/emitir a ciegas.
- Una venta con el mismo `id_venta` en dos empresas no debe colisionar si el contrato permite IDs locales por comercio; proponer el índice adecuado y explicar compatibilidad con el contrato de integraciones.
- La app permite al superadmin ver datos para análisis; explicar el alcance y proteger esa capacidad con autorización explícita.
- Mantener `ARCA_MOCK=true` en el compose local de desarrollo. En producción, el backend debe impedir el arranque si hay mocks activos.

## Etapas propuestas

En la primera respuesta, propone etapas y archivos concretos para aprobación. Como orientación:

1. Diseño multiempresa, autenticación/autorización y migración/aislamiento de datos.
2. Login y áreas separadas de superadmin/admin con permisos por empresa/módulo.
3. Adaptación de la caja y del panel de productos/ventas para el tenant autenticado, alineados con el contrato del curso.

Puedes proponer otro orden si justificas dependencias. No empieces ninguna etapa hasta que el usuario apruebe explícitamente esa etapa y sus archivos.

## Formato de la respuesta inicial

Antes de codificar, devuelve:

1. Rama actual, raíz del repositorio y estado de Git.
2. Resumen de lo que entendiste del requisito multiempresa y del contrato TPV.
3. Decisión recomendada y alternativas para `Empresa` frente a `Comercio`, tenant frente a CUIT, sesión/autenticación y módulos.
4. Cómo migrarás los datos actuales y qué empresa inicial necesitas que confirmemos.
5. Cómo aislarás consultas, operaciones y referencias entre empresas, incluidas solicitudes simultáneas.
6. Etapas con archivos exactos a tocar, riesgos y forma segura de validar cada etapa.
7. Dudas concretas para Sebastián o la cátedra.

Después, espera la aprobación. No codifiques, no ejecutes migraciones, no instales dependencias y no hagas cambios de rama hasta recibirla.

# Changelog del ecosistema Sintegra I26

Qué se conserva, modifica, reemplaza, depreca o elimina en cada entrega. Lo anterior al 2026-10-29 está en [AVANCES-UNIFICACION.md](AVANCES-UNIFICACION.md).

## 2026-10-29 — CORE de comercios (Fases B y C del prompt maestro)

### Agregado
- **Esquema `core`** (migración `20261029000013_core_comercios.sql`): comercios con `commerce_id`, sucursales, usuarios, membresías, integraciones, verificaciones con evidencia y eventos. Función `core.cuit_dv_valido`.
- **Importación** de los comercios que ya operaban en Municipio, ARBA, ARCA o TPV, con una sucursal “Casa central”. Los CUIT demo con dígito verificador inválido quedan `observado`.
- **Usuario demo de la cátedra** (migración `…014`): `demo.comercios.i26@gmail.com`, titular de los comercios importados.
- **Módulo `/core`** en el backend: usuarios y sesiones, alta única, solicitud y aprobación de acceso, panel de estado, verificaciones sandbox y manuales, sucursales, vínculo con Banco y activación del TPV con requisitos.
- **Asistente web** `public/comercios/`: ingreso, alta en 3 pasos, panel de estado y botones para simular cada trámite en su organismo.
- `POST /arca/contribuyentes` (inscripción sandbox), `POST /banco/cuentas` (apertura de cuenta), `POST /municipio/comercios/:cuit/resolucion` (resolución simulada).
- `npm run dev:memoria`: backend local sobre PGlite.
- Documentos: arquitectura, flujo de alta, contratos, matriz de propiedad de datos, plan de migración y pruebas.
- 14 pruebas nuevas (`backend/test/core.test.js`); suite total 28/28.

### Modificado (compatible)
- `POST /municipio/comercios`: si el CUIT ya existe en el padrón fiscal se reutiliza sin pisarlo; `409` solo si ya hay trámite.
- `tpv.js`: la vinculación de comercio se extrajo a `vincularComercio()`; la ruta `POST /tpv/comercios` responde igual.
- `banco.js`: nueva función `abrirCuenta()`.
- `app.js`: CORS admite `Authorization` y `PATCH`; los errores pueden incluir detalle (por ejemplo, `faltantes`).

### Deprecado
- Crear un CUIT desde Municipio. Lo hace ARCA; la identidad del comercio la registra el CORE.

### Conservado
- Todos los esquemas, tablas y datos existentes. Ninguna migración borra datos.

### Validado antes de esta entrega
- Trabajo de Codex sin guardar (PV obligatorio, CAE ficticio, altas municipales pendientes, billetera provista por Banco, TPV Sebastián con cuenta de cobro, ARBA Lucas contra el backend único): 14/14 pruebas y builds correctos; guardado en 6 commits.
- Limpieza de `banco-m`: se quitó un panel HTML incompleto y módulos de ingreso sin uso.

### Pendiente de publicar
- Aplicar en Supabase las migraciones `…011` a `…014` y publicar backend y portal (requiere OK).

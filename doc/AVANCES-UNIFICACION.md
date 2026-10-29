# Avances — Unificación del alta y operación de comercios

**Actualizado:** 2026-10-28  
**Responsable de la sesión:** Codex  
**Estado general:** en curso; primera tanda de cambios locales verificada en backend y frontend. No publicada.  
**Bitácora:** agregar una entrada con fecha al cerrar cada fase o al descubrir un bloqueo relevante.

Este registro acompaña al [traspaso de continuidad](CONTINUIDAD-ECOSISTEMA-CLAUDE.md) y al [prompt maestro](PROMPT-MAESTRO-ECOSISTEMA.md). No reemplaza esos documentos.

## Fases

| Fase | Alcance | Estado | Resultado verificable |
|---|---|---|---|
| 0 | Inventariar cambios, instrucciones locales, estructura y riesgos del workspace | Primera pasada completa | `git status`, `git diff --check`, árbol de proyectos y reglas locales revisados; falta revisar todo el diff histórico antes de publicar |
| 1 | Auditoría de contratos, datos y responsabilidades por aplicación | Primera pasada documentada | `AUDITORIA-ECOSISTEMA.md` cubre apps, contratos, persistencia, mocks y riesgos; falta validación funcional completa de cada proyecto |
| 2 | Definir identidad CORE, sucursales, usuarios y estados de verificación | Pendiente; avance parcial | Checksum aplicado a nuevas solicitudes municipales; faltan commerceId/sucursales/membresías y autenticación transversal |
| 3 | Alinear ARCA, ARBA y Municipio con estados/evidencia y sus reglas propias | Parcial | ARCA exige PV preconfigurado y etiqueta CAE simulado; Municipio deja alta pendiente y no inventa tasas; falta regla ARBA por régimen/agente y conectores oficiales |
| 4 | Alinear Banco, Billetera y TPV; pago único, cuenta receptora y webhook | Parcial, validado en local | Regla de saldo compartido, creación desde Banco, vínculo demo terminal-David y pruebas backend; quedan flujos/UI independientes por migrar |
| 5 | Adaptar UX de alta y panel de estado en las aplicaciones | En curso | Manual HTML y consola/mock municipal alineados; faltan paneles de estado transversal en las apps |
| 6 | Pruebas de integración sintéticas, builds y verificación final | Primera pasada local aprobada | Backend 14/14; Municipio lint/build aprobados; seis builds previos exitosos; no es E2E productivo ni valida organismos oficiales |
| 7 | Revisión de diff, push/despliegue autorizado | No iniciado | Requiere revisión y autorización explícita antes de publicar |

## Bitácora

### 2026-10-28 — Inicio y primera inspección

**Hecho**

- Leídos el traspaso y el prompt maestro completos; confirmé que el prompt exige auditoría previa, compatibilidad y datos sintéticos.
- Revisé `git status`, `git diff --stat`, `git diff --check`, las rutas base de backend y migraciones, la UI de Billetera, el formulario de caja de TPV David, el checkout compartido y partes de TPV Sebastián/ARBA.
- Revisé la instrucción local `municipio-cristian/frontend/AGENTS.md`. Si se modifica ese frontend Next.js, hay que leer su guía instalada en `municipio-cristian/frontend/node_modules/next/dist/docs/` antes de editarlo.
- Confirmé que el repositorio tiene, entre otros, `backend`, `arba-lucas`, `arba-nehemias`, `arba-tomi`, `arca-mateo`, `banco-m`, `Billetera_virtual-Lucas_M`, `brisa`, `municipio-cristian`, `sebasTPV` y `tpv-david`.
- `git diff --check` no reportó errores de whitespace en los cambios anteriores. Emitió advertencias de conversión LF/CRLF.

**Hallazgos que requieren corrección o decisión**

- `backend/src/http.js` aún ofrece validación de formato para compatibilidad; `cuitChecksumValido` se aplica al alta municipal nueva, no a todo el ecosistema. Hay IDs demo existentes sin checksum, así que el endurecimiento integral requiere migrar fixtures.
- `backend/src/modulos/arca.js` devuelve CAE `FICTICIO-` y `validez_fiscal:false`; el módulo Mateo también es simulado. Se eliminó la creación implícita de puntos de venta en ARCA/TPV; la autorización oficial todavía no existe.
- `backend/src/modulos/tpv.js` calcula percepción usando la alícuota de inscripción del CUIT vendedor. `sebasTPV/tpv-frontend/src/App.jsx` además estima una percepción fija de 3%. El concepto/regla necesita diseño fiscal correcto (sujeto alcanzado, agente, jurisdicción, padrón y fecha); no asumir que la tasa del comercio siempre se suma a cada venta.
- El checkout compartido no consulta `municipio.habilitaciones` al activar un comercio ni antes de vender. La integración municipal debe modelarse por sucursal y aplicabilidad/jurisdicción, no con un bloqueo genérico para cualquier actividad.
- `tpv-david` mantiene backend/JSON y UI propios. Su `MunicipioClient` llama una ruta que no coincide con la API común (`/municipio/habilitaciones/consultar` frente a `GET /municipio/comercios/:cuit`). El frontend manda `medioPago` camelCase en el flujo local, mientras la API común acepta `medio_pago`/alias específicos; confirmar y normalizar DTO.
- `tpv-david/src/index.ts` declara una URL de Billetera, pero no inyecta el cliente de Billetera en `VentasService`; el comentario dice explícitamente que todavía no participa del flujo.
- `arba-lucas/frontend/src/apiUrl.js` conserva `/auth/*` local y apunta datos al backend común cuando `VITE_API_BASE_URL` existe. El backend común aún no debe suponerse como sistema de autenticación compartido.
- El esquema común utiliza CUIT como clave/FK en `padron.contribuyentes`; no existe todavía un `commerceId` transversal, sucursal comercial ni membresía multiusuario. Hace falta migración aditiva, no reescritura.
- Se preservan sin modificar estos untracked ajenos: `Mauricio admin/`, `sebasTPV/bar.fig`, `sebasTPV/sebastian/`, `sebasTPV/tpv-backend/dist/`, `sebasTPV/tpv-backend/tsconfig.tsbuildinfo`, `sebasTPV/tpv-frontend/dist/`.

### 2026-10-28 — Primeras correcciones del flujo y manual para usuarios

**Cambios locales realizados**

- `backend/src/modulos/billetera.js` conserva a Banco como responsable de provisionar la billetera; las pruebas confirman que el cliente no puede autoabrirla.
- `backend/src/modulos/banco.js` y `backend/supabase/seed.sql` alinean la demo con el principio de saldo compartido y reflejan las billeteras vinculadas al saldo de la cuenta bancaria.
- `backend/supabase/migrations/20261028000011_tpv_david_banco.sql` asocia la terminal demo de David a la cuenta bancaria del mismo CUIT sin crear otra cuenta ni cambiar saldos.
- `backend/src/modulos/tpv.js` expone explícitamente en las consultas de venta el prefijo `FICTICIO-`, `estado: simulado` y `validez_fiscal: false`; evita presentar una respuesta demo como CAE autorizado.
- `backend/test/integracion.test.js` y `backend/test/integracion-sinteticos.test.js` comprueban provisión Banco→Billetera, saldo compartido, movimientos y CAE ficticio en el entorno PGlite aislado.
- Creado [MANUAL-USUARIO-SINTEGRA.html](MANUAL-USUARIO-SINTEGRA.html): manual autónomo y responsive con recorrido de alta, guía de TPV, Banco/Billetera, módulos fiscales, estados, solución de problemas y fuentes oficiales. Distingue visualmente la demo de una operación fiscal/financiera real.
- `README.md` enlaza el manual HTML desde la entrada del repositorio.

**Verificación ejecutada**

- `backend/`: `npm.cmd test` — **13/13 aprobadas**, incluyendo la suite aislada de cinco sujetos sintéticos; no se usó Supabase ni se generaron transacciones productivas.
- Builds con `npm.cmd run build` o equivalente: ARBA Lucas, ARBA Tomi, frontend de Banco M, frontend de Municipio, frontend de TPV Sebastián y TPV David — todos terminaron con exit code 0. Vite emitió warnings de carga nativa en algunos proyectos, sin impedir el build.
- Billetera: `node --check public/app.js` y `node --check src/server.js` — correctos.
- No hubo push ni despliegue. Las modificaciones siguen locales y requieren revisión completa antes de publicar.

**Trabajo que sigue abierto**

- Validar CUIT con dígito verificador sin romper fixtures; diseñar identidad/sucursal y autorización transversal.
- Resolver divergencias ARBA, ARCA y Municipio con estados, vigencias y reglas por autoridad; mantener percepciones demo separadas de la tributación real.
- Terminar integraciones de Brisa, Sebastián y David con contrato común, incluyendo webhook/reintentos y pruebas de interfaz.
- Aplicar migraciones solo con revisión de destino, respaldo y verificación; revisar el diff histórico y los despliegues independientemente.

## Reglas de registro de avances

- Para cada cambio indicar ruta/endpoint, motivación, compatibilidad, prueba ejecutada y resultado.
- Marcar cada integración como `real/autorizada`, `manual`, `mock`, `local` o `no disponible` con evidencia; no usar “conectada” solamente porque el endpoint `/health` respondió.
- No copiar secrets, credenciales, CUIT de personas reales ni tokens a esta bitácora.
- Actualizar el estado de fase sólo al completar su criterio verificable; no marcarla completa por haber creado documentación o código sin validar.

### 2026-10-28 — PV fiscal explícito y solicitud municipal sin aprobación automática

**Cambios locales realizados**

- `backend/src/modulos/arca.js`: los comprobantes se exponen con `estado: simulado`, `estado_registro`, `ambiente: sandbox` y `validez_fiscal:false`. La emisión requiere punto de venta y tipo configurados antes; si faltan, responde HTTP 409.
- `backend/src/modulos/tpv.js`: ya no inserta el punto de venta al vender. Ante una configuración faltante, la transacción revierte pago/stock y no deja venta persistida.
- `backend/src/http.js`: agregó validación de dígito de control. Se aplica a las altas nuevas del backend municipal; no confirma existencia ni estado real ante ARCA.
- `backend/src/modulos/municipio.js`: el alta crea estado `pendiente`, no crea períodos/tasas y no emite libre deuda sin habilitación vigente.
- `backend/supabase/migrations/20261028000012_municipio_habilitacion_pendiente.sql`: migración aditiva admite `pendiente` y conserva los registros previos. No aplicada a Supabase.
- `municipio-cristian/frontend/src/{services/municipioService.ts,types/municipio.ts,components/TabPadronComercios.tsx}`: el mock/pantalla reportan solicitud pendiente; no inventan obligaciones y bloquean certificado prematuro.
- `municipio-cristian/server.js`: SQLite legacy deja altas pendientes y actualiza solo obligaciones pendientes existentes, por importe exacto y comercio vigente. No hace transferencias Banco. La base `municipio-cristian/municipio.db` no se abrió ni modificó.
- Actualizados manual, auditoría, README del módulo y [guía municipal](MUNICIPIO-CRISTIAN.md) para distinguir actual vs. propuesta.

**Verificación ejecutada**

- Backend `npm.cmd test`: **14/14** aprobadas en PGlite, incluyendo rollback de venta sin PV, flags CAE, checksum incorrecto, solicitud municipal pendiente y certificado rechazado hasta habilitación vigente.
- Municipio frontend `npm.cmd run lint`: aprobado; `npm.cmd run build`: aprobado. Vite conserva warning no fatal de `__dirname`.
- Municipio local SQLite `node --check server.js`: correcto; no se conectó a SQLite.
- Los tests TS directos fallaron al ejecutarse con `npx tsx --test` porque dependen de `import.meta.env`, ausente bajo Node puro. El proyecto no declara script de tests; la nueva regla quedó compilada por TypeScript y probada desde backend.
- Sin cambios/lecturas a Supabase o SQLite, sin push y sin despliegue.

**Pendiente prioritario**

- Definir `commerceId`, sucursales y jurisdicción para modelar la habilitación por establecimiento antes de exigirla en el TPV.
- Agregar workflow autenticado de documentos, observaciones y resolución municipal.
- Normalizar los CUIT sintéticos existentes antes de aplicar checksum a todos los endpoints.
- Sustituir la percepción ARBA automática por una regla de agente/régimen/sujeto/padrón/vigencia; hoy sigue siendo demo.

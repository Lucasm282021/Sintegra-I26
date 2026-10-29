# Auditoría inicial del ecosistema Sintegra I26

**Corte:** 2026-10-28 · **Estado:** auditoría de primera pasada, basada en el árbol, `README`, `package.json`, rutas y código de los componentes principales. Hace falta validar cada app ejecutándola y revisar la totalidad de sus modelos/pruebas antes de aprobar migraciones.

Bitácora de implementación: [AVANCES-UNIFICACION.md](AVANCES-UNIFICACION.md). Requisitos completos: [PROMPT-MAESTRO-ECOSISTEMA.md](PROMPT-MAESTRO-ECOSISTEMA.md).

## Resumen ejecutivo

El repositorio contiene **varias implementaciones paralelas**, no una única plataforma ya conectada. El backend modular en `backend/` es la integración más cercana a una fuente común: Express + Postgres/Supabase y esquemas por dominio. Sin embargo, Banco, ARCA, ARBA, Municipio, Billetera y al menos dos TPV mantienen también servidores, modelos y almacenamientos propios. Algunos frontends consumen backend común; otros llaman su servidor propio, usan mocks o guardan datos locales.

No hay conexión productiva con ARCA/ARBA/Municipios ni servicios bancarios acreditada por la inspección. Los comprobantes CAE del proyecto se identifican como ficticios en parte del código y las bases/semillas son académicas. El backend compartido no tiene autenticación general, las rutas de datos son accesibles sin sesión y permite CORS `*`; **no desplegar para operaciones con datos/dinero reales**.

La propuesta de evolución es conservar los módulos de negocio existentes, usar backend común como plano de integración y propiedad del ledger compartido, y migrar aplicaciones por contrato/adapter. No eliminar bases independientes ni alterar su contenido hasta decidir plan de migración y respaldo.

## Matriz de aplicaciones

| App / carpeta | Stack y persistencia observados | Responsabilidad actual y dependencias | Duplicación / problema principal | Recomendación y riesgo |
|---|---|---|---|---|
| Portal (`public/`, raíz) | HTML/CSS/JS estático; no base propia | Entrada al ecosistema y enlaces a apps | Lista de dominios no certifica que cada despliegue exista o sea correcto | Mantener como launcher; URLs por ambiente y chequeo de estado que diferencie health de readiness/autorización. Riesgo bajo. |
| Backend común (`backend/`) | Node.js + Express, `pg`, Postgres/Supabase, migraciones SQL; pruebas PGlite | API modular `/padron`, `/arca`, `/arba`, `/municipio`, `/banco`, `/billetera`, `/tpv`; TPV coordina cobro, percepción demo, comprobante ficticio y webhook | Esquema comparte CUIT como PK funcional; CAE `FICTICIO-`; checksum solo se exige en nuevas altas municipales; la percepción demo toma alícuota del vendedor; autorización general ausente y CORS `*` | No operar datos/dinero reales. Próximo: identidad/sucursal verificables, reglas ARBA explícitas, adapters oficiales y permisos. Riesgo alto. |
| ARBA Lucas/Tomi (`arba-lucas/`) | API Express 5 + React 19/Vite; README declara JSON `data/db.json`; frontend consulta servicio propio o API común según URL | Consola de padrón, alícuotas, simulador e historial | Tiene CRUD/auth/padrón/estadísticas duplicados del ARBA común y de ARBA Tomi. Contrato de alta acepta tasa editable. `auth` queda local mientras `/arba/*` se apunta al backend común, donde no hay identidad de sesión compartida | Resolver la app de referencia y quién mantiene padrón provincial. Usar dominio ARBA común; eliminar solo al migrar y compatibilizar UI/auth. No presentar alícuota como oficial. Riesgo medio-alto. |
| ARBA Nehemías (`arba-nehemias/`) | Solo se encontró `README.md`; no package/source/API en esta primera pasada | Alcance descrito como módulo ARBA | No hay implementación verificable | Confirmar si se archiva como documentación o se incorpora a ARBA canónico; no asumir una integración. Riesgo bajo. |
| ARBA Tomi (`arba-tomi/`) | React/Vite + Express + SQLite `better-sqlite3` | Sujetos, padrones, workflow borrador/revisión/aprobado, percepciones y autenticación | Segundo padrón ARBA independiente con DB local; cambia estados/rutas y contrato con respecto al backend común | Reutilizar su flujo de revisión útil detrás de API canónica, conservar SQLite hasta plan de export/import. Verificar CUIT checksum, auditoría y reglas de agentes. Riesgo medio. |
| ARCA Mateo (`arca-mateo/`) | Express, JSON de archivo, sesiones en memoria; UI HTML/CSS/JS | Usuarios/roles, padrones locales, puntos de venta, comprobantes, notas/consulta según docs | Padrón de ARCA separado y CAE `FICTICIO-*`; modalidad del punto de venta por configuración; en Vercel el disco es temporal según código | Mantener como sandbox explícito hasta titular/integración oficial. Para real: WSAA/WSFE, certificados por contribuyente/representación y PV autorizado; no usar JSON temporal. Riesgo muy alto. |
| Banco M (`banco-m/`) | Express + TypeScript, Prisma; Postgres declarado en `schema.prisma`, frontend React/Vite | Clientes/cuentas/CBU/alias, movimientos, transferencias, QR, comercios y webhook; autenticación parcial local | Banco administra `Comercio` y abre Cuenta por CUIT independientemente del padrón común; contrato `{ok,data}` difiere del común; README declara sin auth para API de cuentas; DB paralela | Dejar Banco como propietario exclusivo de cuenta, CBU, saldo y ledger; integrar vía API/adapter y mover gradualmente. No copiar saldo entre DBs. Verificar autorización y contrato QR/webhook. Riesgo muy alto. |
| Billetera (`Billetera_virtual-Lucas_M/`) | UI estática HTML/CSS/JS; backend standalone Express + SQLite `node:sqlite`; Vercel rewrite apunta API central | login, actividad, alias, pagos/QR; políticas recientes indican que Banco la provisiona y su saldo replica cuenta bancaria | Backend SQLite permite crear cuentas, separado del backend común. Usuarios demo viejos tienen wallets sin cuenta Banco y saldos distintos. QR/cargas pueden usar endpoints alternativos | Un solo saldo fuente en Banco; provisión desde Banco; billetera registra vistas/movimientos y referencia bancaria. Deprecar alta local y no borrar archivo hasta reconciliación. Revisar permisos del acceso a cuenta/ID. Riesgo alto. |
| Municipio Cristian (`municipio-cristian/`) | API Express + SQLite propio; frontend Vite/React con modo mock; módulo `/municipio` en backend común | solicitudes/habilitación, obligaciones y pagos de demo | La duplicación de API/persistencia permanece. Las altas nuevas quedan `pendiente`, no generan tasa ni certificado; sucursal/jurisdicción, documentos y resolución autenticada siguen pendientes | Municipio mantiene autoridad sobre permiso y tasa. El panel y mock están alineados; el backend común usa estado pendiente con migración aditiva. El SQLite legacy ahora deja altas pendientes y solo actualiza obligaciones existentes, sin debitar Banco. Migrar con respaldo después de definir municipio/sucursal/roles. Riesgo alto. |
| TPV Brisa (`brisa/`) | C# / ASP.NET Core 8 minimal API, SQLite; UI HTML/CSS/JS; simuladores .NET propios para pruebas | TPV y orquestación por HTTP configurable a Municipio, ARBA, Banco/Billetera y ARCA | API, catálogo/venta y SQLite propios; flows/DTOs distintos del TPV común; simuladores locales pueden confundirse con servicios reales | Conservar UI y dominio; migrar catálogo/checkout a contrato común por adapter o decidir que esta implementación sea canónica. No mantener dos ledgers. Riesgo alto. |
| TPV Sebastián (`sebasTPV/tpv-frontend`, `tpv-backend/`) | Frontend React 18/Vite; backend NestJS/TS + Prisma sobre SQLite; autenticación/roles y recuperación avanzada documentadas en su README | Comercios, productos, ventas, conciliación, ARBA/ARCA/Banco/Municipio y auditoría | Dos backends posibles: NestJS propio y backend común. Frontend local actual consulta backend común (por cambios en curso), pero puede existir build/deploy anterior con otra config. Contrato y los tipos de estado pueden divergir | Elegir una API como fuente de operación; reutilizar UI y lógica útil, portar autenticación/auditoría con revisión. Mantener idempotencia y conciliación persistida. Riesgo alto. |
| TPV David (`tpv-david/`) | UI HTML/JS; Express + TypeScript; catálogo, ventas y comercios guardados en archivos JSON | caja, stock, municipio, banco, ARBA, ARCA, conexiones y reintentos | Persistencia JSON efímera/no concurrente en hosting serverless; el service no inyecta cliente Billetera aun cuando la UI ofrece ese medio; client municipal llama ruta no existente en API común; body camelCase puede no mapear igual a `/tpv/ventas` | Migrar UI a endpoints TPV comunes. Mantener id de venta estable en reintentos; implementar billetera con API y CUIT pagador; eliminar JSON tras migración comprobada. Riesgo alto. |
| `consolidacion/` y `doc/` | Documentos Markdown/HTML | Contratos, informes y propuestas | Hay documentación antigua con datos y rutas que ya cambiaron; algunas docs llaman “real” a una integración que es simulada | Añadir estado observado/fecha, enlaces oficiales y distinguir mock/local/real en los docs; usar `doc/` como raíz documental, no duplicar en `docs/`. Riesgo medio. |

## Contratos divergentes observados

1. **Identidad:** apps envían CUIT o CUIL como 11 dígitos; validación generalmente comprueba solo regex. Falta `commerceId`, sucursal y membresías/representación canónicos. No siempre `cuit` identifica a una sola sucursal o usuario.
2. **Respuesta:** backend común entrega DTOs directos, Banco M suele anidar `{ok,data}`, TPV David tiene `camelCase`, Brisa tiene `snake_case`; ARBA local usa envelopes y modos demo/API.
3. **Persistencia:** Supabase/Postgres común vs SQLite local vs archivos JSON. Un dominio puede tener datos contradictorios en varias DB.
4. **ARCA:** el significado de `CAE` debe diferenciar `simulado` de autorizado; solo un CAE real procede de la autorización oficial y punto de venta/modalidad válidos.
5. **ARBA:** el padrón/tasa local no define automáticamente una percepción en todas las ventas. Deben modelarse vendedor agente, sujeto alcanzado, régimen, padrón y vigencia; la tasa del CUIT vendedor no es necesariamente la alícuota aplicable al comprador.
6. **Municipio:** falta relación de habilitación a jurisdicción/sucursal/domicilio/rubro y estados de trámite (pendiente, vigente, observada, vencida, suspendida, no aplicable).
7. **Banco/Billetera:** la API central ya refleja saldo bancario en la wallet, pero el seed legado tiene saldo desigual y wallets sin cuenta. Banco debe ser autoridad de CBU/cuenta/saldo y creación; TPV no debe enviar cuenta destino arbitraria.
8. **Autorización:** hay autenticación en algunas consolas, pero no autorización transversal por `commerceId`. La API común actualmente permite lectura/escritura pública, CORS abierto y no exige token salvo webhook admin; esto debe cerrarse antes de producción.
9. **Contingencia:** algunos módulos guardan paso a paso y dejan venta recuperable; el TPV común ejecuta pago/percepción/CAE en una transacción local. Un servicio externo no puede participar en transacción PostgreSQL real, así que producción necesitaría estados/outbox/saga y conciliación.

## Funciones útiles a preservar

- Alta Banco/Billetera con titularidad e historial; ledger e idempotencia bancaria.
- TPV Brisa: evita mandar precio desde el browser, tiene SQLite transaccional y servicios externos configurables.
- TPV Sebastián: autenticación, aislamiento de empresa, auditoría, locks y recuperación de etapas.
- TPV David: catálogo, estados por etapa y retry hacia adelante; requiere persistencia/DTO común.
- ARBA Tomi: workflow de revisión de alta; ARBA Lucas: consola de consulta e historial.
- Municipio: tasas y comprobantes/libre deuda por jurisdicción.
- ARCA Mateo: roles, sesión y etiqueta CAE ficticio, que deben mantenerse en el sandbox.
- API común: fixtures sintéticos PGlite, webhooks firmados e idempotencia en operaciones ya migradas.

## Plan seguro propuesto

1. Terminar auditoría de esquemas, permisos, deploys y frontend de cada app; guardar inventario con origen/fecha.
2. Definir CORE sin duplicar datos fiscales/bancarios: `commerceId`, CUIT, sucursales, membresías, estados/evidencias. Compatibilidad con CUIT mediante FK durante migración.
3. Definir DTO/versiones y errores en OpenAPI; seleccionar una fuente por dominio y marcar adapters mock/manual/real.
4. Introducir en fases por app: primero contratos y adapters; luego migración de persistencia y cierre de rutas redundantes.
5. Resolver fiscalidad y operaciones externas con dueños/credenciales y homologación, sin recrear reglas legales desde porcentajes demo.
6. Crear tests para alta/identidad, estados parciales, reintento, aislamiento, QR, webhook y facturación simulada; verificar builds y DB local efímera.
7. Revisar las apps una a una y después todo el flujo; no mezclar seed demo con producción ni borrar datos.

## Cambios de la primera sesión de mejoras

- En el backend común se alineó el comportamiento de Billetera con Banco (detalle en [AVANCES-UNIFICACION.md](AVANCES-UNIFICACION.md)).
- Se corrigió la asociación demo del terminal David mediante migración aditiva y se expone explícitamente `FICTICIO-`/`validez_fiscal:false` al leer ventas del TPV común.
- En la verificación inicial la suite pasó 13/13; después de las correcciones locales registradas abajo pasó 14/14 con el fixture PGlite, incluyendo cinco contribuyentes sintéticos.
- Builds verificados: ARBA Lucas, ARBA Tomi, Banco frontend, Municipio frontend, TPV Sebastián frontend, TPV David TypeScript. Algunos muestran warnings de carga nativa Vite; los builds terminaron correctamente.
- Esto **no completa** la auditoría ni hace oficiales las conexiones fiscales/municipales/bancarias.

## Correcciones locales posteriores (28/10/2026)

- La emisión en ARCA/TPV ya requiere que punto de venta + tipo de comprobante estén registrados; no los crea al facturar. Las respuestas de comprobantes devuelven `estado: simulado`, `ambiente: sandbox` y `validez_fiscal: false`.
- El alta municipal del backend común registra una solicitud como `pendiente`, no como habilitación vigente, y ya no inventa tributos/tasas al ingresar el CUIT. La migración `20261028000012_municipio_habilitacion_pendiente.sql` preserva estados previos y admite el estado pendiente.
- La consola de Municipio y su servicio demo ya reflejan ese comportamiento; certificados de libre deuda no se emiten para una solicitud aún no aprobada.
- El backend y el simulador de alta municipal validan el dígito de control del CUIT para nuevos registros. Las consultas y operaciones sobre fixtures existentes mantienen compatibilidad mientras se planifica normalizar IDs demo, pues los datos sembrados actuales incluyen varios CUIT sintéticos que no pasan el checksum.
- La variante SQLite en `municipio-cristian/server.js` también registra altas pendientes y limita pagos a obligaciones pendientes existentes; no realiza movimientos bancarios. La base local no se abrió ni modificó.
- Verificación local de backend tras estos cambios: `npm test` **14/14**; Municipio lint/build aprobados y sintaxis SQLite `node --check` correcta. No se aplicó la migración contra Supabase, no hubo push ni despliegue.
- Las afirmaciones históricas de publicación en este informe corresponden a la versión anterior. Estos cambios son solo locales y requieren aplicar la migración en el destino correcto y volver a desplegar antes de que aparezcan en Vercel.

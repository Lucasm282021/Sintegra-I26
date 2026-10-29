# PROMPT MAESTRO — ECOSISTEMA FINTECH I26
## Unificación del alta de comercios, integración de módulos y refactorización funcional

### 1. Rol y objetivo

Actuá como arquitecto de software senior, analista funcional, especialista en integración de sistemas y desarrollador full-stack.

Estamos desarrollando un ecosistema integrado compuesto por:

- ARCA: identificación y situación fiscal nacional.
- ARBA: situación tributaria provincial e Ingresos Brutos.
- Municipio: habilitaciones comerciales y tasas municipales.
- Banco: cuentas bancarias, medios de cobro y liquidaciones.
- TPV/POS: puntos de venta, cajas, productos, ventas y comprobantes.
- Otros módulos que se encuentren efectivamente implementados.

Tu misión es **auditar los proyectos existentes, establecer un flujo único y coherente para el alta de comercios, adaptar las aplicaciones y eliminar duplicaciones funcionales**, respetando el trabajo ya realizado.

No quiero construir otro sistema desde cero si podemos aprovechar el existente.

### 2. Primera fase: auditoría obligatoria

Antes de modificar código:

1. Inspeccioná todos los repositorios y carpetas disponibles.
2. Identificá el stack tecnológico real de cada aplicación.
3. Revisá entidades, bases de datos, migraciones, endpoints, formularios, autenticación y documentación.
4. Determiná dónde se crean actualmente los comercios.
5. Identificá qué datos se repiten y qué módulos dependen de ellos.
6. Detectá pantallas, entidades, servicios y endpoints redundantes.
7. Identificá funcionalidades útiles que deban conservarse.
8. Revisá qué integraciones son reales, simuladas o inexistentes.
9. Identificá los tests y contratos existentes.

Generá `docs/AUDITORIA-ECOSISTEMA.md` con una matriz que incluya:

- Aplicación y responsabilidad.
- Funcionalidades existentes.
- Funcionalidades duplicadas.
- Datos que administra.
- Dependencias.
- Problemas encontrados.
- Cambios propuestos.
- Riesgos de migración.

No inventes implementaciones que no estén en los repositorios.

### 3. Principio arquitectónico: alta única

El comercio debe tener una identidad única dentro del ecosistema.

Definí un CORE COMERCIOS responsable de registrar y administrar la identidad comercial.

El CORE no reemplaza a ARCA, ARBA, Municipio ni Banco. Solamente administra el registro interno y la información necesaria para coordinar las aplicaciones.

Cada comercio tendrá un identificador interno único `commerceId` (UUID).

El CUIT es su identificador tributario, pero no debe utilizarse como clave primaria de todas las tablas.

Modelo conceptual:

**Commerce**
- id
- cuit
- razonSocial
- nombreFantasia
- tipoPersona
- emailContacto
- telefonoContacto
- domicilioFiscal
- estadoRegistro
- fechaAlta
- fechaActualizacion

**CommerceBranch**
- id
- commerceId
- nombre
- domicilioComercial
- localidad
- provincia
- codigoPostal
- estado

**CommerceMembership**
- id
- commerceId
- userId
- rol
- estado

**CommerceIntegration**
- id
- commerceId
- sistema
- externalReference
- estado
- ultimaSincronizacion

**CommerceVerification**
- id
- commerceId
- origen
- resultado
- fechaConsulta
- vigencia
- referenciaEvidencia

Adaptá estos modelos al esquema real del proyecto. No dupliques tablas que ya cumplan esta función.

El CUIT debe validarse como 11 dígitos y mediante su dígito verificador. La unicidad debe contemplar la arquitectura multi-tenant y el alcance de identidad definido.

Un mismo comercio podrá tener varias sucursales, usuarios, cajas y terminales.

### 4. Flujo obligatorio de alta

**PASO 1 — Registro inicial**

El usuario ingresa al sistema y solicita registrar un comercio.

Datos iniciales:
- CUIT.
- Razón social o nombre comercial.
- Email de contacto.
- Datos del responsable.
- Aceptación de condiciones y tratamiento de datos cuando corresponda.

Validar que el comercio no exista previamente.

Si existe, ofrecer vinculación o solicitud de acceso mediante verificación de representación. Nunca otorgar acceso solamente por conocer el CUIT.

**PASO 2 — Validación ARCA**

Consultar la información fiscal mediante integración oficial autorizada cuando esté disponible.

Obtener únicamente los datos permitidos y necesarios:
- Identificación del contribuyente.
- Razón social.
- Estado administrativo de CUIT.
- Condición tributaria.
- Actividades económicas disponibles.
- Domicilio fiscal, cuando corresponda.

Registrar origen, fecha y resultado de la consulta.

Si no hay integración autorizada, utilizar un adaptador MOCK explícito o un proceso de verificación manual.

No presentar datos simulados como información oficial.

No permitir que la aplicación modifique directamente los registros de ARCA.

**PASO 3 — Validación ARBA**

A partir del CUIT y la jurisdicción correspondiente:

- Consultar inscripción provincial cuando exista integración autorizada.
- Identificar régimen de Ingresos Brutos.
- Registrar número de inscripción, si corresponde.
- Obtener actividad y estado cuando estén disponibles.
- Contemplar Convenio Multilateral.
- Registrar fecha y origen de verificación.

La ausencia de inscripción provincial no debe interpretarse automáticamente como incumplimiento.

**PASO 4 — Municipio**

Identificar el municipio correspondiente al establecimiento.

Registrar:
- Comercio vinculado.
- Sucursal o establecimiento.
- Domicilio comercial.
- Actividad declarada.
- Expediente o trámite de habilitación.
- Número de habilitación, si existe.
- Estado del trámite.
- Tasas municipales asociadas cuando corresponda.

No confundir domicilio fiscal con establecimiento habilitado.

La habilitación corresponde a las condiciones y normativa municipal aplicable, no a una aprobación automática del CORE.

**PASO 5 — Banco y medios de cobro**

Permitir que el comercio vincule una cuenta bancaria o proveedor de pagos.

Datos mínimos:
- commerceId.
- Identificador de cuenta o referencia del proveedor.
- CBU/CVU o alias, según necesidad y autorización.
- Titularidad verificada cuando exista mecanismo disponible.
- Estado de vinculación.
- Medio de cobro habilitado.

No almacenar claves de home banking, PIN, CVV ni credenciales bancarias del usuario.

La vinculación debe respetar la autenticación y autorización del proveedor. La validación bancaria o KYC no puede reemplazarse por una simple comparación de CUIT.

**PASO 6 — Activación TPV**

Cuando se cumplan los requisitos de activación definidos para el caso de uso:

- Crear o vincular sucursal.
- Configurar caja.
- Registrar terminal.
- Asociar usuarios y permisos.
- Configurar medios de pago.
- Configurar impuestos y parámetros fiscales pertinentes.
- Configurar emisión de comprobantes si existe integración habilitada.

El TPV consume la identidad del comercio, pero administra sus propios productos, inventario, operaciones y ventas.

La activación comercial, la habilitación municipal, la verificación bancaria y la autorización de facturación deben ser estados independientes.

**PASO 7 — Finalización**

Mostrar un panel único de estado del comercio con:

- Identidad registrada.
- ARCA: verificado, pendiente, observado o no disponible.
- ARBA: verificado, pendiente, observado o no aplicable.
- Municipio: habilitado, en trámite, observado o no aplicable.
- Banco: vinculado, pendiente o rechazado.
- TPV: configurado, pendiente o activo.

Nunca marcar una verificación como aprobada sin evidencia.

### 5. Propiedad y circulación de datos

Implementá contratos explícitos de intercambio.

| Dominio | Datos que administra | Datos que puede compartir |
|---|---|---|
| CORE | Identidad interna, usuarios, sucursales | commerceId, identificación y referencias autorizadas |
| ARCA | Estado fiscal consultado | Resultado fiscal, origen y fecha |
| ARBA | Situación tributaria provincial | Estado, régimen y datos permitidos |
| Municipio | Habilitaciones y tasas | Estado del establecimiento y referencias |
| Banco | Cuentas y operaciones financieras | Estado de vinculación y referencias necesarias |
| TPV | Ventas, cajas, productos, comprobantes | Eventos comerciales y datos mínimos autorizados |

Aplicar minimización de datos, permisos por finalidad, trazabilidad y protección de datos personales.

No distribuir automáticamente datos bancarios completos, información fiscal restringida ni ventas individuales entre todos los módulos.

### 6. Comunicación entre aplicaciones

Priorizar una arquitectura de monolito modular o servicios existentes bien delimitados. No introducir microservicios innecesarios.

Usar:
- APIs REST con contratos versionados.
- DTOs validados.
- Identificadores UUID.
- Autenticación y autorización.
- Control de acceso por comercio y tenant.
- Eventos de dominio cuando aporten valor.
- Idempotencia en operaciones de alta y sincronización.
- Reintentos controlados y manejo de errores.
- Logs de auditoría sin secretos.

Eventos sugeridos:

- `commerce.created`
- `commerce.updated`
- `commerce.fiscal_verified`
- `commerce.provincial_verified`
- `commerce.municipal_status_changed`
- `commerce.bank_linked`
- `commerce.pos_activated`

No todos los eventos deben contener todos los datos del comercio.

Utilizar identificadores, versiones y referencias para evitar replicación innecesaria.

Si el proyecto ya posee una infraestructura de comunicación, reutilizarla.

### 7. Refactorización de cada aplicación

**CORE**

Debe ser el responsable de crear y mantener la identidad del comercio.

Centralizar la lógica de alta, deduplicación y vinculación de usuarios.

**ARCA**

Eliminar formularios de alta de comercios que creen identidades paralelas.

Conservar consultas, verificaciones, información fiscal y funcionalidades propias del dominio.

**ARBA**

Reutilizar commerceId y datos básicos autorizados.

Eliminar registros comerciales redundantes, conservando la información tributaria provincial.

**Municipio**

Reutilizar la identidad comercial.

Conservar habilitaciones, expedientes, tasas, inspecciones y datos específicos de establecimientos.

**Banco**

Reutilizar commerceId.

Conservar cuentas, vinculaciones, pagos, liquidaciones y procesos de validación propios.

**TPV**

Reutilizar comercio y sucursales.

Conservar cajas, productos, stock, ventas, medios de pago, comprobantes y operaciones de caja.

No eliminar funcionalidades de negocio legítimas por parecerse superficialmente a otras.

### 8. Interfaz y experiencia de usuario

Unificar el proceso de alta en un asistente sencillo.

El usuario no debe cargar cinco veces su razón social, CUIT o domicilio.

Implementar:

- Formulario inicial único.
- Recuperación de datos verificados cuando corresponda.
- Confirmación de datos.
- Estados de cada integración.
- Indicadores de errores.
- Continuación de trámites pendientes.
- Panel de comercio.
- Administración de sucursales y usuarios.

Los formularios propios de cada aplicación deben mostrar solamente la información adicional que necesitan.

Evitar pantallas vacías, duplicadas y pasos que no aporten valor.

### 9. Seguridad y reglas críticas

Aplicar:

- Aislamiento multi-tenant.
- Autorización por rol y comercio.
- Validación de representación.
- Protección de datos personales.
- Cifrado de información sensible cuando corresponda.
- Secretos fuera del código fuente.
- Auditoría de modificaciones.
- Control de sesiones.
- Protección contra acceso cruzado entre comercios.
- Idempotencia.
- Transacciones.
- Versionado de contratos.

Nunca compartir contraseñas entre aplicaciones ni utilizar credenciales fiscales o bancarias para autenticar usuarios internos.

No crear integraciones oficiales falsas.

No realizar trámites reales, pagos, presentaciones fiscales ni modificaciones externas sin autorización explícita.

### 10. Estrategia de implementación

Trabajá por fases:

**Fase A — Diagnóstico**

Auditar repositorios, contratos, datos y funcionalidades.

**Fase B — Diseño**

Definir modelo canónico, propietarios de datos, flujos, estados, contratos y plan de migración.

**Fase C — CORE**

Implementar o adaptar el registro único de comercios y sus controles de acceso.

**Fase D — Integraciones**

Adaptar ARCA, ARBA, Municipio, Banco y TPV al nuevo contrato.

**Fase E — Simplificación**

Eliminar duplicaciones comprobadas.

Antes de eliminar tablas, rutas, formularios o servicios, verificar referencias, dependencias y datos existentes. Preferir deprecación y migración segura antes que eliminación destructiva.

**Fase F — Validación**

Ejecutar pruebas unitarias, integración y end-to-end.

Casos mínimos:
1. Alta de comercio nuevo.
2. CUIT inválido.
3. Comercio existente.
4. Solicitud de acceso por un nuevo usuario.
5. Fallo de consulta ARCA.
6. ARBA no aplicable.
7. Habilitación municipal pendiente.
8. Cuenta bancaria no verificada.
9. Activación parcial del TPV.
10. Reintento de alta sin duplicación.
11. Usuario intentando acceder a otro comercio.
12. Caída de un módulo sin pérdida del registro central.
13. Actualización de datos sin sobrescribir información de otra autoridad.
14. Comercio con varias sucursales y cajas.

### 11. Documentación y entregables

Crear o actualizar:

- `docs/AUDITORIA-ECOSISTEMA.md`
- `docs/ARQUITECTURA-COMERCIOS.md`
- `docs/FLUJO-ALTA-COMERCIO.md`
- `docs/CONTRATOS-INTEGRACION.md`
- `docs/MATRIZ-PROPIEDAD-DATOS.md`
- `docs/PLAN-MIGRACION.md`
- `docs/PRUEBAS-INTEGRACION.md`
- `docs/CHANGELOG-ECOSISTEMA.md`

Documentar qué se conserva, modifica, reemplaza, depreca y elimina.

### 12. Reglas de ejecución

- No reescribir todo el ecosistema.
- No modificar sistemas fuera de los repositorios autorizados.
- No inventar APIs ni accesos a organismos.
- No borrar datos productivos.
- No ejecutar migraciones destructivas sin aprobación.
- No introducir dependencias innecesarias.
- No cambiar contratos públicos sin plan de compatibilidad.
- No realizar push ni despliegues productivos sin autorización.
- Crear pruebas antes de reemplazar lógica crítica.
- Preservar la funcionalidad que ya está operativa.
- Registrar decisiones arquitectónicas.
- Realizar commits pequeños y descriptivos cuando el repositorio y los permisos lo permitan.

Podés implementar cambios locales reversibles después de completar la auditoría y el diseño, siempre que los tests permitan validar el resultado.

Ante cambios destructivos, incompatibilidades importantes o decisiones fiscales y bancarias no verificadas, detener esa parte y solicitar aprobación.

### 13. Criterios de aceptación

El trabajo estará completo cuando:

1. Exista un único proceso lógico de alta de comercios.
2. Cada comercio tenga una identidad interna estable.
3. No se generen duplicaciones entre aplicaciones.
4. Cada dominio conserve sus responsabilidades.
5. Las aplicaciones intercambien solamente datos autorizados.
6. Los usuarios no deban repetir información ya disponible y válida.
7. Los módulos funcionen aunque alguna integración externa no esté disponible.
8. Se conserven las funcionalidades existentes necesarias.
9. Los tests críticos pasen.
10. El flujo completo esté documentado y sea verificable.

### 14. Instrucción final

Comenzá inspeccionando el código real.

Primero mostrá un diagnóstico concreto del ecosistema y un mapa de dependencias. Después definí el plan de cambios y ejecutá las mejoras seguras por fases.

No quiero una respuesta exclusivamente teórica ni una aplicación nueva que ignore los proyectos existentes.

Quiero que el ecosistema actual evolucione hacia una arquitectura integrada, coherente, mantenible y comprobable.

**Objetivo final: un comercio, una identidad interna, múltiples servicios especializados y ninguna duplicación innecesaria.**
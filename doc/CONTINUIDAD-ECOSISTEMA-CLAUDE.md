# Traspaso de continuidad — Ecosistema Sintegra I26

**Fecha de corte:** 2026-10-28  
**Propósito:** permitir que Claude u otro agente continúe la consolidación sin depender del historial de este chat.  
**Repositorio:** `i26sintegra`  
**Estado:** cambios locales en curso; no están validados completamente, no están publicados ni desplegados.

> Este documento resume el pedido del usuario y el estado observado del repositorio. El texto maestro completo adjunto por el usuario quedó copiado a [`PROMPT-MAESTRO-ECOSISTEMA.md`](PROMPT-MAESTRO-ECOSISTEMA.md); se lo debe tratar como requisitos del proyecto. Los archivos e imágenes de referencia no son instrucciones operativas adicionales.

## 1. Objetivo del usuario

Unificar el flujo de alta y operación de comercios entre las aplicaciones ARCA, ARBA, Municipio, Banco, Billetera y TPV. Mantener lo que ya sirve, corregir contratos y duplicaciones demostrables, completar el flujo de venta, documentar las decisiones y probarlo con datos sintéticos.

El usuario describe el orden conceptual como: alta/identificación fiscal nacional, situación de Ingresos Brutos, habilitación municipal cuando aplique, cuenta bancaria, terminal/punto de venta autorizado y venta con factura. El orden real debe permitir estados independientes y trámites pendientes; un fallo o una espera de un organismo no debe borrar la identidad interna ni fingir aprobaciones.

La meta es una sola identidad de comercio a nivel ecosistema, varios dominios responsables, y trazabilidad desde el TPV hasta el pago y comprobante. No se pidió ni se autorizó en este turno publicar, desplegar o hacer push.

## 2. Requisitos del prompt maestro aportado por el usuario

El prompt completo es la fuente primaria de requisitos y está incluido en el repositorio. Sus reglas esenciales:

- Auditar primero todos los proyectos disponibles: stack, formularios, entidades, base, rutas, autenticación, documentos, dependencias, duplicaciones y pruebas.
- Diseñar un CORE de identidad comercial reutilizando esquemas existentes. Modelo conceptual: identidad `commerceId` UUID; CUIT como identificador fiscal único según el alcance acordado, no asumir que debe ser PK global; sucursales, membresías/usuarios, referencias de integración y verificaciones con evidencia.
- Validar CUIT con 11 dígitos **y dígito verificador**. No otorgar acceso por conocer un CUIT; validar representación.
- Mantener propietarios por dominio: ARCA fiscal/facturación; ARBA IIBB; Municipio habilitación/tasas por establecimiento; Banco cuentas y movimientos; TPV catálogo, caja, stock y ventas.
- REST versionado, DTOs validados, autenticación/autorización, multi-tenant, minimización de datos, idempotencia, auditoría y errores/reintentos. Usar eventos/outbox cuando ayuden; evitar microservicios innecesarios.
- No inventar integración oficial, APIs, datos reales ni aprobaciones. Si falta acceso, usar mock explícito o verificación manual, con origen/fecha/estado.
- No borrar datos productivos ni migraciones destructivas; preferir migración compatible/deprecación.
- Pruebas mínimas indicadas: alta, CUIT inválido, existente, solicitud de acceso, fallos ARCA, ARBA no aplicable, Municipio pendiente, cuenta no verificada, activación parcial, idempotencia, aislamiento de usuarios/tenants, caída de módulo, actualización sin sobrescritura y múltiples sucursales/cajas.
- No hacer push ni despliegues productivos sin autorización explícita. No ejecutar trámites/pagos externos sin aprobación.

El prompt pide crear documentación bajo `docs/`; este repositorio usa `doc/`. Continuar usando `doc/` salvo que se acuerde una migración de carpetas; evitar duplicar documentación en ambos lugares.

## 3. Flujo objetivo de alta y venta

### Alta / activación

1. **Usuario y acceso:** crear/invitar al usuario, verificar correo/identidad y representación. El usuario solicita alta o acceso a un comercio; un CUIT por sí solo no concede acceso.
2. **Identidad CORE:** buscar por CUIT válido. Crear un `commerceId` estable si no existe; si ya existe, iniciar una solicitud de vinculación con revisión de permisos, no crear un comercio paralelo. Registrar persona física/jurídica, razón social, nombre de fantasía, contactos, condición fiscal consultada y sucursales.
3. **ARCA:** consultar/validar contribuyente, condición, actividades y domicilio permitidos mediante integración oficial autorizada, o marcar revisión manual/mock explícito. El CORE no modifica ARCA.
4. **ARBA:** registrar/verificar situación provincial y régimen que corresponda (directo, simplificado/unificado o Convenio Multilateral, según el caso); conservar estado *no aplicable / pendiente / verificado / observado / sin servicio*. No inferir incumplimiento de una ausencia de registro ni fijar una alícuota genérica.
5. **Municipio:** por cada establecimiento/sucursal, registrar municipio/jurisdicción, domicilio comercial, actividad, expediente/número, habilitación, vigencia y tasas cuando aplique. No confundir domicilio fiscal con local habilitado. Si no hay API, revisar constancia manualmente y registrar evidencia; no inventar una autorización automática.
6. **Banco:** apertura/provisión de cuenta por Banco, vínculo con titular, CBU/alias y estado de validación. TPV no asigna CBU ni escribe libremente una cuenta ajena. La Billetera la provisiona Banco y refleja el saldo de la cuenta vinculada; no mantiene dinero independiente.
7. **ARCA facturación:** configurar una modalidad y punto de venta autorizado por contribuyente/modalidad; asociar el servicio/certificado/autorización de forma segura. No emitir en producción sin credenciales y autorización real.
8. **TPV:** asignar comercio/sucursal, caja/terminal, usuarios/roles, catálogo, stock, medios de cobro y punto de venta ARCA. Activar solo cuando se satisfagan requisitos aplicables; la habilitación municipal, fiscal, bancaria y de facturación deben mostrarse como estados separados.
9. **Panel de estado:** identidad, ARCA, ARBA, Municipio por local, Banco, Billetera y TPV; origen, evidencia/fecha, error, vencimiento y acción pendiente. La integración caída no altera otros estados.

### Venta / checkout

1. El TPV resuelve comercio, sucursal, terminal y caja autorizados; no confía en CUIT/razón social/precio enviados por el navegador.
2. Carga productos y cantidades; backend resuelve precio/stock y cliente/receptor de comprobante cuando corresponda.
3. Determina IVA/clase de comprobante y otros conceptos a partir de la condición fiscal/reglas vigentes. Ingresos Brutos/retenciones/percepciones no son un impuesto universal a sumar sin verificar régimen, padrón, jurisdicción, rol de agente y reglas aplicables.
4. Autoriza un solo cobro: Banco, Billetera, efectivo, tarjeta o transferencia según integración. Billetera y cuenta Banco son un mismo saldo; no duplicar débito/crédito. La liquidación acredita la cuenta Banco asignada al comercio.
5. Si la operación está sujeta a percepción/retención, consulta el régimen/fuente aplicable, guarda base, alícuota, vigencia, importe y referencia. No cobrar/retener por defecto una alícuota de demo.
6. Solicita CAE a ARCA con el punto de venta y tipo de comprobante correctos; guarda solicitud, respuesta, CAE/vencimiento, número, errores y estado. Solo tras autorización confirma comprobante fiscal. No generar CAE aleatorio.
7. Confirma venta y emite evento/webhook firmado al terminal específico (idempotente); registra auditoría y permite conciliación/contingencias. No marcar pago/factura como confirmado si el tercero no lo confirmó.
8. Si una etapa externa falla después de cobrar, dejar estado recuperable y conciliable; aplicar idempotencia, outbox/reintentos y reversa/nota de crédito según reglas aprobadas, nunca duplicar cobro ni fingir éxito.

## 4. Límites fiscales y fuentes oficiales consultadas

Fuentes consultadas durante la conversación el 2026-10-28; verificar de nuevo antes de producción porque la normativa y los servicios cambian:

- ARCA explica emisión con autorización vía WSFE o “Comprobantes en línea”, punto de venta específico y numeración correlativa: [solicitud de autorización](https://arca.gob.ar/fe/emision-autorizacion/solicitud-autorizacion.asp).
- ARCA publica WSFEv1 y documentación oficial: [web services de factura electrónica](https://arca.gob.ar/ws/documentacion/ws-factura-electronica.asp).
- Para un web service real hacen falta certificado, asociación/delegación del servicio, WSAA (ticket de acceso), implementación del servicio y alta del punto de venta conforme a la documentación: [acciones para consumir web service](https://www.arca.gob.ar/fe/documentos/AccionesarealizarparaconsumirunWebservicedeFacturaElectr.pdf).
- ARBA distingue contribuyente directo de IIBB y requiere identificar actividad y domicilios; puede aplicar simplificado/unificado según elegibilidad: [inscripción](https://www.arba.gov.ar/GuiaTramites/TramiteSeleccionado.asp?tramite=232), [Ingresos Brutos](https://web.arba.gov.ar/ingresos-brutos), [recaudación por sujeto](https://web.arba.gov.ar/regimen-de-recaudacion-por-sujeto).
- ARBA publica alícuotas/padrones para agentes de recaudación y puede excluir, incluir o aplicar valores según situación. El TPV/software no es automáticamente agente: [padrón de tarjetas](https://web.arba.gov.ar/regimen-recaudacion-padron-tarjetas) y [agentes frente a monotributistas](https://web.arba.gov.ar/preguntas-frecuentes/si-soy-agente-de-retencion-o-percepcion-de-ingresos-brutos-como-debo-actuar).
- La habilitación comercial corresponde al municipio/jurisdicción y sus requisitos; no se descubrió una API nacional común. En Buenos Aires, la norma citada menciona trámite ante el municipio correspondiente: [Ley provincial 12.573, texto actualizado](https://www.argentina.gob.ar/normativa/provincial/ley-12573-123456789-0abc-defg-375-2100bvorpyel/actualizacion). Confirmar reglas municipales concretas con el municipio donde esté cada sucursal.

Estos documentos explican mecanismos oficiales, pero **no acreditan que este repositorio tenga credenciales, contrato/API, permisos, convenios ni autorización para usarlos**. La aplicación actual es una integración académica/demo; no utilizar para emitir comprobantes fiscales ni mover dinero real.

## 5. Mapa técnico observado

### Núcleo compartido

- `backend/`: API Node.js/Express + PostgreSQL/Supabase, modular en `backend/src/modulos/`, migraciones en `backend/supabase/migrations/`, pruebas en `backend/test/`.
- `backend/src/app.js` monta `/padron`, `/arca`, `/arba`, `/municipio`, `/banco`, `/billetera`, `/tpv`, webhooks y otros módulos.
- API de producción observada en la conversación: `https://sintegra-backend.vercel.app`; portal `https://sintegrai26.vercel.app`. Debe comprobarse antes de cualquier release.
- Esquemas existentes contienen `padron.contribuyentes`, `municipio.habilitaciones/tasas`, `arba.inscripciones/percepciones`, `banco.cuentas/movimientos`, `billetera.cuentas/movimientos`, `arca.puntos_venta/comprobantes`, `tpv.terminales/comercios/productos/ventas` y webhooks.
- El código usa CUIT como FK/clave en varios dominios; el `commerceId` UUID multi-tenant que propone el prompt todavía no aparece como identidad canónica transversal. Evaluar migración aditiva antes de cambios destructivos.

### Apps y discrepancias conocidas

- **Billetera:** `Billetera_virtual-Lucas_M/public/` es frontend HTML/JS; la API desplegada se enruta al backend común. Cambios locales eliminan alta/autoregistro por usuario, muestran alias/titular/CUIT/CBU y plantean saldo compartido. Revisar `app.js`/markup y decidir si retiro/transferencias son operaciones permitidas; el usuario había dicho que Banco crea la billetera. No inventar CVU si no está implementado. En `Billetera_virtual-Lucas_M/src/server.js` persiste backend SQLite separado, aún no alineado con la API común; revisar endpoints de creación y documentarlo/deprecarlo sin borrar datos.
- **Banco:** `public/banco/app.js` y `backend/src/modulos/banco.js`. Cambios locales hacen que Banco provisione billetera para un cliente y presente saldo/CBU compartidos. El endpoint nuevo esperado es `POST /banco/clientes/:cuit/billetera`. Revisar auth, permisos e idempotencia antes de decir que es bancariamente real.
- **TPV Sebastián:** frontend React/Vite `sebasTPV/tpv-frontend/src/App.jsx`; cambios locales agregan selección de comercio, catálogo por CUIT y ficha de cuenta Banco de destino (CBU/alias), y bloqueo del checkout sin cuenta. El backend debería usar `terminal_id=sebastian`.
- **TPV David:** `tpv-david/` tiene UI HTML en `public/index.html`, API Express/TypeScript propia y persistencia JSON; no está consolidado en el backend común. El checkout central `/tpv/ventas` ya acepta `terminal_id`, CUIT, producto y pago; revisar incompatibilidad de payload: la UI manda `medioPago` camelCase y el backend común lee `medio_pago`/default Banco; los nombres de respuesta también difieren. La interfaz debe incluir CUIT pagador si el medio es Billetera. El cliente municipal actual apunta a `/municipio/habilitaciones/consultar`, ruta que no coincide con el backend común.
- **TPV Brisa:** frontend separado; API común lista por defecto `terminal_id=brisa`; asignación de cuenta en `tpv.comercios`.
- **ARBA Lucas/Tomi:** `arba-lucas/` React/Vite, root de Vite `frontend`; cambios locales usan `VITE_API_BASE_URL=https://sintegra-backend.vercel.app` para `/arba/*` y dejan `/auth/*` en mismo origen. API común no estaba respondiendo a prod durante verificación previa (404 para pruebas CUIT); backend local agregó endpoints `/arba/padron` (GET/POST/PUT/DELETE lógico), `/arba/stats` y listado de percepciones. Captura recibida tenía `202368326074` (12 dígitos); CUIT requiere 11 dígitos, por eso no iba a devolver coincidencia.
- **Municipio Cristian:** frontend y API común ya tienen comercios, habilitaciones, tasas, pagos y libre deuda. `GET /municipio/comercios/:cuit` expone estado, pero el backend común TPV todavía no lo exige al asociar/cobrar.
- **ARCA:** `backend/src/modulos/arca.js` guarda puntos de venta y comprobantes simulados. En TPV central se crea número/CAE aleatorio; el módulo no llama WSAA/WSFE real. Hay que mostrar claramente “simulación”.

## 6. Cambios locales sin cerrar

Los siguientes archivos aparecen modificados localmente en el último `git status`; cambios no necesariamente completos ni correctos:

```text
Billetera_virtual-Lucas_M/public/app.js
Billetera_virtual-Lucas_M/public/index.html
Billetera_virtual-Lucas_M/public/styles.css
arba-lucas/frontend/src/apiUrl.js
backend/src/modulos/arba.js
backend/src/modulos/banco.js
backend/src/modulos/billetera.js
backend/src/modulos/tpv.js
public/banco/app.js
sebasTPV/tpv-frontend/src/App.jsx
sebasTPV/tpv-frontend/src/index.css
```

También apareció `arba-lucas/frontend/.env.production` como untracked intencional de este trabajo. Revisar su contenido antes de staging. Hay elementos no relacionados que no deben agregarse ni borrarse: `Mauricio admin/`, `sebasTPV/bar.fig`, `sebasTPV/sebastian/`, `sebasTPV/tpv-backend/dist/`, `sebasTPV/tpv-backend/tsconfig.tsbuildinfo`, `sebasTPV/tpv-frontend/dist/`.

### Cambios intentados

- Banco provisiona billetera a un cliente bancario existente y devuelve alias/CBU/saldo.
- Billetera presenta saldo derivado de la cuenta Banco y pago mueve fondos en el ledger Banco, luego registra movimientos de billetera como vista/auditoría.
- API común ofrece operaciones del padrón ARBA y lista de percepciones.
- API común asocia el TPV a una cuenta Banco del mismo CUIT; transferencias/ventas depositan en esa cuenta.
- UI TPV Sebastián selecciona comercio/cuenta enlazada.
- ARBA frontend apunta a API común para `/arba/*`.

**Precaución:** revisar diff completo. No asumir que estos cambios ya funcionan. En particular verificar transacciones/locks/idempotencia entre `pagarBilletera` y `transferir`, migraciones, estado real en producción y seguridad de rutas.

## 7. Pendientes críticos para la continuación

1. Leer `git diff` de cada archivo modificado y corregir errores antes de extender más.
2. Terminar una auditoría basada en código, no supuestos; crear/actualizar los entregables en `doc/`: auditoría, arquitectura, flujo de alta, contratos, propiedad de datos, plan de migración, pruebas y changelog (o un índice con enlaces si ya hay equivalentes).
3. Definir y documentar modelo canónico de comercio/sucursal/membresías/estados usando el esquema actual; implementar `commerceId` sólo con migración y compatibilidad, sin sustituir CUIT en frío.
4. Añadir estado de verificación por integración con fuente, fecha, evidencia, vigencia y error. Separar `not_applicable` de `unverified`.
5. Alinear TPV David, Sebastián y Brisa con contratos versionados del backend común; eliminar rutas/repo JSON solo después de comprobar usos y migración.
6. Definir el control de habilitación municipal por local. Evitar un bloqueo global equivocado; validar jurisdicción, estado y aplicabilidad. Corregir el endpoint inconsistente de TPV David.
7. Implementar ARCA real sólo tras obtener propietario, autorización del contribuyente, certificados/secretos por entorno y pruebas de homologación. No aceptar CAE aleatorio ni crear punto de venta en checkout. El alta del punto debe ser proceso explícito y autorizado.
8. Cambiar ARBA a padrón/tasa verificados y reglas de agente. Actualmente la percepción demo no debe confundirse con obligación/impuesto aplicable a toda venta.
9. Completar pagos de Banco/Billetera con identificación de pagador, idempotencia, webhook firmado a la terminal correcta, conciliación, manejo de fallos y sin saldo duplicado. Banco es autoridad del saldo/CBU y alta de billetera.
10. Revisar los flujos de alta de usuario/acceso, permisos multi-tenant, SQL, sesiones y exposición de datos; el demo login no equivale a autenticación segura.
11. Ejecutar verificaciones solicitadas históricamente: tests unitarios/integración/E2E con **cinco registros sintéticos aislados**, no tocar datos productivos; builds de ARBA, TPV Sebastián y TPV David; reportar resultados reales.
12. Revisar estado remoto y diferencias antes de push. No incluir archivos no relacionados ni publicar/desplegar sin autorización actual explícita.

## 8. Pruebas y comandos conocidos

Desde raíz del repo:

```powershell
cd backend
npm.cmd test
```

Construcciones a ejecutar una vez saneados cambios:

```powershell
cd arba-lucas
npm.cmd run build

cd sebasTPV/tpv-frontend
npm.cmd run build

cd tpv-david
npm.cmd run build
```

Verificar también sintaxis con `node --check` para los JS de API/UI que corresponda y revisar las respuestas del API local. Los tests con PGlite de `backend/test/integracion-sinteticos.test.js` crean exactamente cinco CUIT de prueba aislados; sus fixtures actuales necesitarán cambios si se incorpora requisito municipal. No ejecutar una suite contra Supabase/productivo para probar cobros.

Las pruebas no se ejecutaron como parte de la creación de este documento.

## 9. Estado de Git / entrega

- Hay cambios locales modificados y archivos no relacionados sin seguimiento.
- No se creó commit, push ni despliegue por este pedido.
- Antes de tocar rama: `git status --short`, `git diff --stat`, `git diff --check`, diff por archivo, rama y remotos.
- Staging selectivo explícito; no usar `git add .`.
- Mantener los archivos del usuario `Mauricio admin/`, `bar.fig`, `sebasTPV/sebastian/` y artefactos `dist`/tsbuildinfo fuera de la entrega salvo indicación del dueño.

## 10. Instrucción de continuidad para Claude

Retomá desde el repositorio local y desde este documento. Leé primero `doc/PROMPT-MAESTRO-ECOSISTEMA.md` y luego `git status`, `git diff`, `doc/` y los módulos listados. No vuelvas a empezar desde cero ni presupongas que cambios locales están listos. Primero completá la auditoría y actualizá documentación coherente; después implementá mejoras pequeñas y compatibles por fases. Prioridad: contratos correctos, una identidad de comercio/sucursal, registro de estado real/mock, pagos idempotentes, habilitación municipal aplicable y CAE genuinamente autorizado cuando exista integración. Ejecutá los tests sintéticos y builds; informá con precisión qué pasó y qué sigue siendo simulación. Preservá datos y archivos ajenos, y no hagas push ni despliegue sin autorización explícita.

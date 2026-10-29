# Arquitectura del CORE de comercios

**Fecha:** 2026-10-29 · **Estado:** diseño aprobado para implementar (Fase B del [prompt maestro](PROMPT-MAESTRO-ECOSISTEMA.md)).
Relacionados: [flujo de alta](FLUJO-ALTA-COMERCIO.md) · [propiedad de datos](MATRIZ-PROPIEDAD-DATOS.md) · [contratos](CONTRATOS-INTEGRACION.md) · [plan de migración](PLAN-MIGRACION.md) · [pruebas](PRUEBAS-INTEGRACION.md).

## Objetivo

Un comercio, una identidad interna, varios servicios especializados. El CORE registra **quién es el comercio y quién puede operarlo**; no reemplaza a ARCA, ARBA, Municipio, Banco ni TPV. Cada uno de ellos sigue siendo dueño de sus datos y el CORE guarda **qué dijo cada uno, cuándo, con qué evidencia y de qué origen** (sandbox, manual u oficial).

## Dónde vive

Dentro del backend único (`backend/`), como módulo `core` con su propio esquema Postgres `core`. Es un monolito modular: no se agrega un servicio nuevo. Las demás apps lo consumen por HTTP.

## Modelo

El modelo conceptual del prompt (Commerce, Branch, Membership, Integration, Verification) se adaptó al esquema real:

| Concepto | Tabla | Notas de adaptación |
|---|---|---|
| Commerce | `core.comercios` | `id` UUID = **commerce_id**. `cuit` único con el dominio `padron.cuit` (11 dígitos). **Sin FK** a `padron.contribuyentes`: el alta del comercio no depende de que ARCA lo haya verificado. |
| CommerceBranch | `core.sucursales` | Una o más por comercio. La primera se crea en el alta. El municipio se registra por sucursal. |
| Usuario | `core.usuarios` | No había usuarios compartidos (cada app tiene los suyos). Correo + contraseña con bcrypt (`pgcrypto`). No se reutilizan claves de otras apps ni credenciales fiscales/bancarias. |
| CommerceMembership | `core.membresias` | Rol `titular`, `administrador` u `operador`; estado `activa`, `pendiente`, `rechazada`, `revocada`. Una solicitud de acceso es una membresía `pendiente`. |
| CommerceIntegration | `core.integraciones` | Referencia externa por sistema (cuenta bancaria, terminal TPV, punto de venta ARCA…). Solo identificadores, no copias de datos. |
| CommerceVerification | `core.verificaciones` | Historial **solo de agregado**: cada consulta crea una fila. El estado vigente de un sistema es la última fila. |
| Eventos de dominio | `core.eventos` | Bandeja de salida (*outbox*): `commerce.created`, `commerce.fiscal_verified`, etc., con datos mínimos. |

`padron.contribuyentes` se mantiene como **padrón fiscal sandbox** (lo que en la realidad informaría ARCA). No se borra ni se reemplaza: el CORE lo **consulta**.

## Decisiones (ADR)

1. **CUIT único por comercio en este ecosistema.** El alcance es académico y de un solo tenant; un CUIT = un comercio, con varias sucursales. Si más adelante hiciera falta separar unidades de negocio de un mismo CUIT, se agrega un campo de alcance sin cambiar `commerce_id`.
2. **El CUIT no es clave primaria del CORE.** La PK es `commerce_id` (UUID). Las tablas de dominio existentes siguen usando CUIT (no se migran en frío); el vínculo se hace por `core.integraciones` y, en fases siguientes, con columnas `comercio_id` agregadas sin quitar las actuales.
3. **Dígito verificador obligatorio en altas nuevas.** Se valida en la API con el algoritmo de módulo 11. Los CUIT demo heredados que no lo cumplen (10 de 13 en la base al 2026-10-29) **no se bloquean**: el CORE los importa y deja la identidad como `observado` con el motivo.
4. **Conocer un CUIT no da acceso.** El primer usuario que registra el comercio queda como titular por **declaración jurada de representación** (la verificación queda `declarada`, no `verificada`). Cualquier otro usuario solo puede **solicitar acceso**; lo aprueba un titular o administrador.
5. **Estados independientes.** Identidad, ARCA, ARBA, Municipio (por sucursal), Banco y TPV tienen estado propio. La caída de un sistema deja **su** estado en `no_disponible` y no afecta a los demás ni al registro del comercio.
6. **Nada se marca aprobado sin evidencia.** Toda verificación guarda `origen` (`sandbox`, `manual`, `oficial`), fecha, referencia de evidencia y, si corresponde, vigencia. En este repositorio no hay integraciones oficiales: los adaptadores son **sandbox** y así se muestran.
7. **La ausencia no es incumplimiento.** Sin inscripción en ARBA → `pendiente` (puede no aplicar), nunca `rechazado`. `no_aplicable` solo se registra con una verificación manual que diga por qué.
8. **Activación del TPV con requisitos explícitos.** Exige ARCA verificado y cuenta bancaria vinculada. Si la habilitación municipal está `observada` (suspendida o dada de baja) se bloquea; si está en trámite se permite con advertencia, porque depende de la normativa de cada municipio. Si faltan requisitos, el TPV queda `pendiente` con la lista de faltantes.
9. **El CORE no escribe en otros dominios por su cuenta.** Para vincular Banco o activar TPV llama a funciones del módulo dueño (Banco abre la cuenta; TPV crea la terminal-comercio). Nunca edita saldos ni datos fiscales.
10. **Sesiones sin estado.** Token firmado con HMAC (`CORE_AUTH_SECRET`), válido 8 horas. Las rutas del CORE exigen sesión y membresía activa en el comercio (aislamiento entre comercios).

## Estados por sistema

| Sistema | Valores |
|---|---|
| Identidad | `registrado`, `observado` (dato heredado inválido), `suspendido`, `baja` |
| ARCA | `verificado`, `pendiente`, `observado`, `no_disponible` |
| ARBA | `verificado`, `pendiente`, `observado`, `no_aplicable`, `no_disponible` |
| Municipio (por sucursal) | `habilitado`, `en_tramite`, `pendiente` (sin iniciar), `observado`, `no_aplicable`, `no_disponible` |
| Banco | `vinculado`, `pendiente`, `rechazado`, `no_disponible` |
| TPV | `pendiente`, `configurado`, `activo` |

## Adaptadores sandbox (qué consulta cada uno)

| Sistema | Fuente sandbox | Resultado |
|---|---|---|
| ARCA | `padron.contribuyentes` | Existe y activo → `verificado` con condición IVA; no existe → `observado` ("no figura en el padrón sandbox"). |
| ARBA | `arba.inscripciones` | Activa → `verificado` (actividad, alícuota de prueba); baja → `observado`; sin fila → `pendiente`. |
| Municipio | `municipio.habilitaciones` | `activa` → `habilitado`; `pendiente` → `en_tramite`; `suspendida`/`baja` → `observado`; sin fila → `pendiente` (trámite sin iniciar). |
| Banco | `banco.cuentas` | Hay cuenta → `vinculado` (CBU enmascarado); no → `pendiente`. |
| TPV | `tpv.comercios`, `tpv.ventas` | Sin terminal → `pendiente`; con terminal y cuenta → `configurado`; con ventas completadas → `activo`. |

Límite conocido: `municipio.habilitaciones` tiene una fila por CUIT, no por establecimiento. El CORE ya modela sucursales; pasar la habilitación a nivel sucursal es parte del [plan de migración](PLAN-MIGRACION.md).

## Seguridad aplicada en esta fase

- Contraseñas con bcrypt; nunca se devuelven ni se registran.
- Token HMAC con secreto fuera del código (variable de entorno).
- Control de acceso por comercio en todas las rutas `/core/comercios/:id/*`.
- Idempotencia del alta: repetir el alta del mismo CUIT por el mismo titular devuelve el comercio existente; otro usuario recibe `409` con la opción de solicitar acceso.
- Los eventos llevan identificadores y estados, no datos bancarios ni fiscales completos.
- **Pendiente:** el resto del backend (Banco, Billetera, TPV…) todavía no exige sesión; CORS sigue en `*`. Ver [plan de migración](PLAN-MIGRACION.md).

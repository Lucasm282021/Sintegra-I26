# Flujo de alta de un comercio

**Fecha:** 2026-10-29 · Implementa los 7 pasos del [prompt maestro](PROMPT-MAESTRO-ECOSISTEMA.md) sobre el [CORE de comercios](ARQUITECTURA-COMERCIOS.md). Todo es simulación académica: los organismos se consultan en sus versiones **sandbox** del backend único.

## Vista general

```
Usuario ──► 1. Registro inicial (CORE) ──► commerce_id
                      │
                      ├─► 2. ARCA      (consulta padrón sandbox)        ┐
                      ├─► 3. ARBA      (inscripción IIBB sandbox)       │ estados
                      ├─► 4. Municipio (habilitación por sucursal)      │ independientes,
                      ├─► 5. Banco     (apertura / vínculo de cuenta)   │ cada uno con
                      ├─► 6. TPV       (activación si se cumplen reqs.) │ evidencia
                      └─► 7. Panel de estado del comercio               ┘
```

## Paso a paso

### 1. Registro inicial
- El usuario crea su cuenta del ecosistema (correo y contraseña) o ingresa.
- Carga **una sola vez**: CUIT, razón social, nombre de fantasía, correo y teléfono de contacto, domicilio fiscal y la primera sucursal (domicilio comercial, localidad, provincia, municipio).
- Acepta condiciones y **declara que representa al comercio**.
- Validaciones: CUIT de 11 dígitos con dígito verificador; datos obligatorios.
- Si el CUIT **no existe**: se crea el comercio, la sucursal y la membresía `titular`. Evento `commerce.created`.
- Si **ya existe** y el usuario ya es miembro: se devuelve el mismo comercio (reintento sin duplicar).
- Si **ya existe** y el usuario no es miembro: `409` con la opción **solicitar acceso** (membresía `pendiente`). Nunca se otorga acceso por conocer el CUIT.

### 2. ARCA
- El CORE consulta el padrón sandbox por CUIT. Guarda resultado, origen `sandbox`, fecha y evidencia (`padron.contribuyentes:<cuit>`).
- Si el CUIT no figura: `observado`. El comercio queda registrado igual; ARCA puede inscribirlo en su propio módulo y luego se reverifica.
- Si la base o el módulo fallan: `no_disponible` con el error; los demás pasos siguen.
- El CORE **nunca** modifica datos de ARCA.

### 3. ARBA
- Consulta la inscripción en Ingresos Brutos. Activa → `verificado`; sin inscripción → `pendiente` ("puede no corresponder; no es incumplimiento").
- `no_aplicable` (por ejemplo, Convenio Multilateral gestionado en otra jurisdicción) solo se registra como verificación **manual** con su evidencia.

### 4. Municipio
- Se evalúa **por sucursal**. Estados: `habilitado`, `en_tramite`, `pendiente` (sin iniciar), `observado`, `no_aplicable`.
- El domicilio fiscal no es el local habilitado: cada sucursal lleva su propio domicilio comercial.
- Iniciar el trámite se hace en el módulo Municipio (el alta queda `pendiente` hasta que el municipio resuelva). El CORE no aprueba habilitaciones.

### 5. Banco
- "Vincular banco" le pide al módulo Banco que **abra la cuenta** del comercio (o reutilice la existente). Banco asigna CBU y alias; el CORE guarda solo la referencia de la cuenta.
- Requiere que el CUIT esté en el padrón fiscal (ARCA verificado). Si no, queda `pendiente` con el motivo.
- No se guardan claves, PIN ni datos de tarjetas.

### 6. Activación del TPV
- Requisitos: ARCA `verificado` y Banco `vinculado`. Municipio `observado` bloquea; `en_tramite` permite con advertencia.
- Si faltan requisitos: `409` con la lista de faltantes y el TPV queda `pendiente` (activación parcial).
- Si se cumplen: el módulo TPV vincula la terminal elegida con el comercio y su cuenta de cobro → `configurado`. Pasa a `activo` con la primera venta completada.
- El catálogo, el stock y las ventas los administra el TPV.

### 7. Panel de estado
- Muestra identidad, ARCA, ARBA, Municipio (por sucursal), Banco y TPV con: estado, origen, fecha, evidencia, error y acción pendiente.
- Botón **Reverificar** por sistema (vuelve a consultar y agrega una fila al historial).
- Administración de sucursales y de usuarios (aprobar o rechazar solicitudes de acceso).

## Dónde se hace

- **Asistente web:** portal `public/comercios/` (alta, ingreso, panel). Para las clases, cada tarjeta trae un botón **Simular …** que hace el trámite en el sistema sandbox del organismo (inscripción en ARCA, alta de punto de venta, inscripción en IIBB, solicitud y resolución de la habilitación municipal) y después reverifica. El CORE no escribe esos datos: los registra el módulo de cada organismo.
- **Usuario demo:** `demo.comercios.i26@gmail.com` / `ComerciosDemo2026` (titular de los comercios importados).
- **API:** `/core/*` del backend único. Contratos en [CONTRATOS-INTEGRACION.md](CONTRATOS-INTEGRACION.md).

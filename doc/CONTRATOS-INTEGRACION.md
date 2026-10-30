# Contratos de integración — CORE de comercios

**Fecha:** 2026-10-29 · **Versión del contrato:** `core v1` · Base: `https://sintegra-backend.vercel.app` (local: `http://localhost:3010`).
Diseño: [ARQUITECTURA-COMERCIOS.md](ARQUITECTURA-COMERCIOS.md) · Flujo: [FLUJO-ALTA-COMERCIO.md](FLUJO-ALTA-COMERCIO.md).

## Reglas comunes

- JSON, campos en `snake_case`, CUIT como string de 11 dígitos. En el CORE, además, con **dígito verificador** válido.
- Errores: `{"error": "mensaje"}` con el código HTTP correspondiente. Algunos agregan datos (por ejemplo, `faltantes`).
- Sesión: `Authorization: Bearer <token>`. El token dura 8 horas. Todas las rutas `/core/*`, salvo las tres primeras de la tabla, exigen sesión.
- Acceso: las rutas `/core/comercios/:id/*` exigen **membresía activa** en ese comercio. Las de administración exigen rol `titular` o `administrador`.
- Compatibilidad: los endpoints existentes de cada módulo (`/arca`, `/arba`, `/municipio`, `/banco`, `/billetera`, `/tpv`) siguen igual. Los cambios en ellos son **aditivos** (ver más abajo).

## CORE (`/core`)

| Método y ruta | Sesión / rol | Qué hace | Respuestas |
|---|---|---|---|
| `POST /core/cuit/validar` | — | Valida formato y dígito verificador | `200 {cuit, valido, motivo}` |
| `POST /core/usuarios` | — | Crea usuario (`email`, `nombre`, `password` ≥ 10) | `201 {usuario, token}` · `409` correo existente |
| `POST /core/sesiones` | — | Inicia sesión | `200 {usuario, token}` · `401` |
| `GET /core/yo` | sesión | Usuario y comercios (membresías activas o pendientes) | `200 {usuario, comercios[]}` |
| `POST /core/comercios` | sesión | **Alta** (paso 1) y verificación de todos los sistemas (pasos 2 a 6) | `201 ficha` · `200 ficha` si ya es miembro (reintento) · `409` existe · `400` validación |
| `POST /core/comercios/acceso` | sesión | Solicita acceso por CUIT (`cuit`, `motivo`, `rol` opcional) | `202 {comercio_id, estado:"pendiente"}` · `409` ya es miembro · `404` |
| `GET /core/comercios/:id` | miembro | Ficha: comercio, sucursales y estado | `200` · `403` · `404` |
| `GET /core/comercios/:id/estado` | miembro | Panel de estado (paso 7) | `200 estado` |
| `PATCH /core/comercios/:id` | admin | Actualiza datos propios del CORE | `200` · `409` si intenta pisar datos que informa ARCA · `400` si intenta cambiar el CUIT |
| `POST /core/comercios/:id/verificaciones/:sistema` | miembro | Reverifica `arca`, `arba`, `municipio`, `banco` o `tpv` | `200 estado` |
| `POST /core/comercios/:id/verificaciones/:sistema/manual` | admin | Verificación manual con evidencia (`resultado`, `motivo`, `referencia_evidencia`, `vigencia_hasta`, `sucursal_id` para municipio) | `201 estado` · `400` sin evidencia |
| `GET /core/comercios/:id/verificaciones?sistema=` | miembro | Historial (últimas 100) | `200 []` |
| `GET /core/comercios/:id/sucursales` | miembro | Lista sucursales | `200 []` |
| `POST /core/comercios/:id/sucursales` | admin | Agrega sucursal | `201` |
| `GET /core/comercios/:id/membresias` | admin | Usuarios y solicitudes | `200 []` |
| `POST /core/comercios/:id/membresias/:mid/resolver` | admin | `decision`: `aprobar`, `rechazar` o `revocar`; `rol` opcional (solo el titular otorga `administrador`) | `200` · `409` ya resuelta |
| `POST /core/comercios/:id/banco/vincular` | admin | Pide a Banco que abra o reutilice la cuenta (paso 5) | `200 estado` · `409` CUIT sin padrón fiscal |
| `POST /core/comercios/:id/tpv/activar` | admin | Activa una terminal (`terminal_id`, `rubro`) si se cumplen los requisitos (paso 6) | `200 {advertencias[], estado}` · `409 {error, faltantes[]}` |

### Forma del estado

```json
{
  "identidad": {"resultado": "declarado", "origen": "declaracion", "fecha": "…", "evidencia": "…", "detalle": {}},
  "arca":  {"resultado": "verificado", "origen": "sandbox", "fecha": "…", "evidencia": "padron.contribuyentes:30…",
            "detalle": {"condicion_iva": "Responsable Inscripto", "puntos_venta": 1}, "error": null, "accion": null},
  "arba":  {"resultado": "pendiente", "…": "…", "accion": "Inscribir en IIBB o registrar \"no aplica\" con evidencia"},
  "municipio": [{"sucursal_id": "…", "sucursal": "Casa central", "resultado": "en_tramite", "…": "…"}],
  "banco": {"resultado": "vinculado", "detalle": {"cuenta_id": "cuenta-30…", "cbu": "••••0110", "alias": "…"}},
  "tpv":   {"resultado": "configurado", "detalle": {"terminales": ["brisa"], "ventas_completadas": 0}}
}
```

### Alta (cuerpo)

```json
{
  "cuit": "30712990011", "razon_social": "Verdulería Lucía SRL", "nombre_fantasia": "La Huerta",
  "tipo_persona": "juridica", "email_contacto": "contacto@lahuerta.test", "telefono_contacto": "011-5555-0000",
  "domicilio_fiscal": "Sarmiento 50, Morón",
  "sucursal": {"nombre": "Casa central", "domicilio_comercial": "Rivadavia 1200", "localidad": "Haedo",
               "provincia": "Buenos Aires", "codigo_postal": "1706", "municipio": "Morón"},
  "acepta_condiciones": true, "declara_representacion": true
}
```

## Cambios aditivos en otros módulos

| Módulo | Endpoint | Qué agrega |
|---|---|---|
| ARCA | `POST /arca/contribuyentes` | Inscripción en el padrón fiscal **sandbox** (`cuit` con DV, `razon_social`, `condicion_iva`, `tipo_persona`, `domicilio_fiscal`). `201` · `409` ya inscripto. |
| Banco | `POST /banco/cuentas/:id/depositos` · `POST /banco/cuentas/:id/extracciones` · `POST /banco/transferencias` | Operaciones del cliente: depósito y extracción en efectivo (contra `cuenta-caja`) y transferencia por id, CBU o alias. Cuerpo: `id_operacion`, `monto`, `concepto`; la transferencia agrega `origen` y `destino`. `201` · `200` reintento · `402` sin saldo · `404`. |
| Banco | `POST /banco/cuentas` | Apertura de cuenta (sandbox). Banco asigna CBU y alias. Idempotente: `201` nueva, `200` existente; `409` sin padrón fiscal. |
| Municipio | `POST /municipio/comercios` | **Cambio de comportamiento compatible:** si el CUIT ya está en el padrón (lo informó ARCA) se reutiliza sin pisarlo; `409` solo si ya hay un trámite de habilitación. Crear el CUIT desde Municipio queda deprecado. |
| Municipio | `POST /municipio/comercios/:cuit/resolucion` | Resolución simulada del trámite (`estado`: `activa`, `suspendida` o `baja`; `expediente` obligatorio). |
| TPV | `GET /tpv/ventas?detalle=1&terminal_id=&id_venta=` | Ventas con líneas, comprobante (tipo, PV, número, CAE, vencimiento), percepción (alícuota) y cliente. |
| TPV | `POST /tpv/ventas` | Acepta `cuenta_origen` por id, CBU o alias; si no hay `cuit_cliente`, el titular de esa cuenta es el comprador. Devuelve `impuestos` (tipo, neto, IVA, percepción y motivo). |
| ARCA | `GET /arca/comprobantes/:numero?tipo=&pv=&cuit=` | Busca un comprobante por número; `409` si es ambiguo. |
| TPV | `POST /tpv/comercios` | Sin cambios de contrato. La lógica se extrajo a `vincularComercio()`, que también usa el CORE. |

## Eventos (`core.eventos`)

| Tipo | Cuándo | Datos |
|---|---|---|
| `commerce.created` | Alta o importación | `cuit`, `origen` |
| `commerce.updated` | Cambio de datos, sucursal o verificación sin evento propio | campos o `sistema`/`resultado` |
| `commerce.fiscal_verified` | ARCA pasa a `verificado` | `sistema`, `resultado`, `origen` |
| `commerce.provincial_verified` | ARBA pasa a `verificado` | ídem |
| `commerce.municipal_status_changed` | Cambia el estado municipal de una sucursal | ídem + `sucursal_id` |
| `commerce.bank_linked` | Banco pasa a `vinculado` | ídem |
| `commerce.pos_activated` | TPV pasa a `configurado` | ídem |
| `commerce.access_requested` / `commerce.membership_changed` | Solicitudes y resoluciones de acceso | `rol` / `estado` |

Los eventos quedan en la bandeja de salida (`publicado_en` nulo). Todavía no hay un despachador: es el próximo paso para avisar a las apps.

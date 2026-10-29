# Matriz de propiedad de datos

**Fecha:** 2026-10-29 · Quién es dueño de cada dato, quién puede leerlo y qué se comparte. Complementa la [arquitectura del CORE](ARQUITECTURA-COMERCIOS.md).

| Dominio | Esquema / tablas | Es dueño de | Comparte (mínimo necesario) | No comparte |
|---|---|---|---|---|
| **CORE** | `core.comercios`, `sucursales`, `usuarios`, `membresias`, `integraciones`, `verificaciones`, `eventos` | Identidad interna (`commerce_id`), sucursales, usuarios y permisos, historial de verificaciones | `commerce_id`, CUIT, razón social, sucursal y estados por sistema | Contraseñas, datos de contacto fuera del comercio |
| **ARCA** (sandbox) | `padron.contribuyentes`, `arca.puntos_venta`, `arca.comprobantes` | Situación fiscal nacional, condición IVA, puntos de venta, comprobantes | Resultado de verificación, condición IVA, referencia de PV | Comprobantes de otros comercios |
| **ARBA** (sandbox) | `arba.inscripciones`, `arba.percepciones` | Inscripción en IIBB, actividad, alícuota de prueba, percepciones | Estado y régimen | Detalle de percepciones a terceros |
| **Municipio** | `municipio.habilitaciones`, `municipio.tasas` | Habilitaciones, trámites y tasas | Estado de habilitación por establecimiento | Detalle de deuda a otros módulos |
| **Banco** | `banco.cuentas`, `banco.movimientos` | Cuentas, CBU, alias, saldos y ledger | Estado de vínculo y referencia de cuenta (CBU enmascarado al CORE) | Saldos y movimientos a módulos no autorizados |
| **Billetera** | `billetera.*` | Acceso y vista de billetera; el saldo es el de la cuenta Banco vinculada | Alias y estado | Credenciales |
| **TPV** | `tpv.*` | Terminales, catálogo, stock, ventas, webhooks a terminales | Eventos comerciales y estado de activación | Ventas individuales a otros comercios |

## Reglas

1. **Una sola fuente por dato.** El CORE no copia saldos, alícuotas ni condición fiscal: guarda la verificación (qué dijo el dueño, cuándo y con qué evidencia).
2. **Escritura solo por el dueño.** El CORE pide acciones (abrir cuenta, activar terminal) a funciones del módulo dueño; no hace `UPDATE` en tablas ajenas.
3. **Minimización.** El panel del comercio muestra el CBU enmascarado (`••••1234`). Los eventos llevan identificadores y estados.
4. **Acceso por finalidad.** Un usuario ve solo los comercios donde tiene membresía activa.
5. **Datos heredados.** Lo que ya está en los esquemas de dominio se conserva tal cual; el CORE lo enlaza (ver [plan de migración](PLAN-MIGRACION.md)).

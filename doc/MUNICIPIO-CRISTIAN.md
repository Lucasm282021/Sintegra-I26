# Municipio · arquitectura, contratos y estado

**Actualizado:** 28/10/2026 · **Alcance:** implementación académica local, UI de demo y backend común. Ninguna de estas variantes es una autoridad municipal real.

## Componentes que existen

| Componente | Stack / persistencia | Qué hace | Límite actual |
|---|---|---|---|
| `municipio-cristian/frontend` | React + Vite + TypeScript; modo demo en memoria | Panel de padrón, cuentas corrientes, comprobantes/certificados e inspector de solicitudes HTTP | Los sujetos sembrados son fixtures; las pantallas locales no equivalen a actos administrativos. |
| `municipio-cristian/server.js` | Express + SQLite (`municipio.db`) | Variante local legacy de consulta/registro de comercios y pagos de obligaciones ya existentes | Base separada, sin sincronización automática ni integración bancaria o municipal oficial. |
| `backend/src/modulos/municipio.js` | Express + PostgreSQL/Supabase común | Padrón de establecimientos, obligaciones existentes, pagos demo, recibos y certificados de demo | No modela aún `commerceId`/sucursales, documentos ni autoridad/jurisdicción municipal específica. |

## Comportamiento corregido

- `POST /municipio/comercios` valida los 11 dígitos y el checksum en altas nuevas, registra el sujeto y deja el estado de habilitación como `pendiente`.
- La ruta no concede una habilitación automáticamente ni genera períodos/montos arbitrarios de TISH o vía pública.
- `GET /municipio/comercios/:cuit` y el padrón muestran el estado pendiente. Los registros preexistentes continúan consultables como estaban.
- No se emite certificado de libre deuda para una habilitación pendiente o no vigente.
- La UI React y su modo local muestran la misma semántica: alta pendiente, sin deuda inventada y sin certificado hasta que exista estado habilitado.
- El servidor SQLite local registra solicitudes nuevas como `pendiente`; no cambia filas preexistentes de `municipio.db` al arrancar. Su pago solo actualiza una obligación pendiente ya existente, para un comercio vigente y por el importe exacto; no hace una transferencia bancaria.
- La migración aditiva `backend/supabase/migrations/20261028000012_municipio_habilitacion_pendiente.sql` amplía los estados permitidos sin borrar ni reescribir habilitaciones existentes. Todavía no se aplicó a Supabase.

## Qué falta para representar un trámite real

1. Resolver identidad transversal por `commerceId` y registrar sucursales/establecimientos; domicilio fiscal no equivale al domicilio comercial.
2. Exigir jurisdicción municipal, ubicación y actividad para determinar qué reglas aplican.
3. Crear entidades propias para solicitud, documentación, observaciones, resolución, vigencia y auditoría; no convertir el alta de padrón en aprobación.
4. Incorporar autenticación y roles municipales para emitir obligaciones y aprobar/rechazar trámites. No exponer una ruta de aprobación pública.
5. Emitir tasas solo cuando la jurisdicción determine concepto, período, fórmula, monto y vencimiento. Luego permitir su pago conciliado con Banco.
6. Evaluar cada TPV por sucursal y regla municipal aplicable, sin usar un bloqueo universal.
7. Diseñar migración respaldada para `municipio.db`; la base SQLite actual se mantiene intacta mientras se decide la fuente de verdad.

## Verificación de la corrección local

- Backend común: `npm test` pasó 14/14 sobre PGlite efímero; incluye rechazo del certificado mientras la solicitud está pendiente.
- Frontend Municipio: `npm run lint` y `npm run build` terminaron correctamente. Vite muestra una advertencia de `__dirname` en `vite.config.ts`, sin fallar el build.
- `municipio-cristian/server.js`: requiere verificación de sintaxis; no se abrió la base persistente ni se desplegó el contenedor.
- No se aplicó migración remota, no se alteró la base SQLite, y no hubo push/despliegue.

## Referencias

- [Manual de usuario](MANUAL-USUARIO-SINTEGRA.html)
- [Auditoría del ecosistema](AUDITORIA-ECOSISTEMA.md)
- [Bitácora de avances](AVANCES-UNIFICACION.md)
- [Guía de habilitación del proyecto](../municipio-cristian/habilitacion-municipal.html)

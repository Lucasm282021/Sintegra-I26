# TPV Sebastián — especificación del panel de control

**Destino:** agente que implementa el TPV de Sebastián.  
**Estado:** requerimientos funcionales y de interfaz para implementar; no implica que la API o el frontend ya estén disponibles en este repositorio.

## 1. Objetivo

Construir un panel de control para que el comercio pueda entender rápidamente cómo está operando el punto de venta, consultar ventas y detectar pagos o integraciones que requieren atención. El panel es complementario a la pantalla de caja: no debe reemplazar ni entorpecer el flujo ágil de cobro.

## 2. Lo que encontramos en el repositorio

La carpeta `sebasTPV` contiene configuración de Nginx y Docker para desplegar un frontend, pero no incluye los componentes de interfaz ni la aplicación completa. El documento [AJUSTE-TPV.md](AJUSTE-TPV.md) define el contrato tentativo de ventas y el [INFORME-UNIFICACION-APPS.md](INFORME-UNIFICACION-APPS.md) plantea contratos compartidos. Por eso este archivo define qué construir y qué debe confirmar el equipo, sin asumir pantallas o datos ya implementados.

## 3. Navegación propuesta

Separar claramente dos áreas de uso:

1. **Punto de venta:** crear venta, agregar productos, seleccionar medio de pago y mostrar confirmación.
2. **Panel de control:** resumen, ventas, operaciones con problemas y configuración según permisos.

En escritorio, presentar navegación lateral compacta o superior con “Caja”, “Panel”, “Ventas” y “Configuración”. En móvil, priorizar “Caja” y dejar el panel accesible desde una navegación simple. Mantener visible el comercio/sucursal activa y el usuario autenticado.

## 4. Inicio del panel

### Indicadores

Mostrar tarjetas de resumen con período seleccionado y comparación explícita cuando el backend disponga de período anterior:

- Total vendido en ARS.
- Cantidad de ventas confirmadas.
- Ticket promedio.
- Pagos pendientes, fallidos o que requieren revisión.
- Percepciones IIBB registradas (monto y cantidad), solo si la API entrega datos confirmados.
- Comprobantes emitidos, pendientes o rechazados por ARCA.

Filtros mínimos: hoy, últimos 7 días, mes actual y rango personalizado. Mostrar fecha/hora de última actualización. El backend es la fuente de totales; no sumar datos incompletos o de páginas parciales en el navegador.

### Actividad reciente

Tabla/listado de operaciones recientes con:

- Fecha y hora localizadas.
- Identificador de venta (`sale_id`).
- Caja/terminal y operador cuando existan.
- Cantidad de ítems.
- Total y moneda.
- Medio de pago.
- Estado visible y accesible.
- Acceso a detalle y acción contextual permitida.

Estados visuales y textuales sugeridos: **Confirmada**, **En proceso**, **Pendiente**, **Fallida**, **Requiere revisión**. No comunicar “venta confirmada” si el pago o la confirmación del backend no lo acreditan.

### Alertas de operación

Destacar operaciones que necesitan seguimiento, con explicación concreta y acción segura:

- Pago aún no confirmado.
- Rechazo o indisponibilidad del medio de pago.
- Percepción fiscal no confirmada.
- Emisión de comprobante pendiente/rechazada.
- Integración caída o con demoras.

Las acciones de reintento deben llamar a una operación idempotente del backend y mostrar el resultado. Si ya existe una etapa confirmada, no volver a ejecutarla.

## 5. Detalle de una venta

Al abrir una fila, mostrar una vista/drawer con:

- Datos identificatorios: `sale_id`, comercio, fecha, caja y operador.
- Líneas de productos con cantidad y snapshot de precio aplicado.
- Subtotal, impuestos, percepción, descuento si aplica y total.
- Moneda ARS.
- Medio de pago y referencia/estado del pago; ocultar credenciales y datos sensibles.
- Estado de emisión del comprobante y referencia externa permitida.
- Historial cronológico de transiciones, errores recuperables y `request_id`.

El cliente TPV puede mostrar el snapshot, pero no editar montos calculados ni cambiar estados autoritativos.

## 6. Búsqueda, filtros y exportación

- Búsqueda por `sale_id`, fechas, operador, caja y estado; no ofrecer búsqueda por datos personales que el usuario no necesite.
- Filtros combinables, botón para limpiar y cantidad de resultados.
- Paginación del lado servidor con orden estable, por defecto fecha descendente.
- Exportación CSV solo si está autorizada y los resultados respetan el mismo filtro/alcance de permisos.
- En móvil, convertir filas en tarjetas o permitir scroll horizontal claramente indicado.

## 7. Contrato API sugerido

Coordinar estas rutas con el contrato común antes de implementarlas. Son propuestas, no endpoints verificados:

```text
GET  /api/v1/tpv/resumen?desde=2026-10-01&hasta=2026-10-31
GET  /api/v1/tpv/ventas?page=1&limit=20&estado=&desde=&hasta=&q=
GET  /api/v1/tpv/ventas/{sale_id}
POST /api/v1/tpv/ventas/{sale_id}/reintentos/{etapa}
```

Requisitos del contrato:

- JSON con sobre de éxito `{ "data": ... }` y error común `{ "error": { "code", "message", "details", "request_id" } }`.
- Importes exactos en unidad menor (`amount_minor`) y `currency: "ARS"`; definir este formato junto con el equipo antes de producción.
- Timestamps ISO 8601 con zona horaria.
- Rangos y límites de fechas validados en servidor; paginación con metadatos.
- Totales agregados por el servidor, con el período y hora de cálculo incluidos.
- Autorización por usuario, comercio/sucursal y acción.
- Reintentos idempotentes; misma llave y mismo contenido devuelve resultado previo, contenido distinto produce conflicto.
- No exponer secretos, tokens, credenciales bancarias ni datos completos de tarjetas.

Ejemplo conceptual de resumen:

```json
{
  "data": {
    "period": { "from": "2026-10-01", "to": "2026-10-31" },
    "currency": "ARS",
    "sales_count": 0,
    "total_amount_minor": 0,
    "average_ticket_minor": 0,
    "attention_count": 0,
    "updated_at": "2026-10-26T12:00:00-03:00"
  }
}
```

Los ceros son valores de ejemplo de contrato, no datos reales.

## 8. Roles y seguridad

Definir al menos estos permisos antes de integrar:

- **Cajero:** operar ventas y ver las propias según política del comercio.
- **Supervisor:** ver actividad de su sucursal y resolver/reintentar etapas permitidas.
- **Administrador del comercio:** consultar sucursales, operadores e informes y cambiar configuración autorizada.
- **Soporte técnico:** inspección técnica acotada, con auditoría y sin acceso innecesario a datos financieros.

Aplicar permisos en backend; ocultar botones en la interfaz solo mejora la experiencia y no es una barrera de seguridad. Registrar quién hizo cada reintento o cambio administrativo.

## 9. Diseño y accesibilidad

- Mantener una jerarquía: título/período, indicadores, alertas, actividad.
- Reservar color saturado para selección, acciones y estados; usar superficies neutras o tintes claros para separar zonas.
- Acompañar cada color de etiqueta o icono para que el estado no dependa solo del color.
- Usar tipografía tabular para CUIT, identificadores y montos; alinear importes a la derecha.
- Proveer estados de carga, vacío, error de red y datos desactualizados.
- Operable por teclado; foco visible, etiquetas de formulario y contraste legible.
- Evitar animaciones que retrasen la caja o alertas que interrumpan el cobro.

## 10. Criterios de aceptación

- Caja y panel se pueden navegar sin mezclar sus acciones.
- El panel permite elegir período y página de resultados sin duplicados ni sumas parciales incorrectas.
- Cada venta muestra un estado trazable y detalle consistente con el backend.
- Una falla de banco/billetera, IIBB o ARCA queda visible y consultable, sin afirmar éxito falso.
- Reintentar una etapa no duplica cobros, percepciones ni comprobantes.
- La interfaz informa carga, vacío, error y última actualización.
- Los roles no pueden consultar ni modificar comercios ajenos cambiando parámetros del cliente.
- Vista móvil legible y usable; navegación, tabla y acciones no quedan cortadas.
- Los casos demo están marcados y no se mezclan con informes de producción.

## 11. Instrucción para el agente implementador

Antes de modificar código, inspeccionar la versión más reciente del frontend y del backend TPV, confirmar rama/commit y preservar cambios de Sebastián. Comparar su implementación con este documento y con `AJUSTE-TPV.md`. Si existe un contrato real, actualizar este documento para reflejarlo antes de cambiar nombres de rutas. No inventar datos fiscales ni declarar una etapa exitosa desde el cliente. Implementar primero las pantallas y estados con API/fixtures claramente marcados; luego conectar cada endpoint acordado.


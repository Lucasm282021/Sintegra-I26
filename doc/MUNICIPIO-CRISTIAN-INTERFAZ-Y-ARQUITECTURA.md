# Municipio — interfaz, módulos e integración

**Proyecto:** `municipio-cristian/frontend`  
**Propósito:** registrar las decisiones de interfaz realizadas para el sistema municipal y dejar criterios compartidos para el diseño de la plataforma y el backend.

## 1. Objetivo de la interfaz

El módulo Municipio concentra tareas tributarias distintas. La cabecera anterior mezclaba navegación, identidad y datos de contexto en una sola franja, y las áreas de trabajo se percibían como una pantalla continua. La actualización separa navegación y contexto, mejora la adaptación a pantallas pequeñas y distingue cada módulo con un fondo tenue.

## 2. Mapa visual de módulos

| Módulo | Color de identificación | Uso | Contraste de contenido |
| --- | --- | --- | --- |
| Altas y padrón | Azul | Fondo del área activa, pestaña seleccionada, panel de alta y tarjeta de comercios | Campos blancos; tabla blanca para facilitar lectura |
| Cuentas y pagos | Verde | Fondo del área activa y pestaña seleccionada | Paneles y formularios blancos |
| Comprobantes | Violeta | Fondo del área activa y pestaña seleccionada | Paneles y formularios blancos |
| Inspector API | Gris azulado | Fondo del área activa y pestaña seleccionada | Superficies internas blancas para distinguir registros y respuestas |
| Indicadores del padrón | Azul, verde y ámbar | Identificación semántica de cantidad, libre deuda y deuda | Etiquetas y valores mantienen contraste alto |

Los tonos son fondos de apoyo, no colores para texto extenso. Los controles y superficies con información densa conservan contraste suficiente. La selección de navegación usa un tono más saturado de la familia correspondiente.

## 3. Ajustes de interfaz realizados

- Cabecera reorganizada: identidad y estado de API en la franja superior; navegación en una fila independiente.
- Navegación con etiquetas breves, iconos y estado seleccionado visible; en pantallas angostas se distribuye en dos columnas.
- Contexto separado de la navegación: entorno demo, moneda, períodos y CUIT de ejemplo aparecen en una franja propia.
- Acciones de demostración del alta quedan agrupadas en una sección desplegable, evitando competir con el formulario.
- Panel de alta y panel del padrón se presentan como áreas diferenciadas; los campos de carga y la tabla conservan superficies claras.
- Acciones de fila acortadas a “Cuenta” y “Certificado” para evitar que la tabla se desborde.
- El contenido central toma un fondo tenue según la pestaña activa y los KPI usan colores semánticos.

## 4. Módulos y responsabilidades actuales

### Altas y padrón

Permite registrar y consultar comercios/contribuyentes, buscar por CUIT, razón social o rubro, filtrar por situación de deuda y saltar a la cuenta corriente o a comprobantes del CUIT seleccionado.

### Cuentas y pagos

Consulta la cuenta corriente del contribuyente seleccionado y permite recorrer períodos y pagos de la demo. Debe integrarse con el servicio central para consultar deuda consolidada y registrar pagos de manera idempotente.

### Comprobantes

Consulta comprobantes y certificados asociados al contribuyente. En una versión integrada, cada comprobante debe poder verificarse contra el pago y la obligación que lo originó.

### Inspector API

Muestra actividad de red para inspección/desarrollo. Debe tratarse como herramienta técnica; no debería exponer datos sensibles ni permanecer habilitada para usuarios finales sin roles específicos.

## 5. Estado y límites de la versión actual

Esta interfaz es una demostración: muestra casos de ejemplo, estado de API demo, períodos precargados y acciones de simulación. El diseño visual no implica que exista todavía una base de datos productiva, autenticación municipal, conexión oficial al padrón ARBA/ARCA, liquidación legalmente validada ni una integración bancaria real. Antes de usarla con contribuyentes reales deben definirse y validarse esos servicios y reglas con sus responsables.

El alta visible actualmente solicita CUIT, razón social/denominación, condición fiscal, domicilio, rubro principal y rubro secundario opcional. Para una entidad real hacen falta datos y verificaciones adicionales (ver sección 8).

## 6. Propuesta para backend y persistencia compartida

Se recomienda un backend común con autenticación, autorización, auditoría y contratos API versionados. Los módulos consumen ese backend mediante API; no se conectan directamente a la base de datos. La persistencia puede ser una instancia gestionada común al principio, con esquemas/tablas y permisos separados por dominio. La separación lógica evita duplicar contribuyentes y pagos, sin obligar a operar varias bases físicas desde el primer día.

Si crecen los requisitos de aislamiento, disponibilidad o equipos independientes, los dominios pueden migrarse a bases separadas manteniendo contratos de API estables. No se recomienda compartir credenciales de base entre frontends.

### Límites sugeridos por dominio

- **Identidad y sujetos:** persona/entidad, CUIT, domicilios y relaciones entre titular y establecimientos.
- **Padrón municipal:** inscripción, actividades, establecimientos, habilitaciones, estado y fechas de vigencia.
- **Obligaciones:** concepto tributario, período, liquidación, vencimiento, saldo y estado.
- **Pagos:** intentos, confirmaciones, conciliación, devoluciones e idempotencia.
- **Comprobantes:** comprobantes emitidos, certificados, referencia a obligación/pago y verificación.
- **Auditoría:** actor, acción, fecha, módulo, correlación y cambios relevantes; sin registrar secretos.

ARBA/ARCA deben consultarse por una integración autorizada y documentada, con caché y trazabilidad cuando corresponda. El padrón provincial no debe tratarse como tabla propia editable ni copiarse sin fundamento legal/técnico. Municipio conserva su inscripción, tasas y habilitación local, identificando la fuente y fecha de cada dato externo.

## 7. Contratos API que conviene acordar

Todos los módulos deberían compartir:

- Identificador de correlación (`request_id`) y errores con `code`, `message` y detalles de validación.
- Fechas en ISO 8601 y zona horaria definida; importes decimales en representación exacta, moneda explícita (ARS).
- CUIT normalizado como 11 dígitos y validado en backend, además de la validación de interfaz.
- Paginación, filtros y orden estables para listados.
- Autenticación/autorización por usuario, municipio, módulo y acción.
- Versionado compatible (`/api/v1`) y documentación OpenAPI compartida.
- Claves idempotentes para pagos y operaciones que puedan repetirse.
- Estados y transiciones explícitas; no permitir que el frontend invente la liquidación o determine por sí solo “libre deuda”.

Rutas candidatas para discusión, sujetas al contrato final:

```text
GET    /api/v1/sujetos/{cuit}
GET    /api/v1/municipios/{municipioId}/padron?cuit=&estado=&actividad=
POST   /api/v1/municipios/{municipioId}/inscripciones
GET    /api/v1/sujetos/{cuit}/cuenta-corriente
POST   /api/v1/pagos                         (Idempotency-Key requerido)
GET    /api/v1/pagos/{pagoId}
GET    /api/v1/comprobantes/{comprobanteId}
POST   /api/v1/consultas-padron-provincial    (solo vía adaptador autorizado)
```

## 8. Datos a completar antes del alta real

Además de los campos actuales, definir según persona humana o jurídica:

- **Tipo de sujeto:** persona humana, sociedad/persona jurídica u otra forma admitida; separar nombre/apellido de denominación legal cuando aplique.
- **Identificación y validación:** CUIT validado en servidor y fuente/fecha de consulta; estado tributario y condición frente a tributos, solo si la autoridad permite consultar y almacenar esos datos.
- **Representación:** representante/apoderado y alcance de autorización para personas jurídicas, con documentación y vigencia cuando corresponda.
- **Establecimiento:** domicilio desglosado (calle, número, piso/local, localidad, partido, provincia, código postal), ubicación y uno o más locales por sujeto.
- **Actividad:** código/nomenclador municipal, actividad principal y secundarias, fecha de inicio y vigencia; no dejar el rubro solo como texto libre.
- **Habilitación local:** número/estado/fechas y requisitos o expediente, separados de la inscripción tributaria.
- **Contacto para notificaciones:** correo/teléfono, preferencia y constancia de verificación/consentimiento donde corresponda.
- **Evidencia:** documentación solicitada, estado de revisión, fecha y usuario revisor; almacenamiento privado y retención definida.
- **Trazabilidad:** quién dio el alta o modificó datos, cuándo, motivo y cambios; registrar aceptación o declaración jurada si el proceso la exige.
- **Situación de la inscripción:** borrador, pendiente de revisión, activa, observada, suspendida o baja, con transiciones y motivo.

No todos los datos deben ser obligatorios por defecto. El municipio debe establecer finalidad, base legal, minimización, permisos, conservación y tratamiento de información personal antes de agregarlos.

## 9. Próximos pasos recomendados

1. Confirmar con el equipo municipal qué campos y estados exige la ordenanza/proceso de habilitación.
2. Definir el contrato común de sujetos, padrón, cuenta corriente, pagos y comprobantes.
3. Acordar proveedor de identidad, roles y ámbito municipal.
4. Seleccionar base de datos y migraciones; modelar dominios separados y auditoría.
5. Integrar primero una lectura de padrón autorizada y luego el alta municipal; nunca confiar la validación final al navegador.
6. Mantener los datos semilla claramente identificados en demo y separados de producción.
7. Revisar accesibilidad de contraste y navegación por teclado cuando cambien los colores o componentes.

## 10. Archivos principales de interfaz

- `municipio-cristian/frontend/src/App.tsx`: selección del módulo y color de fondo contextual.
- `municipio-cristian/frontend/src/components/HeaderGlobal.tsx`: cabecera, navegación y acento de módulo activo.
- `municipio-cristian/frontend/src/components/TabPadronComercios.tsx`: indicadores, alta y padrón.


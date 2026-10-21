# Informe de contratos para unificar las aplicaciones

**Estado:** análisis de la documentación y del código disponible en `i26sintegra` al 21/10/2026. Es una propuesta para acordar antes de implementar el backend común.

## Resumen ejecutivo

Las aplicaciones comparten conceptos, pero hoy no comparten una API ni una base de datos. ARBA, Municipio y Billetera levantan servicios separados y persisten con SQLite propio; sus montos y errores tampoco siguen una única convención. Las interfaces de ARBA y Billetera llaman a sus APIs, mientras que la interfaz Next/React de Municipio muestra datos de ejemplo y mantiene altas nuevas en estado local: no las guarda en su servicio.

La documentación `doc/sistema.md` define una venta coordinada (`POST /tpv/ventas`) con comercio, productos, ARBA, pago y comprobante, pero la implementación TPV completa, Banco y ARCA no está en este checkout. `sebasTPV` contiene archivos de despliegue, no el código fuente descrito por el Dockerfile.

### Recomendación

Construir un **backend modular único** que sirva a todas las interfaces y sea dueño de una base relacional compartida. Los módulos mantienen límites de dominio y tablas/repositorios propios; ningún frontend ni servicio consulta directamente las tablas de otro módulo. Si la entrega exige procesos separados, exponer el mismo contrato por servicio y conservar una sola base común con acceso mediado por API. No compartir archivos SQLite independientes.

Como destino nuevo, se recomienda PostgreSQL por transacciones concurrentes, restricciones relacionales y operación multiusuario. La elección del motor y el despliegue deben acordarse antes de escribir migraciones. El trabajo inicial debe preservar los servicios y permitir adaptar clientes por etapas.

## Inventario y brechas observadas

| Aplicación | Lo que existe en este repo | Brecha principal |
|---|---|---|
| ARBA · Tomi | API Express en 3003, SQLite (`padron`, `percepciones`), frontend React/Vite y modo Demo/API. | Expone `/arba/...`; la percepción acepta monto decimal. El padrón mezcla administración de comercio y datos fiscales. |
| ARBA · Lucas / Nehemias | Implementaciones alternativas adicionales. | Evitar integrar las tres como servicios separados; elegir una versión de referencia y retirar duplicidad tras comparar datos/casos. |
| Municipio · Cristian | API Express/SQLite en 3005; frontend Next/React. | API usa `snake_case`; el formulario envía `{ cuit, razonSocial, rubro }` solo a estado React. La tabla de la interfaz usa datos de muestra. |
| Billetera | API Express/SQLite en 3006 y web HTML/JS. | Monto entero en pesos frente a los importes decimales de ARBA y `REAL` de Municipio. Cargas/pagos sin llave idempotente; operación DB no atómica con movimiento. |
| TPV | `sebasTPV` documenta Docker/Nginx/configuración de frontend. | Falta el código fuente ejecutable y contrato real; `doc/sistema.md` describe la API objetivo, no una API verificada. |
| Banco | No se encontró implementación en el checkout. | Billetera espera opcionalmente `POST /banco/pagos`, pero no hay contrato de respuesta compartido ni ejecución idempotente acordada. |
| ARCA | No se encontró backend en el checkout. | La venta espera comprobante tras pago; faltan solicitud, respuesta, estados, idempotencia y persistencia definidos. |

La documentación de Billetera dice que cada módulo conserva sus propios datos, mientras que el pedido actual plantea una base unificada. Se puede cumplir ambos objetivos con **un único motor/base física y límites de propiedad lógica por módulo**. La base compartida no debe convertirse en consultas cruzadas arbitrarias.

## Contrato común recomendado (v1)

- **Prefijo:** `/api/v1`; mantener adaptadores temporales para las rutas actuales durante la migración.
- **Formato:** JSON UTF-8. Propiedades `snake_case` para alinear los servicios existentes y simplificar clientes actuales.
- **CUIT:** string de 11 dígitos sin separadores en API/BD. La interfaz puede aceptar/formatear guiones, normalizar antes de llamar y nunca tratarlo como número.
- **Dinero:** adoptar un formato único antes de migrar. Recomendación: entero en centavos (`amount_minor`) más `currency: "ARS"`; convertir en los clientes. Así se evita la precisión binaria de `REAL` y la diferencia entre ARBA decimal y Billetera pesos enteros.
- **Alícuota:** decimal fraccional (`0.03` = 3%), con vigencia y procedencia; no aceptar una tasa digitada libremente en operaciones de venta.
- **Fechas:** RFC 3339/ISO 8601 con zona horaria para instantes (`created_at`), fecha ISO (`YYYY-MM-DD`) y período `YYYY-MM`.
- **Respuestas:** éxito `{ "data": ... }`, listados `{ "data": [...], "meta": { "page": 1, "limit": 20, "total": 0 } }`.
- **Errores:** `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [], "request_id": "..." } }`.
- **Estados HTTP:** 400 formato inválido; 401/403 acceso; 404 inexistente; 409 duplicado o reintento incompatible; 422 regla de negocio; 500 interno; 503 integración no disponible. No traducir una falla de dependencia como éxito.
- **Reintentos:** exigir `Idempotency-Key` en operaciones que cobran, acreditan, crean una percepción, venta o comprobante. Misma llave y mismo contenido devuelven el resultado original; misma llave con contenido distinto, 409.
- **Trazabilidad:** `request_id`, `sale_id`/`id_venta`, origen y marcas de tiempo deben permitir seguir una venta y sus referencias externas.

## Modelo de datos compartido recomendado

Usar claves internas estables además de CUIT. CUIT es identificador fiscal único, pero no debe ser la clave primaria de cada objeto de dominio.

- `comercios`: `commerce_id`, `cuit`, `legal_name`, `trade_name`, `entity_type`, `status`, contacto, timestamps.
- `domicilios` y `actividades`: uno-a-muchos, códigos de actividad, jurisdicción y vigencia.
- `habilitaciones_municipales` y `tasas_municipales`: separadas del perfil central del comercio; tasa por período y estado de liquidación/pago.
- `inscripciones_iibb` y `alicuotas`: estado por jurisdicción, alícuota versionada por código y fechas de vigencia.
- `billeteras`, `movimientos` y `pagos`: ledger append-only; saldo derivado o actualizado dentro de transacción serializable.
- `productos`, `ventas`, `venta_items`: el servidor consulta precio vigente y calcula subtotal.
- `percepciones`, `comprobantes` y `integraciones`: referencias externas ligadas a `sale_id` y estados trazables.
- `idempotency_records` y `outbox_events`: unicidad de solicitudes y entrega confiable de eventos si hay servicios distribuidos.

Índices/constraints mínimos: `comercios.cuit UNIQUE`, claves foráneas, importes no negativos, alícuotas dentro del rango acordado, unicidad de período por comercio/tasa cuando aplique, `sale_id UNIQUE` por resultado de cada etapa e idempotency key con ámbito.

## Flujo coordinado de venta

1. TPV envía productos/cantidades y `sale_id`; el backend valida comercio y catálogo, calcula importes.
2. Consulta estado municipal y condiciones de venta.
3. Calcula y registra percepción IIBB con la alícuota vigente.
4. Envía un solo medio de pago (Banco o Billetera) con llave idempotente.
5. Al confirmar el pago, solicita comprobante a ARCA (simulado).
6. Persiste las etapas y devuelve la venta con un estado explícito: `pending`, `confirmed`, `failed` o `requires_review`.

La venta y los módulos de pago externos no pueden tratarse como una transacción SQL atómica. Registrar transiciones y referencias; reintentar cada etapa idempotentemente y permitir compensación/revisión en vez de borrar o inventar resultados.

## Plan de alineación

1. Acordar contrato v1, formato de dinero, nombres canónicos y qué significa “un solo backend” (monolito modular o varios procesos contra la misma DB mediada por API).
2. Seleccionar la implementación ARBA de referencia y fijar contrato de fixtures/datos ficticios.
3. Agregar clientes al formulario de Municipio y reemplazar sus datos de muestra por endpoints reales.
4. Definir las interfaces Banco y ARCA antes de integrar TPV; implementar `Idempotency-Key` de extremo a extremo.
5. Diseñar migración SQLite → base común con importación/reconciliación por CUIT y preservar IDs/referencias.
6. Mantener rutas de compatibilidad hasta migrar cada cliente; después publicar y retirar rutas heredadas en una versión acordada.

## Archivos de ajuste por aplicación

- [ARBA](AJUSTE-ARBA.md)
- [Municipio](AJUSTE-MUNICIPIO.md)
- [Billetera](AJUSTE-BILLETERA.md)
- [TPV](AJUSTE-TPV.md)
- [Banco](AJUSTE-BANCO.md)
- [ARCA](AJUSTE-ARCA.md)

## Fuentes revisadas

- `doc/sistema.md`, `doc/FRONTEND-ARBA-TOMI.md`, `doc/BILLETERA-VIRTUAL.md`.
- `arba-tomi/src/routes/`, `arba-tomi/src/db.js`, `arba-tomi/src/client/services/arbaApi.js`.
- `municipio-cristian/server.js`, `municipio-cristian/frontend/app/page.tsx`, `municipio-cristian/frontend/components/municipio/`.
- `Billetera_virtual-Lucas_M/src/server.js`, `src/db.js`, `public/app.js`.
- `sebasTPV/README.md` y archivos de despliegue disponibles.

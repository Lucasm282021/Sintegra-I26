# Plan de migración al CORE de comercios

**Fecha:** 2026-10-29 · Regla general: **solo cambios aditivos**. No se borran tablas, columnas ni datos; lo que se reemplaza primero se depreca. Cada paso se prueba en PGlite antes de aplicarse en Supabase con `npm run migrar`.

## Etapa 1 — CORE en paralelo (esta entrega)

| Cambio | Tipo | Riesgo |
|---|---|---|
| Esquema `core` con comercios, sucursales, usuarios, membresías, integraciones, verificaciones y eventos | Nuevo | Bajo: no toca tablas existentes |
| Función SQL `core.cuit_dv_valido(text)` | Nueva | Bajo |
| Importación de comercios existentes: cada CUIT con habilitación municipal, inscripción ARBA, punto de venta ARCA o terminal TPV pasa a `core.comercios` con una sucursal "Casa central" | Datos nuevos | Bajo: lectura de tablas de dominio, escritura solo en `core` |
| CUIT heredados sin dígito verificador válido quedan con identidad `observado` | Datos nuevos | Ninguno sobre las apps |
| Rutas `/core/*`, asistente `public/comercios/` | Nuevo | Bajo |
| Migraciones `…011` (TPV David ↔ Banco) y `…012` (municipio `pendiente`) de Codex | Pendientes de aplicar | Bajo: aditivas |

**Reversión:** `drop schema core cascade` deja el sistema como estaba (ninguna app depende todavía del CORE).

## Etapa 2 — Dominios referencian `commerce_id`

- Agregar `comercio_id uuid` (nullable, con FK a `core.comercios`) en `tpv.comercios`, `municipio.habilitaciones`, `banco.cuentas`, `arba.inscripciones`, `arca.puntos_venta`. Completar por CUIT. Las consultas existentes por CUIT siguen funcionando.
- `municipio.habilitaciones`: hoy la PK es el CUIT. Crear `municipio.habilitaciones_sucursal` (por `sucursal_id`) y mantener la tabla vieja como vista de compatibilidad hasta migrar el frontend de Cristian.
- TPV: `POST /tpv/ventas` acepta `comercio_id` además de `comercio_cuit`.

## Etapa 3 — Apps consumen el CORE

| App | Cambio | Qué se depreca |
|---|---|---|
| TPV David | Usar `/tpv` del backend único y el comercio del CORE | Repositorio JSON propio de ventas y productos |
| TPV Sebastián | Elegir comercio por `commerce_id` | Backend NestJS/SQLite local (ya no se usa en producción) |
| Municipio | Alta de habilitación desde la sucursal del CORE | Alta de comercio propia (queda solo el trámite municipal) |
| ARBA Tomi / Lucas / Nehemías | Unificar en el módulo `/arba` común; las altas de sujetos pasan a ser inscripciones IIBB de un comercio del CORE | Padrones locales (SQLite / JSON) |
| ARCA Mateo | Mantener como sandbox de ARCA (padrón fiscal, PV, comprobantes) sobre `/arca` | Padrón JSON local |
| Banco M (Rodrigo) | Su API debe usar `banco.*` (o exponerse como adaptador) en vez de una base Prisma aparte | Esquema `banco_m` separado |
| Billetera | Sin cambios de fondo (ya usa saldo de Banco) | Servidor SQLite propio |

## Etapa 4 — Seguridad transversal

- Sesión del CORE obligatoria en rutas de escritura de todos los módulos; tokens de servicio para llamadas entre módulos.
- CORS restringido a los dominios del portal y de las apps.
- Auditoría de cambios en dominios con actor (`usuario_id` del CORE).

## Datos que NO se migran automáticamente

- Bases SQLite/JSON locales de ARBA Tomi, ARBA Lucas, ARCA Mateo, Billetera (servidor viejo) y TPV Sebastián (NestJS): se exportan y concilian por CUIT antes de importar; no se copian saldos entre libros.
- Esquema `banco_m` (Prisma de Banco M): datos de demostración; se decide en la etapa 3.

# Mapa de integración del ecosistema

**Fecha:** 2026-10-29 · Qué usa cada app, dónde guarda sus datos y cómo se conecta. Todo es simulación académica.

## Una sola base, un solo motor

El **backend común** (<https://sintegra-backend.vercel.app>, Postgres en Supabase) es la fuente de verdad del ecosistema:

| Dominio | Qué guarda | Ruta |
|---|---|---|
| CORE | Comercios (`commerce_id`), sucursales, usuarios, verificaciones | `/core` |
| ARCA | Padrón fiscal, puntos de venta, comprobantes con numeración correlativa | `/arca` |
| ARBA | Inscripciones IIBB, agentes de percepción, percepciones | `/arba` |
| Municipio | Habilitaciones, alícuotas por rubro, tasas y pagos | `/municipio` |
| Banco | Cuentas, CBU/alias, movimientos (ledger único) | `/banco` |
| Billetera | Acceso y vista de la billetera (el saldo es el de la cuenta Banco) | `/billetera` |
| TPV | Terminales, catálogo, ventas; motor de venta con impuestos | `/tpv` |

**Una venta** (`POST /tpv/ventas`) hace todo en una sola transacción: valida comercio y terminal → calcula IVA y tipo de comprobante (ARCA) → percepción si corresponde (ARBA) → cobra en el Banco o la Billetera → emite el comprobante → avisa a la terminal por webhook firmado. Reglas en [IMPUESTOS-Y-PERCEPCIONES.md](IMPUESTOS-Y-PERCEPCIONES.md).

## Estado por app

| App | Conexión | Dónde quedan sus datos | Configuración |
|---|---|---|---|
| Portal · Comercios (`/comercios`) | CORE y, por trámite, ARCA/ARBA/Municipio/Banco/TPV | Base común | — |
| Portal · Configuración fiscal (`/fiscal`) | ARBA, TPV (IVA), Municipio | Base común | — |
| Portal · Banco M (`/banco`) | Banco y Billetera | Base común | — |
| Portal · TPV Brisa (`/brisa`) | TPV común (terminal `brisa`) | Base común | — |
| TPV Sebastián | TPV común (terminal `sebastian`) | Base común | — |
| **TPV David** | Su servidor usa repositorios sobre el backend común y el motor común de venta | Base común (terminal `david`) | `TPV_BACKEND_URL`, `TPV_COMERCIO_CUIT` |
| **ARCA (Mateo)** | Padrón y comprobantes del ARCA común; usuarios y sesiones propios | Base común (comprobantes) + archivo temporal (usuarios) | `ARCA_BACKEND_URL` |
| ARBA Lucas | `/arba/*` del backend común; ingreso propio | Base común | `VITE_API_BASE_URL` |
| Billetera (Lucas M) | `/billetera/*` del backend común (rewrite de Vercel) | Base común | — |
| Municipio (Cristian) | Backend común en producción | Base común | build de producción |
| ARBA Tomi | **Aislado**: su servidor completo con SQLite temporal | Base propia (se reinicia) | — |
| ARBA Nehemías | Subido al repo (backend + frontend); sin publicar | — | — |
| Banco Boreal (`banco-m`) | **No publicado**: base Prisma propia (`banco_m`) | — | — |

## Cómo se identifica al comprador

- `cuit_cliente` en la venta (opcional; obligatorio con Billetera).
- O la **cuenta de quien paga** (`cuenta_origen` por id, CBU o alias): su titular es el comprador, como en un débito real.
- Sin comprador identificado: consumidor final → Factura B (si el comercio es RI) y sin percepción.

## Verificación de punta a punta

`backend/scripts/e2e-integracion.js` crea un comercio de prueba y recorre: alta en el CORE → inscripción ARCA y punto de venta → IIBB y agente → habilitación municipal → cuenta bancaria → activación del TPV → venta con impuestos → venta con Billetera → liquidación y pago de la tasa municipal.

```bash
cd backend
API=http://localhost:3010 node scripts/e2e-integracion.js   # contra npm run dev:memoria
node scripts/e2e-integracion.js                              # contra producción (deja datos de prueba "QA Integración")
```

Resultado 2026-10-29: **20/20 en local y 20/20 en producción.**

## Pendientes

1. ARBA Tomi: pasar su padrón de sujetos y su flujo de revisión a `/arba` del backend común (hoy usa SQLite temporal).
2. ARBA: definir cuál de las tres apps (Tomi, Lucas, Nehemías) es la oficial; publicar o archivar ARBA Nehemías.
3. Banco Boreal (`banco-m`): operar sobre `banco.*` antes de publicarlo, para no tener dos libros de saldos.
4. Seguridad transversal: hoy solo el CORE exige sesión; ver [PLAN-MIGRACION.md](PLAN-MIGRACION.md), etapa 4.

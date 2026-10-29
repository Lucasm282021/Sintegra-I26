# Pruebas de integración

**Fecha:** 2026-10-29 · Todas corren sobre **PGlite** (Postgres en memoria) con las mismas migraciones y el mismo seed que Supabase. **No tocan la base real.**

```bash
cd backend
npm test             # suite completa: 28 pruebas, 28 pasan (2026-10-29)
npm run dev:memoria  # backend local en memoria en http://localhost:3010 para probar las pantallas
```

## Archivos

| Archivo | Qué cubre |
|---|---|
| `test/core.test.js` | CORE de comercios: los 14 casos del prompt maestro, la importación y el recorrido completo |
| `test/integracion.test.js` | Padrón, Billetera, Banco, venta TPV, Municipio, ARCA (incluye la migración del CORE sobre el seed) |
| `test/integracion-sinteticos.test.js` | Cinco sujetos sintéticos aislados: QR, punto de venta, checkout, webhooks HMAC |

## Casos del prompt maestro → prueba

| # | Caso | Prueba en `core.test.js` | Qué se comprueba |
|---|---|---|---|
| 1 | Alta de comercio nuevo | `1. alta de comercio nuevo…` | `201`, identidad `declarado`, cada sistema con su estado y origen `sandbox`, evento `commerce.created` |
| 2 | CUIT inválido | `2. CUIT inválido` | DV incorrecto y longitud incorrecta → `400`; `/core/cuit/validar` |
| 3 | Comercio existente | `3. comercio existente…` | Otro usuario → `409` “solicitar acceso”; también con un comercio importado |
| 4 | Solicitud de acceso | `4. solicitud de acceso…` | `202` pendiente, `403` hasta aprobar, aprobación del titular, el operador no administra |
| 5 | Fallo de ARCA | `5. fallo de la consulta a ARCA` | ARCA `no_disponible` con el error; ARBA no cambia |
| 6 | ARBA no aplicable | `6. ARBA no aplicable…` | Sin evidencia → `400`; con evidencia → `no_aplicable`, origen `manual` |
| 7 | Municipio pendiente | `7, 13, 14…` | Trámite pendiente → `en_tramite`; el TPV se activa con advertencia; habilitación suspendida → bloquea |
| 8 | Cuenta bancaria no verificada | `8. cuenta bancaria…` | Sin CUIT en el padrón fiscal Banco no abre cuenta: `409`, banco `pendiente` |
| 9 | Activación parcial del TPV | `9. activación parcial…` | `409` con `faltantes` (ARCA y Banco); TPV `pendiente` |
| 10 | Reintento de alta | `10. reintento de alta…` | Mismo titular → `200` con el mismo `commerce_id`; una sola fila |
| 11 | Acceso a otro comercio | `11. un usuario no accede…` | `403` ajeno, `401` sin sesión o con token falso |
| 12 | Caída de un módulo | `12. la caída de un módulo…` | Banco caído durante el alta: el comercio se registra igual; banco `no_disponible` |
| 13 | Actualización sin pisar otra autoridad | `7, 13, 14…` | Razón social con ARCA verificado → `409`; CUIT → `400`; nombre de fantasía → `200` |
| 14 | Varias sucursales y cajas | `7, 13, 14…` | Dos sucursales con estado municipal propio; dos terminales TPV |

Extras:

- **Importación:** los comercios que ya operaban pasan al CORE; los CUIT demo con DV inválido quedan `observado`.
- **Recorrido completo:** ARCA inscribe el CUIT y da de alta el punto de venta, ARBA lo inscribe en IIBB, Municipio recibe y aprueba el trámite (sin pisar el padrón), Banco abre la cuenta y el TPV se activa sin advertencias. Se emiten los seis eventos de dominio.

## Prueba manual en el navegador (2026-10-29)

Con `npm run dev:memoria` y el portal servido en local: ingreso con el usuario demo, alta de un comercio nuevo en 3 pasos, botones de trámite simulado de cada organismo y activación del TPV. Resultado: los seis sistemas en verde. Vista móvil a 375 px sin desborde horizontal.

## Pendiente

- Pruebas E2E automatizadas del asistente web (hoy es prueba manual).
- Pruebas de las apps de alumnos contra el CORE cuando migren a `commerce_id` (etapa 3 del [plan de migración](PLAN-MIGRACION.md)).

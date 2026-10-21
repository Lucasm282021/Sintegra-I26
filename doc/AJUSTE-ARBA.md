# Ajuste de contrato — ARBA

## Estado actual

La implementación de referencia recomendada es `arba-tomi`: API Express/SQLite en el puerto 3003, frontend React/Vite con adaptador `arbaApi.js` y modo Demo. Hay otras carpetas ARBA alternativas (Lucas y Nehemias); el ecosistema debe escoger una para evitar tres padrones divergentes.

Rutas actuales: `GET /health`; `GET /arba/padron?page&limit`; `GET /arba/padron/:cuit`; administración `GET/POST /arba/comercios`, `PUT/DELETE /arba/comercios/:cuit`; `POST /arba/percepciones`; `GET /arba/percepciones/:cuit`.

La alícuota actual es `REAL` como fracción decimal. La percepción es única por `id_venta`: crea 201, repetición equivalente 200, conflicto 409. El esquema `padron` combina razón social, actividad, tasa, estado y toggles de aplicaciones.

## Ajuste a la API unificada

- Migrar a `/api/v1/arba/...`, conservando el proxy/rutas viejas durante la transición.
- Separar perfil `comercios` de inscripción y condición fiscal IIBB. ARBA no es fuente de la facturación ARCA.
- Exponer consulta de inscripción/tasa con jurisdicción, actividad codificada, vigencia y fuente; no devolver una tasa sin fecha de aplicación.
- Cambiar solicitud de percepción a `sale_id` (alias transitorio de `id_venta`), `commerce_id`/CUIT y `base_amount_minor`, moneda. La API deriva la tasa vigente y retorna `rate`, base, importe percibido y referencia.
- Exigir `Idempotency-Key` (o `sale_id` único durante compatibilidad); 201 primera creación, 200 repetición igual y 409 contenido distinto.
- Mantener el cálculo en servidor. El cálculo en React/demo es solo estimativo.

### Esquema objetivo orientativo

```json
{
  "sale_id": "VENTA-123",
  "cuit": "30712345678",
  "base_amount_minor": 1020000,
  "currency": "ARS"
}
```

Éxito: `{ "data": { "sale_id": "VENTA-123", "rate": 0.03, "base_amount_minor": 1020000, "tax_amount_minor": 30600, "currency": "ARS", "status": "calculated" } }`.

## Persistencia y migración

Mover `padron` a `comercios` más `inscripciones_iibb`/`alicuotas`; mover `percepciones` con llave única por venta, monto entero en unidad menor, versión de tasa y `created_at`. Mantener unique CUIT y preservar `id_venta` como `sale_id`. No usar SQLite de ARBA como base aparte después del corte.

## Criterios de aceptación del ajuste

- Las tres implementaciones ARBA no se ejecutan como dueñas simultáneas del mismo padrón.
- El formulario administrativo no marca una inscripción oficial solo por guardar un registro.
- Un reintento no duplica la percepción; los clientes Demo/API mantienen respuestas distinguibles.
- La respuesta de ARBA es trazable al `sale_id` y a una tasa versionada.

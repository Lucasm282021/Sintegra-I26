# Backend unificado — Sintegra I26

Un solo backend para todo el ecosistema, con un módulo por sistema y una base PostgreSQL en Supabase. El diseño, las reglas para compartir datos y cómo aplicarlo están en [consolidacion/BACKEND-Y-BASE-DE-DATOS.md](../consolidacion/BACKEND-Y-BASE-DE-DATOS.md).

- `supabase/migrations/` — esquema de la base.
- `supabase/seed.sql` — datos de prueba ficticios.

## Estado (2026-10-27): publicado y conectado

<https://sintegra-backend.vercel.app> — Express como función de Vercel, base en Supabase (`DATABASE_URL` = pooler de transacciones, puerto 6543, cargada en Vercel).

| Módulo | Endpoints | Quién lo usa |
|---|---|---|
| Padrón | `GET /padron/contribuyentes/{cuit}` (ficha con datos de todos los sistemas) | Todos |
| Banco | `GET /banco/cuentas[?cuit]`, `/cuentas/{id}`, `/cuentas/{id}/saldo`, `/cuentas/{id}/movimientos`, `POST /banco/pagos` | TPV David (cobro de ventas), Billetera (cargas) |
| Billetera | contrato de Lucas M: `/billetera/auth/login`, `/auth/registro`, `/cuentas`, `/cargas`, `/pagos`, `/qr/pagos`, `/qr/{cuit}`, `/demo/clientes` | Billetera (por rewrite de Vercel) |
| ARBA | `GET /arba/padron/{cuit}`, `POST /arba/percepciones`, `GET /arba/percepciones/{cuit}` | TPV David |
| ARCA | `GET /arca/contribuyentes/{cuit}`, `POST /arca/comprobantes`, `GET /arca/comprobantes[?cuit]` | TPV David |

Circuitos que ya pasan por la base:

- **Venta del TPV de David:** el comercio cobra en `banco.movimientos` (paga la cuenta `cuenta-mostrador` si no se informa otra), ARBA registra la percepción y ARCA emite el comprobante con número correlativo y CAE ficticio. Todo con `id_venta` idempotente.
- **Carga de la Billetera:** si la billetera tiene cuenta bancaria vinculada, la plata sale de esa cuenta y entra en la custodia `cuenta-billetera`.
- **Pagos y QR entre billeteras:** débito y crédito en la misma transacción.

### Uso local

```bash
npm install
npm test          # prueba todo contra una base en memoria (PGlite), no toca Supabase
npm run migrar    # aplica en Supabase las migraciones nuevas
npm start         # http://localhost:3010
```

`npm run migrar` y `npm start` leen la conexión de `.env.supabase.local` (no se sube a git; es el `.env.local` que genera la integración Vercel–Supabase).

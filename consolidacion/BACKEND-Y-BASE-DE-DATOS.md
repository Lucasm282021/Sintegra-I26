# Backend unificado y base de datos

**Estado:** base de datos diseñada y probada; backend pendiente. Decidido el 26/10/2026.

## Decisiones

| Tema | Decisión |
|---|---|
| Hosting | Backend como funciones en **Vercel**; base **PostgreSQL en Supabase** |
| Contrato | El de la [guía fundacional](https://github.com/Lucasm282021/Ecosistema-Fintech-simulado/blob/main/docs/guia-fundacional-equipos.html): rutas `/tpv`, `/banco`, `/billetera`, `/arba`, `/arca`, `/municipio`; recurso directo; errores `{"error":"mensaje"}`; CUIT string de 11 dígitos; `id_venta` como clave de idempotencia |
| Arquitectura | **Un solo backend con un módulo por sistema** y una sola base |

Como el backend usa las mismas rutas de la guía, cada frontend se conecta cambiando solo su variable de URL de API (por ejemplo `VITE_API_BASE_URL`).

## Cómo se separan y comparten los datos

Cada sistema tiene su **esquema** de Postgres y solo escribe en el suyo. Lo compartido vive en el esquema `padron`.

| Esquema | Dueño | Contiene |
|---|---|---|
| `padron` | ARCA | `contribuyentes` por CUIT, que leen todos, y la vista `ficha_contribuyente` |
| `municipio` | Municipio | `habilitaciones`, `tasas` por período |
| `arba` | ARBA | `inscripciones` (actividad y alícuota), `percepciones` por venta |
| `arca` | ARCA | `puntos_venta` (numeración correlativa), `comprobantes` con CAE simulado |
| `banco` | Banco | `cuentas`, `movimientos` (ventas, cargas de billetera y transferencias) |
| `billetera` | Billetera | `cuentas` asociadas a una cuenta del banco, `movimientos`, `usuarios` (ingreso con CUIT y contraseña) |
| `tpv` | TPV | `terminales`, `productos`, `ventas`, `venta_items` |

Reglas:

- **Para saber algo de otro sistema** se usa el padrón o la vista `padron.ficha_contribuyente`, que junta por CUIT los datos de ARBA, Municipio, Banco y Billetera. No se leen tablas internas de otro esquema.
- **Los TPV son independientes.** David y Sebastián son dos terminales (`tpv.terminales`). Cada producto y cada venta pertenece a una terminal, y ninguna ve los datos de la otra.
- **Billetera y Banco.** Una billetera puede tener `banco_cuenta_id`. Una carga fondeada desde el banco guarda el movimiento bancario que la respalda (`banco_movimiento_id`). Mientras el banco no esté operativo, ese campo queda vacío y las cargas son locales.
- **Referencias del TPV.** La venta guarda los IDs de percepción, pago y comprobante que devolvió cada sistema, sin claves foráneas hacia otros esquemas.

La base impide por sí misma: CUIT mal formados, saldos negativos, dos tasas del mismo período, repetir una percepción, comprobante o movimiento con el mismo `id_venta`/`id_operacion`, un total de comprobante distinto de subtotal + percepción, y pagar tasas de un comercio no habilitado.

## Archivos

- `backend/supabase/migrations/20261026000001_esquema_inicial.sql` — esquemas, tablas, vista y seguridad.
- `backend/supabase/migrations/20261026000002_usuarios_billetera.sql` — usuarios de la billetera, con la contraseña guardada como hash bcrypt (`pgcrypto`, esquema `extensions` de Supabase).
- `backend/supabase/seed.sql` — datos ficticios: contribuyentes, habilitaciones, tasas, cuentas, billeteras, usuarios demo y el catálogo de cada TPV.

## Usuarios demo de la billetera

| CUIT | Contraseña | Billetera | Cuenta de banco asociada |
|---|---|---|---|
| `20268326074` | `1234` | $50.000 | `cuenta-demo` ($200.000) |
| `30000000001` | `demo1234` | $45.000 | — |
| `30000000002` | `demo1234` | $18.000 | — |
| `30000000003` | `demo1234` | $7.500 | — |

El backend valida el ingreso así:

```sql
select c.*
from billetera.usuarios u
join billetera.cuentas c on c.id = u.cuenta_id
where c.cuit = $1
  and u.password_hash = extensions.crypt($2, u.password_hash);
```

La app actual de Lucas-M exige contraseñas de 8 caracteres o más; el usuario `20268326074` / `1234` solo funciona contra el backend nuevo.

Están en el formato de la CLI de Supabase, así que también se pueden aplicar con `supabase db push`.

## Aplicar en Supabase

1. En el proyecto de Supabase, abrir **SQL Editor**.
2. Pegar y ejecutar las dos migraciones, en orden.
3. Pegar y ejecutar `seed.sql`.
4. Comprobar con `select * from padron.ficha_contribuyente;`.

Si se creó la tabla de ejemplo `notes` del tutorial de Supabase, se puede borrar: `drop table notes;`.

### Seguridad

Todas las tablas tienen RLS activado y ninguna política. Eso bloquea la API pública de Supabase (claves `anon` y `authenticated`): los frontends **no** se conectan a Supabase directamente. Solo el backend accede, con la cadena de conexión de Postgres.

## Conectar el backend

- En Supabase: **Project Settings → Database → Connection string**.
- Para el backend en Vercel usar el **Transaction pooler** (puerto `6543`), pensado para funciones serverless.
- Para migraciones desde una máquina usar la conexión directa o el **Session pooler** (puerto `5432`).
- Guardar la cadena como variable de entorno `DATABASE_URL` en el proyecto de Vercel. Nunca commitearla.

## Próximos pasos

1. Crear las tablas en Supabase con la migración y el seed.
2. Armar el esqueleto del backend en `backend/` (Express + TypeScript en Vercel): conexión a Postgres, `GET /health` con chequeo de la base y manejo de errores común.
3. Implementar un módulo a la vez, empezando por los que no dependen de otros: Municipio, ARBA, Banco y Billetera; después ARCA, y al final el TPV, que coordina a todos.
4. Apuntar cada frontend al backend nuevo y retirar sus datos de demo.

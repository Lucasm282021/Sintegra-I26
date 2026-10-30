# Banco M: cuentas, cheques, eCheq y homebanking

## Cuentas
- Solo se abre una cuenta a un CUIT inscripto en ARCA. Al escribir el CUIT, el panel trae la ficha del padrón general.
- Tipos: **caja de ahorro** (`cuenta-<cuit>`, alias `<cuit>.banco.m`) y **cuenta corriente** (`cc-<cuit>`, alias `<cuit>.cc.banco.m`). Una de cada tipo por CUIT.
- Al abrir la primera cuenta se crea el acceso al homebanking con la clave `demo1234`.

## Cheques (cuenta corriente)
| Paso | Ruta | Regla |
|---|---|---|
| Emitir | `POST /banco/cheques` `{cuenta_librador, beneficiario, monto, fecha_pago}` | Solo desde una cuenta corriente |
| Depositar | `POST /banco/cheques/:numero/depositar` `{cuenta}` | En otra cuenta (alias, CBU o id) |
| Clearing | `POST /banco/cheques/:numero/acreditar` | Fecha de pago futura: 409. Sin fondos: **rechazado** |
| Anular | `POST /banco/cheques/:numero/anular` | Solo si todavía no se depositó |

## eCheq (desde la billetera o el homebanking)
- `GET /billetera/echeqs?cuit=`: dice si está disponible (hace falta cuenta corriente) y lista emitidos y recibidos.
- `POST /billetera/echeqs` `{cuit_origen, destino (CUIT o alias), monto, fecha_pago}`: se libra a un CUIT del padrón.
- `POST /billetera/echeqs/:numero/cobrar` `{cuit}`: solo el beneficiario; se deposita en su caja de ahorro y se acredita si llegó la fecha y hay fondos.
- `POST /billetera/echeqs/:numero/anular` `{cuit}`: solo quien lo emitió, antes de cobrarse.

## Homebanking
- Página `public/homebanking/` (en el portal: «Homebanking · Banco M»).
- `POST /banco/homebanking/login` `{cuit, clave}` → saldos, últimos movimientos, cheques y billetera.
- `POST /banco/homebanking/clave` para cambiar la clave. Simulación: no hay sesiones con token.

# Compras a proveedores y cuenta corriente (TPV)

Un proveedor es una empresa inscripta en ARCA. Se inscribe en ARCA (Mateo) y después se vincula al comercio desde el TPV (sección «Compras» de Brisa).

| Acción | Ruta |
|---|---|
| Alta de proveedor | `POST /tpv/proveedores` `{comercio_cuit, proveedor_cuit, rubro, plazo_dias}` |
| Proveedores con saldo | `GET /tpv/proveedores?comercio_cuit=` |
| Factura de compra | `POST /tpv/compras` `{id_compra, comercio_cuit, proveedor_cuit, numero_factura, items:[{producto_id, cantidad, costo_unitario}]}` |
| Pago | `POST /tpv/proveedores/:cuit/pagos` `{id_pago, comercio_cuit, medio: transferencia\|cheque\|efectivo, monto, fecha_pago?}` |
| Cuenta corriente | `GET /tpv/proveedores/:cuit/cuenta-corriente?comercio_cuit=` |

Reglas:
- Tipo de factura según condiciones: proveedor RI → comercio RI = **Factura A** (IVA discriminado, crédito fiscal); RI → otro = B; monotributista = C.
- La compra suma stock, guarda el nuevo costo y, si el producto tiene % de ganancia, recalcula el precio de venta.
- Vencimiento = fecha + plazo del proveedor.
- Transferencia: de la cuenta del comercio a la del proveedor. Cheque: se libra contra la cuenta corriente del comercio. No se puede pagar más que la deuda.
- Idempotente por `id_compra` e `id_pago`.

## Precio de venta desde el costo
`precio = costo × (1 + ganancia) × (1 + IVA)` para Responsable Inscripto; el monotributista no suma IVA.
Ejemplo: costo $1.000, 30 %, IVA 21 % → $1.573.

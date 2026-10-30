// Proveedores, compras y cuenta corriente de proveedores del TPV.
// El proveedor es una empresa inscripta en ARCA (padrón fiscal). La compra suma
// stock, actualiza el costo (y el precio si el producto tiene margen) y genera
// deuda; los pagos (transferencia, cheque o efectivo) la cancelan.
const express = require('express');
const { query, tx } = require('../db');
const { falla, cuitValido, idValido, montoValido, num, ruta } = require('../http');
const { transferir, cuentaPorCuit, emitirCheque } = require('./banco');
const { tipoComprobante, precioDesdeCosto, r2, TASAS_IVA } = require('./impuestos');

const router = express.Router();
const fecha = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);

async function saldoProveedor(c, comercio, proveedor) {
  const r = (await c.query(`select
      coalesce((select sum(total) from tpv.compras where comercio_cuit=$1 and proveedor_cuit=$2), 0) as debe,
      coalesce((select sum(monto) from tpv.pagos_proveedor where comercio_cuit=$1 and proveedor_cuit=$2), 0) as haber`,
    [comercio, proveedor])).rows[0];
  return { compras: num(r.debe), pagos: num(r.haber), saldo: r2(num(r.debe) - num(r.haber)) };
}

// ---------- Proveedores ----------
router.get('/proveedores', ruta(async (req) => {
  const comercio = req.query.comercio_cuit;
  if (!cuitValido(comercio)) throw falla(400, 'comercio_cuit es obligatorio');
  const { rows } = await query(`select p.*, c.razon_social, c.condicion_iva
    from tpv.proveedores p join padron.contribuyentes c on c.cuit = p.proveedor_cuit
    where p.comercio_cuit = $1 order by c.razon_social`, [comercio]);
  const out = [];
  for (const p of rows) out.push({ proveedor_cuit: p.proveedor_cuit, razon_social: p.razon_social, condicion_iva: p.condicion_iva,
    rubro: p.rubro, plazo_dias: p.plazo_dias, activo: p.activo, ...(await saldoProveedor({ query }, comercio, p.proveedor_cuit)) });
  return { body: out };
}));

router.post('/proveedores', ruta(async (req) => {
  const b = req.body || {};
  if (!cuitValido(b.comercio_cuit) || !cuitValido(b.proveedor_cuit)) throw falla(400, 'comercio_cuit y proveedor_cuit (11 dígitos) son obligatorios');
  if (b.comercio_cuit === b.proveedor_cuit) throw falla(400, 'el comercio no puede ser su propio proveedor');
  const plazo = Number(b.plazo_dias ?? 30);
  if (!Number.isInteger(plazo) || plazo < 0 || plazo > 365) throw falla(400, 'plazo_dias debe ser un entero entre 0 y 365');
  const prov = (await query('select razon_social from padron.contribuyentes where cuit = $1', [b.proveedor_cuit])).rows[0];
  if (!prov) throw falla(409, 'el proveedor tiene que estar inscripto en ARCA (padrón fiscal)');
  if (!(await query('select 1 from padron.contribuyentes where cuit = $1', [b.comercio_cuit])).rows[0]) throw falla(404, 'comercio no encontrado');
  await query(`insert into tpv.proveedores (comercio_cuit, proveedor_cuit, rubro, plazo_dias) values ($1,$2,$3,$4)
    on conflict (comercio_cuit, proveedor_cuit) do update set rubro = excluded.rubro, plazo_dias = excluded.plazo_dias, activo = true`,
    [b.comercio_cuit, b.proveedor_cuit, String(b.rubro || '').trim() || null, plazo]);
  return { status: 201, body: { proveedor_cuit: b.proveedor_cuit, razon_social: prov.razon_social, plazo_dias: plazo } };
}));

// ---------- Compras ----------
const filaCompra = (k) => ({ id: k.id, id_compra: k.id_compra, comercio_cuit: k.comercio_cuit, proveedor_cuit: k.proveedor_cuit,
  tipo_comprobante: k.tipo_comprobante, numero_factura: k.numero_factura, fecha: fecha(k.fecha), vencimiento: fecha(k.vencimiento),
  neto: num(k.neto), iva: num(k.iva), total: num(k.total) });

router.get('/compras', ruta(async (req) => {
  if (!cuitValido(req.query.comercio_cuit)) throw falla(400, 'comercio_cuit es obligatorio');
  const { rows } = await query(`select k.*, c.razon_social from tpv.compras k join padron.contribuyentes c on c.cuit = k.proveedor_cuit
    where k.comercio_cuit = $1 and ($2::text is null or k.proveedor_cuit = $2) order by k.fecha desc, k.creado_en desc limit 200`,
    [req.query.comercio_cuit, req.query.proveedor_cuit || null]);
  return { body: rows.map((k) => ({ ...filaCompra(k), razon_social: k.razon_social })) };
}));

// Registra la factura de compra. En una Factura A el IVA viene discriminado
// (crédito fiscal); en B o C el costo informado ya es el total.
router.post('/compras', ruta(async (req) => {
  const b = req.body || {};
  if (!idValido(b.id_compra)) throw falla(400, 'id_compra es obligatorio');
  if (!cuitValido(b.comercio_cuit) || !cuitValido(b.proveedor_cuit)) throw falla(400, 'comercio_cuit y proveedor_cuit son obligatorios');
  if (!String(b.numero_factura || '').trim()) throw falla(400, 'numero_factura es obligatorio');
  if (!Array.isArray(b.items) || !b.items.length) throw falla(400, 'la compra necesita al menos un producto');
  for (const i of b.items) {
    if (!idValido(i.producto_id) || !Number.isInteger(i.cantidad) || i.cantidad <= 0 || !montoValido(Number(i.costo_unitario))) {
      throw falla(400, 'cada item necesita producto_id, cantidad entera y costo_unitario positivo');
    }
  }
  return tx(async (c) => {
    const previa = (await c.query('select * from tpv.compras where id_compra = $1', [b.id_compra])).rows[0];
    if (previa) return { status: 200, body: filaCompra(previa) };
    const vinculo = (await c.query('select * from tpv.proveedores where comercio_cuit=$1 and proveedor_cuit=$2 and activo', [b.comercio_cuit, b.proveedor_cuit])).rows[0];
    if (!vinculo) throw falla(409, 'primero da de alta al proveedor para este comercio');
    const comercio = (await c.query('select condicion_iva from padron.contribuyentes where cuit=$1', [b.comercio_cuit])).rows[0];
    const proveedor = (await c.query('select condicion_iva from padron.contribuyentes where cuit=$1', [b.proveedor_cuit])).rows[0];
    const tipo = tipoComprobante(proveedor.condicion_iva, comercio.condicion_iva);
    let neto = 0; let iva = 0;
    const lineas = [];
    for (const i of b.items) {
      const p = (await c.query('select * from tpv.productos where id=$1 and comercio_cuit=$2 for update', [i.producto_id, b.comercio_cuit])).rows[0];
      if (!p) throw falla(404, `producto ${i.producto_id} no pertenece a este comercio`);
      const subtotal = r2(Number(i.costo_unitario) * i.cantidad);
      neto = r2(neto + subtotal);
      if (tipo === 'FACTURA_A' && p.iva !== 'exento') iva = r2(iva + subtotal * (TASAS_IVA[p.iva] ?? 0.21));
      lineas.push({ p, ...i });
    }
    const total = r2(neto + iva);
    const k = (await c.query(`insert into tpv.compras (id_compra, comercio_cuit, proveedor_cuit, tipo_comprobante, numero_factura, fecha, vencimiento, neto, iva, total)
      values ($1,$2,$3,$4,$5, coalesce($6::date, current_date), coalesce($6::date, current_date) + $7::int, $8,$9,$10) returning *`,
      [b.id_compra, b.comercio_cuit, b.proveedor_cuit, tipo, String(b.numero_factura).trim(), b.fecha || null, vinculo.plazo_dias, neto, iva, total])).rows[0];
    for (const [n, l] of lineas.entries()) {
      await c.query('insert into tpv.compra_items (compra_id, linea, producto_id, cantidad, costo_unitario) values ($1,$2,$3,$4,$5)',
        [k.id, n + 1, l.p.id, l.cantidad, Number(l.costo_unitario)]);
      // Suma stock, actualiza el costo y, si tiene margen, el precio de venta.
      const precio = l.p.margen !== null ? precioDesdeCosto(Number(l.costo_unitario), num(l.p.margen), l.p.iva, comercio.condicion_iva) : num(l.p.precio);
      await c.query('update tpv.productos set stock = coalesce(stock, 0) + $2, costo = $3, precio = $4 where id = $1',
        [l.p.id, l.cantidad, Number(l.costo_unitario), precio]);
    }
    return { status: 201, body: filaCompra(k) };
  });
}));

// ---------- Cuenta corriente y pagos a proveedores ----------
router.get('/proveedores/:cuit/cuenta-corriente', ruta(async (req) => {
  const comercio = req.query.comercio_cuit;
  if (!cuitValido(comercio) || !cuitValido(req.params.cuit)) throw falla(400, 'comercio_cuit y CUIT del proveedor son obligatorios');
  const { rows } = await query(`
    select 'compra' as tipo, fecha::text as fecha, creado_en, tipo_comprobante || ' ' || numero_factura as detalle, total as debe, 0 as haber
      from tpv.compras where comercio_cuit=$1 and proveedor_cuit=$2
    union all
    select 'pago', creado_en::date::text, creado_en, 'Pago por ' || medio, 0, monto
      from tpv.pagos_proveedor where comercio_cuit=$1 and proveedor_cuit=$2
    order by creado_en`, [comercio, req.params.cuit]);
  let saldo = 0;
  const movimientos = rows.map((m) => { saldo = r2(saldo + num(m.debe) - num(m.haber));
    return { tipo: m.tipo, fecha: m.fecha, detalle: m.detalle, debe: num(m.debe), haber: num(m.haber), saldo }; });
  return { body: { proveedor_cuit: req.params.cuit, comercio_cuit: comercio, saldo, movimientos } };
}));

router.post('/proveedores/:cuit/pagos', ruta(async (req) => {
  const b = req.body || {};
  const proveedor = req.params.cuit;
  if (!idValido(b.id_pago)) throw falla(400, 'id_pago es obligatorio');
  if (!cuitValido(b.comercio_cuit) || !cuitValido(proveedor)) throw falla(400, 'comercio_cuit y CUIT del proveedor son obligatorios');
  if (!['transferencia', 'cheque', 'efectivo'].includes(b.medio)) throw falla(400, 'medio debe ser transferencia, cheque o efectivo');
  if (!montoValido(b.monto)) throw falla(400, 'monto inválido');
  return tx(async (c) => {
    const previo = (await c.query('select * from tpv.pagos_proveedor where id_pago = $1', [b.id_pago])).rows[0];
    if (previo) return { status: 200, body: { id_pago: previo.id_pago, monto: num(previo.monto), medio: previo.medio } };
    if (!(await c.query('select 1 from tpv.proveedores where comercio_cuit=$1 and proveedor_cuit=$2', [b.comercio_cuit, proveedor])).rows[0]) {
      throw falla(404, 'el proveedor no está dado de alta para este comercio');
    }
    const { saldo } = await saldoProveedor(c, b.comercio_cuit, proveedor);
    if (b.monto > saldo + 0.001) throw falla(409, `el pago supera la deuda con el proveedor ($${saldo})`);
    let bancoMov = null; let chequeId = null;
    if (b.medio === 'transferencia') {
      const origen = await cuentaPorCuit(c, b.comercio_cuit);
      const destino = await cuentaPorCuit(c, proveedor);
      if (!origen) throw falla(409, 'el comercio no tiene cuenta bancaria');
      if (!destino) throw falla(409, 'el proveedor no tiene cuenta bancaria: pagá con cheque o efectivo');
      bancoMov = (await transferir(c, { id_operacion: `proveedor:${b.id_pago}`, tipo: 'transferencia', origen: origen.id, destino: destino.id,
        monto: b.monto, payload: { pago_proveedor: b.id_pago } })).movimiento.id;
    } else if (b.medio === 'cheque') {
      const razon = (await c.query('select razon_social from padron.contribuyentes where cuit=$1', [proveedor])).rows[0].razon_social;
      chequeId = (await emitirCheque(c, { cuenta_librador: `cc-${b.comercio_cuit}`, beneficiario: razon, monto: b.monto, fecha_pago: b.fecha_pago })).id;
    }
    await c.query(`insert into tpv.pagos_proveedor (id_pago, comercio_cuit, proveedor_cuit, medio, monto, banco_movimiento_id, cheque_id)
      values ($1,$2,$3,$4,$5,$6,$7)`, [b.id_pago, b.comercio_cuit, proveedor, b.medio, b.monto, bancoMov, chequeId]);
    const cheque = chequeId ? (await c.query('select numero from banco.cheques where id=$1', [chequeId])).rows[0].numero : null;
    return { status: 201, body: { id_pago: b.id_pago, medio: b.medio, monto: b.monto, cheque, banco_movimiento_id: bancoMov,
      saldo: r2(saldo - b.monto) } };
  });
}));

module.exports = router;

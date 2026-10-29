// Banco: cuentas, saldos y transferencias. Todo movimiento de dinero entre
// sistemas (ventas del TPV, cargas de la Billetera) queda en banco.movimientos.
const express = require('express');
const { query, tx } = require('../db');
const { falla, cuitValido, idValido, montoValido, num, hash, ruta } = require('../http');

const router = express.Router();

const filaCuenta = (c) => ({ id: c.id, cuit: c.cuit, titular: c.titular, cbu: c.cbu, alias: c.alias, saldo: num(c.saldo) });
const filaMovimiento = (m) => ({
  id: m.id, id_operacion: m.id_operacion, tipo: m.tipo, cuenta_origen: m.cuenta_origen,
  cuenta_destino: m.cuenta_destino, monto: num(m.monto), estado: m.estado, fecha: new Date(m.creado_en).toISOString(),
});

// Mueve dinero entre dos cuentas dentro de la transacción `c`. Idempotente por id_operacion.
async function transferir(c, { id_operacion, tipo, origen, destino, monto, payload }) {
  const payload_hash = hash({ tipo, origen, destino, monto, ...payload });
  const previo = (await c.query('select * from banco.movimientos where id_operacion = $1', [id_operacion])).rows[0];
  if (previo) {
    if (previo.payload_hash !== payload_hash) throw falla(409, 'id_venta ya fue utilizada con otros datos');
    return { movimiento: previo, repetido: true };
  }
  if (origen === destino) throw falla(400, 'la cuenta de origen y destino no pueden ser la misma');
  const cuentas = (await c.query('select * from banco.cuentas where id = any($1) order by id for update', [[origen, destino]])).rows;
  const o = cuentas.find((x) => x.id === origen);
  const d = cuentas.find((x) => x.id === destino);
  if (!o) throw falla(404, `no existe la cuenta bancaria ${origen}`);
  if (!d) throw falla(404, `no existe la cuenta bancaria ${destino}`);
  if (num(o.saldo) < monto) throw falla(402, 'saldo insuficiente en la cuenta bancaria');
  await c.query('update banco.cuentas set saldo = saldo - $2 where id = $1', [origen, monto]);
  await c.query('update banco.cuentas set saldo = saldo + $2 where id = $1', [destino, monto]);
  const movimiento = (await c.query(
    `insert into banco.movimientos (id_operacion, tipo, cuenta_origen, cuenta_destino, monto, payload_hash)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [id_operacion, tipo, origen, destino, monto, payload_hash],
  )).rows[0];
  return { movimiento, repetido: false };
}

async function cuentaPorCuit(c, cuit) {
  return (await c.query('select * from banco.cuentas where cuit = $1 order by creado_en limit 1', [cuit])).rows[0];
}

router.get('/cuentas', ruta(async (req) => {
  const { cuit } = req.query;
  if (cuit !== undefined && !cuitValido(cuit)) throw falla(400, 'cuit debe tener 11 dígitos');
  const { rows } = cuit
    ? await query('select * from banco.cuentas where cuit = $1 order by id', [cuit])
    : await query('select * from banco.cuentas order by id');
  return { body: rows.map(filaCuenta) };
}));

// Vista consolidada del cliente: CUIT como clave funcional entre padrón,
// cuenta bancaria y billetera. Solo expone datos, nunca credenciales.
router.get('/clientes/:cuit', ruta(async (req) => {
  const cuit=req.params.cuit;
  if(!cuitValido(cuit)) throw falla(400,'CUIT debe tener 11 dígitos');
  const identidad=(await query('select cuit,razon_social,tipo_persona,condicion_iva,estado from padron.contribuyentes where cuit=$1',[cuit])).rows[0];
  if(!identidad) throw falla(404,'cliente no encontrado en el padrón');
  const cuentas=(await query('select * from banco.cuentas where cuit=$1 order by creado_en',[cuit])).rows.map(filaCuenta);
  const billetera=(await query('select * from billetera.cuentas where cuit=$1',[cuit])).rows[0];
  let movimientosBilletera=[];
  if(billetera) movimientosBilletera=(await query('select * from billetera.movimientos where cuenta_id=$1 order by creado_en desc limit 30',[billetera.id])).rows.map(m=>({
    id:m.id,tipo:m.tipo,monto:num(m.monto),contraparte:m.contraparte||m.contraparte_cuit||null,
    saldo_resultante:num(m.saldo_resultante),fecha:new Date(m.creado_en).toISOString(),
  }));
  return {body:{cliente:identidad,cuentas,billetera:billetera?{
    id:billetera.id,cuit:billetera.cuit,titular:billetera.titular,alias:billetera.alias,saldo:num(billetera.saldo),
    banco_cuenta_id:billetera.banco_cuenta_id, movimientos:movimientosBilletera,
  }:null}};
}));

router.get('/cuentas/:id', ruta(async (req) => {
  const c = (await query('select * from banco.cuentas where id = $1', [req.params.id])).rows[0];
  if (!c) throw falla(404, 'cuenta no encontrada');
  return { body: filaCuenta(c) };
}));

router.get('/cuentas/:id/saldo', ruta(async (req) => {
  const c = (await query('select id, saldo from banco.cuentas where id = $1', [req.params.id])).rows[0];
  if (!c) throw falla(404, 'cuenta no encontrada');
  return { body: { id: c.id, saldo: num(c.saldo) } };
}));

router.get('/cuentas/:id/movimientos', ruta(async (req) => {
  const { rows } = await query(
    `select * from banco.movimientos where cuenta_origen = $1 or cuenta_destino = $1
     order by creado_en desc limit 50`, [req.params.id]);
  return { body: rows.map(filaMovimiento) };
}));

// POST /banco/pagos — cobro de una venta. Acepta el formato de la guía
// (id_venta, cuit) y el del TPV de David (ventaId, cuit, medioPago).
// `cuit` es el comercio que cobra; paga `cuenta_origen` o, si no viene,
// la cuenta "mostrador" (consumidor final).
router.post('/pagos', ruta(async (req) => {
  const b = req.body || {};
  const id_venta = b.id_venta ?? b.ventaId;
  const monto = b.monto;
  if (!idValido(id_venta)) throw falla(400, 'id_venta es obligatorio');
  if (!cuitValido(b.cuit)) throw falla(400, 'cuit debe tener 11 dígitos, sin puntos ni guiones');
  if (!montoValido(monto)) throw falla(400, 'monto debe ser un número positivo de hasta dos decimales');
  return tx(async (c) => {
    const destino = b.cuenta_destino || (await cuentaPorCuit(c, b.cuit))?.id;
    if (!destino) throw falla(404, 'el comercio no tiene cuenta en el banco');
    const origen = b.cuenta_origen || 'cuenta-mostrador';
    const { movimiento, repetido } = await transferir(c, {
      id_operacion: `venta:${id_venta}`, tipo: 'venta', origen, destino, monto,
      payload: { medio_pago: b.medio_pago ?? b.medioPago ?? null },
    });
    return {
      status: repetido ? 200 : 201,
      body: {
        id: movimiento.id, id_venta, cuit: b.cuit, monto: num(movimiento.monto),
        cuenta_origen: movimiento.cuenta_origen, cuenta_destino: movimiento.cuenta_destino,
        estado: movimiento.estado, confirmadoEn: new Date(movimiento.creado_en).toISOString(),
      },
    };
  });
}));

module.exports = { router, transferir, cuentaPorCuit };

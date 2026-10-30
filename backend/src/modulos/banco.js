// Banco: cuentas, saldos y transferencias. Todo movimiento de dinero entre
// sistemas (ventas del TPV, cargas de la Billetera) queda en banco.movimientos.
const express = require('express');
const { query, tx } = require('../db');
const { falla, cuitValido, idValido, montoValido, num, hash, ruta } = require('../http');
const { registrarEvento, entregarEvento } = require('./webhooks');

const router = express.Router();

const CLAVE_DEMO = 'demo1234';
const filaCuenta = (c) => ({ id: c.id, cuit: c.cuit, titular: c.titular, cbu: c.cbu, alias: c.alias, saldo: num(c.saldo), tipo: c.tipo || 'caja_ahorro' });
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
  const billetera=(await query(`select w.*,bc.saldo as saldo_banco,bc.cbu from billetera.cuentas w
    left join banco.cuentas bc on bc.id=w.banco_cuenta_id where w.cuit=$1`,[cuit])).rows[0];
  let movimientosBilletera=[];
  if(billetera) movimientosBilletera=(await query('select * from billetera.movimientos where cuenta_id=$1 order by creado_en desc limit 30',[billetera.id])).rows.map(m=>({
    id:m.id,tipo:m.tipo,monto:num(m.monto),contraparte:m.contraparte||m.contraparte_cuit||null,
    saldo_resultante:num(m.saldo_resultante),fecha:new Date(m.creado_en).toISOString(),
  }));
  return {body:{cliente:identidad,cuentas,billetera:billetera?{
    id:billetera.id,cuit:billetera.cuit,titular:billetera.titular,alias:billetera.alias,
    saldo:num(billetera.saldo_banco ?? billetera.saldo),cbu:billetera.cbu||null,
    banco_cuenta_id:billetera.banco_cuenta_id, movimientos:movimientosBilletera,
  }:null}};
}));

// Banco M es el único módulo que provisiona billeteras; reutiliza la cuenta y
// el CBU ya asignados al cliente, y crea el acceso de la billetera.
router.post('/clientes/:cuit/billetera', ruta(async (req) => {
  const cuit = req.params.cuit;
  const { alias, contrasena } = req.body || {};
  if (!cuitValido(cuit)) throw falla(400, 'CUIT debe tener 11 dígitos');
  if (typeof alias !== 'string' || alias.trim().length < 3) throw falla(400, 'alias de billetera inválido');
  if (typeof contrasena !== 'string' || contrasena.length < 8) throw falla(400, 'la contraseña debe tener al menos 8 caracteres');
  return tx(async (c) => {
    const cliente = (await c.query('select cuit,razon_social from padron.contribuyentes where cuit=$1', [cuit])).rows[0];
    if (!cliente) throw falla(404, 'el cliente debe estar registrado en el padrón central');
    const cuenta = (await c.query('select id,cbu,saldo from banco.cuentas where cuit=$1 order by creado_en limit 1', [cuit])).rows[0];
    if (!cuenta) throw falla(409, 'primero abrí una cuenta bancaria para este CUIT');
    if ((await c.query('select 1 from billetera.cuentas where cuit=$1', [cuit])).rows[0]) throw falla(409, 'el cliente ya tiene una billetera');
    const billetera = (await c.query(`insert into billetera.cuentas(cuit,titular,alias,saldo,banco_cuenta_id)
      values($1,$2,$3,$4,$5) returning *`, [cuit,cliente.razon_social,alias.trim(),cuenta.saldo,cuenta.id])).rows[0];
    await c.query(`insert into billetera.usuarios(cuenta_id,password_hash)
      values($1,extensions.crypt($2,extensions.gen_salt('bf')))`, [billetera.id,contrasena]);
    return { status: 201, body: { ...filaCuenta({ ...billetera, saldo: cuenta.saldo }), cuit, titular: cliente.razon_social,
      alias: billetera.alias, saldo: num(cuenta.saldo), cbu: cuenta.cbu, banco_cuenta_id: cuenta.id } };
  });
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
  if (b.terminal_id !== undefined && !idValido(b.terminal_id)) throw falla(400, 'terminal_id inválido');
  const result = await tx(async (c) => {
    const destino = b.cuenta_destino || (await cuentaPorCuit(c, b.cuit))?.id;
    if (!destino) throw falla(404, 'el comercio no tiene cuenta en el banco');
    const origen = b.cuenta_origen || 'cuenta-mostrador';
    const { movimiento, repetido } = await transferir(c, {
      id_operacion: `venta:${id_venta}`, tipo: 'venta', origen, destino, monto,
      payload: { medio_pago: b.medio_pago ?? b.medioPago ?? null },
    });
    const webhookEventId = await registrarEvento(c, { terminal_id: b.terminal_id, id_venta,
      payload: { event_type: 'payment.confirmed', id_venta, terminal_id: b.terminal_id,
        cuit_comercio: b.cuit, monto: num(movimiento.monto), moneda: 'ARS', medio_pago: b.medio_pago ?? b.medioPago ?? 'banco',
        estado: 'confirmado', banco_movimiento_id: movimiento.id } });
    return {
      status: repetido ? 200 : 201,
      body: {
        id: movimiento.id, id_venta, cuit: b.cuit, monto: num(movimiento.monto),
        cuenta_origen: movimiento.cuenta_origen, cuenta_destino: movimiento.cuenta_destino,
        estado: movimiento.estado, confirmadoEn: new Date(movimiento.creado_en).toISOString(), _webhookEventId: webhookEventId,
      },
    };
  });
  if (result.body._webhookEventId) {
    result.body.webhook = await entregarEvento(result.body._webhookEventId);
    delete result.body._webhookEventId;
  }
  return result;
}));

// Apertura de cuenta (sandbox). Banco es el único que asigna CBU y alias. Si el
// CUIT ya tiene cuenta, la devuelve (idempotente). Exige el CUIT en el padrón.
async function abrirCuenta(c, { cuit, titular, tipo = 'caja_ahorro' }) {
  if (!['caja_ahorro', 'cuenta_corriente'].includes(tipo)) throw falla(400, 'tipo debe ser caja_ahorro o cuenta_corriente');
  const existente = (await c.query("select * from banco.cuentas where cuit = $1 and coalesce(tipo, 'caja_ahorro') = $2 order by creado_en limit 1", [cuit, tipo])).rows[0];
  if (existente) return { cuenta: existente, creada: false };
  const sujeto = (await c.query('select razon_social from padron.contribuyentes where cuit = $1', [cuit])).rows[0];
  if (!sujeto) throw falla(409, 'el CUIT debe figurar en el padrón fiscal (inscripto en ARCA) antes de abrir una cuenta');
  const cc = tipo === 'cuenta_corriente';
  const cuenta = (await c.query(
    `insert into banco.cuentas (id, cuit, titular, cbu, alias, saldo, tipo)
     values ($1, $2, $3, $4, $5, 0, $6) returning *`,
    [cc ? `cc-${cuit}` : `cuenta-${cuit}`, cuit, titular || sujeto.razon_social,
      `0000003100${cuit}${cc ? 1 : 0}`, cc ? `${cuit}.cc.banco.m` : `${cuit}.banco.m`, tipo],
  )).rows[0];
  await c.query(`insert into banco.homebanking (cuit, password_hash)
    values ($1, extensions.crypt($2, extensions.gen_salt('bf'))) on conflict (cuit) do nothing`, [cuit, CLAVE_DEMO]);
  return { cuenta, creada: true };
}

router.post('/cuentas', ruta(async (req) => {
  const { cuit, titular, tipo } = req.body || {};
  if (!cuitValido(cuit)) throw falla(400, 'cuit debe tener 11 dígitos, sin puntos ni guiones');
  const { cuenta, creada } = await tx((c) => abrirCuenta(c, { cuit, titular, tipo: tipo || 'caja_ahorro' }));
  return { status: creada ? 201 : 200, body: filaCuenta(cuenta) };
}));

// ---------- Operaciones del cliente (ventanilla y transferencias) ----------
// Depósito y extracción en efectivo usan la caja del banco como contraparte.
// Todas son idempotentes por id_operacion (el cliente la genera y la reenvía si reintenta).
const CAJA = 'cuenta-caja';
const opValida = (b) => {
  if (!idValido(b.id_operacion)) throw falla(400, 'id_operacion es obligatorio');
  if (!montoValido(b.monto)) throw falla(400, 'monto debe ser un número positivo de hasta dos decimales');
};
async function cuentaPorReferencia(c, ref) {
  const r = String(ref || '').trim();
  if (!r) return null;
  return (await c.query(
    'select * from banco.cuentas where id = $1 or cbu = $1 or lower(alias) = lower($1) limit 1', [r])).rows[0];
}
const respuestaOp = async (c, movimiento, cuentaId, repetido) => ({
  status: repetido ? 200 : 201,
  body: { movimiento: filaMovimiento(movimiento), cuenta: filaCuenta((await c.query('select * from banco.cuentas where id = $1', [cuentaId])).rows[0]), repetido },
});

router.post('/cuentas/:id/depositos', ruta(async (req) => {
  const b = req.body || {}; opValida(b);
  return tx(async (c) => {
    if (!(await cuentaPorReferencia(c, req.params.id))) throw falla(404, 'cuenta no encontrada');
    const { movimiento, repetido } = await transferir(c, { id_operacion: `deposito:${b.id_operacion}`, tipo: 'deposito',
      origen: CAJA, destino: req.params.id, monto: b.monto, payload: { concepto: b.concepto || null } });
    return respuestaOp(c, movimiento, req.params.id, repetido);
  });
}));

router.post('/cuentas/:id/extracciones', ruta(async (req) => {
  const b = req.body || {}; opValida(b);
  return tx(async (c) => {
    if (!(await cuentaPorReferencia(c, req.params.id))) throw falla(404, 'cuenta no encontrada');
    const { movimiento, repetido } = await transferir(c, { id_operacion: `extraccion:${b.id_operacion}`, tipo: 'extraccion',
      origen: req.params.id, destino: CAJA, monto: b.monto, payload: { concepto: b.concepto || null } });
    return respuestaOp(c, movimiento, req.params.id, repetido);
  });
}));

// Transferencia a otra cuenta por id, CBU o alias.
router.post('/transferencias', ruta(async (req) => {
  const b = req.body || {}; opValida(b);
  return tx(async (c) => {
    const origen = await cuentaPorReferencia(c, b.origen);
    const destino = await cuentaPorReferencia(c, b.destino);
    if (!origen) throw falla(404, 'cuenta de origen no encontrada');
    if (!destino) throw falla(404, 'no existe una cuenta con ese CBU o alias');
    if ([origen.id, destino.id].includes(CAJA)) throw falla(400, 'la caja del banco no opera por transferencia');
    const { movimiento, repetido } = await transferir(c, { id_operacion: `transferencia:${b.id_operacion}`, tipo: 'transferencia',
      origen: origen.id, destino: destino.id, monto: b.monto, payload: { concepto: b.concepto || null } });
    return respuestaOp(c, movimiento, origen.id, repetido);
  });
}));

// ---------- Cheques (cuentas corrientes) ----------
// Circuito real simplificado: el titular de una cuenta corriente emite (libra) un
// cheque; el beneficiario lo deposita en su cuenta; el banco lo acredita en el
// clearing si llegó la fecha de pago y el librador tiene fondos, o lo rechaza.
const filaCheque = (q) => ({
  id: q.id, numero: q.numero, cuenta_librador: q.cuenta_librador, beneficiario: q.beneficiario, monto: num(q.monto),
  fecha_emision: q.fecha_emision, fecha_pago: q.fecha_pago, estado: q.estado, cuenta_deposito: q.cuenta_deposito,
  movimiento_id: q.movimiento_id, motivo_rechazo: q.motivo_rechazo, canal: q.canal, beneficiario_cuit: q.beneficiario_cuit,
});
const SELECT_CHEQUE = `select id, numero, cuenta_librador, beneficiario, monto, fecha_emision::text as fecha_emision,
  fecha_pago::text as fecha_pago, estado, cuenta_deposito, movimiento_id, motivo_rechazo, canal, beneficiario_cuit, creado_en from banco.cheques`;

async function emitirCheque(c, { cuenta_librador, beneficiario, monto, fecha_pago, canal = 'fisico', beneficiario_cuit = null }) {
  const cuenta = await cuentaPorReferencia(c, cuenta_librador);
  if (!cuenta) throw falla(404, 'cuenta del librador no encontrada');
  if (cuenta.tipo !== 'cuenta_corriente') throw falla(409, 'solo una cuenta corriente puede emitir cheques');
  if (!String(beneficiario || '').trim()) throw falla(400, 'indicá el beneficiario del cheque');
  if (!montoValido(monto)) throw falla(400, 'monto inválido');
  if (fecha_pago && !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha_pago))) throw falla(400, 'fecha_pago debe tener formato AAAA-MM-DD');
  const n = num((await c.query('select count(*) n from banco.cheques')).rows[0].n) + 1;
  const numero = String(10000000 + n);
  return (await c.query(`insert into banco.cheques (numero, cuenta_librador, beneficiario, monto, fecha_pago, canal, beneficiario_cuit)
    values ($1, $2, $3, $4, coalesce($5::date, current_date), $6, $7) returning id, numero`,
    [numero, cuenta.id, String(beneficiario).trim().slice(0, 120), monto, fecha_pago || null, canal, beneficiario_cuit])).rows[0];
}

router.get('/cheques', ruta(async (req) => {
  const cuenta = req.query.cuenta ? await cuentaPorReferencia({ query }, req.query.cuenta) : null;
  if (req.query.cuenta && !cuenta) throw falla(404, 'cuenta no encontrada');
  const { rows } = await query(`${SELECT_CHEQUE} where ($1::text is null or cuenta_librador = $1 or cuenta_deposito = $1)
    order by creado_en desc limit 200`, [cuenta?.id || null]);
  return { body: rows.map(filaCheque) };
}));

router.post('/cheques', ruta(async (req) => {
  const b = req.body || {};
  const { id } = await tx((c) => emitirCheque(c, b));
  return { status: 201, body: filaCheque((await query(`${SELECT_CHEQUE} where id = $1`, [id])).rows[0]) };
}));

async function chequePorNumero(c, numero) {
  const q = (await c.query(`${SELECT_CHEQUE} where numero = $1 for update`, [String(numero)])).rows[0];
  if (!q) throw falla(404, 'cheque no encontrado');
  return q;
}

async function depositarCheque(c, numero, cuentaRef) {
  const q = await chequePorNumero(c, numero);
  if (q.estado !== 'emitido') throw falla(409, `el cheque está ${q.estado}`);
  const destino = await cuentaPorReferencia(c, cuentaRef);
  if (!destino) throw falla(404, 'no existe la cuenta donde se deposita (revisá alias o CBU)');
  if (destino.id === q.cuenta_librador) throw falla(409, 'no se puede depositar en la misma cuenta que lo emitió');
  if (q.beneficiario_cuit && destino.cuit !== q.beneficiario_cuit) throw falla(409, 'el eCheq solo se deposita en una cuenta de su beneficiario');
  await c.query("update banco.cheques set estado = 'depositado', cuenta_deposito = $2, actualizado_en = now() where id = $1", [q.id, destino.id]);
  return filaCheque((await c.query(`${SELECT_CHEQUE} where id = $1`, [q.id])).rows[0]);
}

router.post('/cheques/:numero/depositar', ruta(async (req) => tx(async (c) => ({ body: await depositarCheque(c, req.params.numero, req.body?.cuenta) }))));

// Clearing: acredita si llegó la fecha y hay fondos; si no hay fondos, lo rechaza.
router.post('/cheques/:numero/acreditar', ruta(async (req) => tx(async (c) => ({ body: await acreditarCheque(c, req.params.numero) }))));

async function acreditarCheque(c, numero) {
  const q = await chequePorNumero(c, numero);
  if (q.estado !== 'depositado') throw falla(409, `el cheque está ${q.estado}: primero hay que depositarlo`);
  if ((await c.query('select $1::date > current_date as futuro', [q.fecha_pago])).rows[0].futuro) {
    throw falla(409, `cheque de pago diferido: se puede cobrar desde el ${q.fecha_pago}`);
  }
  const librador = (await c.query('select saldo from banco.cuentas where id = $1', [q.cuenta_librador])).rows[0];
  if (num(librador.saldo) < num(q.monto)) {
    await c.query("update banco.cheques set estado = 'rechazado', motivo_rechazo = 'sin fondos suficientes', actualizado_en = now() where id = $1", [q.id]);
  } else {
    const { movimiento } = await transferir(c, { id_operacion: `cheque:${q.numero}`, tipo: 'cheque', origen: q.cuenta_librador,
      destino: q.cuenta_deposito, monto: num(q.monto), payload: { cheque: q.numero } });
    await c.query("update banco.cheques set estado = 'acreditado', movimiento_id = $2, actualizado_en = now() where id = $1", [q.id, movimiento.id]);
  }
  return filaCheque((await c.query(`${SELECT_CHEQUE} where id = $1`, [q.id])).rows[0]);
}

router.post('/cheques/:numero/anular', ruta(async (req) => tx(async (c) => {
  const q = await chequePorNumero(c, req.params.numero);
  if (q.estado !== 'emitido') throw falla(409, 'solo se anula un cheque que todavía no se depositó');
  await c.query("update banco.cheques set estado = 'anulado', actualizado_en = now() where id = $1", [q.id]);
  return { body: filaCheque((await c.query(`${SELECT_CHEQUE} where id = $1`, [q.id])).rows[0]) };
})));

// ---------- Homebanking ----------
// Cada cliente entra con su CUIT y su clave (simulación: demo1234 al abrir la cuenta).
const SISTEMA = ['20000000001', '30000000097', '30000000098', '30000000099'];
async function resumenCliente(cuit) {
  const cliente = (await query(`select cuit, razon_social, condicion_iva, domicilio_fiscal from padron.contribuyentes where cuit = $1`, [cuit])).rows[0];
  const cuentas = (await query('select * from banco.cuentas where cuit = $1 order by creado_en', [cuit])).rows.map(filaCuenta);
  const ids = cuentas.map((x) => x.id);
  const movimientos = (await query(`select * from banco.movimientos where cuenta_origen = any($1) or cuenta_destino = any($1)
    order by creado_en desc limit 30`, [ids])).rows.map((m) => ({ ...filaMovimiento(m),
    sentido: ids.includes(m.cuenta_destino) && !ids.includes(m.cuenta_origen) ? 'credito' : ids.includes(m.cuenta_origen) && !ids.includes(m.cuenta_destino) ? 'debito' : 'interno' }));
  const cheques = (await query(`${SELECT_CHEQUE} where cuenta_librador = any($1) or cuenta_deposito = any($1) or beneficiario_cuit = $2
    order by creado_en desc limit 50`, [ids, cuit])).rows.map((q) => ({ ...filaCheque(q), rol: ids.includes(q.cuenta_librador) ? 'emitido' : 'recibido' }));
  const billetera = (await query('select alias, saldo from billetera.cuentas where cuit = $1', [cuit])).rows[0];
  return { cliente, cuentas, movimientos, cheques, billetera: billetera ? { alias: billetera.alias, saldo: num(billetera.saldo) } : null,
    echeq_disponible: cuentas.some((x) => x.tipo === 'cuenta_corriente') };
}

router.post('/homebanking/login', ruta(async (req) => {
  const { cuit, clave } = req.body || {};
  if (!cuitValido(cuit) || SISTEMA.includes(cuit)) throw falla(400, 'ingresá tu CUIT de 11 dígitos, sin guiones');
  if (typeof clave !== 'string' || !clave) throw falla(400, 'la clave es obligatoria');
  const u = (await query('select (password_hash = extensions.crypt($2, password_hash)) as ok from banco.homebanking where cuit = $1', [cuit, clave])).rows[0];
  if (!u || !u.ok) throw falla(401, 'CUIT o clave incorrectos (¿tenés cuenta en Banco M?)');
  await query('update banco.homebanking set ultimo_ingreso = now() where cuit = $1', [cuit]);
  return { body: await resumenCliente(cuit) };
}));

router.get('/homebanking/:cuit/resumen', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'CUIT inválido');
  if (!(await query('select 1 from banco.homebanking where cuit = $1', [req.params.cuit])).rows[0]) throw falla(404, 'el CUIT no tiene homebanking');
  return { body: await resumenCliente(req.params.cuit) };
}));

router.post('/homebanking/clave', ruta(async (req) => {
  const { cuit, clave_actual, clave_nueva } = req.body || {};
  if (typeof clave_nueva !== 'string' || clave_nueva.length < 6) throw falla(400, 'la clave nueva debe tener al menos 6 caracteres');
  const { rows } = await query(`update banco.homebanking set password_hash = extensions.crypt($3, extensions.gen_salt('bf'))
    where cuit = $1 and password_hash = extensions.crypt($2, password_hash) returning cuit`, [cuit, String(clave_actual || ''), clave_nueva]);
  if (!rows[0]) throw falla(401, 'la clave actual no es correcta');
  return { body: { ok: true } };
}));

module.exports = { router, transferir, cuentaPorCuit, abrirCuenta, cuentaPorReferencia, emitirCheque, depositarCheque, acreditarCheque, filaCheque, SELECT_CHEQUE };

// Billetera virtual (contrato de Lucas M) sobre la base compartida.
// Si la billetera está vinculada a una cuenta del Banco, cada carga debita
// esa cuenta y acredita la custodia de la Billetera (banco.movimientos).
const express = require('express');
const QRCode = require('qrcode');
const { query, tx } = require('../db');
const { falla, cuitValido, idValido, montoValido, uuidValido, num, hash, ruta } = require('../http');
const { transferir } = require('./banco');
const { registrarEvento, entregarEvento } = require('./webhooks');

const router = express.Router();
const CUENTA_CUSTODIA = 'cuenta-billetera';
const MIN_CLAVE = 8;
const db = { query };

const DEMO = [
  { codigo: 'catedra-demo', cuit: '20268326074', perfil: 'Cuenta de la cátedra, vinculada al Banco' },
  { codigo: 'ana-demo', cuit: '30000000001', perfil: 'Cliente frecuente' },
  { codigo: 'marcos-demo', cuit: '30000000002', perfil: 'Cliente nuevo' },
  { codigo: 'laura-demo', cuit: '30000000003', perfil: 'Saldo bajo para probar rechazos' },
];

const saldoCuenta = (b) => num(b.saldo_banco ?? b.saldo);
const filaBilletera = (b) => ({
  id: b.id, titular: b.titular, cuit: b.cuit, alias: b.alias, saldo: saldoCuenta(b), cbu: b.cbu || null,
  fecha_alta: new Date(b.creado_en).toISOString(), banco_cuenta_id: b.banco_cuenta_id || null,
});
const filaMovimiento = (m) => ({
  id: m.id, tipo: m.tipo, monto: num(m.monto), contraparte: m.contraparte || m.contraparte_cuit || null,
  saldo_resultante: num(m.saldo_resultante), banco_movimiento_id: m.banco_movimiento_id || null,
  fecha: new Date(m.creado_en).toISOString(),
});

const columnasCuenta = `w.*,
  (select b.saldo from banco.cuentas b where b.id = w.banco_cuenta_id) as saldo_banco,
  (select b.cbu from banco.cuentas b where b.id = w.banco_cuenta_id) as cbu`;
const porCuit = async (c, cuit, lock = false) =>
  (await c.query(`select ${columnasCuenta} from billetera.cuentas w where w.cuit = $1${lock ? ' for update of w' : ''}`, [cuit])).rows[0];
const porId = async (c, id) => (await c.query(`select ${columnasCuenta} from billetera.cuentas w where w.id = $1`, [id])).rows[0];

async function movimiento(c, m) {
  return (await c.query(
    `insert into billetera.movimientos
       (id_operacion, cuenta_id, tipo, monto, contraparte, contraparte_cuit, saldo_resultante, banco_movimiento_id, payload_hash)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [m.id_operacion, m.cuenta.id, m.tipo, m.monto, m.contraparte, m.contraparte_cuit || null, m.saldo,
      m.banco_movimiento_id || null, m.payload_hash],
  )).rows[0];
}

// Si la operación ya se hizo con los mismos datos, devuelve el movimiento guardado.
async function previo(c, id_operacion, cuenta, payload_hash) {
  const m = (await c.query('select * from billetera.movimientos where id_operacion = $1 and cuenta_id = $2',
    [id_operacion, cuenta.id])).rows[0];
  if (!m) return null;
  if (m.payload_hash !== payload_hash) throw falla(409, 'id_venta ya fue utilizada con otros datos');
  return m;
}

async function verificarClave(cuit, clave) {
  const { rows } = await query(
    `select c.*, b.saldo as saldo_banco, b.cbu,
       (u.password_hash = extensions.crypt($2, u.password_hash)) as ok
     from billetera.cuentas c join billetera.usuarios u on u.cuenta_id = c.id
     left join banco.cuentas b on b.id = c.banco_cuenta_id where c.cuit = $1`, [cuit, clave]);
  return rows[0] && rows[0].ok ? rows[0] : null;
}

async function crearCuenta(c, { titular, cuit, alias, contrasena }) {
  const tipo = cuit.startsWith('3') ? 'juridica' : 'fisica';
  await c.query(
    `insert into padron.contribuyentes (cuit, razon_social, tipo_persona, condicion_iva)
     values ($1, $2, $3, 'consumidor_final') on conflict (cuit) do nothing`, [cuit, titular, tipo]);
  const banco = (await c.query('select id from banco.cuentas where cuit = $1 order by creado_en limit 1', [cuit])).rows[0];
  let cuenta;
  try {
    cuenta = (await c.query(
      'insert into billetera.cuentas (cuit, titular, alias, banco_cuenta_id) values ($1,$2,$3,$4) returning *',
      [cuit, titular, alias, banco ? banco.id : null])).rows[0];
  } catch (err) {
    if (err.code === '23505' || /unique|duplicate/i.test(err.message)) throw falla(409, 'ya existe una billetera con ese CUIL o alias');
    throw err;
  }
  if (contrasena) {
    await c.query(
      "insert into billetera.usuarios (cuenta_id, password_hash) values ($1, extensions.crypt($2, extensions.gen_salt('bf')))",
      [cuenta.id, contrasena]);
  }
  return cuenta;
}

router.post('/auth/login', ruta(async (req) => {
  const { cuil, contrasena } = req.body || {};
  if (!cuitValido(cuil)) throw falla(400, 'el CUIL debe tener 11 dígitos, sin puntos ni guiones');
  if (typeof contrasena !== 'string' || !contrasena) throw falla(400, 'la contraseña es obligatoria');
  const cuenta = await verificarClave(cuil, contrasena);
  if (!cuenta) throw falla(401, 'CUIL o contraseña incorrectos');
  await query('update billetera.usuarios set ultimo_ingreso = now() where cuenta_id = $1', [cuenta.id]);
  return { body: { billetera: filaBilletera(cuenta) } };
}));

router.post('/auth/registro', ruta(async (req) => {
  throw falla(403, 'el alta de billeteras la realiza Banco M; solicitá el alta de una cuenta bancaria');
}));

router.get('/demo/clientes', ruta(async () => {
  const { rows } = await query(`select w.*,
    (select b.saldo from banco.cuentas b where b.id=w.banco_cuenta_id) as saldo_banco,
    (select b.cbu from banco.cuentas b where b.id=w.banco_cuenta_id) as cbu
    from billetera.cuentas w where w.cuit = any($1)`, [DEMO.map((d) => d.cuit)]);
  return {
    body: DEMO.map((d) => {
      const b = rows.find((r) => r.cuit === d.cuit);
      return b && { codigo: d.codigo, titular: b.titular, cuil: b.cuit, alias: b.alias, saldo_inicial: num(b.saldo), perfil: d.perfil };
    }).filter(Boolean),
  };
}));

router.post('/demo/clientes/:codigo/activar', ruta(async (req) => {
  const d = DEMO.find((x) => x.codigo === req.params.codigo);
  const b = d && await porCuit(db, d.cuit);
  if (!b) throw falla(404, 'cliente de prueba no encontrado');
  return { body: { billetera: filaBilletera(b), creada: false } };
}));

router.get('/qr/:cuit', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'el QR debe tener un CUIL válido');
  const b = await porCuit(db, req.params.cuit);
  if (!b) throw falla(404, 'el QR no corresponde a una billetera existente');
  return { body: { titular: b.titular, cuit: b.cuit, alias: b.alias } };
}));

router.post('/cuentas', ruta(async (req) => {
  throw falla(403, 'el alta de billeteras la realiza Banco M');
}));

router.get('/cuentas/:id', ruta(async (req) => {
  const b = uuidValido(req.params.id) ? await porId(db, req.params.id) : null;
  if (!b) throw falla(404, 'billetera no encontrada');
  return { body: filaBilletera(b) };
}));

router.get('/cuentas/:id/movimientos', ruta(async (req) => {
  const b = uuidValido(req.params.id) ? await porId(db, req.params.id) : null;
  if (!b) throw falla(404, 'billetera no encontrada');
  const { rows } = await query(
    'select * from billetera.movimientos where cuenta_id = $1 order by creado_en desc limit 50', [b.id]);
  return { body: rows.map(filaMovimiento) };
}));

// Los ingresos se liquidan en la cuenta bancaria vinculada. La Billetera es una
// vista del mismo saldo y nunca mantiene dinero paralelo al saldo de Banco.
router.post('/cargas', ruta(async (req) => {
  const { id_venta, cuit, monto } = req.body || {};
  if (!idValido(id_venta)) throw falla(400, 'id_venta es obligatorio');
  if (!cuitValido(cuit)) throw falla(400, 'cuit debe ser un string de 11 dígitos, sin puntos ni guiones');
  if (!montoValido(monto)) throw falla(400, 'monto debe ser un número positivo de hasta dos decimales');
  const payload_hash = hash({ op: 'carga', cuit, monto });
  return tx(async (c) => {
    const b = await porCuit(c, cuit, true);
    if (!b) throw falla(404, 'no existe billetera para ese cuit');
    if (!b.banco_cuenta_id) throw falla(409, 'la billetera necesita una cuenta bancaria asignada por Banco M');
    const ya = await previo(c, id_venta, b, payload_hash);
    if (ya) {
      return { status: 200, body: { ...filaBilletera(b), id_venta, movimiento: filaMovimiento(ya), saldo_resultante: num(ya.saldo_resultante) } };
    }
    const banco = (await transferir(c, {
      id_operacion: `ingreso:${id_venta}`, tipo: 'transferencia', origen: 'cuenta-mostrador',
      destino: b.banco_cuenta_id, monto, payload: { ingreso_bancario: id_venta, cuit },
    })).movimiento;
    const saldo = saldoCuenta(b) + monto;
    const m = await movimiento(c, {
      id_operacion: id_venta, cuenta: b, tipo: 'carga', monto, saldo, payload_hash,
      contraparte: `Ingreso en cuenta bancaria ${b.banco_cuenta_id}`,
      banco_movimiento_id: banco.id,
    });
    return {
      status: 201,
      body: { ...filaBilletera({ ...b, saldo_banco: saldo, saldo }), id_venta, movimiento: filaMovimiento(m), saldo_resultante: saldo,
        banco_movimiento_id: banco.id },
    };
  });
}));

// Debita una billetera y, si el destino también tiene billetera, la acredita.
async function pagar(c, { id_venta, origenCuit, destinoCuit, monto, op, exigirDestino, liquidarBanco = false, terminal_id, webhook_id_venta = id_venta }) {
  const payload_hash = hash({ op, origenCuit, destinoCuit, monto });
  // Bloquear siempre en el mismo orden evita bloqueos cruzados.
  const [primero, segundo] = [origenCuit, destinoCuit].sort();
  const b1 = await porCuit(c, primero, true);
  const b2 = await porCuit(c, segundo, true);
  const origen = primero === origenCuit ? b1 : b2;
  const destino = primero === origenCuit ? b2 : b1;
  if (!origen) throw falla(404, op === 'qr' ? 'no existe la billetera de origen' : 'no existe billetera para ese cuit');
  if (!destino && exigirDestino) throw falla(404, 'el QR no corresponde a una billetera existente');
  const ya = await previo(c, id_venta, origen, payload_hash);
  if (ya) {
    const event = terminal_id ? (await c.query(`select id from tpv.webhook_eventos where terminal_id=$1 and id_venta=$2 and evento='payment.confirmed'`, [terminal_id,id_venta])).rows[0] : null;
    return { status: 200, body: { ...filaBilletera(origen), id_venta, movimiento: filaMovimiento(ya), saldo_resultante: num(ya.saldo_resultante), estado: 'confirmado', _webhookEventId:event?.id||null } };
  }
  if (!origen.banco_cuenta_id) throw falla(409, 'la billetera no tiene una cuenta bancaria asignada por Banco M');
  const cuentaDestino = destino?.banco_cuenta_id
    ? { id: destino.banco_cuenta_id, saldo: saldoCuenta(destino) }
    : (await c.query('select id, saldo from banco.cuentas where cuit=$1 order by creado_en limit 1', [destinoCuit])).rows[0];
  if (!cuentaDestino) throw falla(404, 'el destinatario no tiene una cuenta bancaria');
  const saldoAntes = saldoCuenta(origen);
  if (saldoAntes < monto) throw falla(400, 'saldo insuficiente');
  const bancoMovimiento = (await transferir(c, {
    id_operacion: `billetera:${id_venta}`, tipo: 'transferencia', origen: origen.banco_cuenta_id,
    destino: cuentaDestino.id, monto, payload: { billetera_pago: id_venta, cuit_origen: origenCuit, cuit_destino: destinoCuit },
  })).movimiento;
  const saldoOrigen = saldoAntes - monto;
  const saldoDestino = num(cuentaDestino.saldo) + monto;
  const m = await movimiento(c, {
    id_operacion: id_venta, cuenta: origen, tipo: 'pago', monto, saldo: saldoOrigen, payload_hash,
    contraparte: op === 'transferencia' ? `Transferencia a ${destino?.alias || destinoCuit}` : destino ? `Pago a ${destino.alias}` : `Pago a comercio ${destinoCuit}`, contraparte_cuit: destinoCuit,
    banco_movimiento_id: bancoMovimiento.id,
  });
  if (destino) {
    await movimiento(c, {
      id_operacion: id_venta, cuenta: destino, tipo: 'cobro', monto, saldo: saldoDestino, payload_hash,
      contraparte: `Cobro de ${origen.alias}`, contraparte_cuit: origenCuit,
    });
  }
  const webhookEventId = await registrarEvento(c, { terminal_id, id_venta:webhook_id_venta, payload: {
    event_type: 'payment.confirmed', id_venta:webhook_id_venta, terminal_id, cuit_comercio: destinoCuit,
    cuit_pagador: origenCuit, monto, moneda: 'ARS', medio_pago: 'billetera', estado: 'confirmado',
    billetera_movimiento_id: m.id, banco_movimiento_id: bancoMovimiento.id,
  } });
  return {
    status: 201,
    body: { ...filaBilletera({ ...origen, saldo: saldoOrigen, saldo_banco: saldoOrigen }), id_venta, movimiento: filaMovimiento(m),
      banco_movimiento_id: bancoMovimiento.id, saldo_resultante: saldoOrigen, estado: 'confirmado', _webhookEventId: webhookEventId },
  };
}

router.post('/qr/generar', ruta(async (req) => {
  const { id_venta, cuit_destino, monto, terminal_id } = req.body || {};
  if (!idValido(id_venta)) throw falla(400, 'id_venta es obligatorio');
  if (!cuitValido(cuit_destino)) throw falla(400, 'cuit_destino debe tener 11 dígitos');
  if (!montoValido(monto)) throw falla(400, 'monto debe ser positivo y tener hasta dos decimales');
  if (terminal_id !== undefined && !idValido(terminal_id)) throw falla(400, 'terminal_id inválido');
  if (terminal_id && !(await query('select 1 from tpv.terminales where id=$1',[terminal_id])).rows[0]) throw falla(404, 'terminal TPV no encontrada');
  const destino = (await query('select 1 from billetera.cuentas where cuit=$1 union select 1 from banco.cuentas where cuit=$1 limit 1', [cuit_destino])).rows[0];
  if (!destino) throw falla(404, 'el CUIT destino no tiene una billetera ni cuenta bancaria');
  const payload_hash = hash({ cuit_destino, monto, terminal_id: terminal_id || null });
  let solicitud = (await query('select * from billetera.solicitudes_qr where id_venta=$1', [id_venta])).rows[0];
  if (solicitud && solicitud.payload_hash !== payload_hash) throw falla(409, 'id_venta ya fue utilizada con otros datos');
  if (!solicitud) {
    const id = require('node:crypto').randomUUID();
    const payload = `SINTEGRA-PAGO:${id}`;
    const inserted = (await query(`insert into billetera.solicitudes_qr(id,id_venta,payload,cuit_destino,monto,payload_hash,vence_en,terminal_id)
      values($1,$2,$3,$4,$5,$6,now()+interval '5 minutes',$7) on conflict(id_venta) do nothing returning *`,
      [id,id_venta,payload,cuit_destino,monto,payload_hash,terminal_id||null])).rows[0];
    solicitud = inserted || (await query('select * from billetera.solicitudes_qr where id_venta=$1',[id_venta])).rows[0];
    if (solicitud.payload_hash !== payload_hash) throw falla(409, 'id_venta ya fue utilizada con otros datos');
  }
  if (solicitud.estado !== 'pendiente') throw falla(409, `el QR está ${solicitud.estado}`);
  if (new Date(solicitud.vence_en).getTime() <= Date.now()) {
    await query("update billetera.solicitudes_qr set estado='vencida' where id=$1", [solicitud.id]);
    throw falla(410, 'el QR venció; generá uno nuevo');
  }
  const qr_data_url = await QRCode.toDataURL(solicitud.payload, { errorCorrectionLevel: 'M', margin: 2, width: 320 });
  return { status: 201, body: { id: solicitud.id, id_venta, payload: solicitud.payload, qr_data_url,
    cuit_destino: solicitud.cuit_destino, terminal_id:solicitud.terminal_id, monto: num(solicitud.monto), estado: solicitud.estado,
    vence_en: new Date(solicitud.vence_en).toISOString() } };
}));

router.post('/qr/confirmar', ruta(async (req) => {
  const { payload, cuit_origen } = req.body || {};
  if (typeof payload !== 'string' || !payload.startsWith('SINTEGRA-PAGO:')) throw falla(400, 'payload QR inválido');
  if (!cuitValido(cuit_origen)) throw falla(400, 'cuit_origen debe tener 11 dígitos');
  const id = payload.slice('SINTEGRA-PAGO:'.length);
  if (!uuidValido(id)) throw falla(400, 'identificador QR inválido');
  const result = await tx(async (c) => {
    const solicitud = (await c.query('select * from billetera.solicitudes_qr where id=$1 and payload=$2 for update', [id,payload])).rows[0];
    if (!solicitud) throw falla(404, 'QR no encontrado');
    if (solicitud.estado === 'pagada') {
      if (solicitud.cuit_origen !== cuit_origen) throw falla(409, 'el QR ya fue pagado por otro titular');
      const previoPago = (await c.query("select * from billetera.movimientos where id_operacion=$1 and tipo='pago'", [`qr:${id}`])).rows[0];
      const event = solicitud.terminal_id ? (await c.query(`select id from tpv.webhook_eventos where terminal_id=$1 and id_venta=$2 and evento='payment.confirmed'`, [solicitud.terminal_id,solicitud.id_venta])).rows[0] : null;
      return { status: 200, body: { estado: 'pagada', repetida: true, id_venta: solicitud.id_venta,
        movimiento: previoPago ? filaMovimiento(previoPago) : null, monto: num(solicitud.monto), cuit_destino: solicitud.cuit_destino, _webhookEventId:event?.id||null } };
    }
    if (solicitud.estado !== 'pendiente') throw falla(409, `el QR está ${solicitud.estado}`);
    if (new Date(solicitud.vence_en).getTime() <= Date.now()) {
      await c.query("update billetera.solicitudes_qr set estado='vencida' where id=$1", [id]);
      throw falla(410, 'el QR venció; solicitá uno nuevo');
    }
    const pago = await pagar(c, { id_venta: `qr:${id}`, origenCuit: cuit_origen, destinoCuit: solicitud.cuit_destino,
      monto: num(solicitud.monto), op: 'qr', exigirDestino: false, liquidarBanco: true,
      terminal_id:solicitud.terminal_id,webhook_id_venta:solicitud.id_venta });
    const bancoMovimientoId = pago.body.banco_movimiento_id || pago.body.movimiento?.banco_movimiento_id || null;
    await c.query(`update billetera.solicitudes_qr set estado='pagada',cuit_origen=$2,
      billetera_movimiento_id=$3,banco_movimiento_id=$4,pagado_en=now() where id=$1`,
      [id,cuit_origen,pago.body.movimiento?.id || null,bancoMovimientoId]);
    return { status: 201, body: { ...pago.body, repetida:false, id_venta:solicitud.id_venta,
      cuit_origen,cuit_destino:solicitud.cuit_destino,monto:num(solicitud.monto),estado:'pagada' } };
  });
  if (result.body._webhookEventId) {
    result.body.webhook = await entregarEvento(result.body._webhookEventId);
    delete result.body._webhookEventId;
  }
  return result;
}));

router.post('/pagos', ruta(async (req) => {
  const { id_venta, cuit, monto, comercio_cuit, terminal_id } = req.body || {};
  if (!idValido(id_venta)) throw falla(400, 'id_venta es obligatorio');
  if (!cuitValido(cuit)) throw falla(400, 'cuit debe ser un string de 11 dígitos, sin puntos ni guiones');
  if (!montoValido(monto)) throw falla(400, 'monto debe ser un número positivo de hasta dos decimales');
  if (!cuitValido(comercio_cuit)) throw falla(400, 'comercio_cuit debe ser un string de 11 dígitos');
  if (cuit === comercio_cuit) throw falla(400, 'no podés pagarte a vos mismo');
  if (terminal_id !== undefined && !idValido(terminal_id)) throw falla(400, 'terminal_id inválido');
  const result = await tx((c) => pagar(c, { id_venta, origenCuit: cuit, destinoCuit: comercio_cuit, monto, op: 'pago', exigirDestino: false, liquidarBanco: true, terminal_id }));
  if (result.body._webhookEventId) { result.body.webhook=await entregarEvento(result.body._webhookEventId); delete result.body._webhookEventId; }
  return result;
}));

// Transferencia desde la billetera a otra persona por CUIT, alias de billetera o
// alias/CBU bancario. Si el destinatario tiene billetera, se le acredita; si no,
// va a su cuenta bancaria. Todo queda en el libro del Banco.
router.post('/transferencias', ruta(async (req) => {
  const { id_venta, cuit_origen, destino, monto } = req.body || {};
  if (!idValido(id_venta)) throw falla(400, 'id_venta es obligatorio');
  if (!cuitValido(cuit_origen)) throw falla(400, 'cuit_origen debe tener 11 dígitos');
  if (!montoValido(monto)) throw falla(400, 'monto debe ser un número positivo de hasta dos decimales');
  const ref = String(destino || '').trim();
  if (!ref) throw falla(400, 'indicá el CUIT, alias o CBU del destinatario');
  const result = await tx(async (c) => {
    let destinoCuit = /^\d{11}$/.test(ref) ? ref : null;
    if (!destinoCuit) destinoCuit = (await c.query('select cuit from billetera.cuentas where lower(alias) = lower($1)', [ref])).rows[0]?.cuit;
    if (!destinoCuit) destinoCuit = (await c.query('select cuit from banco.cuentas where lower(alias) = lower($1) or cbu = $1 limit 1', [ref])).rows[0]?.cuit;
    if (!destinoCuit) throw falla(404, 'no encontramos una billetera ni una cuenta con ese CUIT, alias o CBU');
    if (destinoCuit === cuit_origen) throw falla(400, 'no podés transferirte a vos mismo');
    return pagar(c, { id_venta, origenCuit: cuit_origen, destinoCuit, monto, op: 'transferencia', exigirDestino: false, liquidarBanco: true });
  });
  delete result.body._webhookEventId;
  return result;
}));

// ---------- eCheq ----------
// Disponible si el titular tiene cuenta corriente en Banco M. Se libra a un CUIT
// (o al alias de su billetera/cuenta); el beneficiario lo cobra desde su billetera
// y se acredita en su caja de ahorro cuando llega la fecha de pago y hay fondos.
const bancoM = () => require('./banco');
async function cuitDesdeReferencia(c, ref) {
  ref = String(ref || '').trim();
  if (/^\d{11}$/.test(ref)) return ref;
  return (await c.query('select cuit from billetera.cuentas where lower(alias) = lower($1)', [ref])).rows[0]?.cuit
    || (await c.query('select cuit from banco.cuentas where lower(alias) = lower($1) or cbu = $1 limit 1', [ref])).rows[0]?.cuit;
}

router.get('/echeqs', ruta(async (req) => {
  const cuit = req.query.cuit;
  if (!cuitValido(cuit)) throw falla(400, 'cuit es obligatorio');
  const { filaCheque, SELECT_CHEQUE } = bancoM();
  const cc = (await query("select id, saldo from banco.cuentas where cuit = $1 and tipo = 'cuenta_corriente'", [cuit])).rows[0];
  const emitidos = cc ? (await query(`${SELECT_CHEQUE} where canal = 'echeq' and cuenta_librador = $1 order by creado_en desc limit 50`, [cc.id])).rows.map(filaCheque) : [];
  const recibidos = (await query(`${SELECT_CHEQUE} where canal = 'echeq' and beneficiario_cuit = $1 order by creado_en desc limit 50`, [cuit])).rows.map(filaCheque);
  return { body: { disponible: Boolean(cc), cuenta_corriente: cc ? { id: cc.id, saldo: num(cc.saldo) } : null, emitidos, recibidos,
    motivo: cc ? null : 'Para emitir eCheq necesitás una cuenta corriente en Banco M. Igual podés recibir y cobrar eCheq.' } };
}));

router.post('/echeqs', ruta(async (req) => {
  const { cuit_origen, destino, monto, fecha_pago } = req.body || {};
  if (!cuitValido(cuit_origen)) throw falla(400, 'cuit_origen debe tener 11 dígitos');
  if (!montoValido(monto)) throw falla(400, 'monto debe ser un número positivo de hasta dos decimales');
  const { emitirCheque, filaCheque, SELECT_CHEQUE } = bancoM();
  const cheque = await tx(async (c) => {
    const cc = (await c.query("select id from banco.cuentas where cuit = $1 and tipo = 'cuenta_corriente'", [cuit_origen])).rows[0];
    if (!cc) throw falla(409, 'eCheq no disponible: necesitás una cuenta corriente en Banco M');
    const benef = await cuitDesdeReferencia(c, destino);
    if (!benef) throw falla(404, 'no encontramos ese CUIT, alias o CBU');
    if (benef === cuit_origen) throw falla(400, 'no podés librarte un eCheq a vos mismo');
    const sujeto = (await c.query('select razon_social from padron.contribuyentes where cuit = $1', [benef])).rows[0];
    if (!sujeto) throw falla(409, 'el beneficiario tiene que figurar en el padrón (inscripto en ARCA)');
    const { id } = await emitirCheque(c, { cuenta_librador: cc.id, beneficiario: sujeto.razon_social, monto, fecha_pago, canal: 'echeq', beneficiario_cuit: benef });
    return filaCheque((await c.query(`${SELECT_CHEQUE} where id = $1`, [id])).rows[0]);
  });
  return { status: 201, body: cheque };
}));

// El beneficiario lo cobra: se deposita en su caja de ahorro y entra al clearing.
router.post('/echeqs/:numero/cobrar', ruta(async (req) => {
  const cuit = req.body?.cuit;
  if (!cuitValido(cuit)) throw falla(400, 'cuit es obligatorio');
  const { depositarCheque, acreditarCheque } = bancoM();
  return tx(async (c) => {
    const q = (await c.query("select * from banco.cheques where numero = $1 and canal = 'echeq'", [String(req.params.numero)])).rows[0];
    if (!q) throw falla(404, 'eCheq no encontrado');
    if (q.beneficiario_cuit !== cuit) throw falla(403, 'solo el beneficiario puede cobrar este eCheq');
    const cuenta = (await c.query("select id from banco.cuentas where cuit = $1 order by (tipo = 'caja_ahorro') desc, creado_en limit 1", [cuit])).rows[0];
    if (!cuenta) throw falla(409, 'para cobrar un eCheq necesitás una cuenta en Banco M');
    let r = q.estado === 'emitido' ? await depositarCheque(c, q.numero, cuenta.id) : null;
    if ((r?.estado || q.estado) !== 'depositado') throw falla(409, `el eCheq está ${q.estado}`);
    if ((await c.query('select $1::date > current_date as futuro', [q.fecha_pago])).rows[0].futuro) {
      return { body: { ...r, aviso: `eCheq de pago diferido: queda depositado y se acredita desde el ${String(q.fecha_pago instanceof Date ? q.fecha_pago.toISOString().slice(0, 10) : q.fecha_pago)}` } };
    }
    r = await acreditarCheque(c, q.numero);
    return { body: r };
  });
}));

router.post('/echeqs/:numero/anular', ruta(async (req) => {
  const cuit = req.body?.cuit;
  return tx(async (c) => {
    const q = (await c.query(`select q.*, b.cuit as librador_cuit from banco.cheques q join banco.cuentas b on b.id = q.cuenta_librador
      where q.numero = $1 and q.canal = 'echeq' for update`, [String(req.params.numero)])).rows[0];
    if (!q) throw falla(404, 'eCheq no encontrado');
    if (q.librador_cuit !== cuit) throw falla(403, 'solo quien lo emitió puede anularlo');
    if (q.estado !== 'emitido') throw falla(409, 'solo se anula un eCheq que todavía no se cobró');
    await c.query("update banco.cheques set estado = 'anulado', actualizado_en = now() where id = $1", [q.id]);
    return { body: { numero: q.numero, estado: 'anulado' } };
  });
}));

router.post('/qr/pagos', ruta(async (req) => {
  const { id_venta, cuit_origen, cuit_destino, monto, terminal_id } = req.body || {};
  if (!idValido(id_venta)) throw falla(400, 'id_venta es obligatorio');
  if (!cuitValido(cuit_origen) || !cuitValido(cuit_destino)) throw falla(400, 'el QR debe identificar dos CUIL de 11 dígitos');
  if (!montoValido(monto)) throw falla(400, 'monto debe ser un número positivo de hasta dos decimales');
  if (cuit_origen === cuit_destino) throw falla(400, 'no podés pagarte a vos mismo');
  if (terminal_id !== undefined && !idValido(terminal_id)) throw falla(400, 'terminal_id inválido');
  const result = await tx((c) => pagar(c, { id_venta, origenCuit: cuit_origen, destinoCuit: cuit_destino, monto, op: 'qr', exigirDestino: false, liquidarBanco: true, terminal_id }));
  if (result.body._webhookEventId) { result.body.webhook=await entregarEvento(result.body._webhookEventId); delete result.body._webhookEventId; }
  return result;
}));

module.exports = { router, pagar };

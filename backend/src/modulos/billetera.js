// Billetera virtual (contrato de Lucas M) sobre la base compartida.
// Si la billetera está vinculada a una cuenta del Banco, cada carga debita
// esa cuenta y acredita la custodia de la Billetera (banco.movimientos).
const express = require('express');
const { query, tx } = require('../db');
const { falla, cuitValido, idValido, montoValido, uuidValido, num, hash, ruta } = require('../http');
const { transferir } = require('./banco');

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

const filaBilletera = (b) => ({
  id: b.id, titular: b.titular, cuit: b.cuit, alias: b.alias, saldo: num(b.saldo),
  fecha_alta: new Date(b.creado_en).toISOString(), banco_cuenta_id: b.banco_cuenta_id || null,
});
const filaMovimiento = (m) => ({
  id: m.id, tipo: m.tipo, monto: num(m.monto), contraparte: m.contraparte || m.contraparte_cuit || null,
  saldo_resultante: num(m.saldo_resultante), fecha: new Date(m.creado_en).toISOString(),
});

const porCuit = async (c, cuit, lock = false) =>
  (await c.query(`select * from billetera.cuentas where cuit = $1${lock ? ' for update' : ''}`, [cuit])).rows[0];
const porId = async (c, id) => (await c.query('select * from billetera.cuentas where id = $1', [id])).rows[0];

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
    `select c.*, (u.password_hash = extensions.crypt($2, u.password_hash)) as ok
     from billetera.cuentas c join billetera.usuarios u on u.cuenta_id = c.id where c.cuit = $1`, [cuit, clave]);
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
  const { titular, cuil, alias, contrasena } = req.body || {};
  if (!titular || typeof titular !== 'string') throw falla(400, 'nombre y apellido son obligatorios');
  if (!cuitValido(cuil)) throw falla(400, 'el CUIL debe tener 11 dígitos, sin puntos ni guiones');
  if (!alias || typeof alias !== 'string') throw falla(400, 'el alias es obligatorio');
  if (typeof contrasena !== 'string' || contrasena.length < MIN_CLAVE) throw falla(400, 'la contraseña debe tener al menos 8 caracteres');
  const cuenta = await tx((c) => crearCuenta(c, { titular, cuit: cuil, alias, contrasena }));
  return { status: 201, body: { billetera: filaBilletera(cuenta) } };
}));

router.get('/demo/clientes', ruta(async () => {
  const { rows } = await query('select * from billetera.cuentas where cuit = any($1)', [DEMO.map((d) => d.cuit)]);
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
  const { titular, cuit, alias, contrasena } = req.body || {};
  if (!titular || typeof titular !== 'string') throw falla(400, 'titular es obligatorio');
  if (!cuitValido(cuit)) throw falla(400, 'cuit debe ser un string de 11 dígitos, sin puntos ni guiones');
  if (!alias || typeof alias !== 'string') throw falla(400, 'alias es obligatorio');
  if (contrasena && (typeof contrasena !== 'string' || contrasena.length < MIN_CLAVE)) {
    throw falla(400, 'la contraseña debe tener al menos 8 caracteres');
  }
  const cuenta = await tx((c) => crearCuenta(c, { titular, cuit, alias, contrasena: contrasena || null }));
  return { status: 201, body: filaBilletera(cuenta) };
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

// POST /billetera/cargas — acredita saldo; si hay cuenta bancaria vinculada, sale de ahí.
router.post('/cargas', ruta(async (req) => {
  const { id_venta, cuit, monto } = req.body || {};
  if (!idValido(id_venta)) throw falla(400, 'id_venta es obligatorio');
  if (!cuitValido(cuit)) throw falla(400, 'cuit debe ser un string de 11 dígitos, sin puntos ni guiones');
  if (!montoValido(monto)) throw falla(400, 'monto debe ser un número positivo de hasta dos decimales');
  const payload_hash = hash({ op: 'carga', cuit, monto });
  return tx(async (c) => {
    const b = await porCuit(c, cuit, true);
    if (!b) throw falla(404, 'no existe billetera para ese cuit');
    const ya = await previo(c, id_venta, b, payload_hash);
    if (ya) {
      return { status: 200, body: { ...filaBilletera(b), id_venta, movimiento: filaMovimiento(ya), saldo_resultante: num(ya.saldo_resultante) } };
    }
    let banco = null;
    if (b.banco_cuenta_id) {
      banco = (await transferir(c, {
        id_operacion: `carga:${id_venta}`, tipo: 'carga_billetera', origen: b.banco_cuenta_id,
        destino: CUENTA_CUSTODIA, monto, payload: { cuit },
      })).movimiento;
    }
    const saldo = num(b.saldo) + monto;
    await c.query('update billetera.cuentas set saldo = $2 where id = $1', [b.id, saldo]);
    const m = await movimiento(c, {
      id_operacion: id_venta, cuenta: b, tipo: 'carga', monto, saldo, payload_hash,
      contraparte: banco ? `Carga desde cuenta bancaria ${b.banco_cuenta_id}` : 'Carga de saldo',
      banco_movimiento_id: banco ? banco.id : null,
    });
    return {
      status: 201,
      body: { ...filaBilletera({ ...b, saldo }), id_venta, movimiento: filaMovimiento(m), saldo_resultante: saldo,
        banco_movimiento_id: banco ? banco.id : null },
    };
  });
}));

// Debita una billetera y, si el destino también tiene billetera, la acredita.
async function pagar(c, { id_venta, origenCuit, destinoCuit, monto, op, exigirDestino }) {
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
    return { status: 200, body: { ...filaBilletera(origen), id_venta, movimiento: filaMovimiento(ya), saldo_resultante: num(ya.saldo_resultante), estado: 'confirmado' } };
  }
  if (num(origen.saldo) < monto) throw falla(400, 'saldo insuficiente');
  const saldoOrigen = num(origen.saldo) - monto;
  await c.query('update billetera.cuentas set saldo = $2 where id = $1', [origen.id, saldoOrigen]);
  const m = await movimiento(c, {
    id_operacion: id_venta, cuenta: origen, tipo: 'pago', monto, saldo: saldoOrigen, payload_hash,
    contraparte: destino ? `Pago a ${destino.alias}` : `Pago a comercio ${destinoCuit}`, contraparte_cuit: destinoCuit,
  });
  if (destino) {
    const saldoDestino = num(destino.saldo) + monto;
    await c.query('update billetera.cuentas set saldo = $2 where id = $1', [destino.id, saldoDestino]);
    await movimiento(c, {
      id_operacion: id_venta, cuenta: destino, tipo: 'cobro', monto, saldo: saldoDestino, payload_hash,
      contraparte: `Cobro de ${origen.alias}`, contraparte_cuit: origenCuit,
    });
  }
  return {
    status: 201,
    body: { ...filaBilletera({ ...origen, saldo: saldoOrigen }), id_venta, movimiento: filaMovimiento(m), saldo_resultante: saldoOrigen, estado: 'confirmado' },
  };
}

router.post('/pagos', ruta(async (req) => {
  const { id_venta, cuit, monto, comercio_cuit } = req.body || {};
  if (!idValido(id_venta)) throw falla(400, 'id_venta es obligatorio');
  if (!cuitValido(cuit)) throw falla(400, 'cuit debe ser un string de 11 dígitos, sin puntos ni guiones');
  if (!montoValido(monto)) throw falla(400, 'monto debe ser un número positivo de hasta dos decimales');
  if (!cuitValido(comercio_cuit)) throw falla(400, 'comercio_cuit debe ser un string de 11 dígitos');
  if (cuit === comercio_cuit) throw falla(400, 'no podés pagarte a vos mismo');
  return tx((c) => pagar(c, { id_venta, origenCuit: cuit, destinoCuit: comercio_cuit, monto, op: 'pago', exigirDestino: false }));
}));

router.post('/qr/pagos', ruta(async (req) => {
  const { id_venta, cuit_origen, cuit_destino, monto } = req.body || {};
  if (!idValido(id_venta)) throw falla(400, 'id_venta es obligatorio');
  if (!cuitValido(cuit_origen) || !cuitValido(cuit_destino)) throw falla(400, 'el QR debe identificar dos CUIL de 11 dígitos');
  if (!montoValido(monto)) throw falla(400, 'monto debe ser un número positivo de hasta dos decimales');
  if (cuit_origen === cuit_destino) throw falla(400, 'no podés pagarte a vos mismo');
  return tx((c) => pagar(c, { id_venta, origenCuit: cuit_origen, destinoCuit: cuit_destino, monto, op: 'qr', exigirDestino: true }));
}));

module.exports = { router };

// Catálogo y checkout compartidos. La venta, cobro, percepción y factura se
// confirman en una sola transacción de Postgres y se deduplican por id_venta.
const crypto = require('node:crypto');
const express = require('express');
const { query, tx } = require('../db');
const { falla, cuitValido, idValido, montoValido, num, hash, ruta } = require('../http');
const { transferir } = require('./banco');
const { pagar: pagarBilletera } = require('./billetera');

const router = express.Router();
const pad = (n, width) => String(n).padStart(width, '0');
const tipos = { responsable_inscripto: 'FACTURA_B', monotributo: 'FACTURA_C', exento: 'FACTURA_C', consumidor_final: 'FACTURA_C' };

router.get('/health', ruta(async () => ({ body: { status: 'ok', servicio: 'TPV', modulo: 'tpv' } })));
router.get('/integraciones', ruta(async () => ({ body: [
  { nombre: 'Padrón común', estado: 'ok' }, { nombre: 'Banco', estado: 'ok' },
  { nombre: 'ARBA', estado: 'ok' }, { nombre: 'ARCA', estado: 'ok' },
  { nombre: 'Base de datos compartida', estado: 'ok' },
] })));
router.get('/terminales', ruta(async () => ({ body: (await query('select id,nombre,creado_en from tpv.terminales order by id')).rows })));
// Adaptador de compatibilidad para la interfaz de Brisa (Mostrador).
router.get('/comercios', ruta(async () => {
  const { rows } = await query(`select c.cuit,c.razon_social,tc.rubro,tc.cuenta_destino,tc.activo
    from tpv.comercios tc join padron.contribuyentes c using(cuit)
    where tc.terminal_id='brisa' order by c.razon_social`);
  return { body: rows };
}));
router.post('/comercios', ruta(async (req) => {
  const b=req.body||{}; const cuit=String(b.cuit||'');
  if(!cuitValido(cuit)||!String(b.razon_social||'').trim()) throw falla(400,'CUIT y razón social son obligatorios');
  const result=await tx(async c=>{
    const contributor=(await c.query('select cuit,razon_social from padron.contribuyentes where cuit=$1 for update',[cuit])).rows[0];
    if(!contributor) throw falla(404,'El CUIT debe existir antes en el padrón central');
    await c.query('insert into tpv.terminales(id,nombre) values(\'brisa\',\'TPV Brisa\') on conflict do nothing');
    const cuenta=(await c.query('select id from banco.cuentas where cuit=$1 order by creado_en limit 1',[cuit])).rows[0];
    const cuentaDestino=b.cuenta_destino||cuenta?.id||null;
    if(cuentaDestino && !(await c.query('select 1 from banco.cuentas where id=$1 and cuit=$2',[cuentaDestino,cuit])).rows[0]) throw falla(400,'La cuenta de cobro no pertenece al CUIT');
    await c.query(`insert into tpv.comercios(terminal_id,cuit,rubro,cuenta_destino) values('brisa',$1,$2,$3)
      on conflict(terminal_id,cuit) do update set rubro=excluded.rubro,cuenta_destino=excluded.cuenta_destino,activo=true`,[cuit,b.rubro||'Comercio',cuentaDestino]);
    return {cuit,razon_social:contributor.razon_social,rubro:b.rubro||'Comercio',cuenta_destino:cuentaDestino,activo:true};
  });
  return {status:201,body:result};
}));
router.put('/comercios/:cuit', ruta(async(req)=>{
  if(!cuitValido(req.params.cuit)) throw falla(400,'CUIT inválido');
  const b=req.body||{};
  const {rows}=await query(`update tpv.comercios tc set rubro=coalesce(nullif($2,''),tc.rubro),
    cuenta_destino=coalesce(nullif($3,''),tc.cuenta_destino),activo=coalesce($4,tc.activo)
    from padron.contribuyentes c where tc.cuit=$1 and c.cuit=tc.cuit and tc.terminal_id='brisa'
    returning tc.cuit,c.razon_social,tc.rubro,tc.cuenta_destino,tc.activo`,[req.params.cuit,String(b.rubro||'').trim(),String(b.cuenta_destino||'').trim(),typeof b.activo==='boolean'?b.activo:null]);
  if(!rows[0]) throw falla(404,'comercio no encontrado en el padrón');
  return {body:rows[0]};
}));
router.get('/productos', ruta(async (req) => {
  const { terminal_id, cuit } = req.query; const comercioCuit=cuit||req.query.comercio_cuit;
  if (comercioCuit !== undefined && !cuitValido(comercioCuit)) throw falla(400, 'cuit inválido');
  const incluirInactivos=req.query.incluir_inactivos==='true';
  const { rows } = await query(`select p.* from tpv.productos p where (p.activo=true or $3::boolean)
    and ($1::text is null or p.terminal_id=$1) and ($2::text is null or p.comercio_cuit=$2)
    order by p.nombre`, [terminal_id || null, comercioCuit || null,incluirInactivos]);
  return { body: rows.map((r) => ({ id: r.id, terminal_id: r.terminal_id, comercio_cuit: r.comercio_cuit,
    codigo: r.codigo, nombre: r.nombre, categoria:r.categoria||'General', precio: num(r.precio), stock: r.stock, activo: r.activo })) };
}));

router.post('/productos', ruta(async (req) => {
  const b = req.body || {};
  if (!idValido(b.terminal_id) || !cuitValido(b.comercio_cuit) || !String(b.nombre || '').trim() || !montoValido(b.precio)) {
    throw falla(400, 'terminal_id, comercio_cuit, nombre y precio positivo son obligatorios');
  }
  const { rows } = await query(`insert into tpv.productos(terminal_id,comercio_cuit,codigo,nombre,categoria,precio,stock,activo)
    select $1,$2,$3,$4,$5,$6,$7,$8 where exists(select 1 from tpv.terminales where id=$1)
      and exists(select 1 from padron.contribuyentes where cuit=$2)
    returning *`, [b.terminal_id, b.comercio_cuit, b.codigo || null, String(b.nombre).trim(), b.categoria||'General',b.precio,
    b.stock === undefined ? null : b.stock,b.activo!==false]);
  if (!rows[0]) throw falla(404, 'terminal o comercio no encontrado');
  const p = rows[0]; return { status: 201, body: { ...p, precio: num(p.precio) } };
}));
router.put('/productos/:id', ruta(async(req)=>{
  const b=req.body||{};
  if(!idValido(req.params.id)||!String(b.nombre||'').trim()||!montoValido(b.precio)) throw falla(400,'producto, nombre y precio positivo son obligatorios');
  const {rows}=await query(`update tpv.productos set nombre=$2,categoria=$3,precio=$4,stock=$5,activo=$6
    where id=$1 returning *`,[req.params.id,String(b.nombre).trim(),b.categoria||'General',b.precio,b.stock===undefined?null:b.stock,b.activo!==false]);
  if(!rows[0]) throw falla(404,'producto no encontrado');
  return {body:{...rows[0],precio:num(rows[0].precio)}};
}));

router.get('/ventas', ruta(async (req) => {
  const { terminal_id } = req.query;
  const { rows } = await query(`select v.*,c.razon_social,ac.cae comprobante_cae,ac.numero comprobante_numero,ac.tipo_comprobante
    from tpv.ventas v join padron.contribuyentes c on c.cuit=v.comercio_cuit left join arca.comprobantes ac on ac.id::text=v.ref_comprobante
    where ($1::text is null or v.terminal_id=$1) order by v.creado_en desc limit 100`, [terminal_id || null]);
  return { body: rows.map((r) => ({ ...r,id:r.id_venta,createdAt:r.creado_en,estado:r.estado.toUpperCase(),creada:r.creado_en,subtotal:num(r.subtotal),percepcion:num(r.percepcion),total:num(r.total),comprobante:r.comprobante_numero?{numero:r.comprobante_numero,cae:r.comprobante_cae,tipo_comprobante:r.tipo_comprobante}:null })) };
}));

router.get('/ventas/:id', ruta(async (req) => {
  const v = (await query(`select v.*,c.razon_social from tpv.ventas v join padron.contribuyentes c on c.cuit=v.comercio_cuit where v.id_venta=$1`, [req.params.id])).rows[0];
  if (!v) throw falla(404, 'venta no encontrada');
  const items = (await query(`select vi.*,p.nombre from tpv.venta_items vi join tpv.productos p on p.id=vi.producto_id
    where vi.id_venta=$1 order by linea`, [v.id_venta])).rows;
  const movimiento=(await query('select * from banco.movimientos where id_operacion=$1',[`venta:${v.id_venta}`])).rows[0];
  const billetera=(await query("select * from billetera.movimientos where id_operacion=$1 and tipo='pago' order by creado_en desc limit 1",[`tpv:${v.id_venta}`])).rows[0];
  const factura=v.ref_comprobante?(await query('select * from arca.comprobantes where id=$1',[v.ref_comprobante])).rows[0]:null;
  return { body: { ...v, estado:v.estado.toUpperCase(), creada:v.creado_en, subtotal: num(v.subtotal), percepcion: num(v.percepcion), total: num(v.total),
    createdAt:v.creado_en,lineas:items.map((i)=>({producto_id:i.producto_id,nombre:i.nombre,descripcion:i.nombre,cantidad:i.cantidad,precio_unitario:num(i.precio_unitario),subtotal:num(i.precio_unitario)*i.cantidad})),
    pago:{medio:v.medio_pago,medio_pago:v.medio_pago,id_movimiento:movimiento?.id||billetera?.id||v.ref_pago,transaccion_id:movimiento?.id||billetera?.id||v.ref_pago,cuenta_origen:movimiento?.cuenta_origen||null,cuit_pagador:billetera?.cuit||null},
    comprobante:factura?{id:factura.id,tipo_comprobante:factura.tipo_comprobante,numero_comprobante:factura.numero,cae:factura.cae}:null,
    intentos:1,etapa_pendiente:null,ultimo_error:null,items:items.map((i) => ({ ...i, precio_unitario: num(i.precio_unitario) })) } };
}));

router.post('/ventas', ruta(async (req) => {
  const b = req.body || {};
  const idVenta = b.id_venta || b.id || crypto.randomUUID();
  const comercioCuit = b.comercio?.cuit || b.comercio_cuit || b.cuit;
  const terminal = b.terminal_id || b.terminalId || 'david';
  const medio = String(b.medio_pago || b.medioPago || 'banco').toLowerCase();
  const items = b.items;
  if (!idValido(idVenta) || !cuitValido(comercioCuit) || !Array.isArray(items) || !items.length) throw falla(400, 'id_venta, CUIT del comercio e items son obligatorios');
  if (!['banco', 'billetera', 'billetera_virtual', 'efectivo', 'tarjeta', 'transferencia'].includes(medio)) throw falla(400, 'medio_pago inválido');
  for (const i of items) if (!idValido(i.producto_id || i.productoId) || !Number.isInteger(i.cantidad) || i.cantidad <= 0) throw falla(400, 'cada item requiere productoId y cantidad entera positiva');
  const payloadHash = hash({ terminal, comercioCuit, medio, cliente: b.cuit_cliente || b.cuitComprador || b.cuit_pagador || null,
    items: items.map((i) => ({ id: i.producto_id || i.productoId, cantidad: i.cantidad })) });
  return tx(async (c) => {
    const anterior = (await c.query('select * from tpv.ventas where id_venta=$1 for update', [idVenta])).rows[0];
    if (anterior) {
      if (anterior.payload_hash !== payloadHash) throw falla(409, 'id_venta ya se utilizó con otros datos');
      if (anterior.estado !== 'completada') throw falla(409, `venta existente en estado ${anterior.estado}`);
      return { status: 200, body: { ...anterior, subtotal: num(anterior.subtotal), percepcion: num(anterior.percepcion), total: num(anterior.total), repetida: true } };
    }
    const terminalExiste = (await c.query('select 1 from tpv.terminales where id=$1', [terminal])).rows[0];
    if (!terminalExiste) throw falla(404, 'terminal TPV no encontrada');
    const comercio = (await c.query('select * from padron.contribuyentes where cuit=$1', [comercioCuit])).rows[0];
    if (!comercio) throw falla(404, 'comercio no encontrado en padrón');
    const resolved = [];
    for (const item of items) {
      const p = (await c.query(`select * from tpv.productos where id=$1 and terminal_id=$2 and comercio_cuit=$3 and activo=true for update`,
        [item.producto_id || item.productoId, terminal, comercioCuit])).rows[0];
      if (!p) throw falla(404, `producto ${item.producto_id || item.productoId} no disponible para este comercio/terminal`);
      if (p.stock !== null && p.stock < item.cantidad) throw falla(409, `stock insuficiente para ${p.nombre}`);
      resolved.push({ p, cantidad: item.cantidad, precio: num(p.precio) });
    }
    const subtotal = Math.round(resolved.reduce((sum, x) => sum + x.precio * x.cantidad, 0) * 100) / 100;
    if (subtotal <= 0) throw falla(400, 'el total de venta debe ser positivo');
    const v = (await c.query(`insert into tpv.ventas(id_venta,terminal_id,comercio_cuit,medio_pago,estado,subtotal,payload_hash)
      values($1,$2,$3,$4,'pendiente',$5,$6) returning *`, [idVenta, terminal, comercioCuit, medio.includes('billetera') ? 'billetera' : 'banco', subtotal, payloadHash])).rows[0];
    for (let index = 0; index < resolved.length; index++) {
      const { p, cantidad, precio } = resolved[index];
      await c.query('insert into tpv.venta_items(id_venta,linea,producto_id,cantidad,precio_unitario) values($1,$2,$3,$4,$5)', [idVenta, index + 1, p.id, cantidad, precio]);
      if (p.stock !== null) await c.query('update tpv.productos set stock=stock-$2 where id=$1', [p.id, cantidad]);
    }
    const inscripcion = (await c.query("select alicuota from arba.inscripciones where cuit=$1 and estado='activa'", [comercioCuit])).rows[0];
    const alicuota = inscripcion ? num(inscripcion.alicuota) : 0;
    const percepcion = Math.round(subtotal * alicuota * 100) / 100;
    const total = subtotal + percepcion;
    const cobroId = `venta:${idVenta}`;
    let pagoId;
    if (medio.includes('billetera')) {
      if (!cuitValido(b.cuit_cliente || b.cuitComprador || b.cuit_pagador)) throw falla(400, 'cuit_cliente es obligatorio para pagar con billetera');
      const pago = await pagarBilletera(c, { id_venta: `tpv:${idVenta}`, origenCuit: b.cuit_cliente || b.cuitComprador || b.cuit_pagador, destinoCuit: comercioCuit, monto: total, op: 'pago', exigirDestino: false });
      pagoId = pago.body.movimiento.id;
    } else {
      const cuentaDestino = (await c.query('select id from banco.cuentas where cuit=$1 order by creado_en limit 1', [comercioCuit])).rows[0]?.id;
      if (!cuentaDestino) throw falla(404, 'comercio sin cuenta bancaria asociada');
      const transf = await transferir(c, { id_operacion: cobroId, tipo: 'venta', origen: b.cuenta_origen || 'cuenta-mostrador', destino: cuentaDestino,
        monto: total, payload: { venta: idVenta, medio_pago: medio } });
      pagoId = transf.movimiento.id;
    }
    let percepcionId = null;
    if (inscripcion) {
      const payloadPercepcion = hash({ cuit: comercioCuit, monto: subtotal });
      const p = (await c.query(`insert into arba.percepciones(id_venta,cuit,monto_venta,alicuota_aplicada,monto_percepcion,payload_hash)
        values($1,$2,$3,$4,$5,$6) returning id`, [idVenta, comercioCuit, subtotal, alicuota, percepcion, payloadPercepcion])).rows[0];
      percepcionId = p.id;
    }
    const tipo = tipos[comercio.condicion_iva] || 'FACTURA_C';
    await c.query(`insert into arca.puntos_venta(emisor_cuit,punto_venta,tipo_comprobante) values($1,1,$2) on conflict do nothing`, [comercioCuit, tipo]);
    const numero = (await c.query(`update arca.puntos_venta set ultimo_numero=ultimo_numero+1
      where emisor_cuit=$1 and punto_venta=1 and tipo_comprobante=$2 returning ultimo_numero`, [comercioCuit, tipo])).rows[0].ultimo_numero;
    const cae = Array.from(crypto.randomBytes(14), (byte) => byte % 10).join('');
    const comprobante = (await c.query(`insert into arca.comprobantes(id_venta,emisor_cuit,punto_venta,tipo_comprobante,numero,subtotal,percepcion,monto_total,cae,cae_vencimiento,payload_hash)
      values($1,$2,1,$3,$4,$5,$6,$7,$8,current_date+10,$9) returning id`, [idVenta,comercioCuit,tipo,numero,subtotal,percepcion,total,cae,hash({ cuit:comercioCuit,total,percepcion,tipo,puntoVenta:1,receptor:null })])).rows[0];
    const out = (await c.query(`update tpv.ventas set estado='completada',percepcion=$2,total=$3,ref_percepcion=$4,ref_pago=$5,ref_comprobante=$6
      where id_venta=$1 returning *`, [idVenta,percepcion,total,percepcionId,pagoId,comprobante.id])).rows[0];
    return { status: 201, body: { ...out, subtotal: num(out.subtotal), percepcion: num(out.percepcion), total: num(out.total), repetida: false } };
  });
}));

module.exports = router;

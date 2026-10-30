// Catálogo y checkout compartidos. La venta, cobro, percepción y factura se
// confirman en una sola transacción de Postgres y se deduplican por id_venta.
const crypto = require('node:crypto');
const express = require('express');
const { query, tx } = require('../db');
const { falla, cuitValido, idValido, montoValido, num, hash, ruta } = require('../http');
const { transferir, cuentaPorReferencia } = require('./banco');
const { pagar: pagarBilletera } = require('./billetera');
const { registrarEvento, entregarEvento } = require('./webhooks');
const { calcularIva, tipoComprobante, calcularPercepcion } = require('./impuestos');

const router = express.Router();
const IVAS = ['21', '10.5', '27', '0', 'exento'];
const pad = (n, width) => String(n).padStart(width, '0');

router.get('/health', ruta(async () => ({ body: { status: 'ok', servicio: 'TPV', modulo: 'tpv' } })));
router.get('/integraciones', ruta(async () => ({ body: [
  { nombre: 'Padrón común', estado: 'ok' }, { nombre: 'Banco', estado: 'ok' },
  { nombre: 'ARBA', estado: 'ok' }, { nombre: 'ARCA', estado: 'ok' },
  { nombre: 'Base de datos compartida', estado: 'ok' },
] })));
router.get('/terminales', ruta(async () => ({ body: (await query('select id,nombre,creado_en from tpv.terminales order by id')).rows })));
// Comercios y cuenta bancaria receptora por terminal. Brisa conserva su valor
// predeterminado; Sebastián y los siguientes terminales usan terminal_id.
router.get('/comercios', ruta(async (req) => {
  const terminal = req.query.terminal_id || 'brisa';
  if (!idValido(terminal)) throw falla(400, 'terminal_id inválido');
  const { rows } = await query(`select c.cuit,c.razon_social,tc.rubro,tc.cuenta_destino,tc.activo
    ,bc.alias as cuenta_alias,bc.cbu as cuenta_cbu,bc.saldo as cuenta_saldo
    from tpv.comercios tc join padron.contribuyentes c using(cuit)
    left join banco.cuentas bc on bc.id=tc.cuenta_destino
    where tc.terminal_id=$1 order by c.razon_social`, [terminal]);
  return { body: rows };
}));
// Vincula un comercio del padrón con una terminal y su cuenta de cobro. La usan
// la ruta POST /tpv/comercios y la activación desde el CORE de comercios.
async function vincularComercio(c,b){
  const cuit=String(b.cuit||''); const terminal=String(b.terminal_id||'brisa');
  const contributor=(await c.query('select cuit,razon_social from padron.contribuyentes where cuit=$1 for update',[cuit])).rows[0];
  if(!contributor) throw falla(404,'El CUIT debe existir antes en el padrón central');
  const terminalRow=(await c.query('select id from tpv.terminales where id=$1',[terminal])).rows[0];
  if(!terminalRow) throw falla(404,'terminal TPV no encontrada');
  const cuenta=(await c.query('select id from banco.cuentas where cuit=$1 order by creado_en limit 1',[cuit])).rows[0];
  const cuentaDestino=b.cuenta_destino||cuenta?.id||null;
  if(!cuentaDestino) throw falla(409,'el CUIT debe tener una cuenta bancaria abierta en Banco M');
  if(cuentaDestino && !(await c.query('select 1 from banco.cuentas where id=$1 and cuit=$2',[cuentaDestino,cuit])).rows[0]) throw falla(400,'La cuenta de cobro no pertenece al CUIT');
  await c.query(`insert into tpv.comercios(terminal_id,cuit,rubro,cuenta_destino) values($1,$2,$3,$4)
    on conflict(terminal_id,cuit) do update set rubro=excluded.rubro,cuenta_destino=excluded.cuenta_destino,activo=true`,[terminal,cuit,b.rubro||'Comercio',cuentaDestino]);
  return {terminal_id:terminal,cuit,razon_social:contributor.razon_social,rubro:b.rubro||'Comercio',cuenta_destino:cuentaDestino,activo:true};
}
router.post('/comercios', ruta(async (req) => {
  const b=req.body||{}; const cuit=String(b.cuit||''); const terminal=String(b.terminal_id||'brisa');
  if(!idValido(terminal)) throw falla(400,'terminal_id inválido');
  if(!cuitValido(cuit)||!String(b.razon_social||'').trim()) throw falla(400,'CUIT y razón social son obligatorios');
  const result=await tx(c=>vincularComercio(c,b));
  return {status:201,body:result};
}));
router.put('/comercios/:cuit', ruta(async(req)=>{
  if(!cuitValido(req.params.cuit)) throw falla(400,'CUIT inválido');
  const b=req.body||{};
  const terminal=String(b.terminal_id||req.query.terminal_id||'brisa');
  if(!idValido(terminal)) throw falla(400,'terminal_id inválido');
  if(b.cuenta_destino && !(await query('select 1 from banco.cuentas where id=$1 and cuit=$2',[String(b.cuenta_destino),req.params.cuit])).rows[0]) throw falla(400,'La cuenta de cobro no pertenece al CUIT');
  const {rows}=await query(`update tpv.comercios tc set rubro=coalesce(nullif($2,''),tc.rubro),
    cuenta_destino=coalesce(nullif($3,''),tc.cuenta_destino),activo=coalesce($4,tc.activo)
    from padron.contribuyentes c where tc.cuit=$1 and c.cuit=tc.cuit and tc.terminal_id=$5
    returning tc.cuit,c.razon_social,tc.rubro,tc.cuenta_destino,tc.activo`,[req.params.cuit,String(b.rubro||'').trim(),String(b.cuenta_destino||'').trim(),typeof b.activo==='boolean'?b.activo:null,terminal]);
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
  const iva = String(b.iva ?? '21');
  if (!IVAS.includes(iva)) throw falla(400, 'iva debe ser 21, 10.5, 27, 0 o exento');
  const { rows } = await query(`insert into tpv.productos(terminal_id,comercio_cuit,codigo,nombre,categoria,precio,stock,activo,iva)
    select $1,$2::padron.cuit,$3,$4,$5,$6,$7,$8,$9 where exists(select 1 from tpv.terminales where id=$1)
      and exists(select 1 from padron.contribuyentes where cuit=$2::padron.cuit)
    returning *`, [b.terminal_id, b.comercio_cuit, b.codigo || null, String(b.nombre).trim(), b.categoria||'General',b.precio,
    b.stock === undefined ? null : b.stock,b.activo!==false,iva]);
  if (!rows[0]) throw falla(404, 'terminal o comercio no encontrado');
  const p = rows[0]; return { status: 201, body: { ...p, precio: num(p.precio) } };
}));
router.put('/productos/:id', ruta(async(req)=>{
  const b=req.body||{};
  if(!idValido(req.params.id)||!String(b.nombre||'').trim()||!montoValido(b.precio)) throw falla(400,'producto, nombre y precio positivo son obligatorios');
  if(b.iva!==undefined&&!IVAS.includes(String(b.iva))) throw falla(400,'iva debe ser 21, 10.5, 27, 0 o exento');
  const {rows}=await query(`update tpv.productos set nombre=$2,categoria=$3,precio=$4,stock=$5,activo=$6,iva=coalesce($7,iva)
    where id=$1 returning *`,[req.params.id,String(b.nombre).trim(),b.categoria||'General',b.precio,b.stock===undefined?null:b.stock,b.activo!==false,b.iva===undefined?null:String(b.iva)]);
  if(!rows[0]) throw falla(404,'producto no encontrado');
  return {body:{...rows[0],precio:num(rows[0].precio)}};
}));

// Listado con detalle (líneas, comprobante, percepción y cliente) para las cajas
// que muestran su propio historial, como el TPV de David. ?detalle=1&id_venta=...
async function ventasDetalladas({ terminal, id }) {
  const { rows } = await query(`select v.*, c.razon_social,
      ac.cae, ac.cae_vencimiento::text as cae_vencimiento, ac.tipo_comprobante, ac.punto_venta, ac.numero, ac.receptor_cuit,
      ap.alicuota_aplicada,
      coalesce((select json_agg(json_build_object('producto_id', vi.producto_id, 'nombre', p.nombre, 'cantidad', vi.cantidad,
        'precio_unitario', vi.precio_unitario) order by vi.linea)
        from tpv.venta_items vi join tpv.productos p on p.id = vi.producto_id where vi.id_venta = v.id_venta), '[]') as lineas
    from tpv.ventas v join padron.contribuyentes c on c.cuit = v.comercio_cuit
    left join arca.comprobantes ac on ac.id::text = v.ref_comprobante
    left join arba.percepciones ap on ap.id::text = v.ref_percepcion
    where ($1::text is null or v.terminal_id = $1) and ($2::text is null or v.id_venta = $2)
    order by v.creado_en desc limit 500`, [terminal || null, id || null]);
  return rows.map((r) => ({
    id_venta: r.id_venta, terminal_id: r.terminal_id, comercio_cuit: r.comercio_cuit, razon_social: r.razon_social,
    estado: r.estado, medio_pago: r.medio_pago, medio_detalle: r.medio_detalle, creado_en: new Date(r.creado_en).toISOString(),
    subtotal: num(r.subtotal), percepcion: num(r.percepcion), total: num(r.total), ref_pago: r.ref_pago,
    alicuota_percepcion: r.alicuota_aplicada === null ? null : num(r.alicuota_aplicada), cuit_cliente: r.receptor_cuit,
    lineas: (r.lineas || []).map((l) => ({ ...l, precio_unitario: num(l.precio_unitario) })),
    comprobante: r.tipo_comprobante ? { tipo_comprobante: r.tipo_comprobante, punto_venta: pad(r.punto_venta, 5),
      numero: pad(r.numero, 8), cae: `FICTICIO-${r.cae}`, vencimiento_cae: r.cae_vencimiento } : null,
  }));
}

router.get('/ventas', ruta(async (req) => {
  const { terminal_id } = req.query;
  if (req.query.detalle === '1') return { body: await ventasDetalladas({ terminal: terminal_id, id: req.query.id_venta }) };
  const { rows } = await query(`select v.*,c.razon_social,ac.cae comprobante_cae,ac.numero comprobante_numero,ac.tipo_comprobante
    from tpv.ventas v join padron.contribuyentes c on c.cuit=v.comercio_cuit left join arca.comprobantes ac on ac.id::text=v.ref_comprobante
    where ($1::text is null or v.terminal_id=$1) order by v.creado_en desc limit 100`, [terminal_id || null]);
  return { body: rows.map((r) => ({ ...r,id:r.id_venta,createdAt:r.creado_en,estado:r.estado.toUpperCase(),creada:r.creado_en,subtotal:num(r.subtotal),percepcion:num(r.percepcion),total:num(r.total),comprobante:r.comprobante_numero?{
    numero:r.comprobante_numero,cae:`FICTICIO-${r.comprobante_cae}`,tipo_comprobante:r.tipo_comprobante,
    estado:'simulado',validez_fiscal:false,
  }:null })) };
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
    comprobante:factura?{id:factura.id,tipo_comprobante:factura.tipo_comprobante,numero_comprobante:factura.numero,
      cae:`FICTICIO-${factura.cae}`,estado:'simulado',validez_fiscal:false}:null,
    intentos:1,etapa_pendiente:null,ultimo_error:null,items:items.map((i) => ({ ...i, precio_unitario: num(i.precio_unitario) })) } };
}));

router.post('/ventas', ruta(async (req) => {
  const b = req.body || {};
  const idVenta = b.id_venta || b.id || crypto.randomUUID();
  const comercioCuit = b.comercio?.cuit || b.comercio_cuit || b.cuit;
  const terminal = b.terminal_id || b.terminalId || 'david';
  const puntoVenta = Number(b.punto_venta ?? 1);
  const medio = String(b.medio_pago || b.medioPago || 'banco').toLowerCase();
  const items = b.items;
  if (!idValido(idVenta) || !cuitValido(comercioCuit) || !Array.isArray(items) || !items.length) throw falla(400, 'id_venta, CUIT del comercio e items son obligatorios');
  if (!Number.isInteger(puntoVenta) || puntoVenta < 1 || puntoVenta > 99999) throw falla(400, 'punto_venta inválido');
  if (!['banco', 'billetera', 'billetera_virtual', 'efectivo', 'tarjeta', 'transferencia'].includes(medio)) throw falla(400, 'medio_pago inválido');
  for (const i of items) if (!idValido(i.producto_id || i.productoId) || !Number.isInteger(i.cantidad) || i.cantidad <= 0) throw falla(400, 'cada item requiere productoId y cantidad entera positiva');
  const clienteCuit = b.cuit_cliente || b.cuitComprador || b.cuit_pagador || null;
  if (clienteCuit !== null && !cuitValido(clienteCuit)) throw falla(400, 'cuit_cliente debe tener 11 dígitos');
  const payloadHash = hash({ terminal, comercioCuit, medio, puntoVenta, cliente: b.cuit_cliente || b.cuitComprador || b.cuit_pagador || null,
    items: items.map((i) => ({ id: i.producto_id || i.productoId, cantidad: i.cantidad })) });
  const result = await tx(async (c) => {
    const anterior = (await c.query('select * from tpv.ventas where id_venta=$1 for update', [idVenta])).rows[0];
    if (anterior) {
      if (anterior.payload_hash !== payloadHash) throw falla(409, 'id_venta ya se utilizó con otros datos');
      if (anterior.estado !== 'completada') throw falla(409, `venta existente en estado ${anterior.estado}`);
      const event=(await c.query(`select id from tpv.webhook_eventos where terminal_id=$1 and id_venta=$2 and evento='payment.confirmed'`,[terminal,idVenta])).rows[0];
      return { status: 200, body: { ...anterior, subtotal: num(anterior.subtotal), percepcion: num(anterior.percepcion), total: num(anterior.total), repetida: true, _webhookEventId:event?.id||null } };
    }
    const terminalExiste = (await c.query('select 1 from tpv.terminales where id=$1', [terminal])).rows[0];
    if (!terminalExiste) throw falla(404, 'terminal TPV no encontrada');
    const comercio = (await c.query('select * from padron.contribuyentes where cuit=$1', [comercioCuit])).rows[0];
    if (!comercio) throw falla(404, 'comercio no encontrado en padrón');
    const vinculacion = (await c.query(`select tc.cuenta_destino,b.cbu from tpv.comercios tc
      left join banco.cuentas b on b.id=tc.cuenta_destino
      where tc.terminal_id=$1 and tc.cuit=$2 and tc.activo=true`, [terminal,comercioCuit])).rows[0];
    if (['brisa','sebastian','david'].includes(terminal) && !vinculacion?.cuenta_destino) {
      throw falla(409, 'vinculá el comercio a una cuenta bancaria de Banco M antes de vender');
    }
    const resolved = [];
    for (const item of items) {
      const p = (await c.query(`select * from tpv.productos where id=$1 and terminal_id=$2 and comercio_cuit=$3 and activo=true for update`,
        [item.producto_id || item.productoId, terminal, comercioCuit])).rows[0];
      if (!p) throw falla(404, `producto ${item.producto_id || item.productoId} no disponible para este comercio/terminal`);
      if (p.stock !== null && p.stock < item.cantidad) throw falla(409, `stock insuficiente para ${p.nombre}`);
      resolved.push({ p, cantidad: item.cantidad, precio: num(p.precio), iva: p.iva || '21' });
    }
    const subtotal = Math.round(resolved.reduce((sum, x) => sum + x.precio * x.cantidad, 0) * 100) / 100;
    if (subtotal <= 0) throw falla(400, 'el total de venta debe ser positivo');
    const v = (await c.query(`insert into tpv.ventas(id_venta,terminal_id,comercio_cuit,medio_pago,estado,subtotal,payload_hash,medio_detalle)
      values($1,$2,$3,$4,'pendiente',$5,$6,$7) returning *`, [idVenta, terminal, comercioCuit, medio.includes('billetera') ? 'billetera' : 'banco', subtotal, payloadHash, medio])).rows[0];
    for (let index = 0; index < resolved.length; index++) {
      const { p, cantidad, precio } = resolved[index];
      await c.query('insert into tpv.venta_items(id_venta,linea,producto_id,cantidad,precio_unitario) values($1,$2,$3,$4,$5)', [idVenta, index + 1, p.id, cantidad, precio]);
      if (p.stock !== null) await c.query('update tpv.productos set stock=stock-$2 where id=$1', [p.id, cantidad]);
    }
    // Impuestos: IVA según ARCA (por producto), percepción según ARBA (agente,
    // padrón del comprador y mínimo). Ver doc/IMPUESTOS-Y-PERCEPCIONES.md.
    // La cuenta de quien paga puede venir por id, CBU o alias. Su titular es el
    // comprador: si no se informó su CUIT, se toma de la cuenta (como en un débito real).
    let cuentaOrigen = null;
    let compradorCuit = clienteCuit;
    if (b.cuenta_origen && !medio.includes('billetera')) {
      const co = await cuentaPorReferencia(c, b.cuenta_origen);
      if (!co) throw falla(404, 'no existe la cuenta de quien paga (revisá el alias o CBU)');
      cuentaOrigen = co.id;
      if (!compradorCuit && !['cuenta-mostrador', 'cuenta-caja'].includes(co.id)) compradorCuit = co.cuit;
    }
    const receptor = compradorCuit
      ? (await c.query('select cuit,condicion_iva from padron.contribuyentes where cuit=$1', [compradorCuit])).rows[0] : null;
    const condicionReceptor = receptor?.condicion_iva || 'consumidor_final';
    const fiscal = calcularIva(resolved.map((x) => ({ producto_id: x.p.id, nombre: x.p.nombre, precio: x.precio, cantidad: x.cantidad, iva: x.iva })), comercio.condicion_iva);
    const perc = await calcularPercepcion(c, { agenteCuit: comercioCuit, sujetoCuit: compradorCuit, base: fiscal.neto + fiscal.exento });
    const alicuota = perc.alicuota;
    const percepcion = perc.monto;
    const total = Math.round((subtotal + percepcion) * 100) / 100;
    const cobroId = `venta:${idVenta}`;
    let pagoId;
    if (medio.includes('billetera')) {
      if (!cuitValido(b.cuit_cliente || b.cuitComprador || b.cuit_pagador)) throw falla(400, 'cuit_cliente es obligatorio para pagar con billetera');
      const pago = await pagarBilletera(c, { id_venta: `tpv:${idVenta}`, origenCuit: b.cuit_cliente || b.cuitComprador || b.cuit_pagador, destinoCuit: comercioCuit, monto: total, op: 'pago', exigirDestino: false, liquidarBanco: true });
      pagoId = pago.body.movimiento.id;
    } else {
      const cuentaDestino = vinculacion?.cuenta_destino || (await c.query('select id from banco.cuentas where cuit=$1 order by creado_en limit 1', [comercioCuit])).rows[0]?.id;
      if (!cuentaDestino) throw falla(404, 'comercio sin cuenta bancaria asociada');
      const transf = await transferir(c, { id_operacion: cobroId, tipo: 'venta', origen: cuentaOrigen || 'cuenta-mostrador', destino: cuentaDestino,
        monto: total, payload: { venta: idVenta, medio_pago: medio } });
      pagoId = transf.movimiento.id;
    }
    let percepcionId = null;
    if (percepcion > 0) {
      const payloadPercepcion = hash({ cuit: comercioCuit, sujeto: compradorCuit, base: perc.base, alicuota });
      const p = (await c.query(`insert into arba.percepciones(id_venta,cuit,monto_venta,alicuota_aplicada,monto_percepcion,payload_hash,sujeto_cuit,base_imponible,origen_alicuota)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, [idVenta, comercioCuit, subtotal, alicuota, percepcion, payloadPercepcion, compradorCuit, perc.base, perc.origen])).rows[0];
      percepcionId = p.id;
    }
    const tipo = tipoComprobante(comercio.condicion_iva, condicionReceptor);
    const puntoConfigurado = (await c.query(`update arca.puntos_venta set ultimo_numero=ultimo_numero+1
      where emisor_cuit=$1 and punto_venta=$2 and tipo_comprobante=$3 returning ultimo_numero`, [comercioCuit,puntoVenta,tipo])).rows[0];
    if (!puntoConfigurado) throw falla(409, 'configurá previamente en ARCA el punto de venta y el tipo de comprobante');
    const numero = puntoConfigurado.ultimo_numero;
    const cae = Array.from(crypto.randomBytes(14), (byte) => byte % 10).join('');
    const comprobante = (await c.query(`insert into arca.comprobantes(id_venta,emisor_cuit,receptor_cuit,receptor_condicion,punto_venta,tipo_comprobante,numero,
        subtotal,percepcion,monto_total,cae,cae_vencimiento,payload_hash,neto,iva_total,exento,iva_detalle)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,current_date+10,$12,$13,$14,$15,$16) returning id`,
      [idVenta,comercioCuit,compradorCuit,condicionReceptor,puntoVenta,tipo,numero,subtotal,percepcion,total,cae,
        hash({ cuit:comercioCuit,total,percepcion,tipo,puntoVenta,receptor:compradorCuit }),fiscal.neto,fiscal.iva_total,fiscal.exento,JSON.stringify(fiscal.iva_detalle)])).rows[0];
    const out = (await c.query(`update tpv.ventas set estado='completada',percepcion=$2,total=$3,ref_percepcion=$4,ref_pago=$5,ref_comprobante=$6
      where id_venta=$1 returning *`, [idVenta,percepcion,total,percepcionId,pagoId,comprobante.id])).rows[0];
    const webhookEventId=await registrarEvento(c,{terminal_id:terminal,id_venta:idVenta,payload:{
      event_type:'payment.confirmed',id_venta:idVenta,terminal_id:terminal,cuit_comercio:comercioCuit,
      cuit_pagador:medio.includes('billetera')?(b.cuit_cliente||b.cuitComprador||b.cuit_pagador):null,
      monto:total,subtotal,percepcion,moneda:'ARS',medio_pago:medio,estado:'confirmado',
      pago_id:pagoId,percepcion_id:percepcionId,comprobante_id:comprobante.id,
      punto_venta:puntoVenta,tipo_comprobante:tipo,neto:fiscal.neto,iva_total:fiscal.iva_total,
    }});
    const impuestos = { tipo_comprobante: tipo, receptor_cuit: compradorCuit, receptor_condicion: condicionReceptor,
      neto: fiscal.neto, iva_total: fiscal.iva_total, exento: fiscal.exento, iva_detalle: fiscal.iva_detalle, iva_discriminado: tipo === 'FACTURA_A',
      percepcion: { monto: percepcion, alicuota, base: perc.base, origen: perc.origen, motivo: perc.motivo }, simulacion: true };
    return { status: 201, body: { ...out, subtotal: num(out.subtotal), percepcion: num(out.percepcion), total: num(out.total), impuestos, repetida: false,_webhookEventId:webhookEventId } };
  });
  if (result.body._webhookEventId) { result.body.webhook=await entregarEvento(result.body._webhookEventId); delete result.body._webhookEventId; }
  return result;
}));

router.vincularComercio = vincularComercio;
module.exports = router;

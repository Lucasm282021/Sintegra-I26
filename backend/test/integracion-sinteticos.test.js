// Cinco contribuyentes sintéticos en una instancia PGlite aislada. No lee ni
// modifica Supabase ni los fixtures compartidos de las pruebas existentes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { before, after, test } = require('node:test');

const sujetos = {
  comercio: '30700010001', comprador: '20300010002', comercioWallet: '30700010003',
  municipal: '20300010004', tesoreria: '30000010005',
};
let base;
let server;
let receptor;
let receptorUrl;
const eventosRecibidos = [];
const secretoWebhook = 'sintegra-qa-secret-32-caracteres-minimos-0001';

async function abrirBaseSintetica() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const pg = new PGlite({ extensions: { pgcrypto } });
  await pg.exec('create schema if not exists extensions;');
  const dir = path.join(__dirname, '..', 'supabase', 'migrations');
  const migraciones = [
    '20261026000001_esquema_inicial.sql', '20261026000002_usuarios_billetera.sql',
    '20261028000004_municipio_tpv_operativos.sql', '20261028000005_municipio_operacion_bancaria.sql',
    '20261028000006_tpv_brisa_banco_m.sql', '20261028000009_qr_pagos_liquidacion.sql',
    '20261028000010_webhooks_tpv.sql',
  ];
  for (const nombre of migraciones) await pg.exec(fs.readFileSync(path.join(dir, nombre), 'utf8'));
  await pg.exec('alter table billetera.movimientos add column if not exists contraparte text;');
  // La migración municipal crea una cuenta de ejemplo. Se quita dentro de
  // esta base efímera para que el padrón de negocio contenga exactamente cinco CUIT.
  await pg.exec(`delete from banco.cuentas where id='cuenta-municipio'; delete from padron.contribuyentes where cuit='30000000098';`);
  await pg.exec(`
    insert into padron.contribuyentes(cuit,razon_social,tipo_persona,condicion_iva,domicilio_fiscal) values
      ('${sujetos.comercio}','Almacén Sintético Uno SRL','juridica','responsable_inscripto','Calle QA 101'),
      ('${sujetos.comprador}','Alicia Sintética','fisica','monotributo','Calle QA 202'),
      ('${sujetos.comercioWallet}','Servicios Sintéticos Dos SA','juridica','responsable_inscripto','Calle QA 303'),
      ('${sujetos.municipal}','Bruno Sintético','fisica','monotributo','Calle QA 404'),
      ('${sujetos.tesoreria}','Tesorería Sintética I26','juridica','responsable_inscripto','Calle QA 505');
    insert into arba.inscripciones(cuit,actividad,alicuota) values
      ('${sujetos.comercio}','Comercio minorista',0.03),('${sujetos.comercioWallet}','Servicios',0.02);
    insert into municipio.habilitaciones(cuit,rubro,domicilio) values
      ('${sujetos.municipal}','Servicios profesionales','Calle QA 404');
    insert into municipio.tasas(id_tributo,cuit,periodo,tipo,monto,concepto,desglose,vencimiento)
      values('QA-${sujetos.municipal}-2026-10','${sujetos.municipal}','2026-10','TSYH',750,'Tasa sintética QA',
      '[{"concepto":"Tasa sintética QA","importe":750}]','2026-10-31');
    insert into banco.cuentas(id,cuit,titular,alias,saldo) values
      ('qa-comercio','${sujetos.comercio}','Almacén Sintético Uno SRL','qa.comercio',20000),
      ('qa-comprador','${sujetos.comprador}','Alicia Sintética','qa.comprador',10000),
      ('qa-comercio-wallet','${sujetos.comercioWallet}','Servicios Sintéticos Dos SA','qa.comercio.wallet',0),
      ('qa-municipal','${sujetos.municipal}','Bruno Sintético','qa.municipal',10000),
      ('cuenta-mostrador','${sujetos.municipal}','Mostrador Sintético','qa.mostrador',5000),
      ('cuenta-billetera','${sujetos.tesoreria}','Custodia Sintética Billetera','qa.custodia',8000),
      ('cuenta-municipio','${sujetos.tesoreria}','Tesorería Sintética I26','qa.tesoreria',0);
    insert into billetera.cuentas(cuit,titular,alias,saldo,banco_cuenta_id) values
      ('${sujetos.comprador}','Alicia Sintética','alicia.qa',5000,'qa-comprador'),
      ('${sujetos.comercioWallet}','Servicios Sintéticos Dos SA','servicios.qa',0,'qa-comercio-wallet'),
      ('${sujetos.municipal}','Bruno Sintético','bruno.qa',3000,'qa-municipal');
    insert into tpv.terminales(id,nombre) values('qa-terminal','Terminal sintética QA');
    insert into tpv.productos(terminal_id,comercio_cuit,codigo,nombre,categoria,precio,stock) values
      ('qa-terminal','${sujetos.comercio}','QA-001','Producto sintético QA','General',1000,5);
  `);
  return pg;
}

async function api(metodo, url, body) {
  const r = await fetch(`${base}${url}`, {
    method: metodo, headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json() };
}

before(async () => {
  const pg = await abrirBaseSintetica();
  require('../src/db').setDb(pg);
  process.env.SINTEGRA_WEBHOOK_ADMIN_TOKEN = 'qa-token-de-administracion';
  server = require('../src/app').listen(0);
  await new Promise((ok) => server.once('listening', ok));
  base = `http://127.0.0.1:${server.address().port}`;
  receptor = http.createServer((req,res)=>{
    const chunks=[]; req.on('data',chunk=>chunks.push(chunk));
    req.on('end',()=>{
      const payload=JSON.parse(Buffer.concat(chunks).toString());
      const expected=`sha256=${crypto.createHmac('sha256',secretoWebhook).update(JSON.stringify(payload)).digest('hex')}`;
      if(req.headers['x-sintegra-signature']!==expected) { res.writeHead(401); return res.end(); }
      eventosRecibidos.push({payload,eventId:req.headers['x-sintegra-event-id']});
      res.writeHead(204); res.end();
    });
  });
  receptor.listen(0,'127.0.0.1');
  await new Promise((ok)=>receptor.once('listening',ok));
  receptorUrl=`http://127.0.0.1:${receptor.address().port}/api/webhooks/payment`;
});
after(() => { server?.close(); receptor?.close(); delete process.env.SINTEGRA_WEBHOOK_ADMIN_TOKEN; });

test('configuración del webhook queda protegida por token administrativo', async () => {
  const body=JSON.stringify({endpoint_url:receptorUrl,secret:secretoWebhook});
  const denied=await fetch(`${base}/tpv/terminales/qa-terminal/webhook`,{method:'PUT',headers:{'content-type':'application/json'},body});
  assert.equal(denied.status,401);
  const configured=await fetch(`${base}/tpv/terminales/qa-terminal/webhook`,{method:'PUT',headers:{'content-type':'application/json','x-sintegra-admin-token':'qa-token-de-administracion'},body});
  assert.equal(configured.status,200);
  const config=await configured.json();
  assert.equal(config.endpoint_url,receptorUrl);
  assert.equal(Object.hasOwn(config,'secret'),false);
});

test('fixture aislado contiene exactamente cinco contribuyentes sintéticos', async () => {
  const r = await fetch(`${base}/padron/contribuyentes/${sujetos.comercio}`);
  assert.equal(r.status, 200);
  const padron = await fetch(`${base}/municipio/comercios`).then((x) => x.json());
  assert.equal(padron.length, 1);
  const cuentas = await fetch(`${base}/banco/cuentas`).then((x) => x.json());
  assert.equal(new Set(cuentas.map((c) => c.cuit)).size, 5);
});

test('QR cobra desde billetera y liquida al banco del comercio sin duplicar', async () => {
  const generado = await api('POST', '/billetera/qr/generar', {
    id_venta: 'qa-qr-001', cuit_destino: sujetos.comercio, monto: 1000, terminal_id:'qa-terminal',
  });
  assert.equal(generado.status, 201);
  assert.match(generado.body.qr_data_url, /^data:image\/png;base64,/);
  assert.equal(generado.body.estado, 'pendiente');
  const storedQr = await require('../src/db').query('select id,payload from billetera.solicitudes_qr where id_venta=$1', ['qa-qr-001']);
  assert.equal(storedQr.rows[0]?.payload, generado.body.payload, JSON.stringify({ stored: storedQr.rows, response: generado.body }));
  assert.equal(storedQr.rows[0]?.id, generado.body.payload.slice('SINTEGRA-PAGO:'.length));
  const saldoWalletAntes = (await api('GET', '/billetera/cuentas/' + (await api('GET', '/banco/clientes/' + sujetos.comprador)).body.billetera.id)).body.saldo;
  const saldoBancoAntes = (await api('GET', '/banco/cuentas/qa-comercio/saldo')).body.saldo;
  const pagado = await api('POST', '/billetera/qr/confirmar', { payload: generado.body.payload, cuit_origen: sujetos.comprador });
  assert.equal(pagado.status, 201, JSON.stringify({ response: pagado.body, qr: generado.body.payload, row: storedQr.rows[0] }));
  assert.equal(pagado.body.estado, 'pagada');
  assert.equal(pagado.body.webhook.estado,'entregado');
  assert.equal(eventosRecibidos[0].payload.id_venta,'qa-qr-001');
  assert.equal(pagado.body.banco_movimiento_id, pagado.body.movimiento.banco_movimiento_id);
  assert.equal((await api('GET', '/billetera/cuentas/' + (await api('GET', '/banco/clientes/' + sujetos.comprador)).body.billetera.id)).body.saldo, saldoWalletAntes - 1000);
  assert.equal((await api('GET', '/banco/cuentas/qa-comercio/saldo')).body.saldo, saldoBancoAntes + 1000);
  const repetido = await api('POST', '/billetera/qr/confirmar', { payload: generado.body.payload, cuit_origen: sujetos.comprador });
  assert.equal(repetido.status, 200);
  assert.equal(repetido.body.repetida, true);
  assert.equal((await api('POST', '/billetera/qr/confirmar', { payload: generado.body.payload, cuit_origen: sujetos.municipal })).status, 409);
});

test('alta de punto de venta y checkout TPV integra cobro, ARBA, ARCA y stock', async () => {
  const pv = await api('POST', '/arca/puntos-venta', { cuit: sujetos.comercio, punto_venta: 27 });
  assert.equal(pv.status, 201);
  assert.deepEqual(pv.body.tipos_comprobante, ['FACTURA_A', 'FACTURA_B']);
  assert.equal((await api('GET', `/arca/puntos-venta?cuit=${sujetos.comercio}`)).body[0].punto_venta, 27);
  const producto = (await api('GET', `/tpv/productos?terminal_id=qa-terminal&cuit=${sujetos.comercio}`)).body[0];
  const bancoAntes = (await api('GET', '/banco/cuentas/qa-comercio/saldo')).body.saldo;
  const venta = await api('POST', '/tpv/ventas', { id_venta: 'qa-tpv-001', terminal_id: 'qa-terminal',
    comercio_cuit: sujetos.comercio, medio_pago: 'banco', cuenta_origen: 'cuenta-mostrador', punto_venta: 27,
    items: [{ producto_id: producto.id, cantidad: 2 }] });
  assert.equal(venta.status, 201, JSON.stringify(venta.body));
  assert.equal(venta.body.percepcion, 60);
  assert.equal(venta.body.total, 2060);
  assert.equal(venta.body.webhook.estado,'entregado');
  const factura = (await api('GET', `/arca/comprobantes?cuit=${sujetos.comercio}`)).body[0];
  assert.equal(factura.punto_venta, '00027');
  assert.equal(factura.monto_total, 2060);
  assert.equal((await api('GET', '/banco/cuentas/qa-comercio/saldo')).body.saldo, bancoAntes + 2060);
  assert.equal((await api('GET', `/tpv/productos?terminal_id=qa-terminal&cuit=${sujetos.comercio}`)).body[0].stock, 3);
  const percepciones = await api('GET', `/arba/percepciones/${sujetos.comercio}`);
  assert.equal(percepciones.status, 200);
  assert.equal(percepciones.body[0].id_venta, 'qa-tpv-001');
  assert.equal(percepciones.body[0].monto_percepcion, 60);
  const repetida = await api('POST', '/tpv/ventas', { id_venta: 'qa-tpv-001', terminal_id: 'qa-terminal',
    comercio_cuit: sujetos.comercio, medio_pago: 'banco', cuenta_origen: 'cuenta-mostrador', punto_venta: 27,
    items: [{ producto_id: producto.id, cantidad: 2 }] });
  assert.equal(repetida.status, 200);
  assert.equal(repetida.body.webhook.estado,'entregado');
  assert.equal((await api('GET', '/tpv/ventas/qa-tpv-001')).body.estado, 'COMPLETADA');
});

test('checkout de billetera acredita billetera del comercio y Municipio cobra al banco', async () => {
  const producto = (await api('POST', '/tpv/productos', { terminal_id: 'qa-terminal', comercio_cuit: sujetos.comercioWallet,
    nombre: 'Servicio sintético', precio: 500, stock: 10 })).body;
  assert.equal(typeof producto.id, 'string', JSON.stringify(producto));
  const venta = await api('POST', '/tpv/ventas', { id_venta: 'qa-tpv-wallet-001', terminal_id: 'qa-terminal',
    comercio_cuit: sujetos.comercioWallet, medio_pago: 'billetera', cuit_cliente: sujetos.municipal,
    items: [{ producto_id: producto.id, cantidad: 1 }] });
  assert.equal(venta.status, 201, JSON.stringify(venta.body));
  const walletComercio = (await api('GET', '/banco/clientes/' + sujetos.comercioWallet)).body.billetera;
  assert.equal(walletComercio.saldo, 510);
  const pagoTasa = await api('POST', '/municipio/tributos/pagos', { cuit: sujetos.municipal, periodo: '2026-10', monto: 750 });
  assert.equal(pagoTasa.status, 201);
  assert.equal(pagoTasa.body.comprobante.monto, 750);
  assert.equal((await api('GET', '/banco/cuentas/cuenta-municipio/saldo')).body.saldo, 750);
  assert.equal((await api('GET', `/municipio/certificados/libre-deuda/${sujetos.municipal}`)).status, 200);
});

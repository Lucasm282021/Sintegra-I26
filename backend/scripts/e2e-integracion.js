// Recorrido de integración de punta a punta contra un backend publicado.
// Crea un comercio de PRUEBA nuevo (nombre "QA Integración ...") y lo lleva por
// todo el circuito. Deja datos de demostración en la base: usar con criterio.
//
//   node scripts/e2e-integracion.js                       # producción
//   API=http://localhost:3010 node scripts/e2e-integracion.js   # local (npm run dev:memoria)
const API = process.env.API || 'https://sintegra-backend.vercel.app';
const CLIENTE = '20345678901';      // Juan Pérez: monotributista, padrón ARBA 2 %
const BILLETERA = '20268326074';    // Cátedra: billetera con saldo, vinculada al banco
const TERMINAL = 'brisa';

let token = null;
let fallas = 0;
const paso = (ok, texto, extra = '') => { if (!ok) fallas++; console.log(`${ok ? '✔' : '✖'} ${texto}${extra ? ` — ${extra}` : ''}`); };

async function api(metodo, ruta, body) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token && ruta.startsWith('/core')) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(API + ruta, { method: metodo, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
function cuitNuevo() {
  for (;;) {
    const diez = `30${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    const r = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((t, p, i) => t + Number(diez[i]) * p, 0) % 11;
    if (r !== 1) return diez + (r === 0 ? 0 : 11 - r);
  }
}

(async () => {
  const sello = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const cuit = cuitNuevo();
  const razon = `QA Integración ${sello} SRL`;
  console.log(`Backend: ${API}\nComercio de prueba: ${razon} (${cuit})\n`);

  // 1. CORE: usuario y alta única.
  const u = await api('POST', '/core/usuarios', { email: `qa.${sello}.${cuit.slice(-4)}@prueba.test`, nombre: 'QA Integración', password: 'qa-integracion-2026' });
  token = u.body.token;
  paso(u.status === 201, 'CORE · usuario creado');
  const alta = await api('POST', '/core/comercios', { cuit, razon_social: razon, email_contacto: 'qa@prueba.test',
    sucursal: { nombre: 'Casa central', domicilio_comercial: 'Calle QA 123', localidad: 'Morón', municipio: 'Morón' },
    acepta_condiciones: true, declara_representacion: true });
  const id = alta.body.comercio?.id;
  paso(alta.status === 201, 'CORE · alta del comercio', `commerce_id ${id}`);
  paso(alta.body.estado?.arca?.resultado === 'observado', 'CORE · ARCA observado antes de inscribirse');

  // 2. ARCA inscribe y habilita el punto de venta.
  paso((await api('POST', '/arca/contribuyentes', { cuit, razon_social: razon, condicion_iva: 'responsable_inscripto', domicilio_fiscal: 'Calle QA 123' })).status === 201, 'ARCA · inscripción (RI)');
  paso((await api('POST', '/arca/puntos-venta', { cuit, punto_venta: 1 })).status === 201, 'ARCA · punto de venta 1 (A y B)');

  // 3. ARBA inscribe en IIBB y lo designa agente de percepción.
  paso((await api('POST', '/arba/padron', { cuit, actividad: 'Comercio minorista', alicuota: 0.03 })).status === 201, 'ARBA · inscripción IIBB');
  paso((await api('PUT', `/arba/agentes/${cuit}`, {})).body.vigente === true, 'ARBA · agente de percepción vigente');

  // 4. Municipio: solicitud y resolución.
  paso((await api('POST', '/municipio/comercios', { cuit, razon_social: razon, condicion_fiscal: 'Responsable Inscripto', direccion: 'Calle QA 123', rubro_principal: 'Almacén / autoservicio' })).status === 201, 'Municipio · solicitud de habilitación');
  paso((await api('POST', `/municipio/comercios/${cuit}/resolucion`, { estado: 'activa', expediente: `EXP-QA-${sello}` })).status === 200, 'Municipio · habilitación aprobada');

  // 5. CORE reverifica, Banco abre la cuenta y se activa el TPV.
  for (const s of ['arca', 'arba', 'municipio']) await api('POST', `/core/comercios/${id}/verificaciones/${s}`);
  paso((await api('POST', `/core/comercios/${id}/banco/vincular`)).body.banco?.resultado === 'vinculado', 'Banco · cuenta abierta y vinculada');
  const act = await api('POST', `/core/comercios/${id}/tpv/activar`, { terminal_id: TERMINAL, rubro: 'Almacén' });
  paso(act.status === 200 && act.body.advertencias.length === 0, `TPV · terminal ${TERMINAL} activada`, act.body.advertencias?.join('; '));
  const e = act.body.estado || {};
  paso([e.arca?.resultado, e.arba?.resultado, e.municipio?.[0]?.resultado, e.banco?.resultado, e.tpv?.resultado].join() === 'verificado,verificado,habilitado,vinculado,configurado',
    'CORE · panel en verde');

  // 6. Venta con impuestos (cliente monotributista identificado).
  const prod = await api('POST', '/tpv/productos', { terminal_id: TERMINAL, comercio_cuit: cuit, nombre: 'Producto QA', precio: 12100, stock: 10, iva: '21' });
  const cuenta = `cuenta-${cuit}`;
  const saldo0 = (await api('GET', `/banco/cuentas/${cuenta}/saldo`)).body.saldo;
  const v = await api('POST', '/tpv/ventas', { id_venta: `qa-${sello}-1`, terminal_id: TERMINAL, comercio_cuit: cuit, medio_pago: 'tarjeta', cuit_cliente: CLIENTE, items: [{ producto_id: prod.body.id, cantidad: 1 }] });
  const imp = v.body.impuestos || {};
  paso(v.status === 201 && v.body.estado === 'completada', 'TPV · venta completada');
  paso(imp.tipo_comprobante === 'FACTURA_B' && imp.neto === 10000 && imp.iva_total === 2100, 'ARCA · Factura B con neto 10.000 e IVA 2.100');
  paso(v.body.percepcion === 200 && imp.percepcion?.origen === 'padron', 'ARBA · percepción 2 % del padrón del comprador ($200)');
  paso((await api('GET', `/banco/cuentas/${cuenta}/saldo`)).body.saldo === saldo0 + 12300, 'Banco · se acreditaron $12.300');

  // 7. Venta pagada con Billetera (consumidor sin percepción si no es inscripto... la cátedra no está en el padrón ARBA).
  const v2 = await api('POST', '/tpv/ventas', { id_venta: `qa-${sello}-2`, terminal_id: TERMINAL, comercio_cuit: cuit, medio_pago: 'billetera', cuit_cliente: BILLETERA, items: [{ producto_id: prod.body.id, cantidad: 1 }] });
  paso(v2.status === 201, 'Billetera · venta pagada con billetera', `percepción ${v2.body.percepcion} (${v2.body.impuestos?.percepcion?.motivo || v2.body.error})`);

  // 8. CORE ve el TPV activo; Municipio liquida y cobra la tasa del mes.
  paso((await api('POST', `/core/comercios/${id}/verificaciones/tpv`)).body.tpv?.resultado === 'activo', 'CORE · TPV activo después de vender');
  const periodo = new Date().toISOString().slice(0, 7);
  const liq = await api('POST', '/municipio/tributos/liquidar', { cuit, periodo });
  paso(liq.status === 201 && liq.body.importe > 0, 'Municipio · tasa del mes liquidada', `$${liq.body.importe} sobre $${liq.body.base_imponible}`);
  const pago = await api('POST', '/municipio/tributos/pagos', { cuit, periodo, monto: liq.body.importe });
  paso(pago.status === 201, 'Municipio · tasa pagada desde la cuenta del comercio', pago.body.error);

  console.log(`\n${fallas ? `✖ ${fallas} paso(s) con problemas` : '✔ Integración completa sin fallas'}`);
  process.exit(fallas ? 1 : 0);
})().catch((err) => { console.error('Error:', err.message); process.exit(1); });

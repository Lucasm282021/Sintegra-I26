// Carga los dos comercios de la prueba real recorriendo el circuito como en la
// realidad: ARCA → ARBA → Municipio → Banco → Billetera → TPV.
// Uso: API=https://sintegra-backend.vercel.app node scripts/sembrar-prueba-real.js
require('./env');
const { Client } = require('pg');

const API = (process.env.API || 'http://localhost:3010').replace(/\/$/, '');
const RI = { cuit: '20268326074', razon_social: 'Mauricio Sistisisti', fantasia: 'Comercio i26', condicion_iva: 'responsable_inscripto',
  domicilio: 'Calle de la Prueba 26, Morón', rubro: 'Almacén / autoservicio', actividad: 'Comercio minorista', alicuota: 0.03 };
const MONO = { cuit: '27401260264', razon_social: 'Kiosco Ficticio Monotributo', fantasia: 'Kiosco i26 (ficticio)', condicion_iva: 'monotributo',
  domicilio: 'Belgrano 260, Morón', rubro: 'Kiosco', actividad: 'Comercio minorista', alicuota: 0.02 };
const CLIENTES = ['30000000001', '30000000002', '30000000003'];

async function api(metodo, ruta, body, aceptar = []) {
  const r = await fetch(API + ruta, { method: metodo, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && !aceptar.includes(r.status)) throw new Error(`${metodo} ${ruta} → ${r.status}: ${j.error}`);
  return j;
}
const paso = (t) => console.log('·', t);

const PRODUCTOS_RI = [
  ['Yerba mate 1 kg', 'Almacén', 3000, 0.35, '21', 40], ['Aceite girasol 1,5 L', 'Almacén', 2200, 0.3, '21', 30],
  ['Leche entera 1 L', 'Lácteos', 900, 0.25, '10.5', 60], ['Pan lactal', 'Panadería', 1500, 0.4, '10.5', 25],
  ['Gaseosa cola 2,25 L', 'Bebidas', 1800, 0.45, '21', 50],
];
const PRODUCTOS_MONO = [
  ['Alfajor triple', 'Golosinas', 600, 0.6, '21', 80], ['Agua mineral 500 ml', 'Bebidas', 450, 0.7, '21', 60],
  ['Caramelos x 10', 'Golosinas', 200, 0.8, '21', 100], ['Galletitas dulces', 'Almacén', 900, 0.5, '21', 40],
  ['Gaseosa lata', 'Bebidas', 700, 0.6, '21', 48],
];

(async () => {
  console.log('API:', API);
  for (const k of [RI, MONO]) {
    paso(`ARCA: inscribir ${k.razon_social}`);
    await api('POST', '/arca/contribuyentes', { cuit: k.cuit, razon_social: k.razon_social, condicion_iva: k.condicion_iva, tipo_persona: 'fisica', domicilio_fiscal: k.domicilio }, [409]);
    paso('ARCA: punto de venta 1');
    await api('POST', '/arca/puntos-venta', { cuit: k.cuit, punto_venta: 1 }, [409]);
    paso('ARBA: inscripción en Ingresos Brutos');
    await api('POST', '/arba/padron', { cuit: k.cuit, actividad: k.actividad, alicuota: k.alicuota });
    paso('Municipio: habilitación');
    await api('POST', '/municipio/comercios', { cuit: k.cuit, razon_social: k.razon_social,
      condicion_fiscal: k.condicion_iva === 'monotributo' ? 'Monotributista' : 'Responsable Inscripto', direccion: k.domicilio, rubro_principal: k.rubro }, [409]);
    await api('POST', `/municipio/comercios/${k.cuit}/resolucion`, { estado: 'activa', expediente: `EXP-2026-${k.cuit.slice(-4)}` });
    paso('Banco: caja de ahorro');
    k.caja = (await api('POST', '/banco/cuentas', { cuit: k.cuit, tipo: 'caja_ahorro' })).id;
  }
  paso('ARBA: el Responsable Inscripto queda como agente de percepción');
  await api('PUT', `/arba/agentes/${RI.cuit}`, { activo: true });
  paso('Banco: cuenta corriente del Responsable Inscripto (cheques y eCheq)');
  RI.cc = (await api('POST', '/banco/cuentas', { cuit: RI.cuit, tipo: 'cuenta_corriente' })).id;

  paso('Banco: depósitos iniciales');
  const depositar = (id, monto) => api('POST', `/banco/cuentas/${id}/depositos`, { id_operacion: `inicio-${id}`, monto, concepto: 'Saldo inicial prueba real' });
  await depositar(RI.caja, 500000);
  await depositar(RI.cc, 300000);
  await depositar(MONO.caja, 200000);
  for (const c of CLIENTES) await depositar((await api('POST', '/banco/cuentas', { cuit: c })).id, 150000);

  paso('Billetera de cada comercio (clave demo1234)');
  await api('POST', `/banco/clientes/${RI.cuit}/billetera`, { alias: 'comercio.i26', contrasena: 'demo1234' }, [409]);
  await api('POST', `/banco/clientes/${MONO.cuit}/billetera`, { alias: 'kiosco.i26', contrasena: 'demo1234' }, [409]);

  paso('TPV: Brisa y David → Responsable Inscripto; Sebastián → Monotributista');
  await api('POST', '/tpv/comercios', { terminal_id: 'brisa', cuit: RI.cuit, razon_social: RI.razon_social, rubro: RI.rubro });
  await api('POST', '/tpv/comercios', { terminal_id: 'david', cuit: RI.cuit, razon_social: RI.razon_social, rubro: RI.rubro });
  await api('POST', '/tpv/comercios', { terminal_id: 'sebastian', cuit: MONO.cuit, razon_social: MONO.razon_social, rubro: MONO.rubro });

  paso('TPV: productos cargados por costo, ganancia e IVA');
  const cargar = (terminal, cuit, lista) => Promise.all(lista.map(([nombre, categoria, costo, margen, iva, stock]) =>
    api('POST', '/tpv/productos', { terminal_id: terminal, comercio_cuit: cuit, nombre, categoria, costo, margen, iva, stock })));
  await cargar('brisa', RI.cuit, PRODUCTOS_RI);
  await cargar('david', RI.cuit, PRODUCTOS_RI);
  await cargar('sebastian', MONO.cuit, PRODUCTOS_MONO);

  paso('CORE: los dos comercios en «Comercios · Alta única» con su nombre de fantasía');
  const url = new URL(process.env.DATABASE_URL); url.searchParams.delete('sslmode');
  const db = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
  if (API.includes('localhost')) console.log('  (local: se omite el CORE en Supabase)');
  else {
    await db.connect();
    const demo = (await db.query("select id from core.usuarios where email = 'demo.comercios.i26@gmail.com'")).rows[0];
    for (const k of [RI, MONO]) {
      const id = (await db.query(`insert into core.comercios (cuit, razon_social, nombre_fantasia, tipo_persona, domicilio_fiscal)
        values ($1,$2,$3,'fisica',$4) on conflict (cuit) do update set nombre_fantasia = excluded.nombre_fantasia returning id`,
        [k.cuit, k.razon_social, k.fantasia, k.domicilio])).rows[0].id;
      await db.query(`insert into core.sucursales (comercio_id, nombre, domicilio_comercial, provincia)
        select $1, 'Casa central', $2, 'Buenos Aires' where not exists (select 1 from core.sucursales where comercio_id = $1)`, [id, k.domicilio]);
      if (demo) await db.query(`insert into core.membresias (comercio_id, usuario_id, rol, estado)
        select $1, $2, 'titular', 'activa' where not exists (select 1 from core.membresias where comercio_id = $1 and usuario_id = $2)`, [id, demo.id]);
    }
    // Los clientes demo de la billetera quedan vinculados a su caja de ahorro.
    await db.query(`update billetera.cuentas w set banco_cuenta_id = b.id from banco.cuentas b
      where b.cuit = w.cuit and b.tipo = 'caja_ahorro' and w.cuit = any($1) and w.banco_cuenta_id is null`, [CLIENTES]);
    await db.end();
  }
  console.log('Listo. RI:', RI.cuit, '· Monotributista:', MONO.cuit);
})().catch((e) => { console.error('error:', e.message); process.exit(1); });

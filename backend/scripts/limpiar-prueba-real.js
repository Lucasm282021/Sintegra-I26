// Deja la base lista para la prueba real del 30/10/2026: borra los datos de prueba
// y conserva solo las cuentas internas del sistema, los clientes demo de la
// billetera (Ana, Marcos, Laura), las terminales TPV y la configuración.
// Antes correr: node scripts/respaldar.js <carpeta>
// Uso: node scripts/limpiar-prueba-real.js            (simulacro: deshace todo)
//      node scripts/limpiar-prueba-real.js --confirmar
require('./env');
const { Client } = require('pg');

const SISTEMA = ['20000000001', '30000000097', '30000000098', '30000000099'];
const CLIENTES_DEMO = ['30000000001', '30000000002', '30000000003'];
const CONSERVAR = [...SISTEMA, ...CLIENTES_DEMO];
const CUENTAS_SISTEMA = ['cuenta-billetera', 'cuenta-municipio', 'cuenta-caja', 'cuenta-mostrador'];

const PASOS = [
  ['tpv.webhook_eventos', 'delete from tpv.webhook_eventos'],
  ['tpv.pagos_proveedor', 'delete from tpv.pagos_proveedor'],
  ['tpv.compra_items', 'delete from tpv.compra_items'],
  ['tpv.compras', 'delete from tpv.compras'],
  ['tpv.proveedores', 'delete from tpv.proveedores'],
  ['tpv.venta_items', 'delete from tpv.venta_items'],
  ['tpv.ventas', 'delete from tpv.ventas'],
  ['arca.comprobantes', 'delete from arca.comprobantes'],
  ['arba.percepciones', 'delete from arba.percepciones'],
  ['banco.cheques', 'delete from banco.cheques'],
  ['billetera.solicitudes_qr', 'delete from billetera.solicitudes_qr'],
  ['billetera.movimientos', 'delete from billetera.movimientos'],
  ['billetera.usuarios', 'delete from billetera.usuarios where cuenta_id in (select id from billetera.cuentas where not (cuit = any($1)))', [CONSERVAR]],
  ['billetera.cuentas', 'delete from billetera.cuentas where not (cuit = any($1))', [CONSERVAR]],
  ['banco.movimientos', 'delete from banco.movimientos'],
  ['banco.homebanking', 'delete from banco.homebanking'],
  ['tpv.productos', 'delete from tpv.productos'],
  ['tpv.comercios', 'delete from tpv.comercios'],
  ['banco.cuentas', 'delete from banco.cuentas where not (id = any($1))', [CUENTAS_SISTEMA]],
  ['municipio.tasas', 'delete from municipio.tasas'],
  ['municipio.habilitaciones', 'delete from municipio.habilitaciones'],
  ['arba.agentes', 'delete from arba.agentes'],
  ['arba.inscripciones', 'delete from arba.inscripciones'],
  ['arca.puntos_venta', 'delete from arca.puntos_venta'],
  ['core.eventos', 'delete from core.eventos'],
  ['core.integraciones', 'delete from core.integraciones'],
  ['core.verificaciones', 'delete from core.verificaciones'],
  ['core.membresias', 'delete from core.membresias'],
  ['core.sucursales', 'delete from core.sucursales'],
  ['core.comercios', 'delete from core.comercios'],
  ['core.usuarios', "delete from core.usuarios where email <> 'demo.comercios.i26@gmail.com'"],
  ['padron.contribuyentes', 'delete from padron.contribuyentes where not (cuit = any($1))', [CONSERVAR]],
];

(async () => {
  const confirmar = process.argv.includes('--confirmar');
  const url = new URL(process.env.DATABASE_URL); url.searchParams.delete('sslmode');
  const c = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } });
  await c.connect();
  await c.query('begin');
  try {
    for (const [tabla, sql, params] of PASOS) {
      const r = await c.query(sql, params || []);
      console.log(`${tabla}: ${r.rowCount} borradas`);
    }
    const quedan = (await c.query('select cuit, razon_social from padron.contribuyentes order by cuit')).rows;
    console.log('quedan en el padrón:', quedan.map((x) => `${x.cuit} ${x.razon_social}`).join(' | '));
    await c.query(confirmar ? 'commit' : 'rollback');
    console.log(confirmar ? 'LISTO: cambios confirmados' : 'simulacro: no se cambió nada (usar --confirmar)');
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally { await c.end(); }
})().catch((e) => { console.error('error:', e.message); process.exit(1); });

// Motor de impuestos de la venta (doc/IMPUESTOS-Y-PERCEPCIONES.md).
// Simulación académica: las alícuotas son de prueba y se configuran a mano en
// cada organismo (ARCA: IVA por producto; ARBA: agentes, padrón y parámetros).
const { num } = require('../http');

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const TASAS_IVA = { 21: 0.21, '10.5': 0.105, 27: 0.27, 0: 0 };

// IVA de la venta. El precio del catálogo es el precio final al público.
// Solo un Responsable Inscripto discrimina IVA; Monotributo y Exento no.
function calcularIva(lineas, condicionEmisor) {
  const discrimina = condicionEmisor === 'responsable_inscripto';
  const porAlicuota = {};
  let neto = 0; let iva = 0; let exento = 0;
  const detalle = lineas.map((l) => {
    const total = r2(l.precio * l.cantidad);
    const clave = String(l.iva ?? '21');
    if (!discrimina) { neto += total; return { ...l, total, neto: total, iva: 0, alicuota_iva: null }; }
    if (clave === 'exento') { exento += total; return { ...l, total, neto: 0, iva: 0, alicuota_iva: 'exento' }; }
    const tasa = TASAS_IVA[clave] ?? 0.21;
    const netoLinea = r2(total / (1 + tasa));
    const ivaLinea = r2(total - netoLinea);
    neto += netoLinea; iva += ivaLinea;
    porAlicuota[clave] = porAlicuota[clave] || { alicuota: clave, base: 0, importe: 0 };
    porAlicuota[clave].base = r2(porAlicuota[clave].base + netoLinea);
    porAlicuota[clave].importe = r2(porAlicuota[clave].importe + ivaLinea);
    return { ...l, total, neto: netoLinea, iva: ivaLinea, alicuota_iva: clave };
  });
  return { lineas: detalle, neto: r2(neto), iva_total: r2(iva), exento: r2(exento), iva_detalle: Object.values(porAlicuota), discrimina };
}

// RI a RI → A (IVA discriminado); RI a cualquier otro → B; Monotributo/Exento → C.
function tipoComprobante(condicionEmisor, condicionReceptor) {
  if (condicionEmisor !== 'responsable_inscripto') return 'FACTURA_C';
  return condicionReceptor === 'responsable_inscripto' ? 'FACTURA_A' : 'FACTURA_B';
}

// Percepción de IIBB: la aplica el comercio solo si ARBA lo designó agente
// vigente, el comprador está identificado con CUIT y la base supera el mínimo.
// La alícuota sale del padrón del COMPRADOR; si no figura, la de no inscriptos.
async function calcularPercepcion(c, { agenteCuit, sujetoCuit, base }) {
  const sin = (motivo) => ({ monto: 0, alicuota: 0, origen: null, base: r2(base), motivo });
  const agente = (await c.query(
    `select a.cuit from arba.agentes a join arba.inscripciones i on i.cuit = a.cuit and i.estado = 'activa'
     where a.cuit = $1 and a.activo and current_date >= a.vigente_desde
       and (a.vigente_hasta is null or current_date <= a.vigente_hasta)`, [agenteCuit])).rows[0];
  if (!agente) return sin('el comercio no es agente de percepción vigente de ARBA');
  if (!sujetoCuit) return sin('venta a consumidor final sin CUIT: no corresponde percepción');
  if (sujetoCuit === agenteCuit) return sin('el comprador es el mismo comercio');
  const cfg = (await c.query('select * from arba.config_percepcion where id = 1')).rows[0]
    || { alicuota_no_inscriptos: 0.05, monto_minimo: 0 };
  if (base < num(cfg.monto_minimo)) return sin(`la base ($${r2(base)}) no supera el mínimo de $${num(cfg.monto_minimo)}`);
  const padron = (await c.query("select alicuota from arba.inscripciones where cuit = $1 and estado = 'activa'", [sujetoCuit])).rows[0];
  const alicuota = padron ? num(padron.alicuota) : num(cfg.alicuota_no_inscriptos);
  const origen = padron ? 'padron' : 'no_inscripto';
  return { monto: r2(base * alicuota), alicuota, origen, base: r2(base),
    motivo: padron ? 'alícuota del padrón ARBA del comprador' : 'comprador fuera del padrón: alícuota para no inscriptos' };
}

module.exports = { calcularIva, tipoComprobante, calcularPercepcion, r2, TASAS_IVA };

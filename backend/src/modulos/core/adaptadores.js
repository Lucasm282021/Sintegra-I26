// Adaptadores sandbox: consultan los dominios del backend único y devuelven un
// resultado con evidencia. No hay integraciones oficiales con ARCA, ARBA,
// municipios ni bancos: todo resultado sale con origen "sandbox".
// Cada adaptador es independiente; si falla, su estado queda "no_disponible".
const { query } = require('../../db');
const { num } = require('../../http');

const enmascarar = (cbu) => (cbu ? `••••${String(cbu).slice(-4)}` : null);
const CONDICION = {
  responsable_inscripto: 'Responsable Inscripto', monotributo: 'Monotributo',
  exento: 'Exento', consumidor_final: 'Consumidor Final',
};

async function integracion(comercioId, sistema, referencia, estado, detalle = {}) {
  await query(
    `insert into core.integraciones (comercio_id, sistema, referencia_externa, estado, detalle)
     values ($1, $2, $3, $4, $5)
     on conflict (comercio_id, sistema, referencia_externa)
     do update set estado = excluded.estado, detalle = excluded.detalle, ultima_sincronizacion = now()`,
    [comercioId, sistema, referencia, estado, JSON.stringify(detalle)]);
}

const ADAPTADORES = {
  async arca(comercio) {
    const c = (await query('select * from padron.contribuyentes where cuit = $1', [comercio.cuit])).rows[0];
    if (!c) {
      return { resultado: 'observado', referencia_evidencia: `padron.contribuyentes:${comercio.cuit}`,
        detalle: { motivo: 'el CUIT no figura en el padrón fiscal sandbox de ARCA', accion: 'inscribir el CUIT en ARCA y reverificar' } };
    }
    const pv = (await query(
      'select punto_venta, tipo_comprobante from arca.puntos_venta where emisor_cuit = $1 order by 1, 2', [comercio.cuit])).rows;
    if (pv.length) await integracion(comercio.id, 'arca', `pv:${comercio.cuit}`, 'configurado', { puntos_venta: pv });
    return {
      resultado: c.estado === 'activo' ? 'verificado' : 'observado',
      referencia_evidencia: `padron.contribuyentes:${c.cuit}`,
      detalle: { razon_social: c.razon_social, condicion_iva: CONDICION[c.condicion_iva] || c.condicion_iva,
        estado_cuit: c.estado, puntos_venta: pv.length },
    };
  },

  async arba(comercio) {
    const i = (await query('select * from arba.inscripciones where cuit = $1', [comercio.cuit])).rows[0];
    if (!i) {
      return { resultado: 'pendiente', referencia_evidencia: `arba.inscripciones:${comercio.cuit}`,
        detalle: { motivo: 'sin inscripción en IIBB registrada; puede no corresponder (no es incumplimiento)' } };
    }
    return {
      resultado: i.estado === 'activa' ? 'verificado' : 'observado',
      referencia_evidencia: `arba.inscripciones:${i.cuit}`,
      detalle: { regimen: 'directo (sandbox)', actividad: i.actividad, alicuota_prueba: num(i.alicuota),
        estado: i.estado, vigente_desde: i.vigente_desde },
    };
  },

  // Hoy la habilitación es por CUIT (una fila); se asigna a la primera sucursal.
  // Las demás sucursales quedan "pendiente" hasta que Municipio las registre.
  async municipio(comercio, sucursal, esPrincipal) {
    const h = esPrincipal
      ? (await query('select * from municipio.habilitaciones where cuit = $1', [comercio.cuit])).rows[0]
      : null;
    if (!h) {
      return { resultado: 'pendiente', referencia_evidencia: `municipio.habilitaciones:${comercio.cuit}`,
        detalle: { motivo: 'sin trámite de habilitación para esta sucursal', accion: 'iniciar el trámite en Municipio' } };
    }
    const mapa = { activa: 'habilitado', pendiente: 'en_tramite', suspendida: 'observado', baja: 'observado' };
    return {
      resultado: mapa[h.estado] || 'observado',
      referencia_evidencia: `municipio.habilitaciones:${h.cuit}`,
      detalle: { rubro: h.rubro, domicilio_habilitado: h.domicilio, estado_municipal: h.estado, fecha_alta: h.fecha_alta },
    };
  },

  async banco(comercio) {
    const cuenta = (await query('select * from banco.cuentas where cuit = $1 order by creado_en limit 1', [comercio.cuit])).rows[0];
    if (!cuenta) {
      return { resultado: 'pendiente', referencia_evidencia: `banco.cuentas:${comercio.cuit}`,
        detalle: { motivo: 'sin cuenta bancaria vinculada', accion: 'vincular banco' } };
    }
    await integracion(comercio.id, 'banco', cuenta.id, 'vinculado', { cbu: enmascarar(cuenta.cbu), alias: cuenta.alias });
    return { resultado: 'vinculado', referencia_evidencia: `banco.cuentas:${cuenta.id}`,
      detalle: { cuenta_id: cuenta.id, cbu: enmascarar(cuenta.cbu), alias: cuenta.alias } };
  },

  async tpv(comercio) {
    const terminales = (await query(
      'select terminal_id, cuenta_destino, activo from tpv.comercios where cuit = $1 order by terminal_id', [comercio.cuit])).rows;
    if (!terminales.length) {
      return { resultado: 'pendiente', referencia_evidencia: `tpv.comercios:${comercio.cuit}`,
        detalle: { motivo: 'sin terminal asignada', accion: 'activar TPV' } };
    }
    for (const t of terminales) {
      await integracion(comercio.id, 'tpv', t.terminal_id, t.activo ? 'configurado' : 'inactivo', { cuenta_destino: t.cuenta_destino });
    }
    const ventas = num((await query(
      "select count(*) n from tpv.ventas where comercio_cuit = $1 and estado = 'completada'", [comercio.cuit])).rows[0].n);
    return { resultado: ventas > 0 ? 'activo' : 'configurado', referencia_evidencia: `tpv.comercios:${comercio.cuit}`,
      detalle: { terminales: terminales.map((t) => t.terminal_id), ventas_completadas: ventas } };
  },
};

module.exports = { ADAPTADORES, enmascarar };

// Padrón compartido: una sola ficha por CUIT con lo que sabe cada sistema.
const express = require('express');
const { query } = require('../db');
const { falla, cuitValido, num, ruta } = require('../http');

const router = express.Router();

router.get('/contribuyentes/:cuit', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'cuit debe tener 11 dígitos, sin puntos ni guiones');
  const { rows } = await query('select * from padron.ficha_contribuyente where cuit = $1', [req.params.cuit]);
  if (!rows[0]) throw falla(404, 'contribuyente no encontrado');
  const f = rows[0];
  return { body: { ...f, arba_alicuota: num(f.arba_alicuota), municipio_tasas_pendientes: num(f.municipio_tasas_pendientes) } };
}));

// ---------- Padrón general ----------
// Une lo inscripto en ARCA (padron.contribuyentes) con los comercios dados de alta
// en el CORE que todavía no se inscribieron. Lo usan ARCA, ARBA, Municipio, Banco
// y los TPV para buscar un CUIT y completar datos sin volver a cargarlos.
// Las cuentas internas del sistema (caja, mostrador, custodia, tesorería) no se listan.
const SISTEMA = ['20000000001', '30000000097', '30000000098', '30000000099'];
const SQL_GENERAL = `
  with base as (
    select c.cuit, c.razon_social, c.tipo_persona, c.condicion_iva, c.domicilio_fiscal, c.estado, true as arca_inscripto
    from padron.contribuyentes c
    union all
    select k.cuit, k.razon_social, k.tipo_persona, null, k.domicilio_fiscal, 'pendiente_arca', false
    from core.comercios k where not exists (select 1 from padron.contribuyentes c where c.cuit = k.cuit)
  )
  select b.*, k.id as commerce_id, k.nombre_fantasia, k.email_contacto, k.telefono_contacto,
    ai.actividad as arba_actividad, ai.alicuota as arba_alicuota, ai.estado as arba_estado,
    exists (select 1 from arba.agentes a where a.cuit = b.cuit and a.activo) as arba_agente,
    mh.rubro as municipio_rubro, mh.estado as municipio_estado, mh.domicilio as municipio_domicilio,
    (select count(*) from arca.puntos_venta pv where pv.emisor_cuit = b.cuit) as arca_puntos_venta,
    (select json_agg(json_build_object('id', bc.id, 'tipo', bc.tipo, 'alias', bc.alias)) from banco.cuentas bc where bc.cuit = b.cuit) as banco_cuentas,
    exists (select 1 from billetera.cuentas w where w.cuit = b.cuit) as tiene_billetera
  from base b
  left join core.comercios k on k.cuit = b.cuit
  left join arba.inscripciones ai on ai.cuit = b.cuit
  left join municipio.habilitaciones mh on mh.cuit = b.cuit
  where not (b.cuit = any($1))`;
const CONDICION = { responsable_inscripto: 'Responsable Inscripto', monotributo: 'Monotributo', exento: 'Exento', consumidor_final: 'Consumidor Final' };
const fila = (r) => ({
  cuit: r.cuit, razon_social: r.razon_social, nombre_fantasia: r.nombre_fantasia, tipo_persona: r.tipo_persona,
  condicion_iva: r.condicion_iva, condicion_fiscal: CONDICION[r.condicion_iva] || 'Sin inscripción en ARCA',
  domicilio_fiscal: r.domicilio_fiscal, email_contacto: r.email_contacto, telefono_contacto: r.telefono_contacto,
  commerce_id: r.commerce_id,
  arca: { inscripto: r.arca_inscripto, estado: r.estado, puntos_venta: num(r.arca_puntos_venta) },
  arba: r.arba_estado ? { estado: r.arba_estado, actividad: r.arba_actividad, alicuota: num(r.arba_alicuota), agente: r.arba_agente } : null,
  municipio: r.municipio_estado ? { estado: r.municipio_estado, rubro: r.municipio_rubro, domicilio: r.municipio_domicilio } : null,
  banco: r.banco_cuentas || [],
  billetera: r.tiene_billetera,
});

router.get('/general', ruta(async (req) => {
  const buscar = String(req.query.buscar || '').trim();
  const { rows } = await query(`${SQL_GENERAL}
    and ($2 = '' or b.cuit like $2 || '%' or b.razon_social ilike '%' || $2 || '%' or k.nombre_fantasia ilike '%' || $2 || '%')
    order by b.razon_social limit 200`, [SISTEMA, buscar]);
  return { body: rows.map(fila) };
}));

router.get('/general/:cuit', ruta(async (req) => {
  if (!cuitValido(req.params.cuit)) throw falla(400, 'cuit debe tener 11 dígitos, sin puntos ni guiones');
  const { rows } = await query(`${SQL_GENERAL} and b.cuit = $2`, [SISTEMA, req.params.cuit]);
  if (!rows[0]) throw falla(404, 'el CUIT no figura en el padrón general (ni en ARCA ni en Comercios)');
  return { body: fila(rows[0]) };
}));

module.exports = router;

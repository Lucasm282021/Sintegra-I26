const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db');
const auth = require('../auth');
const { isValidCuit, pageParameters } = require('../validation');

const router = express.Router();
const DEMO_JURISDICTION = 'AR-B';
const DEMO_SOURCE = 'Carga de demostración académica; no constituye inscripción oficial';

function validText(value, maxLength = 160) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
}

function validDate(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function validRate(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function sameRequest(existing, request) {
  return existing.sale_id === request.sale_id
    && existing.cuit === request.cuit
    && existing.base_amount_minor === request.base_amount_minor
    && existing.currency === request.currency;
}

function publicEnrollment(enrollment) {
  return {
    commerce_id: enrollment.commerce_id,
    cuit: enrollment.cuit,
    razon_social: enrollment.razon_social,
    jurisdiction: enrollment.jurisdiction,
    activity_code: enrollment.activity_code,
    actividad: enrollment.actividad,
    enrollment_status: enrollment.status,
    is_official: Boolean(enrollment.is_official),
    rate: enrollment.rate,
  };
}

router.get('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'arba', api_version: 'v1' }));

router.get('/padron', (req, res) => {
  const paging = pageParameters(req.query, 10);
  if (!paging) return res.status(400).json({ error: 'Paginación inválida' });
  return res.status(200).json(db.listPadronV1(paging.page, paging.limit));
});

router.get('/padron/:cuit', (req, res) => {
  const { cuit } = req.params;
  if (!isValidCuit(cuit)) return res.status(400).json({ error: 'CUIT inválido' });
  const enrollment = db.getInscription(cuit);
  if (!enrollment) return res.status(404).json({ error: 'Inscripción IIBB no encontrada' });
  return res.status(200).json(publicEnrollment(enrollment));
});

router.get('/inscripciones-iibb/:cuit', (req, res) => {
  const { cuit } = req.params;
  if (!isValidCuit(cuit)) return res.status(400).json({ error: 'CUIT inválido' });
  const enrollment = db.getInscription(cuit);
  if (!enrollment) return res.status(404).json({ error: 'Inscripción IIBB no encontrada' });
  return res.status(200).json(publicEnrollment(enrollment));
});

// El perfil comercial se administra separado de la inscripción IIBB.
router.get('/comercios', auth.requireAuth, auth.requireRoles('admin', 'superadmin'), (req, res) => {
  const paging = pageParameters(req.query, 100);
  if (!paging) return res.status(400).json({ error: 'Paginación inválida' });
  const result = db.listComercios(paging.page, paging.limit);
  return res.status(200).json({
    ...result,
    items: result.items.map(({ cuit, razon_social }) => ({ commerce_id: `COM-${cuit}`, cuit, razon_social })),
  });
});

router.post('/comercios', auth.requireAuth, auth.requireRoles('admin', 'superadmin'), (req, res) => {
  const body = req.body || {};
  if (!isValidCuit(body.cuit) || !validText(body.razon_social)) {
    return res.status(400).json({ error: 'Se requiere CUIT válido y razón social' });
  }
  const commerce = { commerce_id: validText(body.commerce_id, 80) ? body.commerce_id.trim() : `COM-${body.cuit}`, cuit: body.cuit, razon_social: body.razon_social.trim() };
  if (!db.createProfile(commerce)) return res.status(409).json({ error: 'CUIT o commerce_id ya registrado' });
  return res.status(201).json(commerce);
});

router.put('/comercios/:cuit', auth.requireAuth, auth.requireRoles('admin', 'superadmin'), (req, res) => {
  const { cuit } = req.params;
  if (!isValidCuit(cuit) || !validText(req.body?.razon_social)) {
    return res.status(400).json({ error: 'Se requiere CUIT válido y razón social' });
  }
  const updated = db.updateProfile(cuit, { razon_social: req.body.razon_social.trim() });
  if (!updated) return res.status(404).json({ error: 'Comercio no encontrado' });
  return res.status(200).json(updated);
});

router.delete('/comercios/:cuit', auth.requireAuth, auth.requireRoles('admin', 'superadmin'), (req, res) => {
  const { cuit } = req.params;
  if (!isValidCuit(cuit)) return res.status(400).json({ error: 'CUIT inválido' });
  if (!db.deleteComercio(cuit)) return res.status(404).json({ error: 'Comercio no encontrado' });
  return res.status(200).json({ cuit });
});

router.post('/inscripciones-iibb', auth.requireAuth, auth.requireRoles('admin', 'superadmin'), (req, res) => {
  const body = req.body || {};
  if (!isValidCuit(body.cuit)
    || !validText(body.activity_code, 40)
    || !validText(body.actividad)
    || !validRate(body.rate)
    || !validDate(body.valid_from)) {
    return res.status(400).json({ error: 'Inscripción inválida: requiere CUIT, actividad codificada, alícuota y vigencia' });
  }
  if (body.valid_to !== undefined && body.valid_to !== null && !validDate(body.valid_to)) {
    return res.status(400).json({ error: 'valid_to debe tener formato YYYY-MM-DD o ser null' });
  }
  const enrollment = db.createInscription({
    cuit: body.cuit,
    jurisdiction: validText(body.jurisdiction, 16) ? body.jurisdiction.trim() : DEMO_JURISDICTION,
    activity_code: body.activity_code.trim(),
    actividad: body.actividad.trim(),
    status: body.status === 'inactive' ? 'inactive' : 'active',
    rate: body.rate,
    valid_from: body.valid_from,
    valid_to: body.valid_to || null,
    version: validText(body.version, 80) ? body.version.trim() : `DEMO-${body.valid_from}`,
    source: validText(body.source, 200) ? body.source.trim() : DEMO_SOURCE,
  });
  if (!enrollment) return res.status(409).json({ error: 'El comercio no existe o ya tiene una inscripción IIBB' });
  return res.status(201).json(publicEnrollment(enrollment));
});

router.put('/inscripciones-iibb/:cuit', auth.requireAuth, auth.requireRoles('admin', 'superadmin'), (req, res) => {
  const { cuit } = req.params;
  const body = req.body || {};
  if (!isValidCuit(cuit)) return res.status(400).json({ error: 'CUIT inválido' });
  if (body.rate !== undefined && !validRate(body.rate)) return res.status(400).json({ error: 'rate debe ser una fracción decimal entre 0 y 1' });
  if (body.valid_from !== undefined && !validDate(body.valid_from)) return res.status(400).json({ error: 'valid_from debe tener formato YYYY-MM-DD' });
  if (body.activity_code !== undefined && !validText(body.activity_code, 40)) return res.status(400).json({ error: 'activity_code inválido' });
  if (body.actividad !== undefined && !validText(body.actividad)) return res.status(400).json({ error: 'actividad inválida' });
  if (body.status !== undefined && !['active', 'inactive'].includes(body.status)) return res.status(400).json({ error: 'status debe ser active o inactive' });
  const updated = db.updateInscription(cuit, {
    ...body,
    jurisdiction: body.jurisdiction || DEMO_JURISDICTION,
    source: body.source || DEMO_SOURCE,
  });
  if (!updated) return res.status(404).json({ error: 'Inscripción IIBB no encontrada' });
  return res.status(200).json(publicEnrollment(updated));
});

router.delete('/inscripciones-iibb/:cuit', auth.requireAuth, auth.requireRoles('admin', 'superadmin'), (req, res) => {
  const { cuit } = req.params;
  if (!isValidCuit(cuit)) return res.status(400).json({ error: 'CUIT inválido' });
  const updated = db.updateInscription(cuit, { status: 'inactive' });
  if (!updated) return res.status(404).json({ error: 'Inscripción IIBB no encontrada' });
  return res.status(200).json({ cuit, enrollment_status: 'inactive', is_official: false });
});

router.post('/percepciones', auth.requireAuth, (req, res) => {
  const body = req.body || {};
  const saleId = body.sale_id || body.id_venta;
  let cuit = body.cuit;
  if (!cuit && typeof body.commerce_id === 'string' && body.commerce_id.startsWith('COM-')) {
    cuit = body.commerce_id.slice(4);
  }
  const baseMinor = body.base_amount_minor;
  const currency = body.currency;
  const idempotencyKey = req.get('Idempotency-Key') || saleId;

  if (!validText(saleId, 120)) return res.status(400).json({ error: 'sale_id inválido' });
  if (!isValidCuit(cuit)) return res.status(400).json({ error: 'CUIT inválido' });
  if (!Number.isSafeInteger(baseMinor) || baseMinor <= 0) {
    return res.status(400).json({ error: 'base_amount_minor debe ser un entero positivo en centavos' });
  }
  if (currency !== 'ARS') return res.status(400).json({ error: 'La moneda admitida para esta simulación es ARS' });
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) return res.status(400).json({ error: 'Idempotency-Key inválida' });

  const normalizedRequest = { sale_id: saleId, cuit, base_amount_minor: baseMinor, currency };
  const existingSale = db.getPercepcionByIdVenta(saleId);
  if (existingSale) {
    if (!sameRequest(existingSale, normalizedRequest)) return res.status(409).json({ error: 'sale_id ya existe con otros datos' });
    return res.status(200).json({ data: db.listPercepcionesV1ByCuit(cuit).find((row) => row.sale_id === saleId) });
  }
  const existingKey = db.getPercepcionByIdempotencyKey(idempotencyKey);
  if (existingKey) {
    if (!sameRequest(existingKey, normalizedRequest)) return res.status(409).json({ error: 'Idempotency-Key ya fue utilizada con otros datos' });
    return res.status(200).json({ data: db.listPercepcionesV1ByCuit(cuit).find((row) => row.sale_id === existingKey.sale_id) });
  }

  const enrollment = db.getInscription(cuit);
  if (!enrollment) return res.status(404).json({ error: 'Inscripción IIBB no encontrada para el CUIT' });
  if (enrollment.status !== 'active' || enrollment.applications?.arba_iibb === false) {
    return res.status(403).json({ error: 'Inscripción IIBB inactiva para la simulación' });
  }
  if (!enrollment.rate) return res.status(422).json({ error: 'No hay una alícuota vigente para la fecha de aplicación' });
  const effectiveDate = new Date().toISOString().slice(0, 10);
  const rate = db.getRate(cuit, effectiveDate);
  if (!rate) return res.status(422).json({ error: 'No hay una alícuota vigente para la fecha de aplicación' });
  if (body.commerce_id && body.commerce_id !== enrollment.commerce_id) {
    return res.status(400).json({ error: 'commerce_id no corresponde al CUIT informado' });
  }

  const perceptionId = randomUUID();
  const perception = {
    id: perceptionId,
    sale_id: saleId,
    idempotency_key: idempotencyKey.trim(),
    cuit,
    commerce_id: enrollment.commerce_id,
    base_amount_minor: baseMinor,
    rate: rate.rate,
    rate_version: rate.version,
    rate_valid_from: rate.valid_from,
    rate_source: rate.source,
    tax_amount_minor: Math.round(baseMinor * rate.rate),
    currency,
    status: 'calculated',
    created_at: new Date().toISOString(),
  };
  const created = db.createPercepcion(perception);
  if (!created) return res.status(409).json({ error: 'sale_id ya existe' });
  const resource = {
    reference: perception.id,
    sale_id: perception.sale_id,
    commerce_id: perception.commerce_id,
    cuit: perception.cuit,
    rate: perception.rate,
    rate_version: perception.rate_version,
    rate_valid_from: perception.rate_valid_from,
    rate_source: perception.rate_source,
    base_amount_minor: perception.base_amount_minor,
    tax_amount_minor: perception.tax_amount_minor,
    currency: perception.currency,
    status: perception.status,
    created_at: perception.created_at,
  };
  return res.status(201).json({ data: resource });
});

router.get('/percepciones/:cuit', auth.requireAuth, (req, res) => {
  const { cuit } = req.params;
  if (!isValidCuit(cuit)) return res.status(400).json({ error: 'CUIT inválido' });
  const percepciones = db.listPercepcionesV1ByCuit(cuit);
  return res.status(200).json({ data: { cuit, cantidad: percepciones.length, percepciones } });
});

module.exports = router;

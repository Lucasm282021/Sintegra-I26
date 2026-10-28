const crypto = require('node:crypto');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const falla = (status, mensaje) => new HttpError(status, mensaje);

const cuitValido = (v) => typeof v === 'string' && /^\d{11}$/.test(v);
const idValido = (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;
const montoValido = (m) => typeof m === 'number' && Number.isFinite(m) && m > 0
  && Math.abs(m * 100 - Math.round(m * 100)) < 1e-7;
const uuidValido = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));
const num = (v) => (v === null || v === undefined ? v : Number(v));
const hash = (obj) => crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');

// Envuelve un handler async: errores HttpError → {"error": "..."}.
const ruta = (fn) => async (req, res, next) => {
  try {
    const out = await fn(req, res);
    if (out && !res.headersSent) res.status(out.status || 200).json(out.body);
  } catch (err) { next(err); }
};

module.exports = { HttpError, falla, cuitValido, idValido, montoValido, uuidValido, num, hash, ruta };

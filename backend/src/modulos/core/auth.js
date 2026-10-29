// Usuarios y sesiones del CORE. Contraseñas con bcrypt (pgcrypto); sesión con
// token firmado HMAC, sin estado en el servidor (sirve en funciones de Vercel).
const crypto = require('node:crypto');
const { query } = require('../../db');
const { falla } = require('../../http');

const DURACION_MS = 8 * 60 * 60 * 1000;

function secreto() {
  const s = process.env.CORE_AUTH_SECRET?.trim();
  if (s) return s;
  if (process.env.VERCEL) throw falla(503, 'CORE sin configurar: falta CORE_AUTH_SECRET');
  return 'sintegra-core-solo-desarrollo-local';
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const firma = (datos) => crypto.createHmac('sha256', secreto()).update(datos).digest('base64url');

function emitirToken(usuarioId) {
  const datos = b64({ sub: usuarioId, exp: Date.now() + DURACION_MS });
  return `${datos}.${firma(datos)}`;
}

function leerToken(token) {
  const [datos, recibida] = String(token || '').split('.');
  if (!datos || !recibida) return null;
  const esperada = firma(datos);
  if (esperada.length !== recibida.length
    || !crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(recibida))) return null;
  try {
    const p = JSON.parse(Buffer.from(datos, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

const filaUsuario = (u) => ({ id: u.id, email: u.email, nombre: u.nombre });

async function crearUsuario({ email, nombre, password }) {
  const correo = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 254) throw falla(400, 'correo inválido');
  if (!String(nombre || '').trim()) throw falla(400, 'el nombre es obligatorio');
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) {
    throw falla(400, 'la contraseña debe tener entre 10 y 128 caracteres');
  }
  try {
    const u = (await query(
      `insert into core.usuarios (email, nombre, password_hash)
       values ($1, $2, extensions.crypt($3, extensions.gen_salt('bf'))) returning *`,
      [correo, String(nombre).trim(), password])).rows[0];
    return { usuario: filaUsuario(u), token: emitirToken(u.id) };
  } catch (err) {
    if (err.code === '23505' || /duplicate|unique/i.test(err.message)) throw falla(409, 'ya existe un usuario con ese correo');
    throw err;
  }
}

async function iniciarSesion({ email, password }) {
  const correo = String(email || '').trim().toLowerCase();
  const u = (await query(
    `select *, (password_hash = extensions.crypt($2, password_hash)) as ok
     from core.usuarios where email = $1 and estado = 'activo'`, [correo, String(password || '')])).rows[0];
  if (!u || !u.ok) throw falla(401, 'correo o contraseña incorrectos');
  await query('update core.usuarios set ultimo_ingreso = now() where id = $1', [u.id]);
  return { usuario: filaUsuario(u), token: emitirToken(u.id) };
}

// Middleware: exige `Authorization: Bearer <token>` y deja el usuario en req.usuario.
async function requiereSesion(req, _res, next) {
  try {
    const sesion = leerToken((req.get('authorization') || '').replace(/^Bearer\s+/i, ''));
    if (!sesion) throw falla(401, 'iniciá sesión para continuar');
    const u = (await query("select * from core.usuarios where id = $1 and estado = 'activo'", [sesion.sub])).rows[0];
    if (!u) throw falla(401, 'la sesión ya no es válida');
    req.usuario = filaUsuario(u);
    next();
  } catch (err) { next(err); }
}

module.exports = { crearUsuario, iniciarSesion, requiereSesion, emitirToken, leerToken };

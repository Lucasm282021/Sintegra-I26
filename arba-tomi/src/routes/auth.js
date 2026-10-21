const express = require('express');
const crypto = require('crypto');

const router = express.Router();
const secret = () => {
  if (process.env.NODE_ENV === 'production' && !process.env.AUTH_SECRET) throw new Error('AUTH_SECRET es obligatorio en producción');
  return process.env.AUTH_SECRET || 'arba-academico-local-secret-cambiar';
};
const now = () => new Date().toISOString();
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(password, encoded) {
  const [, salt, expected] = String(encoded || '').split('$');
  if (!salt || !expected) return false;
  const actual = Buffer.from(hashPassword(password, salt).split('$')[2], 'hex');
  const target = Buffer.from(expected, 'hex');
  return actual.length === target.length && crypto.timingSafeEqual(actual, target);
}
function sign(user) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
function readSession(req) {
  const token = (req.headers.cookie || '').split(';').map((x) => x.trim()).find((x) => x.startsWith('arba_session='))?.slice(13);
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest();
  let supplied;
  try { supplied = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); return data.exp > Date.now() ? data : null; } catch { return null; }
}
function publicUser(user) { return user && { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, activo: Boolean(user.activo) }; }
function authRequired(req, res, next) {
  const data = readSession(req);
  const user = data && req.app.locals.db.prepare('SELECT * FROM usuarios WHERE id = ? AND activo = 1').get(data.id);
  if (!user) return res.status(401).json({ error: 'autenticacion requerida' });
  req.user = publicUser(user); next();
}
function adminRequired(req, res, next) {
  if (req.user?.rol !== 'admin') return res.status(403).json({ error: 'permiso denegado' });
  next();
}
function ensureInitialAdmin(db) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  if (!db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.toLowerCase())) {
    db.prepare('INSERT INTO usuarios (nombre,email,password_hash,rol,activo,creado_en,actualizado_en) VALUES (?,?,?,\'admin\',1,?,?)')
      .run(process.env.ADMIN_NAME || 'Administrador', email.toLowerCase(), hashPassword(password), now(), now());
  }
}
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'email y contraseña requeridos' });
  const user = req.app.locals.db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !user.activo || !verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'credenciales invalidas' });
  res.setHeader('Set-Cookie', `arba_session=${sign(user)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  return res.status(200).json({ usuario: publicUser(user) });
});
router.post('/logout', (req, res) => { res.setHeader('Set-Cookie', 'arba_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); return res.status(200).json({ ok: true }); });
router.get('/me', authRequired, (req, res) => res.status(200).json({ usuario: req.user }));

module.exports = { router, authRequired, adminRequired, ensureInitialAdmin, hashPassword, publicUser };

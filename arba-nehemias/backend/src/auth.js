const {
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} = require('crypto');
const db = require('./db');

// Para desarrollo local la clave vive solo mientras corre el backend.
// En un despliegue se debe definir JWT_SECRET con una clave propia y privada.
const tokenSecret = process.env.JWT_SECRET || randomBytes(32).toString('hex');
const roles = new Set(['superadmin', 'admin', 'user']);

function safeUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at };
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const key = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${key}`;
}

function verifyPassword(password, storedHash) {
  const [algorithm, salt, expectedHex] = String(storedHash || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function signPayload(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', tokenSecret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function issueToken(user) {
  const now = Math.floor(Date.now() / 1000);
  return signPayload({ sub: user.id, iat: now, exp: now + (8 * 60 * 60) });
}

function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const [encoded, signature, extra] = token.split('.');
  if (!encoded || !signature || extra) return null;
  const expected = createHmac('sha256', tokenSecret).update(encoded).digest();
  let received;
  try {
    received = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.sub || !Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    const user = db.findUserById(payload.sub);
    return user ? safeUser(user) : null;
  } catch {
    return null;
  }
}

function createAccount({ name, email, password, role }) {
  const salt = randomBytes(16).toString('hex');
  const user = {
    id: randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role,
    password_hash: hashPassword(password, salt),
    created_at: new Date().toISOString(),
  };
  return db.createUser(user) ? user : null;
}

function requireAuth(req, res, next) {
  const match = /^Bearer\s+(.+)$/i.exec(req.get('Authorization') || '');
  const user = match ? verifyToken(match[1]) : null;
  if (!user) return res.status(401).json({ error: 'Sesión vencida o no iniciada. Volvé a ingresar.' });
  req.user = user;
  return next();
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Iniciá sesión para continuar.' });
    if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ error: 'Tu rol no tiene permiso para esta acción.' });
    return next();
  };
}

module.exports = {
  createAccount,
  hashPassword,
  issueToken,
  requireAuth,
  requireRoles,
  roles,
  safeUser,
  verifyPassword,
  verifyToken,
};

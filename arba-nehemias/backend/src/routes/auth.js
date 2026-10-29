const express = require('express');
const db = require('../db');
const auth = require('../auth');

const router = express.Router();

function validateAccount(body) {
  if (typeof body?.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 100) {
    return 'Ingresá un nombre de entre 2 y 100 caracteres.';
  }
  if (typeof body?.email !== 'string' || body.email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return 'Ingresá un correo válido.';
  }
  if (typeof body?.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
    return 'La contraseña debe tener entre 8 y 128 caracteres.';
  }
  return null;
}

function sessionResponse(user) {
  return { token: auth.issueToken(user), user: auth.safeUser(user) };
}

router.get('/setup-status', (req, res) => {
  return res.status(200).json({ setup_required: db.countUsers() === 0 });
});

router.post('/bootstrap', (req, res) => {
  if (db.countUsers() > 0) return res.status(409).json({ error: 'La configuración inicial ya fue realizada.' });
  const error = validateAccount(req.body);
  if (error) return res.status(400).json({ error });
  const user = auth.createAccount({ ...req.body, role: 'superadmin' });
  if (!user) return res.status(409).json({ error: 'Ese correo ya está registrado.' });
  return res.status(201).json(sessionResponse(user));
});

router.post('/login', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const user = db.findUserByEmail(email);
  if (!user || !auth.verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
  return res.status(200).json(sessionResponse(user));
});

router.get('/me', auth.requireAuth, (req, res) => res.status(200).json({ user: req.user }));

router.get('/users', auth.requireAuth, auth.requireRoles('superadmin'), (req, res) => {
  return res.status(200).json({ items: db.listUsers() });
});

router.post('/users', auth.requireAuth, auth.requireRoles('superadmin'), (req, res) => {
  const error = validateAccount(req.body);
  if (error) return res.status(400).json({ error });
  const role = req.body.role;
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'El rol debe ser admin o user.' });
  }
  const user = auth.createAccount({ ...req.body, role });
  if (!user) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });
  return res.status(201).json({ user: auth.safeUser(user) });
});

module.exports = router;

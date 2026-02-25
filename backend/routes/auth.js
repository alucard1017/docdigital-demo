const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const Sentry = require('@sentry/node');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secreto-demo';

// Normalizar RUN: quitar puntos y guiones
const normalizeRun = run => (run || '').replace(/[.\-]/g, '');

/**
 * Middleware de autenticación
 */
function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const token = header.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;

    Sentry.setUser({
      id: String(payload.id),
      username: payload.name || undefined,
      email: payload.email || undefined,
    });

    Sentry.setTag('user_role', payload.role || 'unknown');
    Sentry.setTag('user_company', String(payload.company_id || 'none'));

    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

/**
 * Middleware de autorización por rol
 */
function requireRole(requiredRole) {
  return function (req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }
    if (req.user.role !== requiredRole) {
      return res.status(403).json({ message: 'Permisos insuficientes' });
    }
    return next();
  };
}

/**
 * POST /api/auth/login
 * Acepta RUN o correo en un solo campo: identifier
 */
router.post('/login', async (req, res, next) => {
  try {
    console.log('DEBUG /api/auth/login body:', req.body);

    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: 'RUN o correo y contraseña son obligatorios' });
    }

    const isEmail = identifier.includes('@');
    const normalizedRun = isEmail ? null : normalizeRun(identifier);

    const query = isEmail
      ? 'SELECT * FROM users WHERE email = $1'
      : 'SELECT * FROM users WHERE run = $1';

    const value = isEmail ? identifier : normalizedRun;

    const result = await db.query(query, [value]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const ok = bcrypt.compareSync(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        run: user.run,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        run: user.run,
        email: user.email,
        name: user.name,
        role: user.role,
        company_id: user.company_id,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', requireAuth, (req, res) => {
  return res.json({
    id: req.user.id,
    run: req.user.run,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role,
    company_id: req.user.company_id,
  });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireRole = requireRole;

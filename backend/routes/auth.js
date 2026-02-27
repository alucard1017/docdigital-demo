const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const Sentry = require('@sentry/node');

const router = express.Router();

// JWT_SECRET obligatorio en producción
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('❌ JWT_SECRET no está definido en variables de entorno');
  // En producción podrías hacer: process.exit(1);
}

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

    // Contexto en Sentry
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
 *
 * - SUPER_ADMIN siempre pasa.
 * - ADMIN_GLOBAL pasa para rutas marcadas como ADMIN_GLOBAL o ADMIN.
 * - ADMIN solo pasa cuando se exige exactamente ADMIN.
 * - USER no pasa por este middleware.
 */
function requireRole(requiredRole) {
  return function (req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Acceso denegado' });
    }

    const role = req.user.role;

    // SUPER_ADMIN tiene pase libre
    if (role === 'SUPER_ADMIN') {
      return next();
    }

    // Escalera de permisos
    if (requiredRole === 'ADMIN_GLOBAL') {
      if (role !== 'ADMIN_GLOBAL') {
        return res.status(403).json({ message: 'Permisos insuficientes' });
      }
      return next();
    }

    if (requiredRole === 'ADMIN') {
      if (role !== 'ADMIN' && role !== 'ADMIN_GLOBAL') {
        return res.status(403).json({ message: 'Permisos insuficientes' });
      }
      return next();
    }

    // Para otros casos futuros
    if (role !== requiredRole) {
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
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res
        .status(400)
        .json({ message: 'RUN o correo y contraseña son obligatorios' });
    }

    // Forzar minúsculas para emails
    const rawIdentifier = String(identifier).trim();
    const isEmail = rawIdentifier.includes('@');
    const normalizedIdentifier = isEmail
      ? rawIdentifier.toLowerCase()
      : normalizeRun(rawIdentifier);

    if (process.env.NODE_ENV !== 'production') {
      console.log('DEBUG /api/auth/login identifier:', normalizedIdentifier);
    }

    const query = isEmail
      ? 'SELECT * FROM users WHERE email = $1'
      : 'SELECT * FROM users WHERE run = $1';

    const value = normalizedIdentifier;

    const result = await db.query(query, [value]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Bloquear usuarios inactivos
    if (user.active === false) {
      return res
        .status(401)
        .json({ message: 'Cuenta desactivada, contacta al administrador' });
    }

    // Solo password_hash (legacy password eliminado en BD)
    if (!user.password_hash) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const tokenPayload = {
      id: user.id,
      run: user.run,
      email: user.email,
      name: user.name,
      role: user.role,
      company_id: user.company_id,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

    return res.json({
      token,
      user: tokenPayload,
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

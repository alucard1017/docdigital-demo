const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// Usar secreto fuerte desde variables de entorno
const JWT_SECRET = process.env.JWT_SECRET || 'secreto-demo';

/**
 * Asegurar usuario administrador al iniciar el servidor
 */
(async () => {
  try {
    const adminRun = process.env.ADMIN_RUN || '1053806586';
    const adminName = process.env.ADMIN_NAME || 'Alucard';
    const adminPassword = process.env.ADMIN_PASSWORD || 'secreto-demo';

    const hash = bcrypt.hashSync(adminPassword, 10);

    const query = `
      INSERT INTO users (run, name, password_hash, plan, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (run) DO UPDATE SET 
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        plan = EXCLUDED.plan,
        role = EXCLUDED.role;
    `;

    const values = [adminRun, adminName, hash, 'pro', 'admin'];

    await db.query(query, values);
    console.log(`✓ Usuario administrador asegurado: ${adminName} (${adminRun})`);
  } catch (err) {
    console.error('Error asegurando usuario administrador:', err);
  }
})();

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
 * Procesa el acceso al sistema
 */
router.post('/login', async (req, res, next) => {
  try {
    const { run, password } = req.body;

    if (!run || !password) {
      return res.status(400).json({ message: 'RUN y contraseña son obligatorios' });
    }

    const result = await db.query(
      'SELECT * FROM users WHERE run = $1',
      [run]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const ok = bcrypt.compareSync(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        run: user.run,
        plan: user.plan,
        name: user.name,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        run: user.run,
        name: user.name,
        plan: user.plan,
        role: user.role
      }
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/auth/me
 * Devuelve datos del usuario autenticado
 */
router.get('/me', requireAuth, (req, res) => {
  return res.json({
    id: req.user.id,
    run: req.user.run,
    name: req.user.name,
    plan: req.user.plan,
    role: req.user.role
  });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireRole = requireRole;

// backend/routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();

const normalizeRun = run => (run || '').replace(/[.\-]/g, '');

// RUN del dueño que NUNCA se puede borrar (normalizado)
const OWNER_RUN = normalizeRun(process.env.ADMIN_RUN || '1053806586');

/**
 * POST /api/users/register
 * Registro público (si lo usas)
 */
router.post('/register', async (req, res, next) => {
  try {
    const { run, name, email, password, plan, role } = req.body;

    const normalizedRun = normalizeRun(run);
    const hash = bcrypt.hashSync(password, 10);

    await db.query(
      'INSERT INTO users (run, name, email, password_hash, plan, role) VALUES ($1, $2, $3, $4, $5, $6)',
      [normalizedRun, name, email, hash, plan || 'basic', role || 'user']
    );

    return res.status(201).json({ message: 'Usuario creado' });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/users
 * Lista de usuarios (solo admin)
 */
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, run, name, plan, role FROM users ORDER BY id ASC'
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('❌ Error listando usuarios:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * POST /api/users
 * Crear usuario (solo admin)
 */
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { run, name, password, plan = 'basic', role = 'admin' } = req.body;

    if (!run || !name || !password) {
      return res
        .status(400)
        .json({ message: 'RUN, nombre y contraseña son obligatorios' });
    }

    const normalizedRun = normalizeRun(run);
    const hash = bcrypt.hashSync(password, 10);

    const result = await db.query(
      `INSERT INTO users (run, name, password_hash, plan, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, run, name, plan, role`,
      [normalizedRun, name, hash, plan, role]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error creando usuario:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/users/:id
 * Borrar usuario (solo admin) pero NUNCA al dueño
 */
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener datos del usuario objetivo
    const userRes = await db.query(
      'SELECT id, run, role FROM users WHERE id = $1',
      [id]
    );

    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const target = userRes.rows[0];

    // 1) Nadie puede borrar al dueño (tu RUN)
    if (target.run === OWNER_RUN) {
      return res
        .status(403)
        .json({ message: 'No se puede eliminar la cuenta principal del sistema' });
    }

    // 2) Solo el dueño puede borrar otros admins
    if (target.role === 'admin' && normalizeRun(req.user.run) !== OWNER_RUN) {
      return res
        .status(403)
        .json({ message: 'Solo el dueño puede eliminar otros administradores' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);

    return res.json({ message: 'Usuario eliminado correctamente' });
  } catch (err) {
    console.error('❌ Error eliminando usuario:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

module.exports = router;

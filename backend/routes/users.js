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
 * Lista de usuarios
 * - Dueño (OWNER_RUN): ve todos
 * - admin_global: ve todos excepto al dueño
 * - admin normal: solo se ve a sí mismo
 * Permite filtrar por rol: /api/users?role=admin
 */
router.get('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const requesterRun = normalizeRun(req.user.run);
    const isOwner = requesterRun === OWNER_RUN;
    const isGlobalAdmin = req.user.role === 'admin_global';

    const { role } = req.query;

    const params = [];
    const whereParts = [];

    if (isOwner || isGlobalAdmin) {
      // Pueden ver varios usuarios
      if (!isOwner) {
        // admin_global no ve al dueño
        whereParts.push(`run <> $${params.length + 1}`);
        params.push(OWNER_RUN);
      }
    } else {
      // admin normal: solo su propio usuario
      whereParts.push(`run = $${params.length + 1}`);
      params.push(requesterRun);
    }

    if (role) {
      whereParts.push(`role = $${params.length + 1}`);
      params.push(role);
    }

    let query = 'SELECT id, run, name, email, plan, role FROM users';

    if (whereParts.length > 0) {
      query += ' WHERE ' + whereParts.join(' AND ');
    }

    query += ' ORDER BY id ASC';

    const result = await db.query(query, params);
    return res.json(result.rows);
  } catch (err) {
    console.error('❌ Error listando usuarios:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * POST /api/users
 * Crear usuario (solo admin)
 * - Dueño puede crear cualquiera (incluidos admin_global)
 * - admin_global y admin crean usuarios normales por defecto
 */
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { run, name, password, plan = 'basic', role, email } = req.body;

    if (!run || !name || !password) {
      return res
        .status(400)
        .json({ message: 'RUN, nombre y contraseña son obligatorios' });
    }

    const requesterRun = normalizeRun(req.user.run);
    const isOwner = requesterRun === OWNER_RUN;

    // Si no se envía rol, o el que crea no es dueño, forzamos 'admin' o 'user'
    let finalRole = role || 'admin';
    if (!isOwner && (finalRole === 'admin_global')) {
      finalRole = 'admin';
    }

    const normalizedRun = normalizeRun(run);
    const hash = bcrypt.hashSync(password, 10);

    const result = await db.query(
      `INSERT INTO users (run, name, email, password_hash, plan, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, run, name, email, plan, role`,
      [normalizedRun, name, email || null, hash, plan, finalRole]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error creando usuario:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/users/:id
 * Borrar usuario (solo admin) pero:
 * - Nadie puede borrar al dueño
 * - Solo el dueño puede borrar otros admins/admin_global
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
    const requesterRun = normalizeRun(req.user.run);
    const isOwner = requesterRun === OWNER_RUN;

    // 1) Nadie puede borrar al dueño
    if (target.run === OWNER_RUN) {
      return res
        .status(403)
        .json({ message: 'No se puede eliminar la cuenta principal del sistema' });
    }

    // 2) Solo el dueño puede borrar otros admins (admin o admin_global)
    if ((target.role === 'admin' || target.role === 'admin_global') && !isOwner) {
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

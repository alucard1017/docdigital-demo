// backend/routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();

const normalizeRun = run => (run || '').replace(/[.\\-]/g, '');

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
      `INSERT INTO users (run, name, email, password_hash, plan, role, active)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
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

    let query = `
      SELECT id, run, name, email, plan, role, active
      FROM users
    `;

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
 * - admin_global y admin crean admins normales por defecto
 */
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { run, name, password, plan = 'basic', role, email, active } = req.body;

    if (!run || !name || !password) {
      return res
        .status(400)
        .json({ message: 'RUN, nombre y contraseña son obligatorios' });
    }

    const requesterRun = normalizeRun(req.user.run);
    const isOwner = requesterRun === OWNER_RUN;

    let finalRole = role || 'admin';
    if (!isOwner && finalRole === 'admin_global') {
      finalRole = 'admin';
    }

    const normalizedRun = normalizeRun(run);
    const hash = bcrypt.hashSync(password, 10);

    const finalActive =
      typeof active === 'boolean' ? active : true;

    const result = await db.query(
      `INSERT INTO users (run, name, email, password_hash, plan, role, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, run, name, email, plan, role, active`,
      [normalizedRun, name, email || null, hash, plan, finalRole, finalActive]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error creando usuario:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * PUT /api/users/:id
 * Editar usuario (solo admin)
 * - Nadie puede cambiar el rol del dueño
 * - Solo el dueño puede subir/bajar roles de admin/admin_global
 */
router.put('/:id', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { run, name, email, plan, role, password, active } = req.body;

    const requesterRun = normalizeRun(req.user.run);
    const isOwner = requesterRun === OWNER_RUN;
    const isGlobalAdmin = req.user.role === 'admin_global';

    const userRes = await db.query(
      'SELECT id, run, role FROM users WHERE id = $1',
      [id]
    );

    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const target = userRes.rows[0];
    const targetIsOwner = normalizeRun(target.run) === OWNER_RUN;

    // Nadie puede cambiar al dueño salvo él mismo, y sin tocar role
    if (targetIsOwner && !isOwner) {
      return res
        .status(403)
        .json({ message: 'No tienes permisos para modificar la cuenta principal' });
    }

    // Solo el dueño puede cambiar el rol de otros admins/admin_global
    if ((target.role === 'admin' || target.role === 'admin_global') && !isOwner) {
      if (role && role !== target.role) {
        return res
          .status(403)
          .json({ message: 'Solo el dueño puede cambiar el rol de otros administradores' });
      }
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (run) {
      fields.push(`run = $${idx++}`);
      values.push(normalizeRun(run));
    }
    if (name) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }
    if (email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(email || null);
    }
    if (plan) {
      fields.push(`plan = $${idx++}`);
      values.push(plan);
    }
    if (role && !(targetIsOwner && !isOwner)) {
      // No permitimos que alguien distinto del dueño cambie el rol del owner
      if (!isOwner && role === 'admin_global') {
        // admin_global / admin no pueden subir a admin_global
        return res
          .status(403)
          .json({ message: 'Solo el dueño puede asignar rol admin_global' });
      }
      fields.push(`role = $${idx++}`);
      values.push(role);
    }
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      fields.push(`password_hash = $${idx++}`);
      values.push(hash);
    }
    if (typeof active === 'boolean') {
      fields.push(`active = $${idx++}`);
      values.push(active);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE users
       SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING id, run, name, email, plan, role, active`,
      values
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error actualizando usuario:', err);
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
    if (normalizeRun(target.run) === OWNER_RUN) {
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

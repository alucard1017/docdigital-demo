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
      [normalizedRun, name, email, hash, plan || 'basic', role || 'ADMIN']
    );

    return res.status(201).json({ message: 'Usuario creado' });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/users
 * Lista de usuarios
 * - SUPER_ADMIN y ADMIN_GLOBAL: ven todos
 * - ADMIN: solo usuarios de su misma company_id
 * Permite filtrar por rol: /api/users?role=ADMIN
 */
router.get('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    console.log(
      'GET /api/users by',
      req.user.id,
      req.user.role,
      'company',
      req.user.company_id
    );

    const { role, company_id, run } = req.user;
    const { role: filterRole } = req.query;

    const params = [];
    const whereParts = [];

    const requesterRun = normalizeRun(run);
    const isOwner = requesterRun === OWNER_RUN;
    const isSuper = role === 'SUPER_ADMIN';
    const isGlobal = role === 'ADMIN_GLOBAL';

    // Filtro por tenant: solo los ADMIN normales se restringen por company_id
    if (!isSuper && !isGlobal) {
      whereParts.push(`company_id = $${params.length + 1}`);
      params.push(company_id);
    }

    // Si NO es dueño, opcionalmente puedes ocultar al OWNER
    if (!isOwner) {
      whereParts.push(`run <> $${params.length + 1}`);
      params.push(OWNER_RUN);
    }

    if (filterRole) {
      whereParts.push(`role = $${params.length + 1}`);
      params.push(filterRole);
    }

    let query = `
      SELECT id, run, name, email, plan, role, active, company_id
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
 * - Dueño puede crear cualquiera (incluidos ADMIN_GLOBAL)
 * - ADMIN_GLOBAL y ADMIN crean ADMIN normales por defecto
 */
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { run, name, password, plan = 'basic', role, email, active, company_id } = req.body;

    if (!run || !name || !password) {
      return res
        .status(400)
        .json({ message: 'RUN, nombre y contraseña son obligatorios' });
    }

    const requesterRun = normalizeRun(req.user.run);
    const isOwner = requesterRun === OWNER_RUN;
    const requesterRole = req.user.role;

    // Rol final del nuevo usuario
    let finalRole = role || 'ADMIN';

    if (!isOwner && finalRole === 'ADMIN_GLOBAL') {
      // Solo el dueño puede crear ADMIN_GLOBAL
      finalRole = 'ADMIN';
    }

    const normalizedRun = normalizeRun(run);
    const hash = bcrypt.hashSync(password, 10);

    // Si no mandan company_id, hereda el del creador
    const finalCompanyId = company_id || req.user.company_id || null;

    const finalActive =
      typeof active === 'boolean' ? active : true;

    const result = await db.query(
      `INSERT INTO users (run, name, email, password_hash, plan, role, active, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, run, name, email, plan, role, active, company_id`,
      [normalizedRun, name, email || null, hash, plan, finalRole, finalActive, finalCompanyId]
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
 * - Solo el dueño puede subir/bajar roles de ADMIN/ADMIN_GLOBAL
 */
router.put('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { run, name, email, plan, role, password, active, company_id } = req.body;

    const requesterRun = normalizeRun(req.user.run);
    const isOwner = requesterRun === OWNER_RUN;

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

    // Solo el dueño puede cambiar el rol de otros admins
    if ((target.role === 'ADMIN' || target.role === 'ADMIN_GLOBAL') && !isOwner) {
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
      if (!isOwner && role === 'ADMIN_GLOBAL') {
        // Solo el dueño puede subir a ADMIN_GLOBAL
        return res
          .status(403)
          .json({ message: 'Solo el dueño puede asignar rol ADMIN_GLOBAL' });
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
    if (company_id !== undefined) {
      fields.push(`company_id = $${idx++}`);
      values.push(company_id || null);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No hay campos para actualizar' });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE users
       SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING id, run, name, email, plan, role, active, company_id`,
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
 * - Solo el dueño puede borrar otros admins (ADMIN o ADMIN_GLOBAL)
 */
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
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

    // 2) Solo el dueño puede borrar otros administradores
    if ((target.role === 'ADMIN' || target.role === 'ADMIN_GLOBAL') && !isOwner) {
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

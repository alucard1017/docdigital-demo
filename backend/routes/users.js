const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();

const normalizeRun = run => (run || '').replace(/[.\\\-]/g, '');

// RUN del dueño que NUNCA se puede borrar (normalizado)
const OWNER_RUN = normalizeRun(process.env.ADMIN_RUN || '1053806586');

const ALLOWED_ROLES = ['SUPER_ADMIN', 'ADMIN_GLOBAL', 'ADMIN', 'USER'];

/**
 * POST /api/users/register
 * Registro público (si lo usas)
 * - Crea siempre USER por defecto y sin privilegios.
 * - Puedes luego asociarlo a una company_id desde el panel.
 */
router.post('/register', async (req, res, next) => {
  try {
    const { run, name, email, password, plan } = req.body || {};

    if (!run || !name || !email || !password) {
      return res
        .status(400)
        .json({ message: 'RUN, nombre, correo y contraseña son obligatorios' });
    }

    const normalizedRun = normalizeRun(run);
    const normalizedEmail = String(email).toLowerCase();
    const hash = bcrypt.hashSync(password, 10);

    await db.query(
      `INSERT INTO users (run, name, email, password_hash, plan, role, active, company_id)
       VALUES ($1, $2, $3, $4, $5, 'USER', true, $6)`,
      [
        normalizedRun,
        name,
        normalizedEmail,
        hash,
        plan || 'basic',
        null, // se podrá asignar company_id luego desde el panel
      ]
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

    // Si NO es dueño, ocultar al OWNER
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
 *
 * Regla por empresa:
 * - Si es el PRIMER usuario de esa company_id -> role = ADMIN forzado.
 * - Si ya existen usuarios en esa company_id:
 *   - OWNER puede asignar cualquier rol (incluyendo ADMIN_GLOBAL / SUPER_ADMIN).
 *   - ADMIN_GLOBAL puede crear ADMIN o USER (nunca SUPER_ADMIN).
 *   - ADMIN de empresa puede crear USER o ADMIN, solo dentro de su misma company_id.
 */
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const {
      run,
      name,
      password,
      plan = 'basic',
      role,
      email,
      active,
      company_id,
    } = req.body || {};

    if (!run || !name || !password) {
      return res
        .status(400)
        .json({ message: 'RUN, nombre y contraseña son obligatorios' });
    }

    const requesterRun = normalizeRun(req.user.run);
    const requesterRole = req.user.role;
    const isOwner = requesterRun === OWNER_RUN;

    const normalizedRun = normalizeRun(run);
    const normalizedEmail = email ? String(email).toLowerCase() : null;
    const hash = bcrypt.hashSync(password, 10);

    // company_id final: si no se envía, hereda el del creador
    const finalCompanyId = company_id || req.user.company_id;

    if (!finalCompanyId) {
      return res
        .status(400)
        .json({ message: 'company_id es obligatorio para crear usuarios' });
    }

    // ¿Cuántos usuarios existen ya en esa empresa?
    const countRes = await db.query(
      'SELECT COUNT(*)::int AS total FROM users WHERE company_id = $1',
      [finalCompanyId]
    );
    const totalInCompany = countRes.rows[0].total;

    let finalRole = role || 'USER';

    // Si es el primer usuario de la empresa, siempre ADMIN
    if (totalInCompany === 0) {
      finalRole = 'ADMIN';
    } else {
      // No es el primero: aplicar reglas según quién crea
      if (isOwner) {
        // OWNER puede dejar cualquier rol permitido
        if (!ALLOWED_ROLES.includes(finalRole)) {
          finalRole = 'USER';
        }
      } else if (requesterRole === 'ADMIN_GLOBAL') {
        // ADMIN_GLOBAL: puede crear ADMIN o USER (nunca SUPER_ADMIN)
        if (finalRole === 'SUPER_ADMIN') {
          finalRole = 'ADMIN';
        }
        if (!['ADMIN', 'USER'].includes(finalRole)) {
          finalRole = 'USER';
        }
      } else if (requesterRole === 'ADMIN') {
        // ADMIN de empresa: solo ADMIN o USER y siempre en su propia company_id
        if (finalCompanyId !== req.user.company_id) {
          return res
            .status(403)
            .json({ message: 'No puedes crear usuarios en otra empresa' });
        }
        if (!['ADMIN', 'USER'].includes(finalRole)) {
          finalRole = 'USER';
        }
      } else {
        // Roles menores no deberían llegar aquí por requireRole, pero por seguridad:
        finalRole = 'USER';
      }
    }

    const finalActive = typeof active === 'boolean' ? active : true;

    const result = await db.query(
      `INSERT INTO users (run, name, email, password_hash, plan, role, active, company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, run, name, email, plan, role, active, company_id`,
      [
        normalizedRun,
        name,
        normalizedEmail,
        hash,
        plan,
        finalRole,
        finalActive,
        finalCompanyId,
      ]
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
 * - Solo el dueño puede subir/bajar roles de ADMIN_GLOBAL/SUPER_ADMIN
 * - ADMIN_GLOBAL y ADMIN pueden subir/bajar entre USER y ADMIN
 *   dentro de su empresa.
 */
router.put('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { run, name, email, plan, role, password, active, company_id } =
      req.body || {};

    const requesterRun = normalizeRun(req.user.run);
    const requesterRole = req.user.role;
    const isOwner = requesterRun === OWNER_RUN;

    const userRes = await db.query(
      'SELECT id, run, role, company_id FROM users WHERE id = $1',
      [id]
    );

    if (userRes.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const target = userRes.rows[0];
    const targetIsOwner = normalizeRun(target.run) === OWNER_RUN;

    // Nadie puede cambiar al dueño salvo él mismo
    if (targetIsOwner && !isOwner) {
      return res
        .status(403)
        .json({ message: 'No tienes permisos para modificar la cuenta principal' });
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
      values.push(email ? String(email).toLowerCase() : null);
    }
    if (plan) {
      fields.push(`plan = $${idx++}`);
      values.push(plan);
    }

    // Lógica de cambio de rol
    if (role && !(targetIsOwner && !isOwner)) {
      if (!ALLOWED_ROLES.includes(role)) {
        return res
          .status(400)
          .json({ message: 'Rol inválido' });
      }

      if (!isOwner) {
        // No OWNER
        if (role === 'SUPER_ADMIN' || role === 'ADMIN_GLOBAL') {
          // Nadie excepto el dueño puede tocar global/super
          return res
            .status(403)
            .json({ message: 'Solo el dueño puede asignar roles ADMIN_GLOBAL o SUPER_ADMIN' });
        }

        // ADMIN_GLOBAL o ADMIN pueden subir/bajar entre USER y ADMIN
        if (requesterRole === 'ADMIN' || requesterRole === 'ADMIN_GLOBAL') {
          // Deben estar en la misma empresa
          if (target.company_id !== req.user.company_id) {
            return res
              .status(403)
              .json({ message: 'No puedes cambiar el rol de usuarios de otra empresa' });
          }

          if (!['ADMIN', 'USER'].includes(role)) {
            return res
              .status(403)
              .json({ message: 'Solo puedes asignar roles USER o ADMIN en tu empresa' });
          }
        }
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
      // Solo el dueño puede mover usuarios entre empresas
      if (!isOwner) {
        return res
          .status(403)
          .json({ message: 'Solo el dueño puede cambiar la empresa de un usuario' });
      }
      fields.push(`company_id = $${idx++}`);
      values.push(company_id);
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
 * - Solo el dueño puede borrar otros admins (ADMIN, ADMIN_GLOBAL, SUPER_ADMIN)
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

    // 2) Solo el dueño puede borrar otros administradores/globales/super
    const isTargetAdmin =
      target.role === 'ADMIN' ||
      target.role === 'ADMIN_GLOBAL' ||
      target.role === 'SUPER_ADMIN';

    if (isTargetAdmin && !isOwner) {
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

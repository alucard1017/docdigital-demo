const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secreto-demo';

const normalizeRun = run => (run || '').replace(/[.\-]/g, '');

/**
 * POST /api/public/register
 * Registro público del primer admin de una cuenta
 */
router.post('/register', async (req, res, next) => {
  try {
    const { run, name, email, password, plan = 'basic' } = req.body;

    if (!run || !name || !email || !password) {
      return res.status(400).json({ message: 'RUN, nombre, email y contraseña son obligatorios' });
    }

    const normalizedRun = normalizeRun(run);

    // Verificar si ya existe usuario con ese RUN o email
    const existing = await db.query(
      'SELECT id FROM users WHERE run = $1 OR email = $2',
      [normalizedRun, email]
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({ message: 'Ya existe un usuario con ese RUN o email' });
    }

    const hash = bcrypt.hashSync(password, 10);

    const insert = await db.query(
      `INSERT INTO users (run, name, email, password_hash, plan, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, run, name, email, plan, role`,
      [normalizedRun, name, email, hash, plan, 'admin']
    );

    const user = insert.rows[0];

    const token = jwt.sign(
      {
        id: user.id,
        run: user.run,
        name: user.name,
        email: user.email,
        plan: user.plan,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(201).json({ token, user });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

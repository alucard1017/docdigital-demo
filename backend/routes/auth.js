const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'secreto-demo';

// Crear usuario demo si no existe
db.get(
  'SELECT * FROM users WHERE run = ?',
  ['00.000.000-0'],
  (err, row) => {
    if (err) {
      console.error('Error comprobando usuario demo:', err);
      return;
    }

    if (!row) {
      const hash = bcrypt.hashSync('kmzwa8awaa', 10);
      db.run(
        'INSERT INTO users (run, name, password_hash, plan) VALUES (?,?,?,?)',
        ['00.000.000-0', 'Admin Demo', hash, 'pro'],
        (insertErr) => {
          if (insertErr) {
            console.error('Error creando usuario demo:', insertErr);
          } else {
            console.log('✓ Usuario demo creado (run 00.000.000-0)');
          }
        }
      );
    }
  }
);

// Middleware de autenticación
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Sin token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, run, plan, name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { run, password } = req.body;

  db.get(
    'SELECT * FROM users WHERE run = ?',
    [run],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'DB error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const ok = bcrypt.compareSync(password, user.password_hash);
      if (!ok) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const token = jwt.sign(
        {
          id: user.id,
          run: user.run,
          plan: user.plan,
          name: user.name
        },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          run: user.run,
          name: user.name,
          plan: user.plan
        }
      });
    }
  );
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  // req.user viene del token
  res.json({
    id: req.user.id,
    run: req.user.run,
    name: req.user.name,
    plan: req.user.plan
  });
});

module.exports = router;
module.exports.requireAuth = requireAuth;

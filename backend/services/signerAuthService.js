// backend/services/signerAuthService.js
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'tu-super-secreto-change-in-production';
const JWT_EXPIRY = '7d';

function generateToken(signerId, signerEmail) {
  const token = jwt.sign(
    { signerId, email: signerEmail },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
  return token;
}

function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
}

function createSignerSession(signerId, signerEmail) {
  return new Promise((resolve, reject) => {
    const token = generateToken(signerId, signerEmail);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    db.run(
      'INSERT INTO signer_sessions (signer_id, token, expires_at) VALUES (?, ?, ?)',
      [signerId, token, expiresAt],
      function (err) {
        if (err) return reject(err);
        resolve(token);
      }
    );
  });
}

function getSessionByToken(token) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM signer_sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP',
      [token],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
}

module.exports = {
  generateToken,
  verifyToken,
  createSignerSession,
  getSessionByToken,
};

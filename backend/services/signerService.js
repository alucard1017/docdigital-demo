// services/signerService.js
const db = require('../db');

function addSigners(documentId, signers) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      'INSERT INTO signers (document_id, name, email, "order", status) VALUES (?, ?, ?, ?, ?)'
    );

    try {
      signers.forEach(s => {
        stmt.run(documentId, s.name, s.email, s.order, 'pending');
      });
      stmt.finalize(err => {
        if (err) return reject(err);
        resolve();
      });
    } catch (e) {
      stmt.finalize();
      reject(e);
    }
  });
}

function getSignersByDocument(documentId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM signers WHERE document_id = ? ORDER BY "order" ASC',
      [documentId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      }
    );
  });
}

function markSignerAsSigned(documentId, signerId) {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE signers SET status = ?, signed_at = CURRENT_TIMESTAMP WHERE id = ? AND document_id = ?',
      ['signed', signerId, documentId],
      function (err) {
        if (err) return reject(err);
        resolve(this.changes);
      }
    );
  });
}

function allSignersSigned(documentId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'signed' THEN 1 ELSE 0 END) as signed
       FROM signers WHERE document_id = ?`,
      [documentId],
      (err, row) => {
        if (err) return reject(err);
        if (!row || row.total === 0) return resolve(false);
        resolve(row.total === row.signed);
      }
    );
  });
}

module.exports = {
  addSigners,
  getSignersByDocument,
  markSignerAsSigned,
  allSignersSigned,
};

// backend/services/documentService.js
const db = require('../db');

function crearDocumento(data, callback) {
  const { owner_id, title, description, file_path } = data;
  db.run(
    `INSERT INTO documents (owner_id, title, description, file_path, status) 
     VALUES (?, ?, ?, ?, ?)`,
    [owner_id, title, description, file_path, 'draft'],
    function(err) {
      if (err) return callback(err);
      callback(null, { id: this.lastID, ...data, status: 'draft' });
    }
  );
}

function listarDocumentos(ownerId, callback) {
  db.all(
    'SELECT * FROM documents WHERE owner_id = ? ORDER BY created_at DESC',
    [ownerId],
    callback
  );
}

function obtenerDocumento(ownerId, docId, callback) {
  db.get(
    'SELECT * FROM documents WHERE id = ? AND owner_id = ?',
    [docId, ownerId],
    callback
  );
}

function actualizarEstadoDocumento(ownerId, docId, status, motivo, callback) {
  db.run(
    'UPDATE documents SET status = ? WHERE id = ? AND owner_id = ?',
    [status, docId, ownerId],
    function(err) {
      if (err) return callback(err);
      if (this.changes === 0) return callback(null, null);
      // Obtener el documento actualizado
      db.get(
        'SELECT * FROM documents WHERE id = ? AND owner_id = ?',
        [docId, ownerId],
        callback
      );
    }
  );
}

function actualizarEstadoDocumentoPorId(documentId, nuevoEstado, callback) {
  db.run(
    'UPDATE documents SET status = ? WHERE id = ?',
    [nuevoEstado, documentId],
    function(err) {
      if (err) return callback(err);
      callback(null, this.changes);
    }
  );
}

module.exports = {
  crearDocumento,
  listarDocumentos,
  obtenerDocumento,
  actualizarEstadoDocumento,
  actualizarEstadoDocumentoPorId,
};

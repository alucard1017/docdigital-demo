const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ruta al archivo de base de datos
const dbPath = path.join(__dirname, 'database.sqlite');

// Crear / conectar base de datos
const db = new sqlite3.Database(dbPath);

// Crear tablas
db.serialize(() => {
  // Tabla de usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      plan TEXT
    )
  `);

  // Tabla de documentos
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      file_path TEXT,
      creator_email TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de firmantes
  db.run(`
    CREATE TABLE IF NOT EXISTS signers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      "order" INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      signed_at TEXT,
      FOREIGN KEY (document_id) REFERENCES documents(id)
    )
  `);
});

// Exportar conexión
module.exports = db;

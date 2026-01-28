// db.js - conexión a PostgreSQL
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false
});

// Wrapper para usar pool.query en todo el proyecto
module.exports = {
  query: (text, params) => pool.query(text, params)
};

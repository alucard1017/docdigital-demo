// backend/scripts/clean.js
const db = require('../db');

async function clean() {
  try {
    console.log('Limpiando documentos...');
    const result = await db.query('DELETE FROM documents');
    console.log('Resultado:', result);
    
    const count = await db.query('SELECT COUNT(*) FROM documents');
    console.log('✅ Total restante:', count.rows[0].count);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error completo:', err);
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

clean();
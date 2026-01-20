// create-user.js
const db = require('./db');

const run = '12.345.678-9';
const name = '00.000.000-0';
const passwordHash = '$2b$10;r3A1Co.oyN1ymcs3CmYe.usvYs1NZ982xH9yvDCCYT.0DDKW35VbW';
const plan = 'signer'; // usamos 'plan' como rol

db.run(
  'INSERT INTO users (run, name, password_hash, plan) VALUES (?, ?, ?, ?)',
  [run, name, passwordHash, plan],
  function(err) {
    if (err) {
      console.error('Error al crear usuario:', err.message);
    } else {
      console.log('✓ Usuario creado con ID:', this.lastID);
      console.log('  RUN:', run);
      console.log('  Clave: kmzwa8awaa');
    }
    db.close();
  }
);
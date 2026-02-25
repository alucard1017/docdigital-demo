const bcrypt = require('bcryptjs');

const plain = 'kmzwa8awaa';
const hash = '$2a$10$uxaE5An4kOHGSjRXWmDXJe96rx9bRsdXerzITKGqvnSoMZH1pyHae';

const ok = bcrypt.compareSync(plain, hash);
console.log('¿Coinciden?', ok);

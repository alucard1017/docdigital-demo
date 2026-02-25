const bcrypt = require('bcryptjs');

const plain = 'kmzwa8awaa'; // tu clave normal
const hash = bcrypt.hashSync(plain, 10);

console.log('Password:', plain);
console.log('Hash:', hash);

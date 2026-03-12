// scripts/hash-passwords.js
const bcrypt = require("bcryptjs");

async function main() {
  const passwords = ["kmzwa8awaa", "Fernando5761", "Crhift4798"];

  for (const pwd of passwords) {
    const hash = await bcrypt.hash(pwd, 10);
    console.log(pwd, "=>", hash);
  }
}

main().catch(console.error);

const { sendReminderEmail } = require('./services/sendReminderEmails');

async function main() {
  const docFake = {
    id: 123,
    nombre: 'Documento de prueba',
    signer_email: 'TU_CORREO_DE_PRUEBA@correo.com',
  };

  const ok = await sendReminderEmail(docFake);
  console.log('Resultado:', ok);
}

main();

// backend/testEmail.js
const { sendReminderEmail } = require("./services/sendReminderEmails");

async function main() {
  const docFake = {
    id: 123,
    title: "Documento de prueba",
    signer_email: "TU_CORREO_DE_PRUEBA@correo.com",
    signer_name: "Firmante Demo",
    sign_token: "TOKEN_DE_PRUEBA_OPCIONAL",
    verification_code: "VF-TEST-000001",
    customMessage:
      "Hola, este es un recordatorio de prueba generado desde el script testEmail.js.",
  };

  const ok = await sendReminderEmail(docFake);
  console.log("Resultado envío recordatorio:", ok);
}

main().catch((err) => {
  console.error("Error en testEmail:", err);
  process.exit(1);
});
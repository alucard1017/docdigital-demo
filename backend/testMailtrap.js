const nodemailer = require('nodemailer');
require('dotenv').config();

async function main() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"Prueba" <${process.env.REMITENTE}>`,
      to: 'test@example.com',
      subject: 'Prueba Mailtrap',
      text: 'Hola desde Mailtrap',
    });
    console.log('OK, enviado:', info.messageId);
  } catch (err) {
    console.error('ERROR SMTP:', err);
  }
}

main();

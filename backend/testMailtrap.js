const nodemailer = require('nodemailer');
require('dotenv').config();

async function test() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 587,
    secure: false,
    auth: {
      user: 'api',                      // usuario fijo que muestra Mailtrap
      pass: process.env.SMTP_PASS,      // tu token
    },
  });

  try {
    const info = await transporter.sendMail({
      from: '"Prueba Local" <no-reply@demomailtrap.co>',
      to: 'chuquid2000@gmail.com',
      subject: 'Prueba Mailtrap desde local',
      text: 'Si lees esto, Mailtrap SMTP funciona desde tu PC.',
    });
    console.log('OK:', info.messageId);
  } catch (e) {
    console.error('ERROR LOCAL:', e);
  }
}

test();

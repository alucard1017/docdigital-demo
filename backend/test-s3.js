// test-s3.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET || 'verifirma-pdfs';

async function main() {
  try {
    const filePath = path.join(__dirname, 'test.pdf');
    if (!fs.existsSync(filePath)) {
      console.error('No existe backend/test.pdf. Crea un PDF de prueba con ese nombre.');
      process.exit(1);
    }

    const fileContent = fs.readFileSync(filePath);

    const key = `pruebas/${Date.now()}-test.pdf`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileContent,
      ContentType: 'application/pdf',
    });

    const result = await s3.send(command);
    console.log('✅ Subida OK. Key:', key);
    console.log('Resultado:', result);
  } catch (err) {
    console.error('❌ Error en test-s3:', err);
  }
}

main();

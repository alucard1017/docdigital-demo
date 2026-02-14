// backend/services/storageR2.js
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl: presign } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');

const R2_BUCKET = process.env.R2_BUCKET;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;

// Cliente S3 apuntando a R2
const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = R2_BUCKET;

/**
 * Subir un PDF desde disco a R2
 */
async function uploadPdfToS3(filePath, fileName) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archivo no encontrado: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath);

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
      Body: fileContent,
      ContentType: 'application/pdf',
    });

    await r2Client.send(command);
    console.log(`✅ PDF subido a R2: ${fileName}`);
    return fileName;
  } catch (error) {
    console.error('❌ Error al subir PDF a R2:', error.message || error);
    throw error;
  }
}

/**
 * Subir un Buffer genérico a R2 (ej: PNG del QR, PDFs generados, etc.)
 */
async function uploadBufferToS3(buffer, fileName, contentType = 'application/octet-stream') {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    });

    await r2Client.send(command);
    console.log(`✅ Buffer subido a R2: ${fileName}`);
    return fileName;
  } catch (error) {
    console.error('❌ Error al subir buffer a R2:', error.message || error);
    throw error;
  }
}

/**
 * Descargar un PDF de R2 a disco local
 */
async function downloadPdfFromS3(fileName, savePath) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
    });

    const result = await r2Client.send(command);

    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const chunks = [];
    for await (const chunk of result.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    fs.writeFileSync(savePath, buffer);
    console.log(`✅ PDF descargado desde R2: ${fileName}`);
    return savePath;
  } catch (error) {
    console.error('❌ Error al descargar PDF de R2:', error.message);
    throw error;
  }
}

/**
 * Obtener URL firmada temporal para ver/descargar
 */
async function getSignedUrl(fileName, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
    });

    const url = await presign(r2Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('❌ Error al generar URL firmada de R2:', error.message);
    throw error;
  }
}

/**
 * Obtener un objeto como Buffer (ej: para pdf-lib)
 */
async function getObjectBuffer(fileName) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
    });

    const response = await r2Client.send(command);
    const chunks = [];

    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error('❌ Error al obtener buffer desde R2:', error.message);
    throw error;
  }
}

module.exports = {
  uploadPdfToS3,
  uploadBufferToS3,
  downloadPdfFromS3,
  getSignedUrl,
  getObjectBuffer,
};

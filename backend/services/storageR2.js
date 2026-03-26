// backend/services/storageR2.js
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl: presign } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");
const path = require("path");

const R2_BUCKET = process.env.R2_BUCKET;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;

const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = R2_BUCKET;

/* ================================
   SUBIDA
   ================================ */

/**
 * Sube un PDF a R2 usando un Buffer en memoria.
 */
async function uploadPdfToS3(fileName, fileBuffer) {
  try {
    if (!fileName || typeof fileName !== "string") {
      throw new Error("fileName inválido en uploadPdfToS3");
    }
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      throw new Error("Buffer inválido en uploadPdfToS3");
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
      Body: fileBuffer,
      ContentType: "application/pdf",
    });

    await r2Client.send(command);
    console.log(`✅ [R2] PDF subido: ${fileName}`);
    return fileName;
  } catch (error) {
    console.error("❌ [R2] Error al subir PDF:", error.message || error);
    throw error;
  }
}

/**
 * Sube un Buffer genérico a R2 (ej: PNG del QR, PDFs generados, etc.).
 */
async function uploadBufferToS3(fileName, buffer, contentType = "application/octet-stream") {
  try {
    if (!fileName || typeof fileName !== "string") {
      throw new Error("fileName inválido en uploadBufferToS3");
    }
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error("Buffer inválido en uploadBufferToS3");
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    });

    await r2Client.send(command);
    console.log(`✅ [R2] Buffer subido: ${fileName}`);
    return fileName;
  } catch (error) {
    console.error("❌ [R2] Error al subir buffer:", error.message || error);
    throw error;
  }
}

/* ================================
   DESCARGA
   ================================ */

/**
 * Descarga un PDF de R2 y lo guarda en disco local (diagnóstico / batch).
 */
async function downloadPdfFromS3(fileName, savePath) {
  try {
    if (!fileName) throw new Error("fileName requerido en downloadPdfFromS3");
    if (!savePath) throw new Error("savePath requerido en downloadPdfFromS3");

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
    console.log(`✅ [R2] PDF descargado: ${fileName} -> ${savePath}`);
    return savePath;
  } catch (error) {
    console.error("❌ [R2] Error al descargar PDF:", error.message);
    throw error;
  }
}

/**
 * Obtiene un objeto de R2 como Buffer (útil para pdf-lib).
 */
async function getObjectBuffer(fileName) {
  try {
    if (!fileName) throw new Error("fileName requerido en getObjectBuffer");

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
    console.error("❌ [R2] Error al obtener buffer:", error.message);
    throw error;
  }
}

/* ================================
   URLS Y DELETE
   ================================ */

/**
 * Genera URL firmada temporal para ver/descargar.
 */
async function getSignedUrl(fileName, expiresIn = 3600) {
  try {
    if (!fileName) throw new Error("fileName requerido en getSignedUrl");

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
    });

    const url = await presign(r2Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error("❌ [R2] Error al generar URL firmada:", error.message);
    throw error;
  }
}

/**
 * Elimina un objeto del bucket.
 */
async function deleteObjectFromS3(fileName) {
  try {
    if (!fileName) throw new Error("fileName requerido en deleteObjectFromS3");

    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
    });

    await r2Client.send(command);
    console.log(`✅ [R2] Objeto eliminado: ${fileName}`);
    return true;
  } catch (error) {
    console.error("❌ [R2] Error al eliminar objeto:", error.message);
    throw error;
  }
}

module.exports = {
  uploadPdfToS3,
  uploadBufferToS3,
  downloadPdfFromS3,
  getSignedUrl,
  getObjectBuffer,
  deleteObjectFromS3,
};
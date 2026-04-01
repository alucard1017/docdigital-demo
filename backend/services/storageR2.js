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

if (!R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
  console.warn("⚠️ Config R2 incompleta, revisa variables de entorno.");
}

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
   HELPERS INTERNOS
   ================================ */

function ensureBuffer(input) {
  if (!input) return null;
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  throw new Error("Buffer inválido");
}

function normalizeStorageKey(key) {
  if (!key || typeof key !== "string") return null;

  const normalized = key
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\//, "")
    .replace(/[<>:"|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-");

  return normalized || null;
}

function validateKeyOrThrow(key, fnName) {
  if (!key || typeof key !== "string") {
    throw new Error(`fileName inválido en ${fnName}`);
  }
}

async function streamToBuffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/* ================================
   SUBIDA
   ================================ */

async function uploadPdfToS3(
  fileBuffer,
  fileName,
  contentType = "application/pdf"
) {
  try {
    const key = normalizeStorageKey(fileName);
    validateKeyOrThrow(key, "uploadPdfToS3");

    const buffer = ensureBuffer(fileBuffer);
    if (!buffer) {
      throw new Error("Buffer inválido en uploadPdfToS3");
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await r2Client.send(command);
    console.log(`✅ [R2] PDF subido: ${key}`);

    return {
      key,
      url: null,
    };
  } catch (error) {
    console.error("❌ [R2] Error al subir PDF:", error.message || error);
    throw error;
  }
}

async function uploadBufferToS3(
  fileName,
  buffer,
  contentType = "application/octet-stream"
) {
  try {
    const key = normalizeStorageKey(fileName);
    validateKeyOrThrow(key, "uploadBufferToS3");

    const finalBuffer = ensureBuffer(buffer);
    if (!finalBuffer) {
      throw new Error("Buffer inválido en uploadBufferToS3");
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: finalBuffer,
      ContentType: contentType,
    });

    await r2Client.send(command);
    console.log(`✅ [R2] Buffer subido: ${key}`);

    return {
      key,
      url: null,
    };
  } catch (error) {
    console.error("❌ [R2] Error al subir buffer:", error.message || error);
    throw error;
  }
}

/* ================================
   DESCARGA
   ================================ */

async function downloadPdfFromS3(fileName, savePath) {
  try {
    const key = normalizeStorageKey(fileName);
    validateKeyOrThrow(key, "downloadPdfFromS3");

    if (!savePath) {
      throw new Error("savePath requerido en downloadPdfFromS3");
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    const result = await r2Client.send(command);

    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const buffer = await streamToBuffer(result.Body);
    fs.writeFileSync(savePath, buffer);

    console.log(`✅ [R2] PDF descargado: ${key} -> ${savePath}`);
    return savePath;
  } catch (error) {
    console.error("❌ [R2] Error al descargar PDF:", error.message || error);
    throw error;
  }
}

async function getObjectBuffer(fileName) {
  try {
    const key = normalizeStorageKey(fileName);
    validateKeyOrThrow(key, "getObjectBuffer");

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    const response = await r2Client.send(command);
    return await streamToBuffer(response.Body);
  } catch (error) {
    console.error("❌ [R2] Error al obtener buffer:", error.message || error);
    throw error;
  }
}

/* ================================
   URLS Y DELETE
   ================================ */

async function getSignedUrl(fileName, expiresIn = 3600) {
  try {
    const key = normalizeStorageKey(fileName);
    validateKeyOrThrow(key, "getSignedUrl");

    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    return await presign(r2Client, command, { expiresIn });
  } catch (error) {
    console.error(
      "❌ [R2] Error al generar URL firmada:",
      error.message || error
    );
    throw error;
  }
}

async function deleteObjectFromS3(fileName) {
  try {
    const key = normalizeStorageKey(fileName);
    validateKeyOrThrow(key, "deleteObjectFromS3");

    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });

    await r2Client.send(command);
    console.log(`✅ [R2] Objeto eliminado: ${key}`);
    return true;
  } catch (error) {
    console.error("❌ [R2] Error al eliminar objeto:", error.message || error);
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
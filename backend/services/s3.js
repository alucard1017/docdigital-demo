const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl: presign } = require("@aws-sdk/s3-request-presigner");
const fs = require("fs");
const path = require("path");

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET || "firma-express-pdfs";

/**
 * Subir un PDF a S3
 * @param {string} filePath - Ruta local del archivo
 * @param {string} fileName - Clave en S3 (ej: documentos/userId/archivo.pdf)
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
      ContentType: "application/pdf",
    });

    await s3Client.send(command);
    console.log(`✅ PDF subido a S3: ${fileName}`);
    return fileName;
  } catch (error) {
    console.error("❌ Error al subir PDF a S3 COMPLETO:", error);
    throw error;
  }
}

/**
 * Descargar un PDF de S3 a disco local
 */
async function downloadPdfFromS3(fileName, savePath) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
    });

    const result = await s3Client.send(command);

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
    console.log(`✅ PDF descargado desde S3: ${fileName}`);
    return savePath;
  } catch (error) {
    console.error("❌ Error al descargar PDF de S3:", error.message);
    throw error;
  }
}

/**
 * Eliminar un PDF de S3
 */
async function deletePdfFromS3(fileName) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
    });

    await s3Client.send(command);
    console.log(`✅ PDF eliminado de S3: ${fileName}`);
    return true;
  } catch (error) {
    console.error("❌ Error al eliminar PDF de S3:", error.message);
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

    const url = await presign(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error("❌ Error al generar URL firmada de S3:", error.message);
    throw error;
  }
}

module.exports = {
  uploadPdfToS3,
  downloadPdfFromS3,
  deletePdfFromS3,
  getSignedUrl,
};

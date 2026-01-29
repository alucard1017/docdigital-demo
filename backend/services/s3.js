const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configurar AWS S3
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-2'
});

const s3 = new AWS.S3();
const BUCKET = process.env.AWS_S3_BUCKET || 'firma-express-pdfs';

/**
 * Subir un PDF a S3
 * @param {string} filePath - Ruta local del archivo
 * @param {string} fileName - Nombre del archivo en S3
 * @returns {string} URL del archivo en S3
 */
async function uploadPdfToS3(filePath, fileName) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archivo no encontrado: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath);
    
    const params = {
      Bucket: BUCKET,
      Key: fileName,
      Body: fileContent,
      ContentType: 'application/pdf',
      ACL: 'private'
    };

    const result = await s3.upload(params).promise();
    
    console.log(`✅ PDF subido: ${fileName}`);
    return result.Location;
  } catch (error) {
    console.error('❌ Error al subir PDF a S3:', error.message);
    throw error;
  }
}

/**
 * Descargar un PDF de S3
 */
async function downloadPdfFromS3(fileName, savePath) {
  try {
    const params = {
      Bucket: BUCKET,
      Key: fileName
    };

    const result = await s3.getObject(params).promise();
    
    const dir = path.dirname(savePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(savePath, result.Body);
    console.log(`✅ PDF descargado: ${fileName}`);
    
    return savePath;
  } catch (error) {
    console.error('❌ Error al descargar PDF de S3:', error.message);
    throw error;
  }
}

/**
 * Eliminar un PDF de S3
 */
async function deletePdfFromS3(fileName) {
  try {
    const params = {
      Bucket: BUCKET,
      Key: fileName
    };

    await s3.deleteObject(params).promise();
    console.log(`✅ PDF eliminado: ${fileName}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error al eliminar PDF de S3:', error.message);
    throw error;
  }
}

/**
 * Obtener URL firmada (temporal) para descargar desde S3
 */
function getSignedUrl(fileName, expiresIn = 3600) {
  try {
    const params = {
      Bucket: BUCKET,
      Key: fileName,
      Expires: expiresIn
    };

    const url = s3.getSignedUrl('getObject', params);
    return url;
  } catch (error) {
    console.error('❌ Error al generar URL firmada:', error.message);
    throw error;
  }
}

module.exports = {
  uploadPdfToS3,
  downloadPdfFromS3,
  deletePdfFromS3,
  getSignedUrl
};

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configurar las credenciales de AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-2'
});

const s3 = new AWS.S3();

// Función para subir un PDF a S3
async function uploadPdfToS3(filePath, fileName) {
  try {
    const fileContent = fs.readFileSync(filePath);
    
    const params = {
      Bucket: 'firma-express-pdfs',
      Key: fileName, // Ruta del archivo en S3 ej: "documentos/2024/firma.pdf"
      Body: fileContent,
      ContentType: 'application/pdf'
    };

    const result = await s3.upload(params).promise();
    
    console.log('Archivo subido exitosamente a S3:');
    console.log('URL:', result.Location);
    
    return result.Location;
  } catch (error) {
    console.error('Error al subir archivo a S3:', error);
    throw error;
  }
}

// Función para descargar un PDF de S3
async function downloadPdfFromS3(fileName, savePath) {
  try {
    const params = {
      Bucket: 'firma-express-pdfs',
      Key: fileName
    };

    const result = await s3.getObject(params).promise();
    
    fs.writeFileSync(savePath, result.Body);
    console.log('Archivo descargado exitosamente desde S3');
    
    return savePath;
  } catch (error) {
    console.error('Error al descargar archivo de S3:', error);
    throw error;
  }
}

// Función para eliminar un PDF de S3
async function deletePdfFromS3(fileName) {
  try {
    const params = {
      Bucket: 'firma-express-pdfs',
      Key: fileName
    };

    await s3.deleteObject(params).promise();
    console.log('Archivo eliminado exitosamente de S3');
    
    return true;
  } catch (error) {
    console.error('Error al eliminar archivo de S3:', error);
    throw error;
  }
}

module.exports = {
  uploadPdfToS3,
  downloadPdfFromS3,
  deletePdfFromS3
};

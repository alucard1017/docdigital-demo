// backend/controllers/documents/common.js
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');
const db = require('../../db');
const {
  sendSigningInvitation,
  sendVisadoInvitation,
} = require('../../services/emailService');
const { uploadPdfToS3, getSignedUrl } = require('../../services/s3');
const { isValidEmail, isValidRun, validateLength } = require('../../utils/validators');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const { sellarPdfConQr } = require('../../services/pdfSeal');
const { generarNumeroContratoInterno } = require('../../utils/numeroContratoInterno');
const { registrarAuditoria } = require('../../utils/auditLog');

function generarCodigoVerificacion() {
  return crypto
    .randomBytes(6)
    .toString('base64')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 10)
    .toUpperCase();
}

async function aplicarMarcaAguaLocal(filePath) {
  try {
    const bytes = await fs.promises.readFile(filePath);
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();

    const textoPrincipal = 'VERIFIRMA';
    const textoSecundario = 'Documento en proceso – No válido como original';
    const fontSizeMain = 30;
    const fontSizeSub = 11;
    const opacity = 0.36;
    const angle = 33;
    const xStep = 260;
    const yStep = 220;
    const color = rgb(0.6, 0.6, 0.6);

    for (const page of pages) {
      const { width, height } = page.getSize();

      for (let x = -width * 0.25; x < width * 1.25; x += xStep) {
        for (let y = -height * 0.25; y < height * 1.25; y += yStep) {
          page.drawText(textoPrincipal, {
            x,
            y,
            size: fontSizeMain,
            color,
            rotate: degrees(angle),
            opacity,
          });

          page.drawText(textoSecundario, {
            x,
            y: y - 20,
            size: fontSizeSub,
            color,
            rotate: degrees(angle),
            opacity,
          });
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    await fs.promises.writeFile(filePath, pdfBytes);
    console.log('✅ Marca de agua VERIFIRMA aplicada a', filePath);
  } catch (err) {
    console.error('⚠️ Error aplicando marca de agua:', err);
  }
}

module.exports = {
  path,
  crypto,
  fs,
  axios,
  db,
  sendSigningInvitation,
  sendVisadoInvitation,
  uploadPdfToS3,
  getSignedUrl,
  isValidEmail,
  isValidRun,
  validateLength,
  PDFDocument,
  rgb,
  degrees,
  sellarPdfConQr,
  generarNumeroContratoInterno,
  registrarAuditoria,
  generarCodigoVerificacion,
  aplicarMarcaAguaLocal,
};

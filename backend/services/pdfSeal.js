// backend/services/pdfSeal.js
const QRCode = require('qrcode');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { getObjectBuffer, uploadBuffer } = require('./storageR2');

/**
 * Sella un PDF existente en R2/S3 añadiendo:
 * - Bloque legal con ID y código de verificación
 * - QR a la URL pública de verificación
 *
 * @param {Object} params
 * @param {string} params.s3Key              Clave del PDF original en R2/S3
 * @param {string} params.documentoId        UUID de la tabla `documentos`
 * @param {string} params.codigoVerificacion Código público de verificación
 * @param {string} params.categoriaFirma     'SIMPLE' | 'AVANZADA'
 * @returns {Promise<string>} newKey         Nueva clave del PDF sellado
 */
async function sellarPdfConQr({
  s3Key,
  documentoId,
  codigoVerificacion,
  categoriaFirma,
}) {
  if (!s3Key) {
    throw new Error('s3Key es obligatorio para sellar el PDF');
  }
  if (!documentoId) {
    throw new Error('documentoId es obligatorio para sellar el PDF');
  }
  if (!codigoVerificacion) {
    throw new Error('codigoVerificacion es obligatorio para sellar el PDF');
  }

  // 1) Descargar PDF original como buffer
  const pdfBytes = await getObjectBuffer(s3Key);

  // 2) Cargar PDF
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  if (!pages || pages.length === 0) {
    throw new Error('El PDF no tiene páginas');
  }

  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage.getSize();

  // 3) Generar QR con la URL pública de verificación (dominio real)
  const urlVerificacion = `https://verifirma.cl/verificar/${codigoVerificacion}`;

  const qrDataUrl = await QRCode.toDataURL(urlVerificacion, {
    errorCorrectionLevel: 'M',
  });
  const qrImage = await pdfDoc.embedPng(qrDataUrl);
  const qrSize = 80;

  lastPage.drawImage(qrImage, {
    x: width - qrSize - 40,
    y: 40,
    width: qrSize,
    height: qrSize,
  });

  // 4) Bloque de texto legal en el pie
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const textoLegal = [
    `Documento ID: ${documentoId}`,
    `Código de verificación: ${codigoVerificacion}`,
    `Verificación en: ${urlVerificacion}`,
    categoriaFirma === 'AVANZADA'
      ? 'Este documento ha sido firmado mediante Firma Electrónica Avanzada conforme a la Ley N° 19.799.'
      : 'Este documento ha sido firmado mediante Firma Electrónica Simple conforme a la Ley N° 19.799.',
  ].join('\n');

  lastPage.drawText(textoLegal, {
    x: 40,
    y: 60,
    size: 9,
    font,
    color: rgb(0, 0, 0),
    lineHeight: 11,
  });

  // 5) Guardar y subir nueva versión a R2/S3
  const newPdfBytes = await pdfDoc.save();
  const newKey = s3Key.endsWith('.pdf')
    ? s3Key.replace(/\.pdf$/i, '_sellado.pdf')
    : `${s3Key}_sellado.pdf`;

  await uploadBuffer(newKey, newPdfBytes, 'application/pdf');

  return newKey;
}

module.exports = {
  sellarPdfConQr,
};

// backend/services/pdfSeal.js
const QRCode = require('qrcode');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { getObjectBuffer, uploadBuffer } = require('./s3PdfHelpers');

/**
 * Sella un PDF existente agregando:
 * - Bloque de texto legal con ID y código de verificación
 * - QR que apunta a la URL de verificación pública
 *
 * @param {Object} params
 * @param {string} params.s3Key            Clave del PDF original en S3
 * @param {string} params.documentoId      UUID de la tabla documentos
 * @param {string} params.codigoVerificacion
 * @param {string} params.categoriaFirma   'SIMPLE' | 'AVANZADA'
 * @returns {Promise<string>} newKey       Nueva clave del PDF sellado en S3
 */
async function sellarPdfConQr({
  s3Key,
  documentoId,
  codigoVerificacion,
  categoriaFirma,
}) {
  // 1) Descargar PDF original desde S3 (buffer)
  const pdfBytes = await getObjectBuffer(s3Key);

  // 2) Cargar PDF
  const pdfDoc = await PDFDocument.load(pdfBytes);

  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage.getSize();

  // 3) Generar QR como data URL
  const urlVerificacion = `https://tu-frontend.com/verificar/${codigoVerificacion}`;
  const qrDataUrl = await QRCode.toDataURL(urlVerificacion, {
    errorCorrectionLevel: 'M',
  });

  // 4) Insertar QR
  const qrImage = await pdfDoc.embedPng(qrDataUrl);
  const qrSize = 80;

  lastPage.drawImage(qrImage, {
    x: width - qrSize - 40,
    y: 40,
    width: qrSize,
    height: qrSize,
  });

  // 5) Bloque de texto legal
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const textoLegal = [
    `Documento ID: ${documentoId}`,
    `Código de verificación: ${codigoVerificacion}`,
    `Verificación en: https://tu-frontend.com/verificar`,
    categoriaFirma === 'AVANZADA'
      ? 'Este documento ha sido firmado mediante Firma Electrónica Avanzada conforme a la Ley N° 19.799 sobre Documentos Electrónicos y Firma Electrónica.'
      : 'Este documento ha sido firmado mediante Firma Electrónica Simple conforme a la Ley N° 19.799 sobre Documentos Electrónicos y Firma Electrónica.',
  ].join('\n');

  lastPage.drawText(textoLegal, {
    x: 40,
    y: 60,
    size: 9,
    font,
    color: rgb(0, 0, 0),
    lineHeight: 11,
  });

  // 6) Guardar y subir nueva versión
  const newPdfBytes = await pdfDoc.save();
  const newKey = s3Key.replace('.pdf', '_sellado.pdf');

  await uploadBuffer(newKey, newPdfBytes, 'application/pdf');

  return newKey;
}

module.exports = {
  sellarPdfConQr,
};

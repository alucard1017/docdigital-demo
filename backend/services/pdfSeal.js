// backend/services/pdfSeal.js
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const bwipjs = require('@bwip-js/node');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');
const { getObjectBuffer, uploadBuffer } = require('./storageR2');

/**
 * s3Key: clave del PDF original en R2/S3
 * documentoId: ID interno del documento (tabla documentos)
 * codigoVerificacion: código corto para verificación pública
 * categoriaFirma: 'AVANZADA' | 'SIMPLE'
 * numeroContratoInterno: código corto tipo VF-2026-000123 (ya generado afuera)
 */
async function sellarPdfConQr({
  s3Key,
  documentoId,
  codigoVerificacion,
  categoriaFirma,
  numeroContratoInterno,
}) {
  if (!s3Key) throw new Error('s3Key es obligatorio para sellar el PDF');
  if (!documentoId) throw new Error('documentoId es obligatorio para sellar el PDF');
  if (!codigoVerificacion) {
    throw new Error('codigoVerificacion es obligatorio para sellar el PDF');
  }

  // DEBUG: verifica que está llegando el número interno
  console.log('DEBUG SELLO >> numeroContratoInterno recibido:', numeroContratoInterno);
console.log('DEBUG SELLO >> numeroInternoTexto pintado:', numeroInternoTexto);

  // 1) Descargar y cargar PDF base
  const pdfBytes = await getObjectBuffer(s3Key);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  if (!pages || pages.length === 0) throw new Error('El PDF no tiene páginas');

  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage.getSize();

  // Fuente base
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // 2) Logo VeriFirma arriba a la derecha
  const logoPngBytes = await fs.promises.readFile(
    path.join(__dirname, '../assets/verifirma-logo.png')
  );
  const logoImage = await pdfDoc.embedPng(logoPngBytes);
  const logoWidth = 90;
  const logoHeight = (logoImage.height / logoImage.width) * logoWidth;

  const logoX = width - logoWidth - 15;
  const logoY = height - logoHeight - 40;

  lastPage.drawImage(logoImage, {
    x: logoX,
    y: logoY,
    width: logoWidth,
    height: logoHeight,
  });

  // Número interno de contrato bajo el logo (no el UUID)
  const numeroInternoTexto = numeroContratoInterno || 'N° interno: —';
  console.log('DEBUG SELLO >> numeroInternoTexto pintado:', numeroInternoTexto);

  lastPage.drawText(numeroInternoTexto, {
    x: logoX,
    y: logoY - 16,
    size: 9,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  // 3) QR con URL pública de verificación
  const urlVerificacion = `https://verifirma.cl/verificar/${codigoVerificacion}`;

  const qrDataUrl = await QRCode.toDataURL(urlVerificacion, {
    errorCorrectionLevel: 'M',
  });
  const qrImage = await pdfDoc.embedPng(qrDataUrl);
  const qrSize = 80;

  const qrX = width - qrSize - 40;
  const qrY = 40;

  lastPage.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  // Microtexto bajo el QR (2 líneas)
  const textoBajoQr = [
    'Verifique este documento escaneando el código QR',
    'o visitando verifirma.cl',
  ].join('\n');
  const textoBajoQrSize = 7;

  lastPage.drawText(textoBajoQr, {
    x: qrX,
    y: qrY - 18,
    size: textoBajoQrSize,
    font,
    color: rgb(0.25, 0.25, 0.25),
    lineHeight: 9,
  });

  // 3.1) Lateral derecho: código de barras vertical + branding girado
  let barcodePng;
  try {
    const barcodePngBuffer = await bwipjs.toBuffer({
      bcid: 'code128',
      text: codigoVerificacion,
      scale: 1.1,
      height: 12,
      includetext: false,
      textxalign: 'center',
      rotate: 'R',
    });
    barcodePng = await pdfDoc.embedPng(barcodePngBuffer);
  } catch (err) {
    console.error('⚠️ Error generando código de barras:', err);
    barcodePng = null;
  }

  if (barcodePng) {
    const barcodeWidth = 35;
    const barcodeHeight = (barcodePng.height / barcodePng.width) * barcodeWidth;

    const marginRight = 15;
    const barcodeX = width - barcodeWidth - marginRight;
    const barcodeY = height / 2 - barcodeHeight / 2;

    lastPage.drawImage(barcodePng, {
      x: barcodeX,
      y: barcodeY,
      width: barcodeWidth,
      height: barcodeHeight,
    });

    const textoLateral = [
      'VeriFirma · Plataforma de firma electrónica',
      'Seguridad digital sin fronteras',
      'verifirma.cl',
    ].join('  ·  ');

    const lateralSize = 7;

    lastPage.drawText(textoLateral, {
      x: width - 5,
      y: barcodeY + barcodeHeight / 2 - lateralSize,
      size: lateralSize,
      font,
      color: rgb(0.2, 0.2, 0.2),
      rotate: degrees(90),
      maxWidth: height - 80,
      lineHeight: lateralSize + 2,
    });
  }

  // Línea divisoria suave sobre el bloque legal
  lastPage.drawLine({
    start: { x: 40, y: 75 },
    end: { x: width - 40, y: 75 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });

  // 4) Bloque de texto legal en el pie
  const esAvanzada = categoriaFirma === 'AVANZADA';

  const textoLegal = [
    'Certificado de firma electrónica',
    '',
    `Documento ID (sistema): ${documentoId}`,
    `Código de verificación: ${codigoVerificacion}`,
    `Verificación en línea: ${urlVerificacion}`,
    '',
    esAvanzada
      ? 'Este documento ha sido firmado mediante Firma Electrónica Avanzada conforme a la Ley N° 19.799 y su normativa complementaria.'
      : 'Este documento ha sido firmado mediante Firma Electrónica Simple conforme a la Ley N° 19.799 y su normativa complementaria.',
    'La validez del presente documento puede ser verificada en el sitio indicado utilizando el código de verificación.',
    'Proveedor de servicios de firma: VeriFirma SpA – RUT 77.777.777-7.',
    'Zona horaria de referencia: Chile/Continental.',
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

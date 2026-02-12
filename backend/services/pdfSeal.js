// backend/services/pdfSeal.js
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const bwipjs = require('@bwip-js/node');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { getObjectBuffer, uploadBuffer } = require('./storageR2');

async function sellarPdfConQr({
  s3Key,
  documentoId,
  codigoVerificacion,
  categoriaFirma,
}) {
  if (!s3Key) throw new Error('s3Key es obligatorio para sellar el PDF');
  if (!documentoId) throw new Error('documentoId es obligatorio para sellar el PDF');
  if (!codigoVerificacion) {
    throw new Error('codigoVerificacion es obligatorio para sellar el PDF');
  }

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

  const logoX = width - logoWidth - 40;
  const logoY = height - logoHeight - 40;

  lastPage.drawImage(logoImage, {
    x: logoX,
    y: logoY,
    width: logoWidth,
    height: logoHeight,
  });

  // ID de contrato debajo del logo
  lastPage.drawText(`Contrato ID: ${documentoId}`, {
    x: logoX,
    y: logoY - 15,
    size: 9,
    font,
    color: rgb(0, 0, 0),
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

  // 3.1) Código de barras lateral derecho (vertical, pequeño) + eslogan
  let barcodePng;
  try {
    const barcodePngBuffer = await bwipjs.toBuffer({
      bcid: 'code128',
      text: codigoVerificacion,
      scale: 1.2,      // más pequeño
      height: 6,       // barras más cortas
      includetext: false,
      textxalign: 'center',
      rotate: 'R',     // 90° derecha → vertical
    });
    barcodePng = await pdfDoc.embedPng(barcodePngBuffer);
  } catch (err) {
    console.error('⚠️ Error generando código de barras:', err);
    barcodePng = null;
  }

  if (barcodePng) {
    const barcodeWidth = 60;
    const barcodeHeight = (barcodePng.height / barcodePng.width) * barcodeWidth;

    const marginRight = 30;
    const barcodeX = width - barcodeWidth - marginRight;
    const barcodeY = height / 2 - barcodeHeight / 2 + 40;

    // Código de barras
    lastPage.drawImage(barcodePng, {
      x: barcodeX,
      y: barcodeY,
      width: barcodeWidth,
      height: barcodeHeight,
    });

    // Eslogan alineado al centro del código de barras
    const eslogan = 'Seguridad digital sin fronteras';
    const esloganSize = 8;
    const esloganWidth = font.widthOfTextAtSize(eslogan, esloganSize);

    lastPage.drawText(eslogan, {
      x: barcodeX - 5 - esloganWidth,
      y: barcodeY + barcodeHeight / 2 - esloganSize / 2,
      size: esloganSize,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

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

// backend/services/pdfSigner.js
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const axios = require('axios');
const { uploadPdfToS3, getSignedUrl } = require('./s3');

async function createSignedCopyFromS3({ originalPath, doc, signerName }) {
  const url = await getSignedUrl(originalPath, 3600);
  const res = await axios.get(url, { responseType: 'arraybuffer' });
  const existingPdfBytes = res.data;

  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const page = pdfDoc.addPage();
  const { height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const now = new Date();

  page.drawText('Documento firmado electrónicamente', {
    x: 50,
    y: height - 80,
    size: 18,
    font,
    color: rgb(0, 0.2, 0.6),
  });

  page.drawText(`Firmante: ${signerName || doc.firmante_nombre}`, {
    x: 50,
    y: height - 120,
    size: 12,
    font,
  });

  page.drawText(
    `Fecha y hora: ${now.toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`,
    {
      x: 50,
      y: height - 140,
      size: 12,
      font,
    }
  );

  const verificationCode = doc.signature_token; // o genera otro
  page.drawText(`Código de verificación: ${verificationCode}`, {
    x: 50,
    y: height - 160,
    size: 12,
    font,
  });

  const pdfBytes = await pdfDoc.save();

  const signedKey = `documentos-firmados/${doc.owner_id}/${doc.id}-firmado.pdf`;
  await uploadPdfToS3(Buffer.from(pdfBytes), signedKey);

  return signedKey;
}

module.exports = { createSignedCopyFromS3 };

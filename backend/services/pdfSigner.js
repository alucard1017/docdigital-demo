// backend/services/pdfSigner.js
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const {
  getObjectBuffer,
  uploadBufferToS3,
} = require("./storageR2");

/**
 * Genera una copia informativa firmada SIN QR ni certificado oficial.
 *
 * IMPORTANTE:
 * - NO actualiza pdf_final_url
 * - NO actualiza final_storage_key
 * - NO reemplaza el flujo oficial de sellado con QR (pdfSeal.js)
 */
async function createSignedCopyFromS3({ originalPath, doc, signerName }) {
  if (!originalPath) {
    throw new Error("originalPath es obligatorio para createSignedCopyFromS3");
  }

  if (!doc?.id) {
    throw new Error("doc.id es obligatorio para createSignedCopyFromS3");
  }

  const existingPdfBytes = await getObjectBuffer(originalPath);

  const pdfDoc = await PDFDocument.load(existingPdfBytes, {
    updateMetadata: false,
  });

  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const now = new Date().toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  });

  const effectiveSignerName =
    signerName || doc.firmante_nombre || doc.owner_name || "N/A";

  page.drawText("Documento firmado electrónicamente", {
    x: 50,
    y: height - 80,
    size: 18,
    font: fontBold,
    color: rgb(0, 0.2, 0.6),
  });

  page.drawText(`Firmante: ${effectiveSignerName}`, {
    x: 50,
    y: height - 120,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText(`Fecha y hora: ${now}`, {
    x: 50,
    y: height - 140,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  page.drawText(
    `Documento ID: ${doc.id} · Verificación: ${doc.signature_token || "N/A"}`,
    {
      x: 50,
      y: height - 160,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: width - 100,
    }
  );

  page.drawText(
    "Esta copia es informativa y no reemplaza el PDF final sellado con QR.",
    {
      x: 50,
      y: height - 200,
      size: 10,
      font,
      color: rgb(0.45, 0.1, 0.1),
      maxWidth: width - 100,
      lineHeight: 14,
    }
  );

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);

  const signedKey = `documents/${doc.id}/signed-copy-${Date.now()}.pdf`;

  await uploadBufferToS3(signedKey, buffer, "application/pdf");

  return {
    signedKey,
  };
}

module.exports = {
  createSignedCopyFromS3,
};

// backend/services/pdfPreview.js
const { PDFDocument, StandardFonts, rgb, degrees } = require("pdf-lib");
const {
  getOriginalSourceKey,
  getPdfBufferFromKey,
  uploadPdfBufferForDocument,
  normalizeDocumentStatus,
} = require("./s3PdfHelpers");

function resolveWatermarkText(docRow) {
  const status = normalizeDocumentStatus(docRow?.status || docRow?.estado);

  if (status === "PENDIENTE_VISADO" || status === "PENDING_REVIEW") {
    return "DOCUMENTO EN PROCESO DE VISADO";
  }

  if (status === "RECHAZADO" || status === "REJECTED") {
    return "DOCUMENTO RECHAZADO";
  }

  return "DOCUMENTO EN PROCESO DE FIRMA";
}

function drawPageWatermark(page, text, font) {
  const { width, height } = page.getSize();

  const baseSize = Math.max(32, Math.min(width, height) * 0.06);
  const largeSize = baseSize;
  const smallSize = Math.max(18, baseSize * 0.55);

  const centerX = width / 2;
  const centerY = height / 2;

  const largeTextWidth = font.widthOfTextAtSize(text, largeSize);
  const smallTextWidth = font.widthOfTextAtSize(text, smallSize);

  page.drawText(text, {
    x: centerX - largeTextWidth / 2,
    y: centerY - largeSize / 2,
    size: largeSize,
    font,
    color: rgb(0.72, 0.72, 0.72),
    rotate: degrees(35),
    opacity: 0.14,
  });

  page.drawText(text, {
    x: Math.max(24, width * 0.12 - smallTextWidth / 2),
    y: Math.max(80, height * 0.2),
    size: smallSize,
    font,
    color: rgb(0.82, 0.82, 0.82),
    rotate: degrees(35),
    opacity: 0.1,
  });

  page.drawText(text, {
    x: Math.max(24, width * 0.62 - smallTextWidth / 2),
    y: Math.max(50, height * 0.68),
    size: smallSize,
    font,
    color: rgb(0.82, 0.82, 0.82),
    rotate: degrees(35),
    opacity: 0.1,
  });
}

function drawPreviewFooter(page, font, docRow, pageIndex, totalPages) {
  const { width } = page.getSize();
  const footerText = [
    "Vista previa de documento",
    docRow?.title || docRow?.titulo || null,
    `Página ${pageIndex + 1} de ${totalPages}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const size = 8;
  const textWidth = font.widthOfTextAtSize(footerText, size);

  page.drawText(footerText, {
    x: Math.max(20, (width - textWidth) / 2),
    y: 18,
    size,
    font,
    color: rgb(0.45, 0.45, 0.45),
    opacity: 0.95,
  });
}

/**
 * Genera un PDF de PREVIEW con marca de agua a partir del original limpio.
 *
 * - NO toca el PDF final ni lo sella.
 * - Solo genera un PDF visualmente marcado para usar en el flujo de firma/visado.
 *
 * @param {object} docRow Fila de documents.* o estructura compatible
 * @param {object} options
 * @param {string} [options.watermarkText]
 * @param {string} [options.prefix]
 * @returns {Promise<{ previewKey: string, previewHash: string, sourceKey: string }>}
 */
async function generarPdfPreviewConMarcaDeAgua(docRow, options = {}) {
  if (!docRow || !docRow.id) {
    throw new Error("docRow.id es obligatorio en generarPdfPreviewConMarcaDeAgua");
  }

  const documentoId = docRow.id;
  const sourceKey = getOriginalSourceKey(docRow);

  if (!sourceKey) {
    throw new Error(
      `No se encontró archivo original para documento ${documentoId}`
    );
  }

  const originalBytes = await getPdfBufferFromKey(sourceKey);

  const pdfDoc = await PDFDocument.load(originalBytes, {
    updateMetadata: false,
  });

  const pages = pdfDoc.getPages();
  if (!pages || pages.length === 0) {
    throw new Error(
      `El PDF original del documento ${documentoId} no tiene páginas`
    );
  }

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const watermarkText =
    String(options.watermarkText || "").trim() || resolveWatermarkText(docRow);

  pages.forEach((page, index) => {
    drawPageWatermark(page, watermarkText, fontBold);
    drawPreviewFooter(page, fontRegular, docRow, index, pages.length);
  });

  const previewBytes = await pdfDoc.save();
  const previewBuffer = Buffer.from(previewBytes);

  const { key: previewKey, hashSha256: previewHash } =
    await uploadPdfBufferForDocument({
      buffer: previewBuffer,
      documentoId,
      prefix: options.prefix || "preview",
    });

  return {
    previewKey,
    previewHash,
    sourceKey,
  };
}

module.exports = {
  generarPdfPreviewConMarcaDeAgua,
  resolveWatermarkText,
};

// backend/services/pdfPreview.js
const crypto = require("crypto");
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

  if (status === "BORRADOR" || status === "DRAFT") {
    return "DOCUMENTO BORRADOR";
  }

  return "DOCUMENTO EN PROCESO DE FIRMA";
}

function drawPageWatermark(page, text, font) {
  const { width, height } = page.getSize();

  const diagonalSize = Math.max(34, Math.min(width, height) * 0.06);
  const secondarySize = Math.max(18, diagonalSize * 0.52);

  const centerX = width / 2;
  const centerY = height / 2;

  const mainTextWidth = font.widthOfTextAtSize(text, diagonalSize);
  const secondaryTextWidth = font.widthOfTextAtSize(text, secondarySize);

  page.drawText(text, {
    x: centerX - mainTextWidth / 2,
    y: centerY - diagonalSize / 2,
    size: diagonalSize,
    font,
    color: rgb(0.7, 0.7, 0.7),
    rotate: degrees(35),
    opacity: 0.16,
  });

  page.drawText(text, {
    x: Math.max(24, width * 0.14 - secondaryTextWidth / 2),
    y: Math.max(90, height * 0.24),
    size: secondarySize,
    font,
    color: rgb(0.8, 0.8, 0.8),
    rotate: degrees(35),
    opacity: 0.1,
  });

  page.drawText(text, {
    x: Math.max(24, width * 0.62 - secondaryTextWidth / 2),
    y: Math.max(55, height * 0.7),
    size: secondarySize,
    font,
    color: rgb(0.8, 0.8, 0.8),
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

  const fontSize = 8;
  const textWidth = font.widthOfTextAtSize(footerText, fontSize);

  page.drawText(footerText, {
    x: Math.max(20, (width - textWidth) / 2),
    y: 18,
    size: fontSize,
    font,
    color: rgb(0.42, 0.42, 0.42),
    opacity: 0.96,
  });
}

/**
 * Genera un PDF de preview con marca de agua a partir del original limpio.
 *
 * @param {object} docRow
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

  const previewHash = crypto
    .createHash("sha256")
    .update(previewBuffer)
    .digest("hex");

  const { key: previewKey } = await uploadPdfBufferForDocument({
    buffer: previewBuffer,
    documentoId,
    prefix: options.prefix || `preview-${previewHash.slice(0, 12)}`,
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

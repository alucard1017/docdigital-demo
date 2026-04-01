// backend/controllers/documents/common.js
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const axios = require("axios");

const db = require("../../db");
const {
  sendSigningInvitation,
  sendVisadoInvitation,
} = require("../../services/emailService");
const {
  uploadPdfToS3,
  getSignedUrl,
} = require("../../services/storageR2");
const {
  isValidEmail,
  isValidRun,
  validateLength,
} = require("../../utils/validators");
const { PDFDocument, rgb, degrees } = require("pdf-lib");
const { sellarPdfConQr } = require("../../services/pdfSeal");
const {
  generarNumeroContratoInterno,
} = require("../../utils/numeroContratoInterno");

/* ================================
   ESTADOS DE DOCUMENTO
   ================================ */

const DOCUMENT_STATES = Object.freeze({
  DRAFT: "BORRADOR",
  SENT: "ENVIADO",
  UNDER_REVIEW: "EN_REVISION",
  SIGNING: "EN_FIRMA",
  SIGNED: "FIRMADO",
  REJECTED: "RECHAZADO",
  EXPIRED: "EXPIRADO",
});

/* ================================
   HELPERS BASE
   ================================ */

function generarCodigoVerificacion() {
  return crypto
    .randomBytes(6)
    .toString("base64")
    .replace(/[^A-Z0-9]/gi, "")
    .slice(0, 10)
    .toUpperCase();
}

function computeHash(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("computeHash requiere un Buffer válido");
  }

  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function isActiveDocumentStatus(status) {
  return [
    DOCUMENT_STATES.SENT,
    DOCUMENT_STATES.UNDER_REVIEW,
    DOCUMENT_STATES.SIGNING,
  ].includes(status);
}

/* ================================
   PDF / MARCA DE AGUA
   ================================ */

async function aplicarMarcaAguaLocal(pdfBuffer) {
  try {
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
      throw new Error("Buffer inválido en aplicarMarcaAguaLocal");
    }

    const pdfDoc = await PDFDocument.load(pdfBuffer, {
      updateMetadata: false,
    });

    const pages = pdfDoc.getPages();

    const textoPrincipal = "VERIFIRMA";
    const textoSecundario =
      "Documento en proceso - No valido como original";
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
    const resultBuffer = Buffer.from(pdfBytes);

    console.log("✅ Marca de agua VERIFIRMA aplicada (buffer)");
    return resultBuffer;
  } catch (err) {
    console.error("⚠️ Error aplicando marca de agua:", err);
    return pdfBuffer;
  }
}

/* ================================
   EXPORTS
   ================================ */

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
  generarCodigoVerificacion,
  aplicarMarcaAguaLocal,
  computeHash,
  DOCUMENT_STATES,
  isActiveDocumentStatus,
};
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
const { uploadPdfToS3, getSignedUrl } = require("../../services/s3");
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

/**
 * Estados estándar de documentos.
 *
 * BORRADOR       → creado, sin envío.
 * ENVIADO        → enviado a visado/firma, con al menos una invitación emitida.
 * EN_REVISION    → pendiente de visado.
 * EN_FIRMA       → pendiente de firmas.
 * FIRMADO        → todas las firmas completadas.
 * RECHAZADO      → rechazado por propietario o firmante.
 * EXPIRADO       → venció por fecha de expiración.
 */
const DOCUMENT_STATES = {
  DRAFT: "BORRADOR",
  SENT: "ENVIADO",
  UNDER_REVIEW: "EN_REVISION",
  SIGNING: "EN_FIRMA",
  SIGNED: "FIRMADO",
  REJECTED: "RECHAZADO",
  EXPIRED: "EXPIRADO",
};

/**
 * Genera un código alfanumérico para verificación pública de documentos.
 */
function generarCodigoVerificacion() {
  return crypto
    .randomBytes(6)
    .toString("base64")
    .replace(/[^A-Z0-9]/gi, "")
    .slice(0, 10)
    .toUpperCase();
}

/**
 * Aplica marca de agua VERIFIRMA a un PDF local.
 * Nota: la idea a futuro es retirar esta marca del PDF final firmado
 * y dejar solo sello/QR/branding “confiable”.
 */
async function aplicarMarcaAguaLocal(filePath) {
  try {
    const bytes = await fs.promises.readFile(filePath);
    const pdfDoc = await PDFDocument.load(bytes);
    const pages = pdfDoc.getPages();

    const textoPrincipal = "VERIFIRMA";
    const textoSecundario = "Documento en proceso – No válido como original";
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
    console.log("✅ Marca de agua VERIFIRMA aplicada a", filePath);
  } catch (err) {
    console.error("⚠️ Error aplicando marca de agua:", err);
  }
}

/**
 * Calcula el hash SHA-256 de un buffer.
 */
function computeHash(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Helper para saber si un documento está en un estado “activo”
 * sobre el que tenga sentido enviar recordatorios.
 */
function isActiveDocumentStatus(status) {
  return [
    DOCUMENT_STATES.SENT,
    DOCUMENT_STATES.UNDER_REVIEW,
    DOCUMENT_STATES.SIGNING,
  ].includes(status);
}

module.exports = {
  // dependencias base
  path,
  crypto,
  fs,
  axios,
  db,
  // servicios de email
  sendSigningInvitation,
  sendVisadoInvitation,
  // almacenamiento
  uploadPdfToS3,
  getSignedUrl,
  // validaciones
  isValidEmail,
  isValidRun,
  validateLength,
  // pdf-lib
  PDFDocument,
  rgb,
  degrees,
  // sello y numeración interna
  sellarPdfConQr,
  generarNumeroContratoInterno,
  // utilidades locales
  generarCodigoVerificacion,
  aplicarMarcaAguaLocal,
  computeHash,
  // estados
  DOCUMENT_STATES,
  isActiveDocumentStatus,
};

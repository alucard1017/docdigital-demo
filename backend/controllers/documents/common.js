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
  uploadBufferToS3,
  getSignedUrl,
  getObjectBuffer,
  downloadPdfFromS3,
  deleteObjectFromS3,
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

function isHttpUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

/* ================================
   RESOLUCIÓN DE PDF
   ================================ */

function buildDocumentWhereClause({ id, user }) {
  const params = [id];
  let where = "id = $1";

  if (user && user.company_id) {
    params.push(user.company_id);
    where += " AND company_id = $2";
  }

  return { where, params };
}

async function resolvePdfSourceByDocumentId(id, user) {
  const { where, params } = buildDocumentWhereClause({ id, user });

  const docRes = await db.query(
    `
    SELECT
      id,
      title,
      company_id,
      nuevo_documento_id,
      file_url,
      file_path,
      storage_key,
      pdf_original_url,
      pdf_final_url,
      final_storage_key,
      final_file_url
    FROM documents
    WHERE ${where}
    `,
    params
  );

  if (docRes.rowCount === 0) {
    return { ok: false, status: 404, message: "Documento no encontrado" };
  }

  const doc = docRes.rows[0];

  // 1) Prioridad: PDF final sellado
  const finalCandidate = pickFirstNonEmpty(
    doc.pdf_final_url,
    doc.final_storage_key,
    doc.final_file_url
  );

  if (finalCandidate) {
    if (isHttpUrl(finalCandidate)) {
      return {
        ok: true,
        doc,
        sourceType: "final-direct-url",
        directUrl: finalCandidate,
      };
    }

    const signedUrl = await getSignedUrl(finalCandidate, 3600);
    return {
      ok: true,
      doc,
      sourceType: "final-storage-key",
      signedUrl,
      storageKey: finalCandidate,
    };
  }

  // 2) Archivo base moderno
  const baseCandidate = pickFirstNonEmpty(
    doc.file_url,
    doc.storage_key,
    doc.file_path,
    doc.pdf_original_url
  );

  if (baseCandidate) {
    if (isHttpUrl(baseCandidate)) {
      return {
        ok: true,
        doc,
        sourceType: "base-direct-url",
        directUrl: baseCandidate,
      };
    }

    const signedUrl = await getSignedUrl(baseCandidate, 3600);
    return {
      ok: true,
      doc,
      sourceType: "base-storage-key",
      signedUrl,
      storageKey: baseCandidate,
    };
  }

  // 3) Fallback legacy (tabla documentos)
  if (doc.nuevo_documento_id) {
    const legacyRes = await db.query(
      `
      SELECT
        id,
        url_archivo,
        archivo_url,
        pdf_final_url,
        pdf_original_url,
        file_path
      FROM documentos
      WHERE id = $1
      `,
      [doc.nuevo_documento_id]
    );

    if (legacyRes.rowCount > 0) {
      const legacy = legacyRes.rows[0];
      const legacyCandidate = pickFirstNonEmpty(
        legacy.pdf_final_url,
        legacy.url_archivo,
        legacy.archivo_url,
        legacy.pdf_original_url,
        legacy.file_path
      );

      if (legacyCandidate) {
        if (isHttpUrl(legacyCandidate)) {
          return {
            ok: true,
            doc,
            sourceType: "legacy-direct-url",
            directUrl: legacyCandidate,
          };
        }

        const signedUrl = await getSignedUrl(legacyCandidate, 3600);
        return {
          ok: true,
          doc,
          sourceType: "legacy-storage-key",
          signedUrl,
          storageKey: legacyCandidate,
        };
      }
    }
  }

  return { ok: false, status: 404, message: "Documento sin archivo asociado" };
}

function buildSafeFilename(base, fallbackPrefix = "documento") {
  const clean =
    String(base || fallbackPrefix)
      .trim()
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || fallbackPrefix;

  return `${clean}.pdf`;
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
    const textoSecundario = "Documento en proceso - No válido como original";
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
  uploadBufferToS3,
  getSignedUrl,
  getObjectBuffer,
  downloadPdfFromS3,
  deleteObjectFromS3,

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

  isHttpUrl,
  pickFirstNonEmpty,
  buildDocumentWhereClause,
  buildSafeFilename,
  resolvePdfSourceByDocumentId,
};
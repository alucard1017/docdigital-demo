// backend/services/s3PdfHelpers.js
const crypto = require("crypto");
const {
  getSignedUrl,
  getObjectBuffer,
  uploadBufferToS3,
} = require("./storageR2");

/* ================================
   Utilidades básicas
   ================================ */

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function cleanPath(value) {
  return isNonEmptyString(value) ? value.trim() : null;
}

function pickFirstPath(...candidates) {
  for (const value of candidates) {
    const cleaned = cleanPath(value);
    if (cleaned) return cleaned;
  }
  return null;
}

function normalizeDocumentStatus(value) {
  return String(value || "").trim().toUpperCase();
}

/* ================================
   Claves en S3
   ================================ */

function buildPdfStorageKey({ documentoId, prefix = "other", buffer }) {
  if (!documentoId) {
    throw new Error("documentoId es obligatorio en buildPdfStorageKey");
  }

  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("buffer inválido en buildPdfStorageKey");
  }

  const hashSha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  const safePrefix =
    String(prefix || "other")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "") || "other";

  const key = `documents/${documentoId}/${safePrefix}-${hashSha256}.pdf`;

  return {
    key,
    hashSha256,
  };
}

/* =====================================================
   Resolución de archivos por rol
   ===================================================== */

/**
 * Devuelve la fuente ORIGINAL limpia.
 * Debe apuntar al archivo base, no al preview ni al final sellado.
 */
function getOriginalSourceKey(docRow) {
  if (!docRow) return null;

  return pickFirstPath(
    docRow.original_storage_key,
    docRow.pdf_original_url,
    docRow.storage_key,
    docRow.file_path,
    docRow.file_url,
    docRow.archivo_url
  );
}

/**
 * Devuelve el PREVIEW (watermarked) si existe;
 * si no existe, cae al original limpio.
 */
function getPreviewKey(docRow) {
  if (!docRow) return null;

  return pickFirstPath(
    docRow.preview_storage_key,
    docRow.preview_file_url,
    docRow.pdf_preview_url,
    getOriginalSourceKey(docRow)
  );
}

/**
 * Devuelve el FINAL sellado si existe;
 * si no existe, cae a preview y luego a original.
 */
function getFinalKey(docRow) {
  if (!docRow) return null;

  return pickFirstPath(
    docRow.final_storage_key,
    docRow.pdf_final_url,
    docRow.final_file_url,
    getPreviewKey(docRow)
  );
}

/**
 * Decide qué archivo debe usarse en base al estado.
 *
 * - FIRMADO/COMPLETED → final (si hay); si no, preview/original
 * - Estados intermedios → preview (si hay); si no, original
 */
function resolveKeyByStatus(docRow) {
  const status = normalizeDocumentStatus(docRow?.status || docRow?.estado);

  if (["FIRMADO", "SIGNED", "COMPLETED", "FINALIZADO"].includes(status)) {
    return getFinalKey(docRow);
  }

  return getPreviewKey(docRow);
}

/* =====================================================
   Signed URLs
   ===================================================== */

async function buildSignedUrlForKey(basePath, expiresInSeconds = 3600) {
  const cleaned = cleanPath(basePath);
  if (!cleaned) {
    throw new Error("basePath es obligatorio para buildSignedUrlForKey");
  }
  return getSignedUrl(cleaned, expiresInSeconds);
}

/**
 * Devuelve una signed URL según el modo:
 * - original
 * - preview
 * - final
 * - auto (por estado del documento)
 */
async function buildSignedUrlForDocument(docRow, options = {}) {
  const { mode = "auto", expiresIn = 3600 } = options;

  if (!docRow) {
    throw new Error("docRow es obligatorio en buildSignedUrlForDocument");
  }

  let basePath = null;

  switch (mode) {
    case "original":
      basePath = getOriginalSourceKey(docRow);
      break;
    case "preview":
      basePath = getPreviewKey(docRow);
      break;
    case "final":
      basePath = getFinalKey(docRow);
      break;
    case "auto":
    default:
      basePath = resolveKeyByStatus(docRow);
      break;
  }

  if (!basePath) {
    const err = new Error("Documento sin archivo asociado para el modo solicitado");
    err.code = "NO_FILE";
    throw err;
  }

  return buildSignedUrlForKey(basePath, expiresIn);
}

/* =====================================================
   Buffers
   ===================================================== */

async function getPdfBufferFromKey(storageKey) {
  const cleaned = cleanPath(storageKey);
  if (!cleaned) {
    throw new Error("storageKey es obligatorio para getPdfBufferFromKey");
  }

  return getObjectBuffer(cleaned);
}

async function uploadPdfBufferForDocument({ buffer, documentoId, prefix = "other" }) {
  const { key, hashSha256 } = buildPdfStorageKey({
    documentoId,
    prefix,
    buffer,
  });

  await uploadBufferToS3(key, buffer, "application/pdf");

  return {
    key,
    hashSha256,
  };
}

module.exports = {
  isNonEmptyString,
  cleanPath,
  pickFirstPath,
  normalizeDocumentStatus,
  buildPdfStorageKey,
  getOriginalSourceKey,
  getPreviewKey,
  getFinalKey,
  resolveKeyByStatus,
  buildSignedUrlForKey,
  buildSignedUrlForDocument,
  getPdfBufferFromKey,
  uploadPdfBufferForDocument,
};

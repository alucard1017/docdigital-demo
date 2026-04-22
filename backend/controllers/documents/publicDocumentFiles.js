// backend/controllers/documents/publicDocumentFiles.js
const { getSignedUrl } = require("../../services/storageR2");

const NO_FILE_MESSAGE = "Documento sin archivo asociado";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function pickFirstFilePath(...candidates) {
  for (const value of candidates) {
    if (isNonEmptyString(value)) {
      return value.trim();
    }
  }
  return null;
}

/**
 * Para vistas públicas de firma/visado/preview.
 * Durante el flujo debe priorizar SIEMPRE el PDF preview
 * (idealmente con marca de agua).
 */
function buildPreviewDocumentFilePath(row) {
  if (!row) return null;

  return pickFirstFilePath(
    row.preview_file_url,
    row.preview_storage_key,
    row.pdf_preview_url,
    row.pdf_original_url,
    row.original_storage_key,
    row.storage_key,
    row.file_path,
    row.file_url,
    row.pdf_final_url,
    row.final_file_url,
    row.final_storage_key
  );
}

/**
 * Para verificación final o descarga final.
 * Debe priorizar SIEMPRE el PDF final sellado.
 */
function buildFinalDocumentFilePath(row) {
  if (!row) return null;

  return pickFirstFilePath(
    row.pdf_final_url,
    row.final_file_url,
    row.final_storage_key,
    row.preview_file_url,
    row.preview_storage_key,
    row.pdf_preview_url,
    row.pdf_original_url,
    row.original_storage_key,
    row.storage_key,
    row.file_path,
    row.file_url
  );
}

/**
 * Fuente para sellado.
 * Debe salir SIEMPRE del original limpio, nunca del preview ni del final.
 */
function buildSealSourceKey(row) {
  if (!row) return null;

  return pickFirstFilePath(
    row.original_storage_key,
    row.storage_key,
    row.file_path,
    row.file_url,
    row.pdf_original_url
  );
}

/**
 * Decide automáticamente si corresponde preview o final
 * según el estado del documento.
 */
function resolveDocumentFileMode(row, fallbackMode = "preview") {
  const status = String(row?.status || "").trim().toUpperCase();

  if (status === "FIRMADO" || status === "SIGNED") {
    return "final";
  }

  return fallbackMode === "final" ? "final" : "preview";
}

/**
 * Obtiene el path base según el modo solicitado.
 */
function resolveDocumentFilePath(row, mode = "preview") {
  if (mode === "final") {
    return buildFinalDocumentFilePath(row);
  }
  return buildPreviewDocumentFilePath(row);
}

/**
 * Devuelve una signed URL o responde con error HTTP y retorna null.
 */
async function buildSignedPdfUrlOrFail(row, res, options = {}) {
  const {
    mode = "preview",
    expiresIn = 3600,
    autoDetectByStatus = false,
  } = options;

  const resolvedMode = autoDetectByStatus
    ? resolveDocumentFileMode(row, mode)
    : mode;

  const basePath = resolveDocumentFilePath(row, resolvedMode);

  if (!basePath) {
    console.warn("[PUBLIC] documento sin archivo asociado", {
      documentId: row?.id || null,
      mode: resolvedMode,
      status: row?.status || null,
    });

    res.status(404).json({
      code: "NO_FILE",
      message: NO_FILE_MESSAGE,
    });
    return null;
  }

  try {
    return await getSignedUrl(basePath, expiresIn);
  } catch (err) {
    console.error("⚠️ Error generando signed URL:", {
      documentId: row?.id || null,
      mode: resolvedMode,
      status: row?.status || null,
      basePath,
      error: err?.message || err,
    });

    res.status(500).json({
      code: "SIGNED_URL_ERROR",
      message: "No se pudo generar el enlace del documento.",
    });
    return null;
  }
}

module.exports = {
  NO_FILE_MESSAGE,
  buildPreviewDocumentFilePath,
  buildFinalDocumentFilePath,
  buildSealSourceKey,
  resolveDocumentFileMode,
  resolveDocumentFilePath,
  buildSignedPdfUrlOrFail,
};

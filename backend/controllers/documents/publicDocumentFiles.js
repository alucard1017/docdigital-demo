// backend/controllers/documents/publicDocumentFiles.js
const { getSignedUrl } = require("../../services/storageR2");

const NO_FILE_MESSAGE = "Documento sin archivo asociado";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function cleanValue(value) {
  return isNonEmptyString(value) ? value.trim() : null;
}

function pickFirstFilePath(...candidates) {
  for (const value of candidates) {
    const cleaned = cleanValue(value);
    if (cleaned) return cleaned;
  }
  return null;
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

/**
 * Para vistas públicas de firma/visado/preview.
 * Mientras el documento NO esté finalizado, debe priorizar el preview.
 *
 * Importante:
 * - Soporta esquemas parciales donde quizás aún no existe preview_storage_key
 * - Si no hay preview, cae al original limpio
 * - Como último fallback usa final, pero NO es lo ideal
 */
function buildPreviewDocumentFilePath(row) {
  if (!row) return null;

  return pickFirstFilePath(
    row.preview_storage_key,
    row.preview_file_url,
    row.pdf_preview_url,
    row.pdf_original_url,
    row.original_storage_key,
    row.storage_key,
    row.file_path,
    row.file_url,
    row.archivo_url,
    row.pdf_final_url,
    row.final_file_url,
    row.final_storage_key
  );
}

/**
 * Para verificación/descarga final.
 * Debe priorizar SIEMPRE la versión final sellada.
 */
function buildFinalDocumentFilePath(row) {
  if (!row) return null;

  return pickFirstFilePath(
    row.final_storage_key,
    row.pdf_final_url,
    row.final_file_url,
    row.preview_storage_key,
    row.preview_file_url,
    row.pdf_preview_url,
    row.pdf_original_url,
    row.original_storage_key,
    row.storage_key,
    row.file_path,
    row.file_url,
    row.archivo_url
  );
}

/**
 * Fuente para sellado del PDF final.
 * Debe salir SIEMPRE del original limpio,
 * nunca del preview ni del final.
 */
function buildSealSourceKey(row) {
  if (!row) return null;

  return pickFirstFilePath(
    row.original_storage_key,
    row.pdf_original_url,
    row.storage_key,
    row.file_path,
    row.file_url,
    row.archivo_url
  );
}

/**
 * Decide automáticamente qué modo usar según estado.
 */
function resolveDocumentFileMode(row, fallbackMode = "preview") {
  const status = normalizeStatus(row?.status || row?.estado);

  if (["FIRMADO", "SIGNED", "FINALIZADO", "COMPLETED"].includes(status)) {
    return "final";
  }

  return fallbackMode === "final" ? "final" : "preview";
}

function resolveDocumentFilePath(row, mode = "preview") {
  if (mode === "final") {
    return buildFinalDocumentFilePath(row);
  }

  return buildPreviewDocumentFilePath(row);
}

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
      status: row?.status || row?.estado || null,
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
      status: row?.status || row?.estado || null,
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

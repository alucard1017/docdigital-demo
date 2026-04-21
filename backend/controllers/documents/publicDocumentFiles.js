// backend/controllers/documents/publicDocumentFiles.js
const { getSignedUrl } = require("../../services/storageR2");

const NO_FILE_MESSAGE = "Documento sin archivo asociado";

/**
 * Para vistas públicas de firma/visado/preview.
 * Prioriza SIEMPRE preview con marca de agua si existe.
 */
function buildPreviewDocumentFilePath(row) {
  if (!row) return null;

  return (
    row.preview_file_url ||
    row.pdf_original_url ||
    row.original_storage_key ||
    row.storage_key ||
    row.file_path ||
    row.file_url ||
    row.pdf_final_url ||
    row.final_file_url ||
    row.final_storage_key ||
    null
  );
}

/**
 * Para verificación final o descarga final.
 * Prioriza el PDF final sellado.
 */
function buildFinalDocumentFilePath(row) {
  if (!row) return null;

  return (
    row.pdf_final_url ||
    row.final_file_url ||
    row.final_storage_key ||
    row.preview_file_url ||
    row.pdf_original_url ||
    row.original_storage_key ||
    row.storage_key ||
    row.file_path ||
    row.file_url ||
    null
  );
}

/**
 * Fuente para sellado.
 * Debe priorizar SIEMPRE el original limpio.
 */
function buildSealSourceKey(row) {
  if (!row) return null;

  return (
    row.original_storage_key ||
    row.storage_key ||
    row.file_path ||
    row.file_url ||
    row.pdf_original_url ||
    null
  );
}

/**
 * Devuelve una signed URL o responde con error HTTP y retorna null.
 */
async function buildSignedPdfUrlOrFail(row, res, options = {}) {
  const { mode = "preview", expiresIn = 3600 } = options;

  const basePath =
    mode === "final"
      ? buildFinalDocumentFilePath(row)
      : buildPreviewDocumentFilePath(row);

  if (!basePath) {
    console.warn("[PUBLIC] documento sin archivo asociado", {
      documentId: row?.id,
      mode,
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
      documentId: row?.id,
      mode,
      basePath,
      error: err,
    });

    res.status(500).json({
      code: "SIGNED_URL_ERROR",
      message: "No se pudo generar el enlace de descarga del documento.",
    });
    return null;
  }
}

module.exports = {
  NO_FILE_MESSAGE,
  buildPreviewDocumentFilePath,
  buildFinalDocumentFilePath,
  buildSealSourceKey,
  buildSignedPdfUrlOrFail,
};
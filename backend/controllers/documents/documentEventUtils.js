// backend/controllers/documents/documentEventUtils.js

function getClientIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];

  return (
    req?.headers?.["x-real-ip"] ||
    (forwarded &&
      forwarded
        .toString()
        .split(",")
        .pop()
        .trim()) ||
    req?.ip ||
    req?.socket?.remoteAddress ||
    null
  );
}

function getUserAgent(req) {
  return req?.headers?.["user-agent"] || null;
}

function getDocumentHash(doc) {
  if (!doc) return null;

  return (
    doc.final_hash_sha256 ||
    doc.sealed_hash_sha256 ||
    doc.hash_final_file ||
    doc.pdf_hash_final ||
    doc.hash_sha256 ||
    doc.hash_original_file ||
    null
  );
}

function formatDateSafe(dateLike) {
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isExpired(dateLike) {
  if (!dateLike) return false;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return false;
  return d < new Date();
}

module.exports = {
  getClientIp,
  getUserAgent,
  getDocumentHash,
  formatDateSafe,
  isExpired,
};
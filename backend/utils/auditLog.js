// backend/utils/auditLog.js
const db = require("../db");

/**
 * Extrae IP, user-agent y requestId de un objeto req Express-like.
 */
function extractRequestContext(req) {
  if (!req) {
    return { ip: null, userAgent: null, requestId: null };
  }

  const ipHeader = req.headers?.["x-forwarded-for"];
  const forwardedIp =
    typeof ipHeader === "string" ? ipHeader.split(",")[0].trim() : null;

  const ip = req.ipAddress || req.ip || forwardedIp || null;
  const userAgent = req.userAgent || req.headers?.["user-agent"] || null;
  const requestId = req.requestId || null;

  return { ip, userAgent, requestId };
}

/**
 * Normaliza metadata a JSON string o null.
 */
function normalizeMetadata(metadata) {
  if (!metadata) return null;
  if (typeof metadata === "string") return metadata;

  if (typeof metadata === "object") {
    try {
      return JSON.stringify(metadata);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Construye metadata estándar para eventos de documentos.
 */
function buildDocumentAuditMetadata({
  documentId,
  title,
  status,
  companyId = null,
  extra = {},
}) {
  const base = {
    document_id: documentId,
    title: title || null,
    status: status || null,
    company_id: companyId,
  };

  return { ...base, ...extra };
}

/* ================================
   logAudit: acciones de negocio / dominio
   ================================ */
async function logAudit({
  user,
  action,
  entityType,
  entityId = null,
  metadata = null,
  req = null,
}) {
  if (!action || !entityType) return;

  try {
    const userId = user?.id ?? null;
    const companyId = user?.company_id ?? null;
    const { ip, userAgent, requestId } = extractRequestContext(req);
    const metadataJson = normalizeMetadata(metadata);

    await db.query(
      `INSERT INTO audit_log
         (user_id, company_id, action, entity_type, entity_id, metadata, ip, user_agent, request_id)
       VALUES ($1,      $2,        $3,     $4,          $5,        $6,       $7, $8,         $9)`,
      [
        userId,
        companyId,
        action,
        entityType,
        entityId,
        metadataJson,
        ip,
        userAgent,
        requestId,
      ]
    );
  } catch (err) {
    console.error("⚠️ Error registrando audit_log:", err.message || err);
  }
}

/* ================================
   logAuth: eventos de autenticación
   ================================ */
async function logAuth({
  userId = null,
  run = null,
  action,
  metadata = null,
  req = null,
}) {
  if (!action) return;

  try {
    const { ip, userAgent } = extractRequestContext(req);
    const metadataJson = normalizeMetadata(metadata);

    await db.query(
      `INSERT INTO auth_log
         (user_id, run, action, metadata, ip, user_agent, created_at)
       VALUES ($1,      $2,  $3,     $4,       $5, $6,         NOW())`,
      [userId, run, action, metadataJson, ip, userAgent]
    );
  } catch (err) {
    console.error("⚠️ Error registrando auth_log:", err.message || err);
  }
}

module.exports = {
  logAudit,
  logAuth,
  extractRequestContext,
  buildDocumentAuditMetadata,
};

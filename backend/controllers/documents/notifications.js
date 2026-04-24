// backend/controllers/documents/notifications.js
const db = require("../../db");
const {
  normalizeDocumentEvent,
  normalizeAuditEvent,
} = require("./timeline");

function isGlobalAdmin(user) {
  return user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_GLOBAL";
}

function toSafeLimit(raw, defaultValue = 20, max = 100) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return defaultValue;
  return Math.min(n, max);
}

// Eventos que consideramos “notificación” relevante
const NOTIFICATION_EVENT_TYPES = new Set([
  "DOCUMENT_SIGNED_OWNER",
  "PUBLIC_SIGN",
  "PUBLIC_SIGNED",
  "PUBLIC_REJECT",
  "DOCUMENT_REJECTED_OWNER",
  "STATUS_CHANGED",
  "DOCUMENT_VISADO_OWNER",
  "PUBLIC_VISAR",
  "PUBLIC_VISADO",
]);

/**
 * GET /api/docs/notifications?limit=20
 *
 * Devuelve eventos recientes relevantes para el usuario (por company_id),
 * normalizados y con info básica del documento.
 */
async function getDocumentNotifications(req, res) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "No autenticado" });
    }

    if (!isGlobalAdmin(user) && !user.company_id) {
      return res.status(400).json({
        message: "Tu usuario no tiene company_id asignado",
      });
    }

    const limit = toSafeLimit(req.query.limit, 20, 100);

    const params = [];
    let whereCompany = "";

    if (!isGlobalAdmin(user)) {
      params.push(user.company_id);
      whereCompany = "AND d.company_id = $1";
    }

    const notificationsSql = `
      SELECT
        e.id,
        e.document_id,
        e.participant_id,
        e.actor,
        COALESCE(e.action, e.tipo_evento) AS action,
        COALESCE(e.details, e.detalle::text) AS details,
        e.from_status,
        e.to_status,
        COALESCE(e.event_type, e.tipo_evento) AS event_type,
        e.metadata,
        COALESCE(e.ip_address, e.ip) AS ip_address,
        e.user_agent,
        e.hash_document,
        e.company_id,
        e.user_id,
        e.created_at,
        d.title AS document_title,
        d.numero_contrato_interno AS numero_interno
      FROM document_events e
      JOIN documents d ON d.id = e.document_id
      WHERE 1 = 1
        ${whereCompany}
        AND e.event_type IS NOT NULL
      ORDER BY e.created_at DESC
      LIMIT ${limit}
    `;

    const result = await db.query(notificationsSql, params);
    const rows = result.rows || [];

    const notifications = rows
      .map((row) => {
        const normalized = normalizeDocumentEvent(row);

        const eventTypeUpper = String(normalized.eventType || "")
          .toUpperCase()
          .trim();

        if (!NOTIFICATION_EVENT_TYPES.has(eventTypeUpper)) {
          return null;
        }

        // Actor legible para UI
        let actorLabel = normalized.actor || "system";
        const metaActorName =
          normalized.metadata?.signer_name ||
          normalized.metadata?.actor_name ||
          normalized.metadata?.participant_name ||
          null;

        if (metaActorName) {
          actorLabel = metaActorName;
        }

        return {
          id: normalized.id,
          document_id: row.document_id,
          document_title: row.document_title || "Documento sin título",
          numero_interno: row.numero_interno || null,
          event_type: normalized.eventType,
          action: normalized.action,
          actor: actorLabel,
          from_status: normalized.fromStatus,
          to_status: normalized.toStatus,
          created_at: normalized.createdAt,
          metadata: normalized.metadata,
        };
      })
      .filter(Boolean);

    return res.json({
      items: notifications,
    });
  } catch (err) {
    console.error("❌ Error obteniendo notificaciones de documentos:", err);
    return res
      .status(500)
      .json({ message: "Error obteniendo notificaciones" });
  }
}

module.exports = {
  getDocumentNotifications,
};
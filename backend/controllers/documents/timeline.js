// backend/controllers/documents/timeline.js
const { db, getSignedUrl, computeHash, axios } = require("./common");
const { logAudit } = require("../../utils/auditLog");
const { getClientIp, getUserAgent } = require("./documentEventUtils");

/**
 * Contrato uniforme de salida para eventos del timeline.
 *
 * {
 *   id: string | number,
 *   eventType: string,
 *   action: string,
 *   actor: string,
 *   fromStatus: string | null,
 *   toStatus: string | null,
 *   ip: string | null,
 *   userAgent: string | null,
 *   createdAt: string, // ISO 8601
 *   metadata: object
 * }
 */

/* ================================
   Helpers comunes
   ================================ */

function safeJson(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeBoolean(value) {
  if (value === true || value === "true" || value === 1 || value === "1") {
    return true;
  }
  if (value === false || value === "false" || value === 0 || value === "0") {
    return false;
  }
  return Boolean(value);
}

function normalizeStatus(raw) {
  if (!raw) return null;

  const value = String(raw).toUpperCase().trim();

  switch (value) {
    case "BORRADOR":
      return "BORRADOR";
    case "PENDIENTE_VISADO":
      return "PENDIENTE_VISADO";
    case "PENDIENTE_FIRMA":
    case "EN_FIRMA":
      return "PENDIENTE_FIRMA";
    case "FIRMADO":
      return "FIRMADO";
    case "RECHAZADO":
      return "RECHAZADO";
    default:
      return value;
  }
}

function normalizeCreatedAt(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function detectEventSource(eventType, metadata) {
  if (metadata?.source) return metadata.source;
  if (!eventType) return "document_events";

  const type = String(eventType).toUpperCase();

  if (type.startsWith("PUBLIC_")) return "public";
  if (type.endsWith("_OWNER")) return "owner";
  if (type.includes("INTERNAL")) return "internal_flow";
  if (type.includes("AUDIT")) return "audit_log";

  return "document_events";
}

function buildNormalizedEvent({
  id,
  eventType,
  action,
  actor,
  fromStatus,
  toStatus,
  ip,
  userAgent,
  createdAt,
  metadata,
}) {
  const createdAtIso = normalizeCreatedAt(createdAt);

  return {
    id,
    eventType: eventType || "UNKNOWN",
    action: action || eventType || "UNKNOWN",
    actor: actor || "system",
    fromStatus: normalizeStatus(fromStatus),
    toStatus: normalizeStatus(toStatus),
    ip: ip || null,
    userAgent: userAgent || null,
    createdAt: createdAtIso,
    metadata: metadata || {},
  };
}

function normalizeDocumentEvent(evt) {
  const metadata = safeJson(evt.metadata, {}) || {};

  const baseEventType = evt.event_type || evt.tipo_evento || evt.action;
  const baseAction = evt.action || evt.tipo_evento || baseEventType;

  const eventType = baseEventType || "UNKNOWN";
  const action = baseAction || "UNKNOWN";

  const fromStatusRaw =
    evt.from_status || metadata.from_status || metadata.legacy_status || null;

  const toStatusRaw =
    evt.to_status || metadata.to_status || metadata.documents_status || null;

  const actor =
    evt.actor ||
    metadata.actor ||
    metadata.actor_email ||
    (metadata.user_id ? `user:${metadata.user_id}` : null) ||
    (metadata.actor_type
      ? `system:${String(metadata.actor_type).toLowerCase()}`
      : null) ||
    "system";

  const source = detectEventSource(eventType, metadata);

  return buildNormalizedEvent({
    id: evt.id,
    eventType,
    action,
    actor,
    fromStatus: fromStatusRaw,
    toStatus: toStatusRaw,
    ip: evt.ip_address || evt.ip || null,
    userAgent: evt.user_agent || null,
    createdAt: evt.created_at,
    metadata: {
      ...metadata,
      source,
      details: evt.details || evt.detalle || metadata.details || null,
      participant_id: evt.participant_id || metadata.participant_id || null,
      hash_document: evt.hash_document || metadata.hash_document || null,
      company_id: evt.company_id || metadata.company_id || null,
      user_id: evt.user_id || metadata.user_id || null,
    },
  });
}

function normalizeAuditEvent(evt) {
  const metadata = safeJson(evt.metadata, {}) || {};
  const baseAction = evt.action || "AUDIT_LOG";
  const eventType =
    metadata.eventType || metadata.event_type || `AUDIT_${baseAction}`;

  const actor =
    metadata.actor || (evt.user_id ? `user:${evt.user_id}` : null) || "system";

  return buildNormalizedEvent({
    id: `audit-${evt.id}`,
    eventType,
    action: baseAction,
    actor,
    fromStatus: metadata.from_status || null,
    toStatus: metadata.to_status || null,
    ip: evt.ip || null,
    userAgent: evt.user_agent || null,
    createdAt: evt.created_at,
    metadata: {
      ...metadata,
      source: "audit_log",
      details: evt.details || metadata.details || null,
      request_id: evt.request_id || metadata.request_id || null,
      user_id: evt.user_id || metadata.user_id || null,
    },
  });
}

function buildTimelineProgress(status, requiresVisado) {
  const normalized = normalizeStatus(status);

  switch (normalized) {
    case "PENDIENTE_VISADO":
      return {
        currentStep: "Pendiente de visación",
        nextStep: "⏳ Esperando visación",
        progress: 25,
      };
    case "PENDIENTE_FIRMA":
      return {
        currentStep: "Pendiente de firma",
        nextStep: "⏳ Esperando firma",
        progress: requiresVisado ? 75 : 50,
      };
    case "FIRMADO":
      return {
        currentStep: "FIRMADO",
        nextStep: "✅ Completado",
        progress: 100,
      };
    case "RECHAZADO":
      return {
        currentStep: "RECHAZADO",
        nextStep: "❌ Rechazado",
        progress: 100,
      };
    case "BORRADOR":
    default:
      return {
        currentStep: normalized || "PENDIENTE",
        nextStep: "",
        progress: 0,
      };
  }
}

/* ================================
   GET: URL firmada para ver PDF
   ================================ */

async function getDocumentPdf(req, res) {
  try {
    const docId = toNumber(req.params.id);
    if (!docId) {
      return res.status(400).json({
        code: "INVALID_ID",
        message: "ID de documento inválido",
      });
    }

    const result = await db.query(
      `
      SELECT 
        id,
        company_id,
        owner_id,
        title,
        file_path,
        pdf_original_url,
        pdf_final_url,
        status,
        pdf_hash_final
      FROM documents
      WHERE id = $1
      `,
      [docId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Documento no encontrado",
      });
    }

    const {
      id,
      company_id,
      title,
      file_path,
      pdf_original_url,
      pdf_final_url,
      status,
      pdf_hash_final,
    } = result.rows[0];

    if (!file_path && !pdf_original_url && !pdf_final_url) {
      return res.status(404).json({
        code: "NO_FILE",
        message: "Documento sin archivo asociado",
      });
    }

    const normalizedStatus = normalizeStatus(status);

    let storageKey = null;
    let isFinalPdf = false;

    if (normalizedStatus === "FIRMADO" && pdf_final_url) {
      storageKey = pdf_final_url;
      isFinalPdf = true;
    } else {
      storageKey = pdf_original_url || file_path;
      isFinalPdf = false;
    }

    if (!storageKey) {
      return res.status(404).json({
        code: "NO_FILE_KEY",
        message: "No se encontró una ruta de archivo para este documento",
      });
    }

    // Si es PDF final y tenemos hash, hacemos verificación de integridad
    if (isFinalPdf && pdf_hash_final) {
      try {
        const signedUrl = await getSignedUrl(storageKey, 600);

        const fileResponse = await axios.get(signedUrl, {
          responseType: "arraybuffer",
        });

        const buffer = Buffer.from(fileResponse.data);
        const currentHash = computeHash(buffer);

        if (currentHash !== pdf_hash_final) {
          console.error("❌ Hash de PDF no coincide", docId, {
            storageKey,
            stored_hash: pdf_hash_final,
            current_hash: currentHash,
          });

          await logAudit({
            user: req.user || null,
            action: "DOCUMENT_PDF_HASH_MISMATCH",
            entityType: "document",
            entityId: docId,
            metadata: {
              document_id: docId,
              company_id,
              title,
              key: storageKey,
              stored_hash: pdf_hash_final,
              current_hash: currentHash,
              context: "getDocumentPdf",
            },
            req,
          });

          return res.status(409).json({
            code: "PDF_HASH_MISMATCH",
            message:
              "El archivo del documento no pasa la verificación de integridad. Contacta al administrador.",
          });
        }
      } catch (verifyErr) {
        console.error(
          "❌ Error verificando hash de PDF para documento",
          docId,
          verifyErr
        );

        await logAudit({
          user: req.user || null,
          action: "DOCUMENT_PDF_HASH_VERIFY_ERROR",
          entityType: "document",
          entityId: docId,
          metadata: {
            document_id: docId,
            company_id,
            title,
            key: storageKey,
            error: verifyErr.message,
            context: "getDocumentPdf",
          },
          req,
        });

        return res.status(500).json({
          code: "PDF_VERIFY_ERROR",
          message: "Error verificando la integridad del documento.",
        });
      }
    }

    const finalSignedUrl = await getSignedUrl(storageKey, 600);

    await logAudit({
      user: req.user || null,
      action: "DOCUMENT_PDF_VIEWED",
      entityType: "document",
      entityId: docId,
      metadata: {
        document_id: docId,
        company_id,
        title,
        key: storageKey,
        final_pdf: isFinalPdf,
        ip: getClientIp(req),
        user_agent: getUserAgent(req),
      },
      req,
    });

    return res.json({
      url: finalSignedUrl,
      final: isFinalPdf,
    });
  } catch (err) {
    console.error("❌ Error obteniendo PDF:", err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
}

/* ================================
   GET: Timeline del documento (UI)
   ================================ */

async function getTimeline(req, res) {
  try {
    const docId = toNumber(req.params.id);
    if (!docId) {
      return res.status(400).json({
        code: "INVALID_ID",
        message: "ID de documento inválido",
      });
    }

    const docRes = await db.query(
      `
      SELECT
        id,
        title,
        status,
        company_id,
        destinatario_nombre,
        empresa_rut,
        created_at,
        updated_at,
        requires_visado,
        firmante_nombre,
        visador_nombre,
        numero_contrato_interno,
        tipo_documento
      FROM documents
      WHERE id = $1
      `,
      [docId]
    );

    if (docRes.rowCount === 0) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Documento no encontrado",
      });
    }

    const doc = docRes.rows[0];

    const participantsRes = await db.query(
      `
      SELECT
        id,
        role_in_doc,
        status,
        step_order,
        flow_order,
        flow_group,
        name,
        email,
        signed_at
      FROM document_participants
      WHERE document_id = $1
      ORDER BY flow_order ASC NULLS LAST,
               step_order ASC NULLS LAST,
               id ASC
      `,
      [doc.id]
    );

    const participants = participantsRes.rows || [];

    const eventsRes = await db.query(
      `
      SELECT 
        id,
        participant_id,
        actor,
        COALESCE(action, tipo_evento) AS action,
        COALESCE(details, detalle::text) AS details,
        from_status,
        to_status,
        COALESCE(event_type, tipo_evento) AS event_type,
        metadata,
        COALESCE(ip_address, ip) AS ip_address,
        user_agent,
        hash_document,
        company_id,
        user_id,
        created_at
      FROM document_events
      WHERE document_id = $1
      ORDER BY created_at ASC
      `,
      [docId]
    );

    const documentEvents = eventsRes.rows || [];

    const auditRes = await db.query(
      `
      SELECT
        id,
        created_at,
        user_id,
        action,
        details,
        metadata,
        ip,
        user_agent,
        request_id
      FROM audit_log
      WHERE entity_type = 'document'
        AND entity_id = $1
      ORDER BY created_at ASC
      `,
      [docId]
    );

    const auditEvents = auditRes.rows || [];

    const normalizedEvents = [
      ...documentEvents.map(normalizeDocumentEvent),
      ...auditEvents.map(normalizeAuditEvent),
    ].sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return ta - tb;
    });

    const requiresVisadoBool = normalizeBoolean(doc.requires_visado);
    const { currentStep, nextStep, progress } = buildTimelineProgress(
      doc.status,
      requiresVisadoBool
    );

    return res.json({
      document: {
        id: doc.id,
        title: doc.title,
        status: normalizeStatus(doc.status),
        company_id: doc.company_id,
        destinatario_nombre: doc.destinatario_nombre,
        empresa_rut: doc.empresa_rut,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        requires_visado: requiresVisadoBool,
        firmante_nombre: doc.firmante_nombre,
        visador_nombre: doc.visador_nombre,
        numero_contrato_interno: doc.numero_contrato_interno,
        tipo_documento: doc.tipo_documento,
      },
      participants,
      timeline: {
        currentStep,
        nextStep,
        progress,
        events: normalizedEvents,
      },
    });
  } catch (err) {
    console.error("❌ Error obteniendo timeline:", err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
}

/* ================================
   GET: Timeline legal (solo document_events)
   ================================ */

async function getLegalTimeline(req, res) {
  try {
    const docId = toNumber(req.params.id);
    if (!docId) {
      return res.status(400).json({
        code: "INVALID_ID",
        message: "ID de documento inválido",
      });
    }

    const docRes = await db.query(
      `
      SELECT id, title, status, company_id
      FROM documents
      WHERE id = $1
      `,
      [docId]
    );

    if (docRes.rowCount === 0) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Documento no encontrado",
      });
    }

    const doc = docRes.rows[0];

    const eventsRes = await db.query(
      `
      SELECT
        id,
        document_id,
        participant_id,
        actor,
        COALESCE(action, tipo_evento) AS action,
        COALESCE(details, detalle::text) AS details,
        from_status,
        to_status,
        COALESCE(event_type, tipo_evento) AS event_type,
        COALESCE(ip_address, ip) AS ip_address,
        user_agent,
        hash_document,
        company_id,
        user_id,
        metadata,
        created_at
      FROM document_events
      WHERE document_id = $1
      ORDER BY created_at ASC
      `,
      [docId]
    );

    const events = (eventsRes.rows || []).map((evt) =>
      normalizeDocumentEvent(evt)
    );

    return res.json({
      document: {
        id: doc.id,
        title: doc.title,
        status: normalizeStatus(doc.status),
        company_id: doc.company_id,
      },
      events,
    });
  } catch (err) {
    console.error("❌ Error obteniendo timeline legal:", err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
}

/* ================================
   GET: Firmantes de un documento
   ================================ */

async function getSigners(req, res) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        code: "UNAUTHENTICATED",
        message: "Autenticación requerida",
      });
    }

    const docId = toNumber(req.params.id);
    if (!docId) {
      return res.status(400).json({
        code: "INVALID_ID",
        message: "ID de documento inválido",
      });
    }

    const docRes = await db.query(
      `
      SELECT id, owner_id
      FROM documents
      WHERE id = $1 AND owner_id = $2
      `,
      [docId, req.user.id]
    );

    if (docRes.rowCount === 0) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Documento no encontrado",
      });
    }

    const signersRes = await db.query(
      `
      SELECT
        id,
        document_id,
        name,
        email,
        status,
        role,
        sign_token,
        signed_at,
        created_at
      FROM document_signers
      WHERE document_id = $1
      ORDER BY id ASC
      `,
      [docId]
    );

    return res.json(signersRes.rows || []);
  } catch (err) {
    console.error("❌ Error obteniendo firmantes:", err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
}

module.exports = {
  getDocumentPdf,
  getTimeline,
  getLegalTimeline,
  getSigners,
};
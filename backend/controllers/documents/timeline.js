// backend/controllers/documents/timeline.js
const { db, getSignedUrl, computeHash, axios } = require("./common");
const { logAudit } = require("../../utils/auditLog");

/* ================================
   GET: URL firmada para VER PDF
   ================================ */
async function getDocumentPdf(req, res) {
  try {
    const docId = Number(req.params.id);
    if (Number.isNaN(docId)) {
      return res.status(400).json({ message: "ID de documento inválido" });
    }

    const result = await db.query(
      `SELECT 
         id,
         file_path,
         pdf_original_url,
         pdf_final_url,
         status,
         pdf_hash_final
       FROM documents
       WHERE id = $1`,
      [docId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    const {
      file_path,
      pdf_original_url,
      pdf_final_url,
      status,
      pdf_hash_final,
    } = result.rows[0];

    if (!file_path && !pdf_original_url && !pdf_final_url) {
      return res
        .status(404)
        .json({ message: "Documento sin archivo asociado" });
    }

    // PDF que debe ver el usuario:
    // - Si está FIRMADO y hay pdf_final_url -> PDF sellado
    // - En otro caso, original o file_path (compatibilidad legacy)
    const key =
      status === "FIRMADO" && pdf_final_url
        ? pdf_final_url
        : pdf_original_url || file_path;

    // Verificación de integridad SOLO si hay hash guardado
    if (pdf_hash_final) {
      try {
        const signedUrl = await getSignedUrl(key, 600);

        const fileResponse = await axios.get(signedUrl, {
          responseType: "arraybuffer",
        });
        const buffer = Buffer.from(fileResponse.data);

        const currentHash = computeHash(buffer);

        if (currentHash !== pdf_hash_final) {
          console.error(
            "❌ Hash de PDF no coincide (vista pública) para documento",
            docId,
            {
              key,
              stored_hash: pdf_hash_final,
              current_hash: currentHash,
            }
          );

          await logAudit({
            user: null,
            action: "public_document_hash_mismatch",
            entityType: "document",
            entityId: docId,
            metadata: {
              document_id: docId,
              stored_hash: pdf_hash_final,
              current_hash: currentHash,
              key,
              context: "getDocumentPdf_public",
            },
            req,
          });

          return res.status(409).json({
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
        // Si falla la verificación técnica (problema de red/R2), mantenemos 500
        return res.status(500).json({
          message: "Error verificando la integridad del documento.",
        });
      }
    }

    const finalSignedUrl = await getSignedUrl(key, 3600);

    return res.json({
      url: finalSignedUrl,
      final: status === "FIRMADO" && !!pdf_final_url,
    });
  } catch (err) {
    console.error("❌ Error obteniendo PDF:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   GET: Timeline del documento
   ================================ */
async function getTimeline(req, res) {
  try {
    const docId = Number(req.params.id);
    if (Number.isNaN(docId)) {
      return res.status(400).json({ message: "ID de documento inválido" });
    }

    const docRes = await db.query(
      `SELECT 
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
         tipo_tramite,
         tipo_documento
       FROM documents 
       WHERE id = $1`,
      [docId]
    );

    if (docRes.rowCount === 0) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    const doc = docRes.rows[0];

    const participantsRes = await db.query(
      `
      SELECT
        id,
        role_in_doc,
        status,
        step_order,
        "name",
        email,
        signed_at
      FROM document_participants
      WHERE document_id = $1
      ORDER BY step_order ASC, id ASC
      `,
      [doc.id]
    );
    const participants = participantsRes.rows || [];

    const eventsRes = await db.query(
      `SELECT 
         id,
         action,
         details,
         actor,
         from_status,
         to_status,
         created_at
       FROM document_events 
       WHERE document_id = $1 
       ORDER BY created_at ASC`,
      [docId]
    );
    const documentEvents = eventsRes.rows || [];

    const auditRes = await db.query(
      `SELECT
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
       ORDER BY created_at ASC`,
      [docId]
    );
    const auditEvents = auditRes.rows || [];

    const timelineEvents = [
      ...documentEvents.map((evt) => ({
        id: evt.id,
        source: "document_events",
        action: evt.action,
        actor: evt.actor,
        timestamp: evt.created_at,
        fromStatus: evt.from_status,
        toStatus: evt.to_status,
        details: evt.details,
        metadata: null,
        companyId: doc.company_id || null,
        ip: null,
        userAgent: null,
        requestId: null,
      })),
      ...auditEvents.map((evt) => ({
        id: evt.id,
        source: "audit_log",
        action: evt.action,
        actor: evt.user_id ? `user:${evt.user_id}` : "system",
        timestamp: evt.created_at,
        fromStatus: null,
        toStatus: null,
        details: evt.details,
        metadata: evt.metadata,
        companyId:
          (evt.metadata && evt.metadata.company_id) || doc.company_id || null,
        ip: evt.ip,
        userAgent: evt.user_agent,
        requestId: evt.request_id,
      })),
    ];

    timelineEvents.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    let currentStep = "Pendiente";
    let nextStep = "";
    let progress = 0;

    switch (doc.status) {
      case "PENDIENTE_VISADO":
        currentStep = "Pendiente de visado";
        nextStep = "⏳ Esperando visación";
        progress = 25;
        break;
      case "PENDIENTE_FIRMA":
        currentStep = "Pendiente de firma";
        nextStep = "⏳ Esperando firma";
        progress = doc.requires_visado ? 75 : 50;
        break;
      case "FIRMADO":
        currentStep = "Firmado";
        nextStep = "✅ Completado";
        progress = 100;
        break;
      case "RECHAZADO":
        currentStep = "Rechazado";
        nextStep = "❌ Rechazado";
        progress = 0;
        break;
      default:
        currentStep = doc.status || "Pendiente";
        nextStep = "";
        progress = 0;
        break;
    }

    return res.json({
      document: {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        company_id: doc.company_id,
        destinatario_nombre: doc.destinatario_nombre,
        empresa_rut: doc.empresa_rut,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        requires_visado: doc.requires_visado,
        numero_contrato_interno: doc.numero_contrato_interno,
        tipo_tramite: doc.tipo_tramite,
        tipo_documento: doc.tipo_documento,
      },
      participants,
      timeline: {
        currentStep,
        nextStep,
        progress,
        events: timelineEvents,
      },
    });
  } catch (err) {
    console.error("❌ Error obteniendo timeline:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   GET: Timeline legal (document_events)
   ================================ */
async function getLegalTimeline(req, res) {
  try {
    const docId = Number(req.params.id);
    if (Number.isNaN(docId)) {
      return res.status(400).json({ message: "ID de documento inválido" });
    }

    const docRes = await db.query(
      `SELECT id, title, status, company_id
       FROM documents
       WHERE id = $1`,
      [docId]
    );

    if (docRes.rowCount === 0) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    const doc = docRes.rows[0];

    const eventsRes = await db.query(
      `
      SELECT
        id,
        document_id,
        participant_id,
        event_type,
        ip_address,
        user_agent,
        hash_document,
        metadata,
        created_at
      FROM document_events
      WHERE document_id = $1
      ORDER BY created_at ASC
      `,
      [docId]
    );

    const events = (eventsRes.rows || []).map((evt) => ({
      id: evt.id,
      document_id: evt.document_id,
      participant_id: evt.participant_id,
      event_type: evt.event_type,
      timestamp: evt.created_at,
      ip_address: evt.ip_address,
      user_agent: evt.user_agent,
      hash_document: evt.hash_document,
      metadata: evt.metadata,
    }));

    return res.json({
      document: {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        company_id: doc.company_id,
      },
      events,
    });
  } catch (err) {
    console.error("❌ Error obteniendo timeline legal:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   GET: Firmantes de un documento
   ================================ */
async function getSigners(req, res) {
  try {
    const docId = Number(req.params.id);
    if (Number.isNaN(docId)) {
      return res.status(400).json({ message: "ID de documento inválido" });
    }

    const docRes = await db.query(
      `SELECT id 
       FROM documents 
       WHERE id = $1 AND owner_id = $2`,
      [docId, req.user.id]
    );

    if (docRes.rowCount === 0) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    const signersRes = await db.query(
      `SELECT 
         id,
         name,
         email,
         status
       FROM document_signers
       WHERE document_id = $1
       ORDER BY id ASC`,
      [docId]
    );

    return res.json(signersRes.rows);
  } catch (err) {
    console.error("❌ Error obteniendo firmantes:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

module.exports = {
  getDocumentPdf,
  getTimeline,
  getLegalTimeline,
  getSigners,
};
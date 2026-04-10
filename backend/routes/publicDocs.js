// backend/routes/publicDocs.js
const express = require("express");
const db = require("../db");

const router = express.Router();

/* ================================
   HELPERS
   ================================ */

function getClientIp(req) {
  return (
    (req.headers["x-forwarded-for"] || "")
      .toString()
      .split(",")[0]
      .trim() || req.socket.remoteAddress || null
  );
}

function getUserAgent(req) {
  return req.headers["user-agent"] || null;
}

function isExpired(value) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date < new Date();
}

async function createDocumentEvent(client, payload) {
  const {
    documentId,
    participantId = null,
    actor = "PUBLIC_SIGN_LINK",
    action = null,
    fromStatus = null,
    toStatus = null,
    eventType = null,
    details = null,
    metadata = {},
    ipAddress = null,
    userAgent = null,
    hashDocument = null,
    companyId = null,
    userId = null,
  } = payload;

  await client.query(
    `
    INSERT INTO public.document_events (
      document_id,
      participant_id,
      actor,
      action,
      details,
      from_status,
      to_status,
      event_type,
      metadata,
      ip_address,
      user_agent,
      hash_document,
      company_id,
      user_id,
      created_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13, $14, now()
    )
    `,
    [
      documentId,
      participantId,
      actor,
      action,
      details,
      fromStatus,
      toStatus,
      eventType,
      metadata,
      ipAddress,
      userAgent,
      hashDocument,
      companyId,
      userId,
    ]
  );
}

async function getPendingPreviousParticipants(client, documentId, flowOrder) {
  const parsedOrder = Number(flowOrder);
  if (!Number.isFinite(parsedOrder)) return [];

  const res = await client.query(
    `
    SELECT
      id,
      name,
      email,
      role_in_doc,
      status,
      flow_order
    FROM public.document_participants
    WHERE document_id = $1
      AND flow_order < $2
      AND status NOT IN ('FIRMADO', 'VISADO', 'COMPLETADO')
    ORDER BY flow_order ASC, id ASC
    `,
    [documentId, parsedOrder]
  );

  return res.rows;
}

/* ================================
   GET /api/public/docs/:token
   - document (legacy o moderno)
   - signer legacy
   - participant moderno (si existe)
   - invitation
   - flow
   ================================ */

router.get("/docs/:token", async (req, res) => {
  const { token } = req.params;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Token inválido" });
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // 1) Invitación legacy
    const inviteRes = await client.query(
      `
      SELECT
        si.id              AS invitation_id,
        si.token           AS invitation_token,
        si.expires_at      AS invitation_expires_at,
        si.sent_at         AS invitation_sent_at,

        s.id               AS signer_id,
        s.full_name        AS signer_full_name,
        s.email            AS signer_email,
        s.role             AS signer_role,
        s.status           AS signer_status,
        s.order_index      AS signer_order_index,

        d.id               AS legacy_document_id,
        d.titulo           AS legacy_document_title,
        d.estado           AS legacy_document_status,
        d.tipo_flujo       AS legacy_document_flow_type,
        d.categoria_firma  AS legacy_document_signature_category,
        d.fecha_expiracion AS legacy_document_expires_at,
        d.company_id       AS legacy_company_id,
        d.hash_documento   AS legacy_hash_document,
        d.numero_contrato_interno AS legacy_internal_number,
        d.url_archivo      AS legacy_file_url
      FROM public.signer_invitations si
      JOIN public.signers s
        ON s.id = si.signer_id
      JOIN public.documentos d
        ON d.id = s.documento_id
      WHERE si.token = $1
      LIMIT 1
      `,
      [token]
    );

    if (inviteRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Invitación no encontrada" });
    }

    const row = inviteRes.rows[0];

    if (isExpired(row.invitation_expires_at)) {
      await client.query("ROLLBACK");
      return res.status(410).json({ message: "Esta invitación ha expirado" });
    }

    // 2) Documento moderno (documents/document_participants)
    const modernDocRes = await client.query(
      `
      SELECT
        id,
        title,
        status,
        requires_visado,
        sign_flow_type,
        company_id,
        numero_contrato_interno,
        final_file_url,
        pdf_final_url,
        hash_final_file,
        hash_sha256,
        final_hash_sha256,
        file_url,
        fecha_expiracion
      FROM public.documents
      WHERE
        company_id = $1
        AND numero_contrato_interno IS NOT DISTINCT FROM $2
      ORDER BY id DESC
      LIMIT 1
      `,
      [row.legacy_company_id, row.legacy_internal_number]
    );

    const modernDoc = modernDocRes.rowCount > 0 ? modernDocRes.rows[0] : null;

    let participant = null;
    let blockedBy = [];

    if (modernDoc) {
      const participantRes = await client.query(
        `
        SELECT
          id,
          document_id,
          role_in_doc,
          participant_type,
          status,
          signed_at,
          flow_order,
          flow_group,
          name,
          email,
          phone,
          requires_mfa,
          is_legal_representative,
          metadata
        FROM public.document_participants
        WHERE document_id = $1
          AND lower(email) = lower($2)
        ORDER BY flow_order ASC, id ASC
        LIMIT 1
        `,
        [modernDoc.id, row.signer_email]
      );

      participant =
        participantRes.rowCount > 0 ? participantRes.rows[0] : null;

      if (
        participant &&
        String(modernDoc.sign_flow_type || "").toUpperCase() === "SEQUENTIAL"
      ) {
        blockedBy = await getPendingPreviousParticipants(
          client,
          modernDoc.id,
          participant.flow_order
        );
      }
    }

    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);

    // 3) Actualizar estado legacy invited -> opened
    const fromStatus = row.signer_status;
    const toStatus =
      row.signer_status === "invited" ? "opened" : row.signer_status;

    if (fromStatus === "invited") {
      await client.query(
        `
        UPDATE public.signers
        SET status = 'opened', updated_at = now()
        WHERE id = $1
        `,
        [row.signer_id]
      );
    }

    // 4) Evento moderno (si hay documento moderno)
    if (modernDoc) {
      await createDocumentEvent(client, {
        documentId: modernDoc.id,
        participantId: participant?.id || null,
        actor: "PUBLIC_SIGNER",
        action: "INVITATION_OPENED",
        fromStatus,
        toStatus,
        eventType: "INVITATION_OPENED",
        details: "El firmante abrió el enlace público de firma.",
        metadata: {
          token,
          signerId: row.signer_id,
          invitationId: row.invitation_id,
          signerEmail: row.signer_email,
          sequentialBlocked: blockedBy.length > 0,
          blockedBy: blockedBy.map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email,
            role_in_doc: p.role_in_doc,
            flow_order: p.flow_order,
            status: p.status,
          })),
        },
        ipAddress,
        userAgent,
        hashDocument:
          modernDoc.final_hash_sha256 ||
          modernDoc.hash_final_file ||
          modernDoc.hash_sha256 ||
          row.legacy_hash_document ||
          null,
        companyId: modernDoc.company_id || row.legacy_company_id || null,
      });
    }

    await client.query("COMMIT");

    // 5) Normalizar documento devuelto
    const effectiveDocument = modernDoc
      ? {
          id: modernDoc.id,
          title: modernDoc.title,
          status: modernDoc.status,
          requires_visado: modernDoc.requires_visado,
          signFlowType: modernDoc.sign_flow_type,
          numero_contrato_interno: modernDoc.numero_contrato_interno,
          pdfUrl:
            modernDoc.final_file_url ||
            modernDoc.pdf_final_url ||
            modernDoc.file_url ||
            row.legacy_file_url ||
            null,
          expiresAt:
            modernDoc.fecha_expiracion || row.legacy_document_expires_at,
          hash:
            modernDoc.final_hash_sha256 ||
            modernDoc.hash_final_file ||
            modernDoc.hash_sha256 ||
            row.legacy_hash_document ||
            null,
        }
      : {
          id: row.legacy_document_id,
          title: row.legacy_document_title,
          status: row.legacy_document_status,
          signFlowType: row.legacy_document_flow_type,
          categoriaFirma: row.legacy_document_signature_category,
          numero_contrato_interno: row.legacy_internal_number,
          pdfUrl: row.legacy_file_url || null,
          expiresAt: row.legacy_document_expires_at,
          hash: row.legacy_hash_document || null,
        };

    return res.json({
      ok: true,
      document: effectiveDocument,
      signer: {
        id: row.signer_id,
        fullName: row.signer_full_name,
        email: row.signer_email,
        role: row.signer_role,
        status: toStatus,
        orderIndex: row.signer_order_index,
      },
      participant: participant
        ? {
            id: participant.id,
            roleInDoc: participant.role_in_doc,
            participantType: participant.participant_type,
            status: participant.status,
            signedAt: participant.signed_at,
            flowOrder: participant.flow_order,
            flowGroup: participant.flow_group,
            name: participant.name,
            email: participant.email,
            phone: participant.phone,
            requiresMfa: participant.requires_mfa,
            isLegalRepresentative: participant.is_legal_representative,
            metadata: participant.metadata || {},
          }
        : null,
      invitation: {
        id: row.invitation_id,
        token: row.invitation_token,
        expiresAt: row.invitation_expires_at,
        sentAt: row.invitation_sent_at,
      },
      flow: {
        mode:
          modernDoc?.sign_flow_type ||
          row.legacy_document_flow_type ||
          "SEQUENTIAL",
        canActNow: blockedBy.length === 0,
        blockedBy: blockedBy.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          roleInDoc: p.role_in_doc,
          status: p.status,
          flowOrder: p.flow_order,
        })),
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error en GET /public/docs/:token:", err);
    return res.status(500).json({ message: "Error interno" });
  } finally {
    client.release();
  }
});

module.exports = router;
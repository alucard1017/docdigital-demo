// backend/routes/publicDocs.js
const express = require("express");
const db = require("../db");
const publicDocumentsController = require("../controllers/documents/publicDocuments");

const router = express.Router();

/* ================================
   HELPERS GENERALES
   ================================ */

const NOT_FOUND_MESSAGE = "Enlace inválido o documento no encontrado";
const INVITATION_EXPIRED_MESSAGE = "Esta invitación ha expirado";
const LINK_EXPIRED_MESSAGE = "Este enlace ha expirado";
const INVALID_TOKEN_MESSAGE = "Token inválido";
const INTERNAL_ERROR_MESSAGE = "Error interno";

function getClientIp(req) {
  return (
    (req.headers["x-forwarded-for"] || "")
      .toString()
      .split(",")[0]
      .trim() ||
    req.socket?.remoteAddress ||
    null
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
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13, $14,
      now()
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

async function getPendingPreviousParticipants(client, documentId, flowOrderRaw) {
  const flowOrder = Number(flowOrderRaw);
  if (!Number.isFinite(flowOrder)) return [];

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
    [documentId, flowOrder]
  );

  return res.rows;
}

/* ================================
   GET /api/public/docs/:token
   Legacy (signer_invitations) + tokens modernos (document_signers.sign_token)
   ================================ */

router.get("/docs/:token", async (req, res) => {
  const { token } = req.params;

  if (!token || typeof token !== "string" || !token.trim()) {
    return res.status(400).json({ message: INVALID_TOKEN_MESSAGE });
  }

  const cleanToken = token.trim();
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);

    /* 1) Legacy (signer_invitations) */
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
      [cleanToken]
    );

    let legacyRow = null;
    let modernDoc = null;
    let participant = null;
    let blockedBy = [];
    let fromStatus = null;
    let toStatus = null;

    if (inviteRes.rowCount > 0) {
      /* ===== CASO LEGACY ===== */
      legacyRow = inviteRes.rows[0];

      if (isExpired(legacyRow.invitation_expires_at)) {
        await client.query("ROLLBACK");
        console.info(
          "[PUBLIC DOCS] /docs/:token → invitación expirada (legacy)",
          cleanToken
        );
        return res.status(410).json({ message: INVITATION_EXPIRED_MESSAGE });
      }

      // 2) Espejo moderno por company + numero_contrato_interno
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
        [legacyRow.legacy_company_id, legacyRow.legacy_internal_number]
      );

      modernDoc = modernDocRes.rowCount > 0 ? modernDocRes.rows[0] : null;

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
          [modernDoc.id, legacyRow.signer_email]
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

      fromStatus = legacyRow.signer_status;
      toStatus =
        legacyRow.signer_status === "invited"
          ? "opened"
          : legacyRow.signer_status;

      if (fromStatus === "invited") {
        await client.query(
          `
          UPDATE public.signers
          SET status = 'opened', updated_at = now()
          WHERE id = $1
          `,
          [legacyRow.signer_id]
        );
      }

      if (modernDoc) {
        const effectiveHash =
          modernDoc.final_hash_sha256 ||
          modernDoc.hash_final_file ||
          modernDoc.hash_sha256 ||
          legacyRow.legacy_hash_document ||
          null;

        await createDocumentEvent(client, {
          documentId: modernDoc.id,
          participantId: participant?.id || null,
          actor: "PUBLIC_SIGNER",
          action: "INVITATION_OPENED",
          fromStatus,
          toStatus,
          eventType: "INVITATION_OPENED",
          details: "El firmante abrió el enlace público de firma (legacy).",
          metadata: {
            token: cleanToken,
            signerId: legacyRow.signer_id,
            invitationId: legacyRow.invitation_id,
            signerEmail: legacyRow.signer_email,
            sequentialBlocked: blockedBy.length > 0,
            blockedBy: blockedBy.map((p) => ({
              id: p.id,
              name: p.name,
              email: p.email,
              role_in_doc: p.role_in_doc,
              flow_order: p.flow_order,
              status: p.status,
            })),
            source: "legacy",
          },
          ipAddress,
          userAgent,
          hashDocument: effectiveHash,
          companyId: modernDoc.company_id || legacyRow.legacy_company_id || null,
        });
      }

      await client.query("COMMIT");

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
              legacyRow.legacy_file_url ||
              null,
            expiresAt:
              modernDoc.fecha_expiracion ||
              legacyRow.legacy_document_expires_at,
            hash:
              modernDoc.final_hash_sha256 ||
              modernDoc.hash_final_file ||
              modernDoc.hash_sha256 ||
              legacyRow.legacy_hash_document ||
              null,
          }
        : {
            id: legacyRow.legacy_document_id,
            title: legacyRow.legacy_document_title,
            status: legacyRow.legacy_document_status,
            signFlowType: legacyRow.legacy_document_flow_type,
            categoriaFirma: legacyRow.legacy_document_signature_category,
            numero_contrato_interno: legacyRow.legacy_internal_number,
            pdfUrl: legacyRow.legacy_file_url || null,
            expiresAt: legacyRow.legacy_document_expires_at,
            hash: legacyRow.legacy_hash_document || null,
          };

      return res.json({
        ok: true,
        document: effectiveDocument,
        signer: {
          id: legacyRow.signer_id,
          fullName: legacyRow.signer_full_name,
          email: legacyRow.signer_email,
          role: legacyRow.signer_role,
          status: toStatus,
          orderIndex: legacyRow.signer_order_index,
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
          id: legacyRow.invitation_id,
          token: legacyRow.invitation_token,
          expiresAt: legacyRow.invitation_expires_at,
          sentAt: legacyRow.invitation_sent_at,
        },
        flow: {
          mode:
            modernDoc?.sign_flow_type ||
            legacyRow.legacy_document_flow_type ||
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
    }

    /* ===== CASO MODERNO (document_signers.sign_token) ===== */

    const modernSignerRes = await client.query(
      `
      SELECT
        ds.id                AS signer_id,
        ds.document_id       AS document_id,
        ds.name              AS signer_full_name,
        ds.email             AS signer_email,
        ds.role              AS signer_role,
        ds.status            AS signer_status,
        ds.flow_order        AS signer_order_index,
        ds.sign_token        AS sign_token,

        d.id                 AS modern_document_id,
        d.title              AS modern_document_title,
        d.status             AS modern_document_status,
        d.requires_visado    AS modern_requires_visado,
        d.sign_flow_type     AS modern_sign_flow_type,
        d.company_id         AS modern_company_id,
        d.numero_contrato_interno AS modern_internal_number,
        d.final_file_url     AS modern_final_file_url,
        d.pdf_final_url      AS modern_pdf_final_url,
        d.hash_final_file    AS modern_hash_final_file,
        d.hash_sha256        AS modern_hash_sha256,
        d.final_hash_sha256  AS modern_final_hash_sha256,
        d.file_url           AS modern_file_url,
        d.fecha_expiracion   AS modern_expires_at
      FROM public.document_signers ds
      JOIN public.documents d
        ON d.id = ds.document_id
      WHERE ds.sign_token = $1
      LIMIT 1
      `,
      [cleanToken]
    );

    if (modernSignerRes.rowCount === 0) {
      await client.query("ROLLBACK");
      console.warn(
        "[PUBLIC DOCS] /docs/:token → token no encontrado ni legacy ni moderno",
        cleanToken
      );
      return res.status(404).json({ message: NOT_FOUND_MESSAGE });
    }

    const mrow = modernSignerRes.rows[0];

    if (isExpired(mrow.modern_expires_at)) {
      await client.query("ROLLBACK");
      console.info(
        "[PUBLIC DOCS] /docs/:token → enlace moderno expirado",
        cleanToken
      );
      return res.status(410).json({ message: LINK_EXPIRED_MESSAGE });
    }

    const effectiveModernDoc = {
      id: mrow.modern_document_id,
      title: mrow.modern_document_title,
      status: mrow.modern_document_status,
      requires_visado: mrow.modern_requires_visado,
      signFlowType: mrow.modern_sign_flow_type,
      numero_contrato_interno: mrow.modern_internal_number,
      pdfUrl:
        mrow.modern_final_file_url ||
        mrow.modern_pdf_final_url ||
        mrow.modern_file_url ||
        null,
      expiresAt: mrow.modern_expires_at,
      hash:
        mrow.modern_final_hash_sha256 ||
        mrow.modern_hash_final_file ||
        mrow.modern_hash_sha256 ||
        null,
    };

    const modernParticipantRes = await client.query(
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
      [mrow.modern_document_id, mrow.signer_email]
    );

    const modernParticipant =
      modernParticipantRes.rowCount > 0
        ? modernParticipantRes.rows[0]
        : null;

    if (
      modernParticipant &&
      String(mrow.modern_sign_flow_type || "").toUpperCase() === "SEQUENTIAL"
    ) {
      blockedBy = await getPendingPreviousParticipants(
        client,
        mrow.modern_document_id,
        modernParticipant.flow_order
      );
    }

    fromStatus = mrow.signer_status;
    toStatus =
      mrow.signer_status === "INVITED" || mrow.signer_status === "invited"
        ? "OPENED"
        : mrow.signer_status;

    if (mrow.signer_status === "INVITED" || mrow.signer_status === "invited") {
      await client.query(
        `
        UPDATE public.document_signers
        SET status = 'OPENED', updated_at = now()
        WHERE id = $1
        `,
        [mrow.signer_id]
      );
    }

    const effectiveModernHash =
      mrow.modern_final_hash_sha256 ||
      mrow.modern_hash_final_file ||
      mrow.modern_hash_sha256 ||
      null;

    await createDocumentEvent(client, {
      documentId: mrow.modern_document_id,
      participantId: modernParticipant?.id || null,
      actor: "PUBLIC_SIGNER",
      action: "INVITATION_OPENED",
      fromStatus,
      toStatus,
      eventType: "INVITATION_OPENED",
      details: "El firmante abrió el enlace público de firma (moderno).",
      metadata: {
        token: cleanToken,
        signerId: mrow.signer_id,
        signerEmail: mrow.signer_email,
        signToken: mrow.sign_token,
        sequentialBlocked: blockedBy.length > 0,
        blockedBy: blockedBy.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email,
          role_in_doc: p.role_in_doc,
          flow_order: p.flow_order,
          status: p.status,
        })),
        source: "modern",
      },
      ipAddress,
      userAgent,
      hashDocument: effectiveModernHash,
      companyId: mrow.modern_company_id || null,
    });

    await client.query("COMMIT");

    return res.json({
      ok: true,
      document: effectiveModernDoc,
      signer: {
        id: mrow.signer_id,
        fullName: mrow.signer_full_name,
        email: mrow.signer_email,
        role: mrow.signer_role,
        status: toStatus,
        orderIndex: mrow.signer_order_index,
      },
      participant: modernParticipant
        ? {
            id: modernParticipant.id,
            roleInDoc: modernParticipant.role_in_doc,
            participantType: modernParticipant.participant_type,
            status: modernParticipant.status,
            signedAt: modernParticipant.signed_at,
            flowOrder: modernParticipant.flow_order,
            flowGroup: modernParticipant.flow_group,
            name: modernParticipant.name,
            email: modernParticipant.email,
            phone: modernParticipant.phone,
            requiresMfa: modernParticipant.requires_mfa,
            isLegalRepresentative: modernParticipant.is_legal_representative,
            metadata: modernParticipant.metadata || {},
          }
        : null,
      invitation: null,
      flow: {
        mode: mrow.modern_sign_flow_type || "SEQUENTIAL",
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
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback error
    }
    console.error("❌ Error en GET /api/public/docs/:token:", err);
    return res.status(500).json({ message: INTERNAL_ERROR_MESSAGE });
  } finally {
    client.release();
  }
});

/* ================================
   NUEVAS RUTAS PÚBLICAS MODERNAS
   (usando publicDocumentsController)
   ================================ */

// GET firma por sign_token (versión moderna simple)
router.get(
  "/docs2/:token",
  publicDocumentsController.getPublicDocBySignerToken
);

// GET visado / visualización por signature_token
router.get(
  "/docs/document/:token",
  publicDocumentsController.getPublicDocByDocumentToken
);

// POST firmar documento (sign_token)
router.post(
  "/docs/:token/firmar",
  publicDocumentsController.publicSignDocument
);

// POST rechazar documento (sign_token)
router.post(
  "/docs/:token/rechazar",
  publicDocumentsController.publicRejectDocument
);

// POST visar documento (signature_token)
router.post(
  "/docs/document/:token/visar",
  publicDocumentsController.publicVisarDocument
);

// Verificación por código
router.get("/verificar/:codigo", publicDocumentsController.verifyByCode);

module.exports = router;
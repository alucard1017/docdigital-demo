// backend/controllers/documents/publicDocuments.js
const db = require("../../db");
const { getSignedUrl } = require("../../services/storageR2");
const { sellarPdfConQr } = require("../../services/pdfSeal");
const { logAudit } = require("../../utils/auditLog");
const { formatDateSafe } = require("./documentEventUtils");
const {
  insertPublicEvent,
  insertPublicStatusChangedEvent,
} = require("./documentEventInserts");
const {
  validatePublicToken,
  validatePublicRejectReason,
  validatePublicAccess,
  validatePublicSign,
  validatePublicReject,
  validatePublicVisar,
} = require("./publicDocumentsValidations");

const NOT_FOUND_MESSAGE = "Enlace inválido o documento no encontrado";
const NO_FILE_MESSAGE = "Documento sin archivo asociado";
const EXPIRED_LINK_MESSAGE =
  "El enlace público ha expirado. Solicita uno nuevo al emisor.";

function buildDocumentFilePath(row) {
  return row?.pdf_final_url || row?.pdf_original_url || row?.file_path || null;
}

function buildPublicDocumentPayload(row, extra = {}) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    destinatario_nombre: row.destinatario_nombre,
    empresa_rut: row.empresa_rut,
    requires_visado: row.requires_visado,
    signature_status: row.signature_status,
    firmante_nombre: row.firmante_nombre,
    firmante_run: row.firmante_run,
    numero_contrato_interno: row.numero_contrato_interno,
    numero_contrato: row.numero_contrato || row.numero_contrato_interno || "",
    visador_nombre: row.visador_nombre || null,
    pdf_final_url: row.pdf_final_url || null,
    pdf_original_url: row.pdf_original_url || null,
    ...extra,
  };
}

async function buildSignedPdfUrlOrFail(row, res) {
  const basePath = buildDocumentFilePath(row);

  if (!basePath) {
    console.warn("[PUBLIC] documento sin archivo asociado", {
      documentId: row?.id,
    });
    res.status(404).json({ message: NO_FILE_MESSAGE });
    return null;
  }

  return getSignedUrl(basePath, 3600);
}

/**
 * SOLO lectura por token de documento (signature_token).
 * No usar para firmar/rechazar (se debe usar siempre sign_token).
 */
async function getDocumentAndSignerByDocumentToken(
  documentToken,
  emailFromQuery = null
) {
  const { rows } = await db.query(
    `
    SELECT
      d.*,
      s.id     AS signer_id,
      s.status AS signer_status,
      s.name   AS signer_name,
      s.email  AS signer_email
    FROM documents d
    LEFT JOIN document_signers s
      ON s.document_id = d.id
      AND ($2::text IS NULL OR s.email = $2)
    WHERE d.signature_token = $1
    LIMIT 1
    `,
    [documentToken, emailFromQuery]
  );

  return rows[0] || null;
}

/* ================================
   GET: Firma por sign_token
   /api/public/docs/:token
   ================================ */

async function getPublicDocBySignerToken(req, res) {
  const { token } = req.params;

  try {
    console.log("[PUBLIC] GET /api/public/docs/:token (sign_token)", { token });

    const tokenError = validatePublicToken(token);
    if (tokenError) {
      return res.status(tokenError.status).json(tokenError.body);
    }

    const { rows } = await db.query(
      `
      SELECT 
        d.*,
        d.destinatario_nombre,
        d.empresa_rut,
        d.requires_visado,
        d.signature_status,
        d.signature_token_expires_at,
        d.firmante_nombre,
        d.firmante_run,
        d.numero_contrato_interno,
        COALESCE(
          d.numero_contrato_interno,
          d.metadata->>'numero_contrato',
          d.metadata->>'numero_interno',
          d.metadata->>'contract_number',
          d.metadata->>'codigo_contrato'
        ) AS numero_contrato,
        s.id     AS signer_id,
        s.name   AS signer_name,
        s.email  AS signer_email,
        s.status AS signer_status,
        s.role   AS signer_role
      FROM document_signers s
      JOIN documents d ON d.id = s.document_id
      WHERE s.sign_token = $1
      `,
      [token]
    );

    if (!rows.length) {
      console.warn(
        "[PUBLIC] getPublicDocBySignerToken → sin resultados para sign_token",
        { token }
      );
      return res.status(404).json({ message: NOT_FOUND_MESSAGE });
    }

    const row = rows[0];

    const accessError = validatePublicAccess(row, EXPIRED_LINK_MESSAGE);
    if (accessError) {
      return res.status(accessError.status).json(accessError.body);
    }

    const pdfUrl = await buildSignedPdfUrlOrFail(row, res);
    if (!pdfUrl) return;

    try {
      await insertPublicEvent({
        req,
        doc: row,
        participantId: row.signer_id || null,
        actor: row.signer_name || row.signer_email || "Firmante externo",
        action: "PUBLIC_LINK_OPENED_SIGNER",
        details: "Apertura de enlace público de firma por firmante",
        fromStatus: row.status,
        toStatus: row.status,
        eventType: "PUBLIC_LINK_OPENED_SIGNER",
        extraMetadata: {
          actor_type: "PUBLIC_SIGNER",
          signer_id: row.signer_id,
          signer_email: row.signer_email,
          signer_name: row.signer_name,
          opened_at: formatDateSafe(new Date()),
          link_type: "signer_token",
        },
      });
    } catch (eventErr) {
      console.error(
        "⚠️ Error registrando PUBLIC_LINK_OPENED_SIGNER:",
        eventErr
      );
    }

    return res.json({
      document: buildPublicDocumentPayload(row),
      currentSigner: {
        id: row.signer_id,
        name: row.signer_name,
        email: row.signer_email,
        status: row.signer_status,
        role: row.signer_role || "FIRMANTE",
      },
      pdfUrl,
      file_url: pdfUrl,
      public_mode: "firma",
      public_token_kind: "signer",
    });
  } catch (err) {
    console.error("❌ Error cargando documento público (firmante):", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   GET: Visualización/visado por signature_token
   /api/public/docs/document/:token
   ================================ */

async function getPublicDocByDocumentToken(req, res) {
  const { token } = req.params;

  try {
    console.log(
      "[PUBLIC] GET /api/public/docs/document/:token (signature_token)",
      { token }
    );

    const tokenError = validatePublicToken(token);
    if (tokenError) {
      return res.status(tokenError.status).json(tokenError.body);
    }

    const { rows } = await db.query(
      `
      SELECT 
        d.*,
        d.destinatario_nombre,
        d.empresa_rut,
        d.requires_visado,
        d.signature_status,
        d.signature_token_expires_at,
        d.firmante_nombre,
        d.firmante_run,
        d.numero_contrato_interno,
        d.visador_nombre,
        COALESCE(
          d.numero_contrato_interno,
          d.metadata->>'numero_contrato',
          d.metadata->>'numero_interno',
          d.metadata->>'contract_number',
          d.metadata->>'codigo_contrato'
        ) AS numero_contrato
      FROM documents d
      WHERE d.signature_token = $1
      `,
      [token]
    );

    if (!rows.length) {
      console.warn(
        "[PUBLIC] getPublicDocByDocumentToken → sin resultados para signature_token",
        { token }
      );
      return res.status(404).json({ message: NOT_FOUND_MESSAGE });
    }

    const doc = rows[0];

    const accessError = validatePublicAccess(doc, EXPIRED_LINK_MESSAGE);
    if (accessError) {
      return res.status(accessError.status).json(accessError.body);
    }

    const pdfUrl = await buildSignedPdfUrlOrFail(doc, res);
    if (!pdfUrl) return;

    try {
      await insertPublicEvent({
        req,
        doc,
        participantId: null,
        actor: "PUBLIC_USER",
        action: "INVITATION_OPENED",
        details: "Apertura de invitación pública de documento",
        fromStatus: doc.status,
        toStatus: doc.status,
        eventType: "INVITATION_OPENED",
        extraMetadata: {
          actor_type: "PUBLIC_VIEWER",
          opened_at: formatDateSafe(new Date()),
          link_type: "document_token",
        },
      });
    } catch (eventErr) {
      console.error(
        "⚠️ Error registrando INVITATION_OPENED (document_events):",
        eventErr
      );
    }

    return res.json({
      document: buildPublicDocumentPayload(doc, { pdfUrl }),
      pdfUrl,
      file_url: pdfUrl,
      public_mode: "visado",
      public_token_kind: "document",
    });
  } catch (err) {
    console.error("❌ Error cargando documento público (document):", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   POST: Firmar documento (sign_token)
   /api/public/docs/:token/firmar
   ================================ */

async function publicSignDocument(req, res) {
  const { token } = req.params;

  try {
    console.log("[PUBLIC] POST /api/public/docs/:token/firmar", { token });

    const tokenError = validatePublicToken(token);
    if (tokenError) {
      return res.status(tokenError.status).json(tokenError.body);
    }

    const currentRes = await db.query(
      `
      SELECT 
        s.id     AS signer_id,
        s.status AS signer_status,
        s.name   AS signer_name,
        s.email  AS signer_email,
        s.role   AS signer_role,
        d.*,
        COALESCE(
          d.numero_contrato_interno,
          d.metadata->>'numero_contrato',
          d.metadata->>'numero_interno',
          d.metadata->>'contract_number',
          d.metadata->>'codigo_contrato'
        ) AS numero_contrato
      FROM document_signers s
      JOIN documents d ON d.id = s.document_id
      WHERE s.sign_token = $1
      `,
      [token]
    );

    if (!currentRes.rows.length) {
      console.warn(
        "[PUBLIC] publicSignDocument → sin resultados para sign_token",
        { token }
      );
      return res.status(404).json({ message: NOT_FOUND_MESSAGE });
    }

    const row = currentRes.rows[0];

    const validationError = validatePublicSign(row);
    if (validationError) {
      return res.status(validationError.status).json(validationError.body);
    }

    if (row.signer_role && row.signer_role.toUpperCase() === "VISADOR") {
      return res
        .status(400)
        .json({ message: "Este enlace corresponde a visado, no a firma" });
    }

    await db.query(
      `
      UPDATE document_signers
      SET status = 'FIRMADO',
          signed_at = NOW()
      WHERE id = $1
      `,
      [row.signer_id]
    );

    try {
      await db.query(
        `
        UPDATE document_participants
        SET status = 'FIRMADO',
            signed_at = NOW(),
            updated_at = NOW()
        WHERE document_id = $1
          AND email = $2
        `,
        [row.id, row.signer_email]
      );
    } catch (errDp) {
      console.error(
        "⚠️ Error actualizando document_participants (publicSignDocument):",
        errDp
      );
    }

    const countRes = await db.query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'FIRMADO') AS signed_count,
        COUNT(*) AS total_signers
      FROM document_signers
      WHERE document_id = $1
      `,
      [row.id]
    );

    const { signed_count, total_signers } = countRes.rows[0];
    const allSigned = Number(signed_count) >= Number(total_signers);

    let newDocStatus = row.status;
    let newSignatureStatus = row.signature_status;

    if (allSigned) {
      newDocStatus = "FIRMADO";
      newSignatureStatus = "FIRMADO";
    } else {
      newDocStatus = "PENDIENTE_FIRMA";
      newSignatureStatus = "PENDIENTE";
    }

    const docUpdateRes = await db.query(
      `
      UPDATE documents
      SET status = $1,
          signature_status = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *,
      COALESCE(
        numero_contrato_interno,
        metadata->>'numero_contrato',
        metadata->>'numero_interno',
        metadata->>'contract_number',
        metadata->>'codigo_contrato'
      ) AS numero_contrato
      `,
      [newDocStatus, newSignatureStatus, row.id]
    );
    const doc = docUpdateRes.rows[0];

    if (doc.nuevo_documento_id) {
      try {
        await db.query(
          `
          UPDATE documentos
          SET estado = $1,
              updated_at = NOW()
          WHERE id = $2
          `,
          [allSigned ? "FIRMADO" : "PENDIENTE_FIRMA", doc.nuevo_documento_id]
        );

        await db.query(
          `
          UPDATE firmantes
          SET estado = 'FIRMADO',
              fecha_firma = NOW(),
              tipo_firma = 'SIMPLE',
              updated_at = NOW()
          WHERE documento_id = $1
            AND email = $2
          `,
          [doc.nuevo_documento_id, row.signer_email]
        );
      } catch (syncErr) {
        console.error(
          "⚠️ Error sincronizando estado con tabla documentos:",
          syncErr
        );
      }
    }

    const fromStatus = row.status;
    const toStatus = newDocStatus;

    await insertPublicEvent({
      req,
      doc,
      participantId: row.signer_id || null,
      actor: row.signer_name || row.signer_email || "Firmante externo",
      action: "SIGNED_PUBLIC",
      details: allSigned
        ? "Documento firmado por todos los firmantes desde enlace público"
        : `Firma registrada para firmante ${row.signer_email}`,
      fromStatus,
      toStatus,
      eventType: "SIGNED_PUBLIC",
      extraMetadata: {
        actor_type: "PUBLIC_SIGNER",
        signer_id: row.signer_id,
        signer_email: row.signer_email,
        signer_name: row.signer_name,
        all_signed: allSigned,
      },
    });

    if (fromStatus !== toStatus) {
      try {
        await insertPublicStatusChangedEvent({
          req,
          doc,
          fromStatus,
          toStatus,
          details: "Cambio de estado por firma pública",
          extraMetadata: {
            reason: "all_signers_completed_public",
            signer_email: row.signer_email,
            signer_name: row.signer_name,
          },
        });
      } catch (eventErr) {
        console.error(
          "⚠️ Error registrando STATUS_CHANGED (publicSignDocument):",
          eventErr
        );
      }
    }

    await logAudit({
      user: null,
      action: "PUBLIC_SIGN",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        signer_email: row.signer_email,
        signer_name: row.signer_name,
        all_signed: allSigned,
        previous_status: fromStatus,
        new_status: toStatus,
        source: "public_link",
      },
      req,
    });

    if (allSigned && doc.nuevo_documento_id) {
      try {
        const docNuevoRes = await db.query(
          `
          SELECT id, codigo_verificacion, categoria_firma
          FROM documentos
          WHERE id = $1
          `,
          [doc.nuevo_documento_id]
        );

        if (docNuevoRes.rowCount > 0) {
          const docNuevo = docNuevoRes.rows[0];
          const baseKey = doc.pdf_original_url || doc.file_path;

          const sealResult = await sellarPdfConQr({
            s3Key: baseKey,
            documentoId: doc.id,
            codigoVerificacion: docNuevo.codigo_verificacion,
            categoriaFirma: docNuevo.categoria_firma || "SIMPLE",
            numeroContratoInterno: doc.numero_contrato_interno,
          });

          const updatedDocRes = await db.query(
            `
            SELECT
              pdf_final_url,
              final_storage_key,
              final_file_url
            FROM documents
            WHERE id = $1
            `,
            [doc.id]
          );

          if (updatedDocRes.rowCount > 0) {
            const updatedDoc = updatedDocRes.rows[0];
            doc.pdf_final_url =
              updatedDoc.pdf_final_url ||
              updatedDoc.final_storage_key ||
              updatedDoc.final_file_url ||
              sealResult?.finalKey ||
              null;
          }
        }
      } catch (sealError) {
        console.error(
          "⚠️ Error sellando PDF con QR (firma pública):",
          sealError
        );
      }
    }

    const fileUrl = buildDocumentFilePath(doc);

    return res.json({
      ...doc,
      numero_contrato_interno: doc.numero_contrato_interno,
      numero_contrato: doc.numero_contrato || doc.numero_contrato_interno,
      file_url: fileUrl,
      documentStatus: newDocStatus,
      public_mode: "firma",
      public_token_kind: "signer",
      message: allSigned
        ? "Documento firmado correctamente por todos los firmantes"
        : "Firma registrada. Aún faltan firmantes por completar la firma",
    });
  } catch (err) {
    console.error("❌ Error firmando documento público:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   POST: Rechazar documento (sign_token)
   /api/public/docs/:token/rechazar
   ================================ */

async function publicRejectDocument(req, res) {
  const { token } = req.params;
  const { motivo } = req.body || {};

  try {
    console.log("[PUBLIC] POST /api/public/docs/:token/rechazar", {
      token,
      motivo,
    });

    const tokenError = validatePublicToken(token);
    if (tokenError) {
      return res.status(tokenError.status).json(tokenError.body);
    }

    const reasonError = validatePublicRejectReason(motivo);
    if (reasonError) {
      return res.status(reasonError.status).json(reasonError.body);
    }

    const current = await db.query(
      `
      SELECT 
        s.id     AS signer_id,
        s.status AS signer_status,
        s.name   AS signer_name,
        s.email  AS signer_email,
        s.role   AS signer_role,
        d.*,
        COALESCE(
          d.numero_contrato_interno,
          d.metadata->>'numero_contrato',
          d.metadata->>'numero_interno',
          d.metadata->>'contract_number',
          d.metadata->>'codigo_contrato'
        ) AS numero_contrato
      FROM document_signers s
      JOIN documents d ON d.id = s.document_id
      WHERE s.sign_token = $1
      `,
      [token]
    );

    if (!current.rows.length) {
      console.warn(
        "[PUBLIC] publicRejectDocument → sin resultados para sign_token",
        { token }
      );
      return res.status(404).json({ message: NOT_FOUND_MESSAGE });
    }

    const row = current.rows[0];

    const validationError = validatePublicReject(row);
    if (validationError) {
      return res.status(validationError.status).json(validationError.body);
    }

    await db.query(
      `
      UPDATE document_signers
      SET status = 'RECHAZADO',
          rejected_at = NOW(),
          rejection_reason = $2
      WHERE id = $1
      `,
      [row.signer_id, motivo]
    );

    try {
      await db.query(
        `
        UPDATE document_participants
        SET status = 'RECHAZADO',
            updated_at = NOW()
        WHERE document_id = $1
          AND email = $2
        `,
        [row.id, row.signer_email]
      );
    } catch (errDp) {
      console.error(
        "⚠️ Error actualizando document_participants (publicRejectDocument):",
        errDp
      );
    }

    const docUpdateRes = await db.query(
      `
      UPDATE documents
      SET status = 'RECHAZADO',
          signature_status = 'RECHAZADO',
          reject_reason = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *,
      COALESCE(
        numero_contrato_interno,
        metadata->>'numero_contrato',
        metadata->>'numero_interno',
        metadata->>'contract_number',
        metadata->>'codigo_contrato'
      ) AS numero_contrato
      `,
      [row.id, motivo]
    );
    const doc = docUpdateRes.rows[0];

    if (doc.nuevo_documento_id) {
      try {
        await db.query(
          `
          UPDATE documentos
          SET estado = 'RECHAZADO',
              updated_at = NOW()
          WHERE id = $1
          `,
          [doc.nuevo_documento_id]
        );

        await db.query(
          `
          UPDATE firmantes
          SET estado = 'RECHAZADO',
              updated_at = NOW()
          WHERE documento_id = $1
            AND email = $2
          `,
          [doc.nuevo_documento_id, row.signer_email]
        );
      } catch (syncErr) {
        console.error(
          "⚠️ Error sincronizando rechazo con tabla documentos:",
          syncErr
        );
      }
    }

    const fromStatus = row.status;
    const toStatus = "RECHAZADO";

    await insertPublicEvent({
      req,
      doc,
      participantId: row.signer_id || null,
      actor: row.signer_name || row.signer_email || "Firmante externo",
      action: "REJECTED_PUBLIC",
      details: `Documento rechazado desde enlace público. Motivo: ${motivo}`,
      fromStatus,
      toStatus,
      eventType: "REJECTED_PUBLIC",
      extraMetadata: {
        actor_type: "PUBLIC_SIGNER",
        signer_id: row.signer_id,
        signer_email: row.signer_email,
        signer_name: row.signer_name,
        reason: motivo,
      },
    });

    try {
      await insertPublicStatusChangedEvent({
        req,
        doc,
        fromStatus,
        toStatus,
        details: "Cambio de estado por rechazo público",
        extraMetadata: {
          reason: "public_reject",
          signer_email: row.signer_email,
          signer_name: row.signer_name,
        },
      });
    } catch (eventErr) {
      console.error(
        "⚠️ Error registrando STATUS_CHANGED (publicRejectDocument):",
        eventErr
      );
    }

    await logAudit({
      user: null,
      action: "PUBLIC_REJECT",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        signer_email: row.signer_email,
        signer_name: row.signer_name,
        motivo,
        previous_status: fromStatus,
        new_status: toStatus,
        source: "public_link",
      },
      req,
    });

    const fileUrl = buildDocumentFilePath(doc);

    return res.json({
      ...doc,
      file_url: fileUrl,
      documentStatus: "RECHAZADO",
      public_mode: "firma",
      public_token_kind: "signer",
      message: "Documento rechazado correctamente",
    });
  } catch (err) {
    console.error("❌ Error rechazando documento público:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   POST: Visar documento (signature_token)
   /api/public/docs/document/:token/visar
   ================================ */

async function publicVisarDocument(req, res) {
  const { token } = req.params;

  try {
    console.log("[PUBLIC] POST /api/public/docs/document/:token/visar", {
      token,
    });

    const tokenError = validatePublicToken(token);
    if (tokenError) {
      return res.status(tokenError.status).json(tokenError.body);
    }

    const current = await db.query(
      `
      SELECT *,
      COALESCE(
        numero_contrato_interno,
        metadata->>'numero_contrato',
        metadata->>'numero_interno',
        metadata->>'contract_number',
        metadata->>'codigo_contrato'
      ) AS numero_contrato
      FROM documents
      WHERE signature_token = $1
      `,
      [token]
    );

    if (!current.rows.length) {
      console.warn(
        "[PUBLIC] publicVisarDocument → sin resultados para signature_token",
        { token }
      );
      return res.status(404).json({ message: NOT_FOUND_MESSAGE });
    }

    const docActual = current.rows[0];

    const validationError = validatePublicVisar(docActual);
    if (validationError) {
      return res.status(validationError.status).json(validationError.body);
    }

    const result = await db.query(
      `
      UPDATE documents
      SET status = $1,
          signature_status = COALESCE(signature_status, 'PENDIENTE'),
          updated_at = NOW()
      WHERE id = $2
      RETURNING *,
      COALESCE(
        numero_contrato_interno,
        metadata->>'numero_contrato',
        metadata->>'numero_interno',
        metadata->>'contract_number',
        metadata->>'codigo_contrato'
      ) AS numero_contrato
      `,
      ["PENDIENTE_FIRMA", docActual.id]
    );
    const doc = result.rows[0];

    const fromStatus = docActual.status;
    const toStatus = "PENDIENTE_FIRMA";

    await insertPublicEvent({
      req,
      doc,
      participantId: null,
      actor: doc.visador_nombre || "Visador externo",
      action: "VISADO_PUBLIC",
      details: "Documento visado desde enlace público",
      fromStatus,
      toStatus,
      eventType: "VISADO_PUBLIC",
      extraMetadata: {
        actor_type: "PUBLIC_VISADOR",
        visador_nombre: doc.visador_nombre || "Visador externo",
      },
    });

    try {
      await insertPublicStatusChangedEvent({
        req,
        doc,
        fromStatus,
        toStatus,
        details: "Cambio de estado por visado público",
        extraMetadata: {
          reason: "public_visado",
        },
      });
    } catch (eventErr) {
      console.error(
        "⚠️ Error registrando STATUS_CHANGED (publicVisarDocument):",
        eventErr
      );
    }

    await logAudit({
      user: null,
      action: "PUBLIC_VISADO",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        visador_nombre: doc.visador_nombre || "Visador externo",
        previous_status: fromStatus,
        new_status: toStatus,
        source: "public_link",
      },
      req,
    });

    const fileUrl = buildDocumentFilePath(doc);

    return res.json({
      ...doc,
      file_url: fileUrl,
      documentStatus: "PENDIENTE_FIRMA",
      public_mode: "visado",
      public_token_kind: "document",
      message: "Documento visado correctamente desde enlace público",
    });
  } catch (err) {
    console.error("❌ Error visando documento público:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   GET: Verificación por código
   /api/public/verificar/:codigo
   ================================ */

async function verifyByCode(req, res) {
  const { codigo } = req.params;

  try {
    console.log("[PUBLIC] GET /api/public/verificar/:codigo", { codigo });

    if (!codigo || typeof codigo !== "string") {
      return res
        .status(400)
        .json({ message: "Código de verificación inválido" });
    }

    const docResult = await db.query(
      `
      SELECT *
      FROM documentos
      WHERE codigo_verificacion = $1
      `,
      [codigo]
    );

    if (!docResult.rows.length) {
      console.warn("[PUBLIC] verifyByCode → sin resultados para codigo", {
        codigo,
      });
      return res
        .status(404)
        .json({ message: "Documento no encontrado para este código" });
    }

    const documento = docResult.rows[0];

    const signersResult = await db.query(
      `
      SELECT
        id,
        nombre,
        email,
        rut,
        rol,
        orden_firma,
        estado,
        fecha_firma,
        tipo_firma
      FROM firmantes
      WHERE documento_id = $1
      ORDER BY orden_firma ASC
      `,
      [documento.id]
    );

    const eventosResult = await db.query(
      `
      SELECT
        id,
        tipo_evento,
        ip,
        user_agent,
        metadata,
        created_at
      FROM eventos_firma
      WHERE documento_id = $1
      ORDER BY created_at ASC
      `,
      [documento.id]
    );

    let basePath =
      documento.pdf_final_url ||
      documento.pdf_original_url ||
      documento.archivo_url ||
      documento.file_path ||
      null;

    let relatedDocument = null;

    if (!basePath) {
      const modernDocRes = await db.query(
        `
        SELECT
          id,
          nuevo_documento_id,
          file_path,
          pdf_original_url,
          pdf_final_url,
          company_id,
          numero_contrato_interno,
          status,
          hash_final_file,
          pdf_hash_final,
          hash_original_file,
          metadata
        FROM documents
        WHERE nuevo_documento_id = $1
        ORDER BY id DESC
        LIMIT 1
        `,
        [documento.id]
      );

      if (modernDocRes.rowCount > 0) {
        relatedDocument = modernDocRes.rows[0];
        basePath =
          relatedDocument.pdf_final_url ||
          relatedDocument.pdf_original_url ||
          relatedDocument.file_path ||
          null;
      }
    }

    let pdfUrl = null;
    if (basePath) {
      try {
        pdfUrl = await getSignedUrl(basePath, 3600);
      } catch (urlErr) {
        console.error(
          "⚠️ Error generando signed URL en verifyByCode:",
          urlErr
        );
      }
    }

    const document = {
      id: documento.id,
      title: documento.titulo,
      status: documento.estado,
      tipo_tramite: documento.tipo,
      categoria_firma: documento.categoria_firma,
      hash_pdf: documento.hash_pdf,
      created_at: documento.created_at,
      updated_at: documento.updated_at,
      pdf_final_url:
        documento.pdf_final_url || relatedDocument?.pdf_final_url || null,
      pdf_url: pdfUrl,
    };

    const signers = signersResult.rows.map((s) => ({
      id: s.id,
      name: s.nombre,
      email: s.email,
      rut: s.rut,
      role: s.rol,
      order: s.orden_firma,
      status: s.estado,
      signed_at: s.fecha_firma,
      tipo_firma: s.tipo_firma,
    }));

    const events = eventosResult.rows.map((e) => ({
      id: e.id,
      event_type: e.tipo_evento,
      ip: e.ip,
      user_agent: e.user_agent,
      metadata: (() => {
        if (!e.metadata) return null;
        if (typeof e.metadata === "object") return e.metadata;
        try {
          return JSON.parse(e.metadata);
        } catch {
          return e.metadata;
        }
      })(),
      created_at: e.created_at,
      descripcion: e.tipo_evento,
    }));

    if (relatedDocument) {
      try {
        await insertPublicEvent({
          req,
          doc: relatedDocument,
          participantId: null,
          actor: "PUBLIC_VERIFY",
          action: "VERIFY_PUBLIC_CODE",
          details:
            "Verificación de documento mediante código de verificación público",
          fromStatus: relatedDocument.status || null,
          toStatus: relatedDocument.status || null,
          eventType: "VERIFY_PUBLIC_CODE",
          extraMetadata: {
            source: "public_verify",
            codigo_verificacion: codigo,
          },
        });
      } catch (eventErr) {
        console.error(
          "⚠️ Error registrando VERIFY_PUBLIC_CODE en document_events:",
          eventErr
        );
      }
    }

    return res.json({
      codigoVerificacion: documento.codigo_verificacion,
      document,
      signers,
      events,
    });
  } catch (err) {
    console.error("❌ Error en verificación por código:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

module.exports = {
  getDocumentAndSignerByDocumentToken,
  getPublicDocBySignerToken,
  getPublicDocByDocumentToken,
  publicSignDocument,
  publicRejectDocument,
  publicVisarDocument,
  verifyByCode,
};
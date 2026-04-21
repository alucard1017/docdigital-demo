// backend/controllers/documents/publicDocuments.js
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
  isTruthyVisado,
} = require("./publicDocumentsValidations");
const {
  buildSignedPdfUrlOrFail,
  buildSealSourceKey,
  buildFinalDocumentFilePath,
} = require("./publicDocumentFiles");
const {
  buildPublicDocumentPayload,
  buildCurrentSignerPayload,
  mapLegacySignerRow,
  mapLegacyEventRow,
} = require("./publicDocumentPayloads");
const {
  resolveParticipantIdForPublicEvent,
  getDocumentAndSignerByDocumentToken,
  getPublicSignerDocumentByToken,
  getPublicDocumentBySignatureToken,
  getPublicSignContextByToken,
  getPublicRejectContextByToken,
  getPublicVisadoContextByToken,
  markSignerAsSigned,
  markParticipantAsSigned,
  markSignerAsRejected,
  markParticipantAsRejected,
  countSigningProgress,
  updateDocumentStatuses,
  rejectDocument,
  updateDocumentToPendingFirma,
  syncLegacySigned,
  syncLegacyRejected,
  getLegacyDocumentByVerificationCode,
  getLegacySigners,
  getLegacySignatureEvents,
  getModernDocumentByLegacyId,
  refreshPdfFields,
} = require("./publicDocumentQueries");
const db = require("../../db");
const { getSignedUrl } = require("../../services/storageR2");

const NOT_FOUND_MESSAGE = "Enlace inválido o documento no encontrado";
const EXPIRED_LINK_MESSAGE =
  "El enlace público ha expirado. Solicita uno nuevo al emisor.";

/**
 * Resuelve datos de verificación (código y categoría) desde legacy + metadata.
 */
async function resolveVerificationData(doc) {
  let codigoVerificacion = null;
  let categoriaFirma = "SIMPLE";

  if (doc.nuevo_documento_id) {
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
      codigoVerificacion = docNuevo.codigo_verificacion || null;
      categoriaFirma = docNuevo.categoria_firma || "SIMPLE";
    }
  }

  if (!codigoVerificacion) {
    const meta = doc.metadata || {};
    codigoVerificacion =
      meta.codigo_verificacion ||
      meta.verification_code ||
      doc.signature_token ||
      `DOC-${doc.id}`;
  }

  return { codigoVerificacion, categoriaFirma };
}

/* ================================
   GET: Firma por sign_token
   ================================ */

async function getPublicDocBySignerToken(req, res) {
  const { token } = req.params;

  try {
    console.log("[PUBLIC] GET /api/public/docs/:token (sign_token)", { token });

    const tokenError = validatePublicToken(token);
    if (tokenError) {
      return res.status(tokenError.status).json(tokenError.body);
    }

    const row = await getPublicSignerDocumentByToken(token);

    if (!row) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: NOT_FOUND_MESSAGE,
      });
    }

    const accessError = validatePublicAccess(row, EXPIRED_LINK_MESSAGE);
    if (accessError) {
      return res.status(accessError.status).json(accessError.body);
    }

    const pdfUrl = await buildSignedPdfUrlOrFail(row, res, {
      mode: "preview",
    });
    if (!pdfUrl) return;

    try {
      const participantId =
        (await resolveParticipantIdForPublicEvent({
          documentId: row.id,
          email: row.signer_email,
          roleInDoc: row.signer_role,
        })) || null;

      await insertPublicEvent({
        req,
        doc: row,
        participantId,
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
      console.error("⚠️ Error registrando PUBLIC_LINK_OPENED_SIGNER:", eventErr);
    }

    return res.json({
      document: buildPublicDocumentPayload(row),
      currentSigner: buildCurrentSignerPayload(row),
      pdfUrl,
      file_url: pdfUrl,
      public_mode: "firma",
      public_token_kind: "signer",
    });
  } catch (err) {
    console.error("❌ Error cargando documento público (firmante):", err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
}

/* ================================
   GET: Visualización/visado por signature_token
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

    const doc = await getPublicDocumentBySignatureToken(token);

    if (!doc) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: NOT_FOUND_MESSAGE,
      });
    }

    const accessError = validatePublicAccess(doc, EXPIRED_LINK_MESSAGE);
    if (accessError) {
      return res.status(accessError.status).json(accessError.body);
    }

    const pdfUrl = await buildSignedPdfUrlOrFail(doc, res, {
      mode: "preview",
    });
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
      console.error("⚠️ Error registrando INVITATION_OPENED:", eventErr);
    }

    const requiresVisadoBool = isTruthyVisado(doc.requires_visado);

    return res.json({
      document: buildPublicDocumentPayload(doc, { pdfUrl }),
      pdfUrl,
      file_url: pdfUrl,
      public_mode: requiresVisadoBool ? "visado" : "firma",
      public_token_kind: "document",
    });
  } catch (err) {
    console.error("❌ Error cargando documento público (document):", err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
}

/* ================================
   POST: Firmar documento (sign_token)
   ================================ */

async function publicSignDocument(req, res) {
  const { token } = req.params;

  try {
    console.log("[PUBLIC] POST /api/public/docs/:token/firmar", { token });

    const tokenError = validatePublicToken(token);
    if (tokenError) {
      return res.status(tokenError.status).json(tokenError.body);
    }

    const row = await getPublicSignContextByToken(token);

    if (!row) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: NOT_FOUND_MESSAGE,
      });
    }

    const validationError = validatePublicSign(row);
    if (validationError) {
      return res.status(validationError.status).json(validationError.body);
    }

    if (row.signer_role && row.signer_role.toUpperCase() === "VISADOR") {
      return res.status(400).json({
        code: "WRONG_MODE",
        message: "Este enlace corresponde a visado, no a firma",
      });
    }

    await markSignerAsSigned(row.signer_id);

    try {
      await markParticipantAsSigned(row.id, row.signer_email);
    } catch (errDp) {
      console.error("⚠️ Error actualizando document_participants:", errDp);
    }

    const { signed_count, total_signers } = await countSigningProgress(row.id);

    const allSigned =
      Number(total_signers || 0) > 0 &&
      Number(signed_count) >= Number(total_signers);

    const newDocStatus = allSigned ? "FIRMADO" : "PENDIENTE_FIRMA";
    const newSignatureStatus = allSigned ? "FIRMADO" : "PENDIENTE";

    const doc = await updateDocumentStatuses(
      row.id,
      newDocStatus,
      newSignatureStatus
    );

    if (doc?.nuevo_documento_id) {
      try {
        await syncLegacySigned(
          doc.nuevo_documento_id,
          row.signer_email,
          allSigned
        );
      } catch (syncErr) {
        console.error("⚠️ Error sincronizando estado con legacy:", syncErr);
      }
    }

    const fromStatus = row.status;
    const toStatus = newDocStatus;

    const participantId =
      (await resolveParticipantIdForPublicEvent({
        documentId: doc.id,
        email: row.signer_email,
        roleInDoc: row.signer_role,
      })) || null;

    await insertPublicEvent({
      req,
      doc,
      participantId,
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
        console.error("⚠️ Error registrando STATUS_CHANGED:", eventErr);
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

    if (allSigned) {
      try {
        const { codigoVerificacion, categoriaFirma } =
          await resolveVerificationData(doc);

        const baseKey = buildSealSourceKey(doc);

        if (!baseKey) {
          console.warn(
            "[PUBLIC] publicSignDocument → sin fuente limpia para sellar PDF",
            { documentId: doc.id }
          );
        } else {
          await sellarPdfConQr({
            s3Key: baseKey,
            documentoId: doc.id,
            codigoVerificacion,
            categoriaFirma,
            numeroContratoInterno: doc.numero_contrato_interno,
          });

          await refreshPdfFields(doc.id, doc);
        }
      } catch (sealError) {
        console.error("⚠️ Error sellando PDF con QR:", sealError);
      }
    }

    const fileUrl = await buildSignedPdfUrlOrFail(doc, res, {
      mode: allSigned ? "final" : "preview",
    });
    if (!fileUrl) return;

    return res.json({
      ...doc,
      numero_contrato_interno: doc.numero_contrato_interno,
      numero_contrato: doc.numero_contrato || doc.numero_contrato_interno,
      file_url: fileUrl,
      pdfUrl: fileUrl,
      documentStatus: newDocStatus,
      public_mode: "firma",
      public_token_kind: "signer",
      message: allSigned
        ? "Documento firmado correctamente por todos los firmantes"
        : "Firma registrada. Aún faltan firmantes por completar la firma",
    });
  } catch (err) {
    console.error("❌ Error firmando documento público:", err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
}

/* ================================
   POST: Rechazar documento (sign_token)
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

    const row = await getPublicRejectContextByToken(token);

    if (!row) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: NOT_FOUND_MESSAGE,
      });
    }

    const validationError = validatePublicReject(row);
    if (validationError) {
      return res.status(validationError.status).json(validationError.body);
    }

    await markSignerAsRejected(row.signer_id, motivo);

    try {
      await markParticipantAsRejected(row.id, row.signer_email);
    } catch (errDp) {
      console.error("⚠️ Error actualizando document_participants:", errDp);
    }

    const doc = await rejectDocument(row.id, motivo);

    if (doc?.nuevo_documento_id) {
      try {
        await syncLegacyRejected(doc.nuevo_documento_id, row.signer_email);
      } catch (syncErr) {
        console.error("⚠️ Error sincronizando rechazo con legacy:", syncErr);
      }
    }

    const fromStatus = row.status;
    const toStatus = "RECHAZADO";

    const participantId =
      (await resolveParticipantIdForPublicEvent({
        documentId: doc.id,
        email: row.signer_email,
        roleInDoc: row.signer_role,
      })) || null;

    await insertPublicEvent({
      req,
      doc,
      participantId,
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
      console.error("⚠️ Error registrando STATUS_CHANGED:", eventErr);
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

    const fileUrl = await buildSignedPdfUrlOrFail(doc, res, {
      mode: "preview",
    });
    if (!fileUrl) return;

    return res.json({
      ...doc,
      file_url: fileUrl,
      pdfUrl: fileUrl,
      documentStatus: "RECHAZADO",
      public_mode: "firma",
      public_token_kind: "signer",
      message: "Documento rechazado correctamente",
    });
  } catch (err) {
    console.error("❌ Error rechazando documento público:", err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
}

/* ================================
   POST: Visar documento (signature_token)
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

    const docActual = await getPublicVisadoContextByToken(token);

    if (!docActual) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: NOT_FOUND_MESSAGE,
      });
    }

    const validationError = validatePublicVisar(docActual);
    if (validationError) {
      return res.status(validationError.status).json(validationError.body);
    }

    const doc = await updateDocumentToPendingFirma(docActual.id);

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
      console.error("⚠️ Error registrando STATUS_CHANGED:", eventErr);
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

    const fileUrl = await buildSignedPdfUrlOrFail(doc, res, {
      mode: "preview",
    });
    if (!fileUrl) return;

    return res.json({
      ...doc,
      file_url: fileUrl,
      pdfUrl: fileUrl,
      documentStatus: "PENDIENTE_FIRMA",
      public_mode: "visado",
      public_token_kind: "document",
      message: "Documento visado correctamente desde enlace público",
    });
  } catch (err) {
    console.error("❌ Error visando documento público:", err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
}

/* ================================
   GET: Verificación por código
   ================================ */

async function verifyByCode(req, res) {
  const { codigo } = req.params;

  try {
    console.log("[PUBLIC] GET /api/public/verificar/:codigo", { codigo });

    if (!codigo || typeof codigo !== "string") {
      return res.status(400).json({
        code: "INVALID_CODE",
        message: "Código de verificación inválido",
      });
    }

    const documento = await getLegacyDocumentByVerificationCode(codigo);

    if (!documento) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Documento no encontrado para este código",
      });
    }

    const signersRows = await getLegacySigners(documento.id);
    const eventRows = await getLegacySignatureEvents(documento.id);

    let basePath =
      documento.pdf_final_url ||
      documento.pdf_original_url ||
      documento.archivo_url ||
      documento.file_path ||
      null;

    let relatedDocument = null;

    if (!basePath) {
      relatedDocument = await getModernDocumentByLegacyId(documento.id);

      if (relatedDocument) {
        basePath = buildFinalDocumentFilePath(relatedDocument);
      }
    }

    let pdfUrl = null;
    if (basePath) {
      try {
        pdfUrl = await getSignedUrl(basePath, 3600);
      } catch (urlErr) {
        console.error("⚠️ Error generando signed URL en verifyByCode:", urlErr);
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

    const signers = signersRows.map(mapLegacySignerRow);
    const events = eventRows.map(mapLegacyEventRow);

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
        console.error("⚠️ Error registrando VERIFY_PUBLIC_CODE:", eventErr);
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
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
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
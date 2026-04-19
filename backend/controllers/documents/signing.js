// backend/controllers/documents/signing.js
const { db, sellarPdfConQr, DOCUMENT_STATES } = require("./common");
const { logAudit } = require("../../utils/auditLog");
const {
  insertOwnerEvent,
  insertOwnerStatusChangedEvent,
} = require("./documentEventInserts");
const {
  validateSign,
  validateVisar,
  validateReject,
} = require("./signingValidations");

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
};

/* ================================
   POST: Firmar documento (propietario)
   ================================ */

async function signDocument(req, res) {
  try {
    const id = parseId(req.params.id);
    const userId = req.user.id;

    if (id === null) {
      return res.status(400).json({
        code: "INVALID_ID",
        message: "ID de documento inválido",
      });
    }

    const current = await db.query(
      `
      SELECT *
      FROM documents
      WHERE id = $1 AND owner_id = $2
      `,
      [id, userId]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Documento no encontrado",
      });
    }

    const docActual = current.rows[0];

    const validationError = validateSign(docActual);
    if (validationError) {
      return res.status(validationError.status).json(validationError.body);
    }

    const updateRes = await db.query(
      `
      UPDATE documents
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2 AND owner_id = $3
      RETURNING *
      `,
      [DOCUMENT_STATES.SIGNED, id, userId]
    );

    const doc = updateRes.rows[0];

    const fromStatus = docActual.status;
    const toStatus = DOCUMENT_STATES.SIGNED;
    const eventType = "SIGNED_OWNER";

    await insertOwnerEvent({
      req,
      doc,
      fromStatus,
      toStatus,
      eventType,
      action: "DOCUMENT_SIGNED_OWNER",
      details:
        "Firmado por propietario (aceptó aviso legal de uso de firma electrónica simple, con equivalencia a firma manuscrita conforme a la Ley N° 19.799).",
      extraMetadata: {
        actor_type: "OWNER",
      },
    });

    if (fromStatus !== toStatus) {
      try {
        await insertOwnerStatusChangedEvent({
          req,
          doc,
          fromStatus,
          toStatus,
          details: "Cambio de estado por firma de propietario",
          extraMetadata: {
            reason: "owner_signed",
          },
        });
      } catch (eventErr) {
        console.error(
          "⚠️ Error registrando STATUS_CHANGED (signDocument):",
          eventErr
        );
      }
    }

    await logAudit({
      user: req.user,
      action: "DOCUMENT_SIGNED_OWNER",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        from_status: fromStatus,
        to_status: toStatus,
        source: "owner",
      },
      req,
    });

    // === Sellar PDF con QR siempre que tengamos sourceKey ===
    try {
      const sourceKey = doc.pdf_original_url || doc.file_path;

      if (!sourceKey) {
        console.warn(
          "[signDocument] Documento sin pdf_original_url ni file_path. No se puede sellar.",
          { documentId: doc.id }
        );
      } else {
        // Si existe documento legacy, recuperamos datos de verificación; si no, usamos metadata actual.
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
            codigoVerificacion = docNuevo.codigo_verificacion;
            categoriaFirma = docNuevo.categoria_firma || "SIMPLE";
          }
        }

        // Fallback: si no hay documento legado, intenta usar metadata del propio documents
        if (!codigoVerificacion) {
          const meta = doc.metadata || {};
          codigoVerificacion =
            meta.codigo_verificacion ||
            meta.verification_code ||
            doc.signature_token ||
            `DOC-${doc.id}`;
        }

        await sellarPdfConQr({
          s3Key: sourceKey,
          // IMPORTANTE: usamos el id de documents, que es donde se actualiza pdf_final_url
          documentoId: doc.id,
          codigoVerificacion,
          categoriaFirma,
          numeroContratoInterno: doc.numero_contrato_interno,
        });

        // Recargar campos finales después del sellado
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
          const finalRow = updatedDocRes.rows[0];
          doc.pdf_final_url =
            finalRow.pdf_final_url ||
            finalRow.final_file_url ||
            finalRow.final_storage_key ||
            doc.pdf_final_url;
        }
      }
    } catch (sealError) {
      console.error("⚠️ Error sellando PDF con QR (signDocument):", sealError);
    }

    const fileUrl = doc.pdf_final_url || doc.file_path;

    return res.json({
      ...doc,
      file_url: fileUrl,
      message: "Documento firmado exitosamente",
    });
  } catch (err) {
    console.error("❌ Error firmando documento:", err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
}

/* ================================
   VISADO interno (propietario)
   ================================ */

async function viserDocumentInternalUpdate(id, userId, req = null) {
  const numericId = parseId(id);

  if (numericId === null) {
    return {
      error: {
        status: 400,
        body: { code: "INVALID_ID", message: "ID de documento inválido" },
      },
    };
  }

  const current = await db.query(
    `
    SELECT *
    FROM documents
    WHERE id = $1 AND owner_id = $2
    `,
    [numericId, userId]
  );

  if (current.rowCount === 0) {
    return {
      error: {
        status: 404,
        body: { code: "NOT_FOUND", message: "Documento no encontrado" },
      },
    };
  }

  const docActual = current.rows[0];

  const validationError = validateVisar(docActual);
  if (validationError) {
    return { error: validationError };
  }

  const result = await db.query(
    `
    UPDATE documents
    SET status = $1,
        updated_at = NOW()
    WHERE id = $2 AND owner_id = $3
    RETURNING *
    `,
    ["PENDIENTE_FIRMA", numericId, userId]
  );

  const doc = result.rows[0];

  const fromStatus = docActual.status;
  const toStatus = "PENDIENTE_FIRMA";

  await insertOwnerEvent({
    req,
    doc,
    fromStatus,
    toStatus,
    eventType: "VISADO_OWNER",
    action: "DOCUMENT_VISADO_OWNER",
    details: "Documento visado por el propietario",
    extraMetadata: {
      actor_type: "OWNER",
    },
  });

  if (fromStatus !== toStatus) {
    try {
      await insertOwnerStatusChangedEvent({
        req,
        doc,
        fromStatus,
        toStatus,
        details: "Cambio de estado por visado de propietario",
        extraMetadata: {
          reason: "owner_visado",
        },
      });
    } catch (eventErr) {
      console.error(
        "⚠️ Error registrando STATUS_CHANGED (viserDocumentInternalUpdate):",
        eventErr
      );
    }
  }

  return { doc, docActual };
}

async function visarDocument(req, res) {
  try {
    const id = req.params.id;
    const userId = req.user.id;

    const result = await viserDocumentInternalUpdate(id, userId, req);
    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }

    const { doc, docActual } = result;

    await logAudit({
      user: req.user,
      action: "DOCUMENT_VISADO_OWNER",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        from_status: docActual.status,
        to_status: "PENDIENTE_FIRMA",
        source: "owner",
      },
      req,
    });

    const fileUrl = doc.pdf_final_url || doc.file_path;

    return res.json({
      ...doc,
      file_url: fileUrl,
      message: "Documento visado exitosamente",
    });
  } catch (err) {
    console.error("❌ Error visado documento:", err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
}

/* ================================
   Rechazar documento (propietario)
   ================================ */

async function rejectDocument(req, res) {
  try {
    const id = parseId(req.params.id);
    const { motivo } = req.body || {};
    const userId = req.user.id;

    if (id === null) {
      return res.status(400).json({
        code: "INVALID_ID",
        message: "ID de documento inválido",
      });
    }

    if (!motivo || !motivo.trim()) {
      return res.status(400).json({
        code: "MISSING_REASON",
        message: "Debes indicar un motivo de rechazo.",
      });
    }

    const current = await db.query(
      `
      SELECT *
      FROM documents
      WHERE id = $1 AND owner_id = $2
      `,
      [id, userId]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Documento no encontrado",
      });
    }

    const docActual = current.rows[0];

    const validationError = validateReject(docActual);
    if (validationError) {
      return res.status(validationError.status).json(validationError.body);
    }

    const rejectReason = motivo.trim();

    const result = await db.query(
      `
      UPDATE documents
      SET status = $1,
          reject_reason = $2,
          updated_at = NOW()
      WHERE id = $3 AND owner_id = $4
      RETURNING *
      `,
      [DOCUMENT_STATES.REJECTED, rejectReason, id, userId]
    );

    const doc = result.rows[0];

    const fromStatus = docActual.status;
    const toStatus = DOCUMENT_STATES.REJECTED;

    await insertOwnerEvent({
      req,
      doc,
      fromStatus,
      toStatus,
      eventType: "REJECTED_OWNER",
      action: "DOCUMENT_REJECTED_OWNER",
      details: "Documento rechazado por el propietario",
      extraMetadata: {
        actor_type: "OWNER",
        reason: rejectReason,
      },
    });

    try {
      await insertOwnerStatusChangedEvent({
        req,
        doc,
        fromStatus,
        toStatus,
        details: "Cambio de estado por rechazo de propietario",
        extraMetadata: {
          reason: "owner_rejected",
        },
      });
    } catch (eventErr) {
      console.error(
        "⚠️ Error registrando STATUS_CHANGED (rejectDocument):",
        eventErr
      );
    }

    await logAudit({
      user: req.user,
      action: "DOCUMENT_REJECTED_OWNER",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        motivo: rejectReason,
        from_status: fromStatus,
        to_status: toStatus,
        source: "owner",
      },
      req,
    });

    const fileUrl = doc.pdf_final_url || doc.file_path;

    return res.json({
      ...doc,
      file_url: fileUrl,
      message: "Documento rechazado exitosamente",
    });
  } catch (err) {
    console.error("❌ Error rechazando documento:", err);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
}

module.exports = {
  signDocument,
  viserDocumentInternalUpdate,
  visarDocument,
  rejectDocument,
};
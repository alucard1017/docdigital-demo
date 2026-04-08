// backend/controllers/documents/signing.js

const { db, sellarPdfConQr, DOCUMENT_STATES } = require("./common");
const { logAudit } = require("../../utils/auditLog");
const { insertOwnerEvent } = require("./documentEventInserts");
const {
  validateSign,
  validateVisar,
  validateReject,
} = require("./signingValidations");

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
};

async function signDocument(req, res) {
  try {
    const id = parseId(req.params.id);
    const userId = req.user.id;

    if (id === null) {
      return res.status(400).json({ message: "ID de documento inválido" });
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
      return res.status(404).json({ message: "No encontrado" });
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
    });

    await logAudit({
      user: req.user,
      action: "document_signed",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        from_status: fromStatus,
        to_status: toStatus,
      },
      req,
    });

    try {
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
          const sourceKey = doc.pdf_original_url || doc.file_path;

          if (sourceKey) {
            await sellarPdfConQr({
              s3Key: sourceKey,
              documentoId: docNuevo.id,
              codigoVerificacion: docNuevo.codigo_verificacion,
              categoriaFirma: docNuevo.categoria_firma || "SIMPLE",
              numeroContratoInterno: doc.numero_contrato_interno,
            });

            const updatedDocRes = await db.query(
              `
              SELECT pdf_final_url
              FROM documents
              WHERE id = $1
              `,
              [doc.id]
            );

            if (updatedDocRes.rowCount > 0) {
              doc.pdf_final_url = updatedDocRes.rows[0].pdf_final_url;
            }
          }
        }
      }
    } catch (sealError) {
      console.error("⚠️ Error sellando PDF con QR:", sealError);
    }

    return res.json({
      ...doc,
      file_url: doc.pdf_final_url || doc.file_path,
      message: "Documento firmado exitosamente",
    });
  } catch (err) {
    console.error("❌ Error firmando documento:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

async function viserDocumentInternalUpdate(id, userId, req = null) {
  const numericId = parseId(id);

  if (numericId === null) {
    return {
      error: { status: 400, body: { message: "ID de documento inválido" } },
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
    return { error: { status: 404, body: { message: "No encontrado" } } };
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

  await insertOwnerEvent({
    req,
    doc,
    fromStatus: docActual.status,
    toStatus: "PENDIENTE_FIRMA",
    eventType: "VISADO_OWNER",
    action: "DOCUMENT_VISADO_OWNER",
    details: "Documento visado por el propietario",
  });

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
      action: "document_visado",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        from_status: docActual.status,
        to_status: "PENDIENTE_FIRMA",
      },
      req,
    });

    return res.json({
      ...doc,
      file_url: doc.pdf_final_url || doc.file_path,
      message: "Documento visado exitosamente",
    });
  } catch (err) {
    console.error("❌ Error visado documento:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

async function rejectDocument(req, res) {
  try {
    const id = parseId(req.params.id);
    const { motivo } = req.body || {};
    const userId = req.user.id;

    if (id === null) {
      return res.status(400).json({ message: "ID de documento inválido" });
    }

    if (!motivo || !motivo.trim()) {
      return res
        .status(400)
        .json({ message: "Debes indicar un motivo de rechazo." });
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
      return res.status(404).json({ message: "No encontrado" });
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

    await insertOwnerEvent({
      req,
      doc,
      fromStatus: docActual.status,
      toStatus: DOCUMENT_STATES.REJECTED,
      eventType: "REJECTED_OWNER",
      action: "DOCUMENT_REJECTED_OWNER",
      details: "Documento rechazado",
      extraMetadata: { reason: rejectReason },
    });

    await logAudit({
      user: req.user,
      action: "document_rejected",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        motivo: rejectReason,
        from_status: docActual.status,
        to_status: DOCUMENT_STATES.REJECTED,
      },
      req,
    });

    return res.json({
      ...doc,
      file_url: doc.pdf_final_url || doc.file_path,
      message: "Documento rechazado exitosamente",
    });
  } catch (err) {
    console.error("❌ Error rechazando documento:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

module.exports = {
  signDocument,
  viserDocumentInternalUpdate,
  visarDocument,
  rejectDocument,
};
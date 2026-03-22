// backend/controllers/documents/signing.js
const { db, sellarPdfConQr, DOCUMENT_STATES } = require("./common");
const { logAudit } = require("../../utils/auditLog");

/* ================================
   POST: Firmar documento (propietario)
   ================================ */
async function signDocument(req, res) {
  try {
    const id = req.params.id;

    const current = await db.query(
      `SELECT * 
       FROM documents 
       WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: "No encontrado" });
    }

    const docActual = current.rows[0];

    if (docActual.status === DOCUMENT_STATES.SIGNED) {
      return res.status(400).json({ message: "Ya firmado" });
    }

    if (docActual.status === DOCUMENT_STATES.REJECTED) {
      return res.status(400).json({ message: "Documento rechazado" });
    }

    if (
      docActual.requires_visado === true &&
      docActual.status === "PENDIENTE_VISADO"
    ) {
      return res.status(400).json({
        message: "Este documento requiere visación antes de firmar",
      });
    }

    const result = await db.query(
      `UPDATE documents 
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2 AND owner_id = $3
       RETURNING *`,
      [DOCUMENT_STATES.SIGNED, id, req.user.id]
    );
    const doc = result.rows[0];

    await db.query(
      `INSERT INTO document_events (
         document_id, actor, action, details, from_status, to_status
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        doc.id,
        req.user.name || "Sistema",
        "FIRMADO",
        "Firmado por propietario (aceptó aviso legal de uso de firma electrónica simple, con equivalencia a firma manuscrita conforme a la Ley N° 19.799).",
        docActual.status,
        DOCUMENT_STATES.SIGNED,
      ]
    );

    await logAudit({
      user: req.user,
      action: "document_signed",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        from_status: docActual.status,
        to_status: DOCUMENT_STATES.SIGNED,
      },
      req,
    });

    // Sellar PDF con QR / código y guardar ruta firmada en pdf_final_url
    try {
      if (doc.nuevo_documento_id) {
        const docNuevoRes = await db.query(
          `SELECT id, codigo_verificacion, categoria_firma
           FROM documentos
           WHERE id = $1`,
          [doc.nuevo_documento_id]
        );

        if (docNuevoRes.rowCount > 0) {
          const docNuevo = docNuevoRes.rows[0];

          const sourceKey = doc.pdf_original_url || doc.file_path;
          if (sourceKey) {
            const newKey = await sellarPdfConQr({
              s3Key: sourceKey,
              documentoId: docNuevo.id,
              codigoVerificacion: docNuevo.codigo_verificacion,
              categoriaFirma: docNuevo.categoria_firma || "SIMPLE",
              numeroContratoInterno: doc.numero_contrato_interno,
            });

            await db.query(
              `UPDATE documents
               SET pdf_final_url = $1
               WHERE id = $2`,
              [newKey, doc.id]
            );

            doc.pdf_final_url = newKey;
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

/* ================================
   POST: Visar documento (propietario)
   ================================ */
async function viserDocumentInternalUpdate(id, userId) {
  const current = await db.query(
    `SELECT * 
     FROM documents 
     WHERE id = $1 AND owner_id = $2`,
    [id, userId]
  );

  if (current.rowCount === 0) {
    return { error: { status: 404, body: { message: "No encontrado" } } };
  }

  const docActual = current.rows[0];

  if (docActual.status === DOCUMENT_STATES.SIGNED) {
    return { error: { status: 400, body: { message: "Ya firmado" } } };
  }

  if (docActual.status === DOCUMENT_STATES.REJECTED) {
    return {
      error: { status: 400, body: { message: "Documento rechazado" } },
    };
  }

  if (docActual.requires_visado !== true) {
    return {
      error: {
        status: 400,
        body: { message: "Este documento no requiere visación" },
      },
    };
  }

  if (docActual.status !== "PENDIENTE_VISADO") {
    return {
      error: {
        status: 400,
        body: {
          message:
            "Solo se pueden visar documentos en estado PENDIENTE_VISADO",
        },
      },
    };
  }

  const result = await db.query(
    `UPDATE documents 
     SET status = $1, updated_at = NOW() 
     WHERE id = $2 AND owner_id = $3 
     RETURNING *`,
    ["PENDIENTE_FIRMA", id, userId]
  );
  const doc = result.rows[0];

  await db.query(
    `INSERT INTO document_events (
       document_id, actor, action, details, from_status, to_status
     ) 
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      doc.id,
      "Sistema",
      "VISADO",
      "Documento visado por el propietario",
      docActual.status,
      "PENDIENTE_FIRMA",
    ]
  );

  return { doc, docActual };
}

async function visarDocument(req, res) {
  try {
    const id = req.params.id;

    const result = await viserDocumentInternalUpdate(id, req.user.id);
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
      file_url: doc.file_path,
      message: "Documento visado exitosamente",
    });
  } catch (err) {
    console.error("❌ Error visando documento:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
 * POST: Rechazar documento (propietario)
 * ================================ */
async function rejectDocument(req, res) {
  try {
    const id = req.params.id;
    const { motivo } = req.body;

    const current = await db.query(
      `SELECT * 
       FROM documents 
       WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: "No encontrado" });
    }

    const docActual = current.rows[0];

    if (docActual.status === DOCUMENT_STATES.SIGNED) {
      return res.status(400).json({
        message: "Ya firmado, no se puede rechazar",
      });
    }

    if (docActual.status === DOCUMENT_STATES.REJECTED) {
      return res.status(400).json({ message: "Ya rechazado" });
    }

    const result = await db.query(
      `UPDATE documents 
       SET status = $1, reject_reason = $2, updated_at = NOW()
       WHERE id = $3 AND owner_id = $4 
       RETURNING *`,
      [DOCUMENT_STATES.REJECTED, motivo || "Sin especificar", id, req.user.id]
    );

    const doc = result.rows[0];

    await db.query(
      `INSERT INTO document_events (
         document_id, actor, action, details, from_status, to_status
       ) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        doc.id,
        req.user.name || "Sistema",
        "RECHAZADO",
        `Documento rechazado: ${motivo || "Sin especificar"}`,
        docActual.status,
        DOCUMENT_STATES.REJECTED,
      ]
    );

    await logAudit({
      user: req.user,
      action: "document_rejected",
      entityType: "document",
      entityId: doc.id,
      metadata: { motivo: motivo || "Sin especificar" },
      req,
    });

    return res.json({
      ...doc,
      file_url: doc.file_path,
      message: "Documento rechazado exitosamente",
    });
  } catch (err) {
    console.error("❌ Error rechazando documento:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

module.exports = {
  signDocument,
  visarDocument,
  rejectDocument,
  viserDocumentInternalUpdate,
};

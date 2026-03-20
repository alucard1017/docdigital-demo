// backend/controllers/documents/signing.js
const { db, sellarPdfConQr } = require("./common");
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

    if (docActual.status === "FIRMADO") {
      return res.status(400).json({ message: "Ya firmado" });
    }

    if (docActual.status === "RECHAZADO") {
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

    // 1) Actualizar estado a FIRMADO
    const result = await db.query(
      `UPDATE documents 
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND owner_id = $3
       RETURNING *`,
      ["FIRMADO", id, req.user.id]
    );
    const doc = result.rows[0];

    // 2) Registrar evento
    await db.query(
      `INSERT INTO document_events (
         document_id, actor, action, details, from_status, to_status
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        doc.id,
        req.user.name || "Sistema",
        "FIRMADO",
        "Firmado por propietario",
        docActual.status,
        "FIRMADO",
      ]
    );

    await logAudit({
      user: req.user,
      action: "document_signed",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        from_status: docActual.status,
        to_status: "FIRMADO",
      },
      req,
    });

    // 3) Sellar PDF con QR / código y guardar ruta firmada
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

            // Guardamos la ruta del PDF final firmado/sellado
            await db.query(
              `UPDATE documents
               SET pdf_final_url = $1,
                   signed_file_path = $1
               WHERE id = $2`,
              [newKey, doc.id]
            );

            doc.pdf_final_url = newKey;
            doc.signed_file_path = newKey;
          }
        }
      }
    } catch (sealError) {
      console.error("⚠️ Error sellando PDF con QR:", sealError);
    }

    return res.json({
      ...doc,
      file_url: doc.signed_file_path || doc.pdf_final_url || doc.file_path,
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
async function visarDocument(req, res) {
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

    if (docActual.status === "FIRMADO") {
      return res.status(400).json({ message: "Ya firmado" });
    }

    if (docActual.status === "RECHAZADO") {
      return res.status(400).json({ message: "Documento rechazado" });
    }

    if (docActual.requires_visado !== true) {
      return res.status(400).json({
        message: "Este documento no requiere visación",
      });
    }

    if (docActual.status !== "PENDIENTE_VISADO") {
      return res.status(400).json({
        message: "Solo se pueden visar documentos en estado PENDIENTE_VISADO",
      });
    }

    const result = await db.query(
      `UPDATE documents 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 AND owner_id = $3 
       RETURNING *`,
      ["PENDIENTE_FIRMA", id, req.user.id]
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
        "VISADO",
        "Documento visado por el propietario",
        docActual.status,
        "PENDIENTE_FIRMA",
      ]
    );

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

    if (docActual.status === "FIRMADO") {
      return res.status(400).json({
        message: "Ya firmado, no se puede rechazar",
      });
    }

    if (docActual.status === "RECHAZADO") {
      return res.status(400).json({ message: "Ya rechazado" });
    }

    const result = await db.query(
      `UPDATE documents 
       SET status = $1, reject_reason = $2, updated_at = NOW()
       WHERE id = $3 AND owner_id = $4 
       RETURNING *`,
      ["RECHAZADO", motivo || "Sin especificar", id, req.user.id]
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
        "RECHAZADO",
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
};

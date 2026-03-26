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

    // Sellar PDF con QR / código y dejar que pdfSeal.js actualice pdf_final_url y pdf_hash_final
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
            await sellarPdfConQr({
              s3Key: sourceKey,
              documentoId: docNuevo.id,
              codigoVerificacion: docNuevo.codigo_verificacion,
              categoriaFirma: docNuevo.categoria_firma || "SIMPLE",
              numeroContratoInterno: doc.numero_contrato_interno,
            });

            // No actualizar pdf_final_url aquí: ya lo hace pdfSeal.js.
            // Si quieres devolver el valor actualizado, recarga el documento.
            const updatedDocRes = await db.query(
              `SELECT pdf_final_url 
               FROM documents 
               WHERE id = $1`,
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

    // Notificar al creador por email
    const creadorRes = await db.query(
      `SELECT u.email, u.name
       FROM users u
       WHERE u.id = $1`,
      [doc.owner_id]
    );

    if (creadorRes.rowCount > 0) {
      const creador = creadorRes.rows[0];
      const { sendNotification } = require("../../services/emailService");

      const subject = `❌ Documento rechazado: ${doc.title}`;
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #b91c1c;">❌ Documento Rechazado</h2>
          <p>Hola <strong>${creador.name}</strong>,</p>
          <p>El documento <strong>${doc.title}</strong> ha sido rechazado.</p>
          <div style="background: #fef2f2; padding: 16px; border-radius: 8px; border-left: 4px solid #b91c1c; margin: 16px 0;">
            <strong>Motivo del rechazo:</strong><br/>
            ${motivo || "Sin especificar"}
          </div>
          <p>Por favor, revisa el motivo y toma las acciones necesarias.</p>
          <a href="${process.env.FRONTEND_URL}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;margin-top:16px;">
            Ver en VeriFirma
          </a>
        </div>
      `;

      sendNotification(creador.email, subject, html).catch((err) =>
        console.error("Error enviando notificación de rechazo:", err)
      );
    }

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
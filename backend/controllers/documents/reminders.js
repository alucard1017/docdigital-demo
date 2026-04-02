// backend/controllers/documents/reminders.js
const {
  db,
  sendSigningInvitation,
  sendVisadoInvitation,
  isActiveDocumentStatus,
} = require("./common");
const { logAudit } = require("../../utils/auditLog");

const SIGNING_PORTAL_URL =
  process.env.SIGNING_PORTAL_URL || "https://firmar.verifirma.cl";

const REVIEW_PORTAL_URL =
  process.env.REVIEW_PORTAL_URL || "https://firmar.verifirma.cl";

function buildPublicSignUrl(token) {
  return `${SIGNING_PORTAL_URL}/?token=${token}`;
}

function buildVisadoUrl(token) {
  return `${REVIEW_PORTAL_URL}/?token=${token}&mode=visado`;
}

/* ================================
   POST: Reenviar recordatorio manual
   ================================ */
async function resendReminder(req, res) {
  try {
    const { id } = req.params;
    const { tipo, signerId } = req.body; // 'VISADO' | 'FIRMA'

    if (!tipo) {
      return res
        .status(400)
        .json({ message: "El campo 'tipo' es obligatorio" });
    }

    const docRes = await db.query(
      `SELECT *
       FROM documents
       WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );
    if (docRes.rowCount === 0) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }
    const doc = docRes.rows[0];

    if (!isActiveDocumentStatus(doc.status)) {
      return res.status(400).json({
        message:
          "Solo se pueden enviar recordatorios para documentos en proceso (ENVIADO/EN_REVISION/EN_FIRMA)",
      });
    }

    if (tipo === "VISADO") {
      if (!doc.requires_visado || !doc.visador_email) {
        return res.status(400).json({
          message: "Este documento no tiene visador configurado",
        });
      }

      const url = buildVisadoUrl(doc.signature_token);

      await sendVisadoInvitation(
        doc.visador_email,
        doc.title,
        url,
        doc.visador_nombre || ""
      );

      await db.query(
        `INSERT INTO document_events (
           document_id, actor, action, details, from_status, to_status
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          doc.id,
          req.user.name || "Sistema",
          "REENVIO_VISADO",
          "Recordatorio enviado al visador",
          doc.status,
          doc.status,
        ]
      );

      await logAudit({
        user: req.user,
        action: "document_reminder_visado_resent",
        entityType: "document",
        entityId: doc.id,
        metadata: {
          tipo: "VISADO",
          visador_email: doc.visador_email,
          status: doc.status,
        },
        req,
      });

      return res.json({ message: "Recordatorio de visado reenviado" });
    }

    if (tipo === "FIRMA") {
      if (!signerId) {
        return res
          .status(400)
          .json({ message: "El campo 'signerId' es obligatorio" });
      }

      const signerRes = await db.query(
        `SELECT *
         FROM document_signers
         WHERE id = $1 AND document_id = $2`,
        [signerId, id]
      );
      if (signerRes.rowCount === 0) {
        return res.status(404).json({ message: "Firmante no encontrado" });
      }
      const signer = signerRes.rows[0];

      if (["FIRMADO", "RECHAZADO"].includes(signer.status)) {
        return res.status(400).json({
          message: "No se pueden enviar recordatorios a firmantes ya cerrados",
        });
      }

      const url = buildPublicSignUrl(signer.sign_token);

      await sendSigningInvitation(
        signer.email,
        doc.title,
        url,
        signer.name || ""
      );

      await db.query(
        `INSERT INTO document_events (
           document_id, actor, action, details, from_status, to_status
         )
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          doc.id,
          req.user.name || "Sistema",
          "REENVIO_FIRMA",
          `Recordatorio de firma reenviado a ${signer.email}`,
          doc.status,
          doc.status,
        ]
      );

      await logAudit({
        user: req.user,
        action: "document_reminder_signer_resent",
        entityType: "document",
        entityId: doc.id,
        metadata: {
          tipo: "FIRMA",
          signer_id: signer.id,
          signer_email: signer.email,
          status: doc.status,
        },
        req,
      });

      return res.json({ message: "Recordatorio de firma reenviado" });
    }

    return res.status(400).json({ message: "Tipo de reenvío inválido" });
  } catch (err) {
    console.error("❌ Error reenviando invitación:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   POST: Enviar recordatorios automáticos
   (ej. job diario; intervalos configurables a futuro)
   ================================ */
async function sendAutomaticReminders(req, res) {
  try {
    const userId = req.user.id;

    const docsRes = await db.query(
      `SELECT d.id,
              d.title,
              d.status,
              d.requires_visado,
              d.visador_email,
              d.signature_token
       FROM documents d
       WHERE d.owner_id = $1
         AND d.status IN ('PENDIENTE_VISADO', 'PENDIENTE_FIRMA')
         AND d.created_at < NOW() - INTERVAL '7 days'
         AND (
           d.last_reminder_sent_at IS NULL
           OR d.last_reminder_sent_at < NOW() - INTERVAL '7 days'
         )`,
      [userId]
    );

    const docs = docsRes.rows;
    let remindersCount = 0;

    for (const doc of docs) {
      try {
        if (doc.requires_visado && doc.status === "PENDIENTE_VISADO") {
          if (doc.visador_email) {
            const urlVisado = buildVisadoUrl(doc.signature_token);

            await sendVisadoInvitation(
              doc.visador_email,
              doc.title,
              urlVisado,
              "Visador"
            );

            remindersCount++;

            await db.query(
              `UPDATE documents
               SET last_reminder_sent_at = NOW()
               WHERE id = $1`,
              [doc.id]
            );
          }
        }

        if (doc.status === "PENDIENTE_FIRMA") {
          const signersRes = await db.query(
            `SELECT *
             FROM document_signers
             WHERE document_id = $1
               AND status NOT IN ('FIRMADO', 'RECHAZADO')`,
            [doc.id]
          );

          for (const signer of signersRes.rows) {
            try {
              const urlFirma = buildPublicSignUrl(signer.sign_token);

              await sendSigningInvitation(
                signer.email,
                doc.title,
                urlFirma,
                signer.name || ""
              );

              remindersCount++;
            } catch (emailErr) {
              console.error(
                `⚠️ Error enviando recordatorio a ${signer.email}:`,
                emailErr.message
              );
            }
          }

          await db.query(
            `UPDATE documents
             SET last_reminder_sent_at = NOW()
             WHERE id = $1`,
            [doc.id]
          );
        }
      } catch (docErr) {
        console.error(
          `⚠️ Error procesando documento ${doc.id}:`,
          docErr.message
        );
      }
    }

    if (docs.length > 0) {
      await db.query(
        `INSERT INTO document_events (
           document_id, actor, action, details, from_status, to_status
         )
         SELECT 
           id, 'Sistema', 'RECORDATORIOS_AUTOMATICOS',
           $1, status, status
         FROM documents
         WHERE id = ANY($2::int[])`,
        [
          `${remindersCount} recordatorio(s) enviado(s)`,
          docs.map((d) => d.id),
        ]
      );
    }

    await logAudit({
      user: req.user,
      action: "document_automatic_reminders_sent",
      entityType: "document",
      entityId: null,
      metadata: {
        owner_id: userId,
        documentsProcessed: docs.length,
        remindersSent: remindersCount,
      },
      req,
    });

    return res.json({
      message: `${remindersCount} recordatorio(s) automático(s) enviado(s)`,
      documentsProcessed: docs.length,
    });
  } catch (err) {
    console.error("❌ Error enviando recordatorios automáticos:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

module.exports = {
  resendReminder,
  sendAutomaticReminders,
};

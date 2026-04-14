// backend/services/reminderService.js
const db = require("../db");
const {
  sendSigningInvitation,
  sendVisadoInvitation,
} = require("./emailService");

const SIGNING_PORTAL_URL =
  process.env.SIGNING_PORTAL_URL || "https://firmar.verifirma.cl";

const REVIEW_PORTAL_URL =
  process.env.REVIEW_PORTAL_URL || "https://firmar.verifirma.cl";

function buildFirmaUrl(token) {
  return `${SIGNING_PORTAL_URL}/?token=${encodeURIComponent(token)}`;
}

function buildVisadoUrl(token) {
  return `${REVIEW_PORTAL_URL}/?token=${encodeURIComponent(
    token
  )}&mode=visado`;
}

function getReminderStepFromAgeHours(ageHours) {
  if (ageHours >= 48) return 3;
  if (ageHours >= 24) return 2;
  if (ageHours >= 12) return 1;
  return 0;
}

async function getDocumentById(documentoId) {
  const docRes = await db.query(
    `
    SELECT *
    FROM documents
    WHERE id = $1
    `,
    [documentoId]
  );

  if (docRes.rowCount === 0) {
    throw new Error("Documento no encontrado");
  }

  return docRes.rows[0];
}

async function getPendingSigners(documentoId) {
  const signersRes = await db.query(
    `
    SELECT id, email, name, status, sign_token
    FROM document_signers
    WHERE document_id = $1
      AND COALESCE(status, '') NOT IN ('FIRMADO', 'SIGNED', 'COMPLETED', 'RECHAZADO')
    `,
    [documentoId]
  );

  return signersRes.rows;
}

async function alreadySentAutoReminderStep(documentoId, step) {
  const res = await db.query(
    `
    SELECT 1
    FROM document_events
    WHERE document_id = $1
      AND action = $2
    LIMIT 1
    `,
    [documentoId, `RECORDATORIO_AUTO_${step}`]
  );

  return res.rowCount > 0;
}

async function registrarEventoRecordatorio({
  documentoId,
  action,
  details,
  fromStatus,
  toStatus,
}) {
  await db.query(
    `
    INSERT INTO document_events (
      document_id,
      actor,
      action,
      details,
      from_status,
      to_status
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [documentoId, "Sistema", action, details, fromStatus, toStatus]
  );
}

/* ================================
   RECORDATORIO MANUAL
   ================================ */

async function enviarRecordatorioManual(documentoId) {
  try {
    const doc = await getDocumentById(documentoId);
    const reminders = [];

    // Visado manual por signature_token
    if (
      doc.requires_visado === true &&
      doc.status === "PENDIENTE_VISADO" &&
      doc.visador_email &&
      doc.signature_token
    ) {
      const urlVisado = buildVisadoUrl(doc.signature_token);

      await sendVisadoInvitation(
        doc.visador_email,
        doc.title,
        urlVisado,
        doc.visador_nombre || "Visador"
      );

      reminders.push({
        tipo: "VISADO",
        email: doc.visador_email,
        nombre: doc.visador_nombre || "Visador",
      });

      console.log(
        `✅ Recordatorio manual de VISADO enviado a ${doc.visador_email}`
      );
    }

    // Firma manual por sign_token de cada firmante pendiente
    if (doc.status === "PENDIENTE_FIRMA") {
      const signers = await getPendingSigners(documentoId);

      for (const signer of signers) {
        if (!signer.email) continue;

        if (!signer.sign_token) {
          console.warn(
            `⚠️ Firmante ${signer.id} sin sign_token en documento ${documentoId}`
          );
          continue;
        }

        const urlFirma = buildFirmaUrl(signer.sign_token);

        await sendSigningInvitation(
          signer.email,
          doc.title,
          urlFirma,
          signer.name || "Firmante"
        );

        reminders.push({
          tipo: "FIRMA",
          email: signer.email,
          nombre: signer.name || "Firmante",
        });

        console.log(
          `✅ Recordatorio manual de FIRMA enviado a ${signer.email}`
        );
      }
    }

    await registrarEventoRecordatorio({
      documentoId,
      action: "RECORDATORIO_MANUAL",
      details: `Recordatorio manual enviado a ${reminders.length} destinatario(s)`,
      fromStatus: doc.status,
      toStatus: doc.status,
    });

    return {
      success: true,
      reminders,
      message: `Recordatorio(s) enviado(s) a ${reminders.length} destinatario(s)`,
    };
  } catch (err) {
    console.error("❌ Error enviando recordatorio manual:", err);
    throw err;
  }
}

/* ================================
   RECORDATORIO AUTOMÁTICO POR DOCUMENTO
   ================================ */

async function enviarRecordatorioAutomaticoDocumento(doc, step) {
  const reminders = [];

  // Visado automático por signature_token
  if (
    doc.requires_visado === true &&
    doc.status === "PENDIENTE_VISADO" &&
    doc.visador_email &&
    doc.signature_token
  ) {
    const urlVisado = buildVisadoUrl(doc.signature_token);

    await sendVisadoInvitation(
      doc.visador_email,
      doc.title,
      urlVisado,
      doc.visador_nombre || "Visador"
    );

    reminders.push({
      tipo: "VISADO",
      email: doc.visador_email,
      nombre: doc.visador_nombre || "Visador",
    });

    console.log(
      `✅ Recordatorio automático #${step} de VISADO enviado a ${doc.visador_email}`
    );
  }

  // Firma automática por sign_token
  if (doc.status === "PENDIENTE_FIRMA") {
    const signers = await getPendingSigners(doc.id);

    for (const signer of signers) {
      if (!signer.email) continue;

      if (!signer.sign_token) {
        console.warn(
          `⚠️ Firmante ${signer.id} sin sign_token en documento ${doc.id}`
        );
        continue;
      }

      const urlFirma = buildFirmaUrl(signer.sign_token);

      await sendSigningInvitation(
        signer.email,
        doc.title,
        urlFirma,
        signer.name || "Firmante"
      );

      reminders.push({
        tipo: "FIRMA",
        email: signer.email,
        nombre: signer.name || "Firmante",
      });

      console.log(
        `✅ Recordatorio automático #${step} de FIRMA enviado a ${signer.email}`
      );
    }
  }

  await registrarEventoRecordatorio({
    documentoId: doc.id,
    action: `RECORDATORIO_AUTO_${step}`,
    details: `Recordatorio automático #${step} enviado a ${reminders.length} destinatario(s)`,
    fromStatus: doc.status,
    toStatus: doc.status,
  });

  return reminders;
}

/**
 * Política automática:
 * - recordatorio 1: a las 12h
 * - recordatorio 2: a las 24h
 * - recordatorio 3: a las 48h
 * - después no se envían más
 */
async function enviarRecordatoriosAutomaticos() {
  try {
    console.log("🔔 Iniciando envío de recordatorios automáticos...");

    const docsRes = await db.query(
      `
      SELECT
        d.id,
        d.title,
        d.status,
        d.created_at,
        d.updated_at,
        d.requires_visado,
        d.visador_email,
        d.visador_nombre,
        d.signature_token
      FROM documents d
      WHERE d.status IN ('PENDIENTE_VISADO', 'PENDIENTE_FIRMA')
      LIMIT 200
      `
    );

    const docs = docsRes.rows;
    console.log(`📬 Documentos candidatos a recordatorio: ${docs.length}`);

    let procesados = 0;
    let enviados = 0;
    let omitidos = 0;
    let conError = 0;

    for (const doc of docs) {
      try {
        const baseDate = doc.updated_at || doc.created_at;
        if (!baseDate) {
          omitidos++;
          continue;
        }

        const ageHours =
          (Date.now() - new Date(baseDate).getTime()) / (1000 * 60 * 60);

        const step = getReminderStepFromAgeHours(ageHours);

        if (!step) {
          omitidos++;
          continue;
        }

        const alreadySent = await alreadySentAutoReminderStep(doc.id, step);
        if (alreadySent) {
          omitidos++;
          continue;
        }

        const reminders = await enviarRecordatorioAutomaticoDocumento(doc, step);

        procesados++;
        enviados += reminders.length;
      } catch (err) {
        conError++;
        console.error(
          `⚠️ Error enviando recordatorio automático del documento ${doc.id}: ${err.message}`
        );
      }
    }

    console.log(
      `✅ Recordatorios automáticos completados | docs procesados=${procesados}, destinatarios=${enviados}, omitidos=${omitidos}, errores=${conError}`
    );

    return {
      success: true,
      processedDocuments: procesados,
      remindersSent: enviados,
      skipped: omitidos,
      errors: conError,
    };
  } catch (err) {
    console.error("❌ Error en recordatorios automáticos:", err);
    throw err;
  }
}

module.exports = {
  enviarRecordatorioManual,
  enviarRecordatoriosAutomaticos,
};
// backend/services/sendFinalDocumentEmails.js
const db = require("../db");
const { getSignedUrl } = require("./storageR2");
const {
  sendEmail,
  PUBLIC_VERIFY_BASE_URL,
  DASHBOARD_BASE_URL,
  baseStyles,
} = require("./emailService");
const { DOCUMENT_EVENT_TYPES } = require("../controllers/documents/documentEventTypes");
const { insertDocumentEvent } = require("../controllers/documents/documentEventInserts");
const { getDocumentHash } = require("../controllers/documents/documentEventUtils");

console.log("📬 [EMAIL] Cargando sendFinalDocumentEmails.js");

async function buildFinalPdfUrl(docRow) {
  const basePath =
    docRow.pdf_final_url ||
    docRow.file_path ||
    docRow.pdf_original_url ||
    null;

  if (!basePath) return null;

  try {
    // 30 días de validez (en segundos)
    return await getSignedUrl(basePath, 30 * 24 * 3600);
  } catch (err) {
    console.error("❌ [FINAL_EMAIL] Error generando signed URL PDF final:", err);
    return null;
  }
}

/**
 * Envía correo de "Documento firmado" al owner y a los participantes.
 *
 * @param {object} params
 * @param {number} params.documentId
 * @param {boolean} [params.force=false]
 * @returns {Promise<boolean>}
 */
async function sendFinalDocumentEmails({ documentId, force = false }) {
  if (!documentId) {
    console.error(
      "❌ [FINAL_EMAIL] documentId requerido en sendFinalDocumentEmails"
    );
    return false;
  }

  try {
    const docResult = await db.query(
      `
      SELECT 
        d.id,
        d.title,
        d.status,
        d.pdf_final_url,
        d.pdf_original_url,
        d.file_path,
        d.verification_code AS codigo_verificacion,
        d.owner_id,
        d.company_id,
        d.created_at,
        d.updated_at,
        d.final_email_sent_at,
        d.final_email_recipients,
        u.email AS owner_email,
        u.name AS owner_name
      FROM documents d
      LEFT JOIN users u ON u.id = d.owner_id
      WHERE d.id = $1
      LIMIT 1
      `,
      [documentId]
    );

    if (docResult.rows.length === 0) {
      console.warn(
        "[FINAL_EMAIL] Documento no encontrado, no se envía correo final",
        { documentId }
      );
      return false;
    }

    const doc = docResult.rows[0];

    if (doc.status !== "FIRMADO") {
      console.log(
        "[FINAL_EMAIL] Documento no está FIRMADO, se omite envío final",
        { documentId, status: doc.status }
      );
      return false;
    }

    if (!force && doc.final_email_sent_at) {
      console.log(
        "[FINAL_EMAIL] final_email_sent_at ya existe, se omite reenvío (usar force para forzar).",
        { documentId, final_email_sent_at: doc.final_email_sent_at }
      );
      return false;
    }

    const participantsResult = await db.query(
      `
      SELECT 
        id,
        email,
        name,
        role_in_doc
      FROM document_participants
      WHERE document_id = $1
        AND email IS NOT NULL
      ORDER BY id ASC
      `,
      [documentId]
    );

    const participants = participantsResult.rows || [];
    const pdfUrl = await buildFinalPdfUrl(doc);

    const recipientsMap = new Map();

    if (doc.owner_email) {
      recipientsMap.set(doc.owner_email.toLowerCase(), {
        email: doc.owner_email,
        name: doc.owner_name || "",
        kind: "OWNER",
      });
    }

    for (const p of participants) {
      const email = String(p.email || "").trim();
      if (!email) continue;

      const key = email.toLowerCase();
      if (!recipientsMap.has(key)) {
        recipientsMap.set(key, {
          email,
          name: p.name || "",
          kind: p.role_in_doc || "PARTICIPANT",
        });
      }
    }

    const recipients = Array.from(recipientsMap.values());

    if (recipients.length === 0) {
      console.warn(
        "[FINAL_EMAIL] No hay destinatarios (owner ni participantes).",
        { documentId }
      );
      return false;
    }

    const subject = `Documento firmado: ${doc.title || "Documento"}`.slice(
      0,
      255
    );

    const baseInfoHtml = `
      <div class="doc-title">${doc.title || "Documento"}</div>
      <div class="info-box">
        <h4>📄 Detalles del documento</h4>
        <ul class="details-list">
          <li><strong>Estado:</strong> ${doc.status}</li>
          <li><strong>Creado:</strong> ${new Date(
            doc.created_at
          ).toLocaleString("es-CL")}</li>
          <li><strong>Última actualización:</strong> ${new Date(
            doc.updated_at
          ).toLocaleString("es-CL")}</li>
          ${
            doc.codigo_verificacion
              ? `<li><strong>Código de verificación:</strong> <span class="verify-code">${doc.codigo_verificacion}</span></li>`
              : ""
          }
        </ul>
      </div>
    `;

    const buttonHtml = pdfUrl
      ? `
      <div style="text-align: center; margin-top: 12px;">
        <a href="${pdfUrl}" class="button">Ver / Descargar documento firmado</a>
        <p class="meta">Puedes guardar este PDF como respaldo para tus registros.</p>
      </div>
    `
      : `
      <div class="info-box warning">
        <h4>⚠️ Documento firmado</h4>
        <p>
          El documento se ha firmado correctamente, pero no se pudo generar el enlace
          directo al PDF final en este momento. Si necesitas una copia, contacta al emisor.
        </p>
      </div>
    `;

    let enviados = 0;
    const resultados = [];

    for (const r of recipients) {
      const safeName = r.name ? `<strong>${r.name}</strong>` : "Hola";

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>${baseStyles}</style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="badge">VeriFirma</div>
                <h2 class="title">Documento firmado correctamente</h2>
                <p class="subtitle">Copia final para tus registros</p>
              </div>

              <div class="content">
                <p>${safeName},</p>
                <p>
                  Te informamos que el proceso de firma electrónica del siguiente 
                  documento ha finalizado y se encuentra <strong>completamente firmado</strong> 
                  por todas las partes correspondientes.
                </p>

                ${baseInfoHtml}

                ${buttonHtml}

                ${
                  doc.codigo_verificacion
                    ? `
                <div class="info-box">
                  <h4>🔐 Verificación futura</h4>
                  <p>
                    Guarda este correo junto con el PDF firmado. En el futuro, podrás 
                    verificar la validez del documento usando el código de verificación 
                    en el portal público de VeriFirma.
                  </p>
                  <p style="margin-top:8px;">
                    Portal de verificación:
                    <a href="${PUBLIC_VERIFY_BASE_URL}" target="_blank" rel="noopener noreferrer">
                      ${PUBLIC_VERIFY_BASE_URL}
                    </a>
                  </p>
                </div>
                `
                    : ""
                }
              </div>

              <div class="footer">
                <p>© 2026 VeriFirma - Plataforma de Firma Digital Segura</p>
                <p>
                  <a href="${DASHBOARD_BASE_URL}">www.verifirma.cl</a>
                </p>
                <p style="color: #9ca3af; font-size: 10px;">
                  Este es un correo automático, por favor no respondas.
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

      const ok = await sendEmail({
        to: r.email,
        subject,
        html,
        documentoId: documentId,
        firmanteId: null,
      });

      resultados.push({
        email: r.email,
        name: r.name,
        kind: r.kind,
        sent: !!ok,
      });

      if (ok) enviados++;
    }

    console.log(
      "[FINAL_EMAIL] Envíos de documento firmado completados:",
      enviados,
      "/",
      recipients.length,
      "para documento",
      documentId
    );

    try {
      const hashDocument = getDocumentHash(doc);

      await insertDocumentEvent({
        documentId,
        participantId: null,
        actor: "system",
        action: DOCUMENT_EVENT_TYPES.FINAL_EMAIL_SENT,
        details: `Correos de documento firmado enviados a ${enviados} de ${recipients.length} destinatarios.`,
        fromStatus: doc.status,
        toStatus: doc.status,
        eventType: DOCUMENT_EVENT_TYPES.FINAL_EMAIL_SENT,
        ipAddress: null,
        userAgent: null,
        hashDocument,
        companyId: doc.company_id || null,
        userId: null,
        metadata: {
          source: "final_email_service",
          recipients: resultados,
          total_recipients: recipients.length,
          total_sent_ok: enviados,
          force_used: !!force,
        },
      });
    } catch (eventErr) {
      console.error(
        "⚠️ [FINAL_EMAIL] Error registrando evento FINAL_EMAIL_SENT:",
        eventErr
      );
    }

    try {
      await db.query(
        `
        UPDATE documents
        SET final_email_sent_at = NOW(),
            final_email_recipients = $2,
            updated_at = NOW()
        WHERE id = $1
        `,
        [documentId, JSON.stringify(resultados)]
      );
    } catch (updateErr) {
      console.error(
        "⚠️ [FINAL_EMAIL] Error actualizando final_email_sent_at/final_email_recipients:",
        updateErr
      );
    }

    return enviados > 0;
  } catch (err) {
    console.error("❌ [FINAL_EMAIL] Error en sendFinalDocumentEmails:", err);
    return false;
  }
}

module.exports = {
  sendFinalDocumentEmails,
};
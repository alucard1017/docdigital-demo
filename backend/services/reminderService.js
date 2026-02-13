// backend/services/reminderService.js
const db = require('../db');
const {
  sendSigningInvitation,
  sendVisadoInvitation,
} = require('./emailService');

const API_URL = process.env.FRONTEND_URL || 'https://docdigital-demo.onrender.com';

/**
 * Envía recordatorio manual a firmantes y visadores pendientes de un documento
 */
async function enviarRecordatorioManual(documentoId) {
  try {
    // 1) Obtener documento
    const docRes = await db.query(
      `SELECT *
       FROM documents
       WHERE id = $1`,
      [documentoId]
    );

    if (docRes.rowCount === 0) {
      throw new Error('Documento no encontrado');
    }

    const doc = docRes.rows[0];

    const reminders = [];

    // 2) Enviar a visador si está pendiente visado
    if (
      doc.requires_visado === true &&
      doc.status === 'PENDIENTE_VISADO' &&
      doc.visador_email
    ) {
      const urlVisado = `${API_URL}/firma-publica?token=${doc.signature_token}&mode=visado`;
      await sendVisadoInvitation(
        doc.visador_email,
        doc.title,
        urlVisado,
        doc.visador_nombre || 'Visador'
      );

      reminders.push({
        tipo: 'VISADO',
        email: doc.visador_email,
        nombre: doc.visador_nombre,
      });

      console.log(
        `✅ Recordatorio de VISADO enviado a ${doc.visador_email}`
      );
    }

    // 3) Enviar a firmantes pendientes
    const signersRes = await db.query(
      `SELECT id, email, name, status
       FROM document_signers
       WHERE document_id = $1 AND status != 'FIRMADO'`,
      [documentoId]
    );

    for (const signer of signersRes.rows) {
      const urlFirma = `${API_URL}/firma-publica?token=${signer.sign_token || doc.signature_token}`;
      await sendSigningInvitation(
        signer.email,
        doc.title,
        urlFirma,
        signer.name || 'Firmante'
      );

      reminders.push({
        tipo: 'FIRMA',
        email: signer.email,
        nombre: signer.name,
      });

      console.log(
        `✅ Recordatorio de FIRMA enviado a ${signer.email}`
      );
    }

    // 4) Registrar evento de recordatorio enviado
    await db.query(
      `INSERT INTO document_events (
         document_id, actor, action, details, from_status, to_status
       )
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        documentoId,
        'Sistema',
        'RECORDATORIO_MANUAL',
        `Recordatorio manual enviado a ${reminders.length} destinatario(s)`,
        doc.status,
        doc.status,
      ]
    );

    return {
      success: true,
      reminders,
      message: `Recordatorio(s) enviado(s) a ${reminders.length} destinatario(s)`,
    };
  } catch (err) {
    console.error('Error enviando recordatorio:', err);
    throw err;
  }
}

/**
 * Busca documentos pendientes y envía recordatorios automáticos
 * Se ejecuta cada 24 horas
 */
async function enviarRecordatoriosAutomaticos() {
  try {
    console.log('🔔 Iniciando envío de recordatorios automáticos...');

    // Documentos que están pendientes desde hace 24h o más
    const docsRes = await db.query(
      `SELECT d.id, d.title, d.status
       FROM documents d
       WHERE d.status IN ('PENDIENTE_VISADO', 'PENDIENTE_FIRMA')
       AND (NOW() - d.created_at) > INTERVAL '24 hours'
       AND d.updated_at < (NOW() - INTERVAL '24 hours')
       LIMIT 100`
    );

    const docs = docsRes.rows;
    console.log(`📬 Encontrados ${docs.length} documentos pendientes`);

    for (const doc of docs) {
      try {
        await enviarRecordatorioManual(doc.id);
      } catch (err) {
        console.error(
          `⚠️ Error enviando recordatorio a documento ${doc.id}:`,
          err.message
        );
      }
    }

    console.log(`✅ Recordatorios automáticos completados`);
  } catch (err) {
    console.error('❌ Error en recordatorios automáticos:', err);
  }
}

module.exports = {
  enviarRecordatorioManual,
  enviarRecordatoriosAutomaticos,
};

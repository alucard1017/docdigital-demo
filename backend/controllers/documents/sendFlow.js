const {
  DOCUMENT_STATES,
  getDbClient,
  rollbackSafely,
  upsertDocumentMirror,
  mapFlowStateAfterSend,
} = require("./flowCommon");

const { syncParticipantsFromFlow } = require("./flowParticipantsSync");

const {
  logAudit,
  buildDocumentAuditMetadata,
} = require("../../utils/auditLog");

const { validateSendFlowParams } = require("./flowValidation");
const { triggerWebhook } = require("../../services/webhookService");
const { emitToCompany } = require("../../services/socketService");

const { getClientIp, getUserAgent } = require("./documentEventUtils");
const { insertDocumentEvent } = require("./documentEventInserts");

const {
  getReminderConfig,
  createAutomaticReminders,
  cancelPendingReminders,
} = require("./flowHelpers");

async function sendFlow(req, res) {
  const { valid, id, error } = validateSendFlowParams(req.params);
  if (!valid) {
    return res.status(400).json({
      code: "INVALID_PARAMS",
      message: error || "Parámetros inválidos",
    });
  }

  const client = await getDbClient();

  try {
    await client.query("BEGIN");

    const docRes = await client.query(
      `
      SELECT id, titulo, estado, company_id, creado_por, fecha_expiracion, tipo_flujo, categoria_firma
      FROM documentos
      WHERE id = $1
      `,
      [id]
    );

    if (docRes.rowCount === 0) {
      await rollbackSafely(client);
      return res.status(404).json({
        code: "NOT_FOUND",
        message: "Documento no encontrado",
      });
    }

    const documento = docRes.rows[0];

    if (documento.estado !== DOCUMENT_STATES.DRAFT) {
      await rollbackSafely(client);
      return res.status(400).json({
        code: "INVALID_STATE",
        message: "Solo puedes enviar documentos en estado BORRADOR",
      });
    }

    const firmantesRes = await client.query(
      `
      SELECT id, rol, orden_firma, email, nombre
      FROM firmantes
      WHERE documento_id = $1
      ORDER BY orden_firma ASC, id ASC
      `,
      [id]
    );

    if (firmantesRes.rowCount === 0) {
      await rollbackSafely(client);
      return res.status(400).json({
        code: "NO_SIGNERS",
        message: "El documento no tiene firmantes configurados",
      });
    }

    const firmantes = firmantesRes.rows;
    const tieneVisador = firmantes.some((f) => f.rol === "VISADOR");
    const totalParticipantes = firmantes.length;

    const { legacyStatus, documentsStatus } = mapFlowStateAfterSend();

    await client.query(
      `
      UPDATE documentos
      SET estado = $1,
          enviado_en = NOW(),
          updated_at = NOW()
      WHERE id = $2
      `,
      [legacyStatus, id]
    );

    const newDocumentId = await upsertDocumentMirror(client, {
      nuevoDocumentoId: documento.id,
      title: documento.titulo,
      status: documentsStatus,
      companyId: documento.company_id,
      ownerId: documento.creado_por,
      filePath: null,
      signFlowType:
        (documento.tipo_flujo || "SECUENCIAL") === "PARALELO"
          ? "PARALLEL"
          : "SEQUENTIAL",
      notaryMode: "NONE",
      countryCode: "CL",
      enviadoEn: new Date(),
      fechaExpiracion: documento.fecha_expiracion || null,
    });

    await client.query(
      `
      INSERT INTO eventos_firma (
        documento_id,
        tipo_evento,
        metadata,
        created_at
      )
      VALUES ($1, 'ENVIADO', $2, NOW())
      `,
      [
        id,
        JSON.stringify({
          fuente: "API",
          enviado_por: req.user.id,
          estado_inicial: legacyStatus,
          total_firmantes: firmantes.length,
          tiene_visador: tieneVisador,
        }),
      ]
    );

    const reminderConfig = await getReminderConfig(client, documento.company_id);

    await cancelPendingReminders(client, documento.id);

    let recordatoriosCreados = 0;
    if (reminderConfig.enabled) {
      recordatoriosCreados = await createAutomaticReminders(client, {
        documentId: documento.id,
        signers: firmantes,
        intervalDays: reminderConfig.intervalDays,
        maxAttempts: reminderConfig.maxAttempts,
        companyId: documento.company_id,
      });
    }

    await syncParticipantsFromFlow(client, {
      documentId: newDocumentId,
      signers: firmantes
        .filter((f) => f.rol !== "VISADOR")
        .map((f) => ({ name: f.nombre, email: f.email })),
      visadores: firmantes
        .filter((f) => f.rol === "VISADOR")
        .map((f) => ({ name: f.nombre, email: f.email })),
    });

    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);

    await insertDocumentEvent({
      documentId: newDocumentId,
      participantId: null,
      actor: req.user?.name || `user:${req.user.id}`,
      action: "DOCUMENT_SENT",
      details: "Documento enviado a firma",
      fromStatus: DOCUMENT_STATES.DRAFT,
      toStatus: documentsStatus,
      eventType: "DOCUMENT_SENT",
      ipAddress,
      userAgent,
      hashDocument: null,
      companyId: documento.company_id || null,
      userId: req.user.id || null,
      metadata: {
        fuente: "API",
        legacy_documento_id: documento.id,
        total_participantes: totalParticipantes,
        total_firmantes: firmantes.filter((f) => f.rol !== "VISADOR").length,
        total_visadores: firmantes.filter((f) => f.rol === "VISADOR").length,
        tiene_visador: tieneVisador,
        categoria_firma: documento.categoria_firma,
        fecha_expiracion: documento.fecha_expiracion,
        tipo_flujo: documento.tipo_flujo || "SECUENCIAL",
      },
    });

    await client.query("COMMIT");

    if (documento.company_id) {
      triggerWebhook(documento.company_id, "document.sent", {
        documentoId: documento.id,
        titulo: documento.titulo,
        estado: legacyStatus,
        firmantes: firmantes.length,
        tieneVisador,
      }).catch((err) => console.error("Error en webhook document.sent:", err));

      emitToCompany(documento.company_id, "document:sent", {
        documentoId: documento.id,
        titulo: documento.titulo,
        estado: legacyStatus,
        firmantes: firmantes.length,
      });
    }

    const metadata = buildDocumentAuditMetadata({
      documentId: documento.id,
      title: documento.titulo,
      status: documentsStatus,
      companyId: documento.company_id,
      extra: {
        categoria_firma: documento.categoria_firma,
        firmantes: firmantes.length,
        fecha_expiracion: documento.fecha_expiracion,
        documents_equivalent_id: newDocumentId,
        documents_status: documentsStatus,
        legacy_status: legacyStatus,
      },
    });

    logAudit({
      user: req.user,
      action: "DOCUMENT_FLOW_SENT",
      entityType: "document",
      entityId: documento.id,
      metadata,
      req,
    });

    return res.json({
      documentoId: documento.id,
      documentsId: newDocumentId,
      estado: legacyStatus,
      recordatoriosCreados,
      message: "Documento enviado a firma correctamente",
    });
  } catch (error) {
    await rollbackSafely(client);
    console.error("❌ Error enviando flujo de documento:", error.message);
    console.error(error.stack);
    return res.status(500).json({
      code: "FLOW_SEND_ERROR",
      message: "Error enviando flujo de documento",
      detail: error.message,
    });
  } finally {
    client.release();
  }
}

module.exports = {
  sendFlow,
};
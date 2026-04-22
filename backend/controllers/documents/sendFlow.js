// backend/controllers/documents/sendFlow.js

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
const { generarPdfPreviewConMarcaDeAgua } = require("../../services/pdfPreview");

function normalizeRole(rawRole) {
  const role = String(rawRole || "").trim().toUpperCase();
  if (!role) return null;
  if (role.includes("VIS")) return "VISADOR";
  if (role.includes("REV")) return "VISADOR";
  if (role.includes("FINAL")) return "FIRMANTE_FINAL";
  if (role.includes("FIRM")) return "FIRMANTE";
  return role;
}

async function ensurePreviewForModernDocument(client, newDocumentId) {
  const modernDocRes = await client.query(
    `
    SELECT *
    FROM documents
    WHERE id = $1
    LIMIT 1
    `,
    [newDocumentId]
  );

  if (modernDocRes.rowCount === 0) {
    throw new Error(`No se encontró documents.id=${newDocumentId} para generar preview`);
  }

  const modernDoc = modernDocRes.rows[0];

  if (modernDoc.preview_storage_key || modernDoc.pdf_preview_url) {
    return {
      previewKey:
        modernDoc.preview_storage_key ||
        modernDoc.pdf_preview_url,
      generated: false,
    };
  }

  const { previewKey } = await generarPdfPreviewConMarcaDeAgua(modernDoc);

  await client.query(
    `
    UPDATE documents
    SET
      preview_storage_key = $1,
      pdf_preview_url = $2,
      updated_at = NOW()
    WHERE id = $3
    `,
    [previewKey, previewKey, newDocumentId]
  );

  return {
    previewKey,
    generated: true,
  };
}

async function sendFlow(req, res) {
  const { valid, id, error } = validateSendFlowParams(req.params);
  if (!valid) {
    return res.status(400).json({
      code: "INVALID_PARAMS",
      message: error || "Parámetros inválidos",
    });
  }

  if (!req.user) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Usuario no autenticado",
    });
  }

  const client = await getDbClient();

  try {
    await client.query("BEGIN");

    // 1) Cargar documento legacy con path del archivo original
    const docRes = await client.query(
      `
      SELECT
        id,
        titulo,
        estado,
        company_id,
        creado_por,
        fecha_expiracion,
        tipo_flujo,
        categoria_firma,
        archivo_url,
        pdf_original_url,
        storage_key,
        file_path
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

    // 2) Validaciones de compañía y estado
    if (
      documento.company_id &&
      req.user.company_id &&
      documento.company_id !== req.user.company_id
    ) {
      await rollbackSafely(client);
      return res.status(403).json({
        code: "FORBIDDEN",
        message: "No tienes permisos para enviar este documento",
      });
    }

    if (documento.estado !== DOCUMENT_STATES.DRAFT) {
      await rollbackSafely(client);
      return res.status(400).json({
        code: "INVALID_STATE",
        message: "Solo puedes enviar documentos en estado BORRADOR",
      });
    }

    // 3) Cargar firmantes
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

    const firmantes = firmantesRes.rows.map((f) => ({
      ...f,
      rol: normalizeRole(f.rol),
    }));

    const totalParticipantes = firmantes.length;
    const totalVisadores = firmantes.filter((f) => f.rol === "VISADOR").length;
    const totalFirmantes = totalParticipantes - totalVisadores;
    const tieneVisador = totalVisadores > 0;

    if (totalFirmantes <= 0) {
      await rollbackSafely(client);
      return res.status(400).json({
        code: "NO_SIGNERS",
        message:
          "El flujo debe tener al menos un firmante distinto de visador antes de ser enviado.",
      });
    }

    // 4) Tipo de flujo normalizado
    const rawFlowType = (documento.tipo_flujo || "SECUENCIAL").toUpperCase();
    const normalizedFlowType =
      rawFlowType === "PARALELO" ? "PARALELO" : "SECUENCIAL";

    // 5) Estados nuevo modelo
    const { legacyStatus, documentsStatus } = mapFlowStateAfterSend();

    // Resolver archivo base del documento legacy
    const sourceFilePath =
      documento.pdf_original_url ||
      documento.storage_key ||
      documento.file_path ||
      documento.archivo_url ||
      null;

    // 6) Actualizar documento legacy
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

    // 7) Mirror en tabla moderna "documents"
    const newDocumentId = await upsertDocumentMirror(client, {
      nuevoDocumentoId: documento.id,
      title: documento.titulo,
      status: documentsStatus,
      companyId: documento.company_id,
      ownerId: documento.creado_por,
      filePath: sourceFilePath,
      signFlowType:
        normalizedFlowType === "PARALELO" ? "PARALLEL" : "SEQUENTIAL",
      notaryMode: "NONE",
      countryCode: "CL",
      enviadoEn: new Date(),
      fechaExpiracion: documento.fecha_expiracion || null,
    });

    // 8) Asegurar preview con marca de agua en documents
    const previewResult = await ensurePreviewForModernDocument(
      client,
      newDocumentId
    );

    // 9) Registro legado en eventos_firma
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
          total_firmantes: totalFirmantes,
          total_visadores: totalVisadores,
          tiene_visador: tieneVisador,
          preview_generado: previewResult.generated,
          preview_storage_key: previewResult.previewKey || null,
        }),
      ]
    );

    // 10) Recordatorios automáticos
    const reminderConfig = await getReminderConfig(
      client,
      documento.company_id
    );
    await cancelPendingReminders(client, documento.id);

    let recordatoriosCreados = 0;
    if (reminderConfig.enabled) {
      recordatoriosCreados = await createAutomaticReminders(client, {
        documentId: documento.id,
        signers: firmantes
          .filter((f) => f.rol !== "VISADOR")
          .map((f) => ({ id: f.id, name: f.nombre, email: f.email })),
        intervalDays: reminderConfig.intervalDays,
        maxAttempts: reminderConfig.maxAttempts,
        companyId: documento.company_id,
      });
    }

    // 11) Sincronizar a document_participants
    await syncParticipantsFromFlow(client, {
      documentId: newDocumentId,
      signers: firmantes
        .filter((f) => f.rol !== "VISADOR")
        .map((f) => ({ id: f.id, name: f.nombre, email: f.email })),
      visadores: firmantes
        .filter((f) => f.rol === "VISADOR")
        .map((f) => ({ id: f.id, name: f.nombre, email: f.email })),
    });

    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);

    // 12) Evento moderno para timeline
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
        total_firmantes: totalFirmantes,
        total_visadores: totalVisadores,
        tiene_visador: tieneVisador,
        categoria_firma: documento.categoria_firma,
        fecha_expiracion: documento.fecha_expiracion,
        tipo_flujo: normalizedFlowType,
        preview_generado: previewResult.generated,
        preview_storage_key: previewResult.previewKey || null,
      },
    });

    await client.query("COMMIT");

    // 13) Webhooks / sockets
    if (documento.company_id) {
      triggerWebhook(documento.company_id, "document.sent", {
        documentoId: documento.id,
        titulo: documento.titulo,
        estado: legacyStatus,
        firmantes: totalFirmantes,
        tieneVisador,
      }).catch((err) =>
        console.error("Error en webhook document.sent:", err)
      );

      emitToCompany(documento.company_id, "document:sent", {
        documentoId: documento.id,
        titulo: documento.titulo,
        estado: legacyStatus,
        firmantes: totalFirmantes,
      });
    }

    // 14) Audit log
    const metadata = buildDocumentAuditMetadata({
      documentId: documento.id,
      title: documento.titulo,
      status: documentsStatus,
      companyId: documento.company_id,
      extra: {
        categoria_firma: documento.categoria_firma,
        firmantes: totalFirmantes,
        visadores: totalVisadores,
        fecha_expiracion: documento.fecha_expiracion,
        documents_equivalent_id: newDocumentId,
        documents_status: documentsStatus,
        legacy_status: legacyStatus,
        preview_storage_key: previewResult.previewKey || null,
        preview_generado: previewResult.generated,
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
      previewGenerado: previewResult.generated,
      previewStorageKey: previewResult.previewKey || null,
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

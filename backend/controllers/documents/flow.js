// backend/controllers/documents/flow.js
const {
  crypto,
  DOCUMENT_STATES,
  getDbClient,
  rollbackSafely,
  upsertDocumentMirror,
  countLegacySignatures,
  countParticipantSignatures,
  getDocumentFlowType,
  validateSequentialSigning,
  mapLegacyStatusToDocumentsStatus,
  mapFlowStateAfterSend,
  mapFlowStateAfterSigned,
  mapFlowStateWhileSigning,
} = require("./flowCommon");

const {
  insertFlowActorEvent,
  insertFlowStatusChangedEvent,
} = require("./flowEventInserts");

const {
  syncParticipantsFromFlow,
  updateParticipantStatus,
} = require("./flowParticipantsSync");

const {
  logAudit,
  buildDocumentAuditMetadata,
} = require("../../utils/auditLog");
const {
  validateCreateFlowBody,
  validateSendFlowParams,
} = require("./flowValidation");
const { triggerWebhook } = require("../../services/webhookService");
const { emitToCompany } = require("../../services/socketService");
const { getGeoFromIP } = require("../../utils/geoLocation");
const { getClientIp, getUserAgent } = require("./documentEventUtils");
const { insertDocumentEvent } = require("./documentEventInserts");

/* ================================
   Helpers sendFlow / signFlow
   ================================ */

const getReminderConfig = async (client, companyId) => {
  const configRes = await client.query(
    `
    SELECT interval_days, max_attempts, enabled
    FROM reminder_config
    WHERE company_id = $1
    `,
    [companyId]
  );

  if (configRes.rowCount === 0) {
    return {
      intervalDays: 3,
      maxAttempts: 3,
      enabled: true,
    };
  }

  const config = configRes.rows[0];

  return {
    intervalDays: Number(config.interval_days) || 3,
    maxAttempts: Number(config.max_attempts) || 3,
    enabled: Boolean(config.enabled),
  };
};

const createAutomaticReminders = async (
  client,
  { documentId, signers, intervalDays, maxAttempts, companyId }
) => {
  if (!documentId || !signers?.length) return 0;

  const firstReminderAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

  for (const signer of signers) {
    await client.query(
      `
      INSERT INTO recordatorios (
        documento_id,
        company_id,
        firmante_id,
        destinatario_email,
        tipo,
        estado,
        proximo_intento_at,
        sent_at,
        intentos,
        max_intentos,
        error_message,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4,
        'AUTO',
        'pendiente',
        $5,
        NULL,
        0,
        $6,
        NULL,
        NOW(),
        NOW()
      )
      `,
      [
        documentId,
        companyId || null,
        signer.id || null,
        signer.email,
        firstReminderAt,
        maxAttempts,
      ]
    );
  }

  return signers.length;
};

const cancelPendingReminders = async (client, documentId) => {
  if (!documentId) return 0;

  const result = await client.query(
    `
    UPDATE recordatorios
    SET
      estado = 'cancelado',
      updated_at = NOW()
    WHERE documento_id = $1
      AND estado IN ('pendiente', 'enviado')
    `,
    [documentId]
  );

  return result.rowCount || 0;
};

/* ================================
   Crear flujo (BORRADOR)
   ================================ */
async function createFlow(req, res) {
  console.log("DEBUG crear-flujo body >>>", req.body);

  const { valid, errors } = validateCreateFlowBody(req.body);
  if (!valid) {
    return res.status(400).json({
      code: "INVALID_BODY",
      message: "Datos inválidos",
      details: errors,
    });
  }

  const {
    tipo,
    titulo,
    categoriaFirma,
    firmantes,
    fechaExpiracion,
    tipoFlujo = "SECUENCIAL",
  } = req.body;

  const client = await getDbClient();

  try {
    await client.query("BEGIN");

    const codigoVerificacion = crypto.randomUUID().slice(0, 8);

    const docResult = await client.query(
      `
      INSERT INTO documentos (
        tipo,
        titulo,
        estado,
        hash_pdf,
        codigo_verificacion,
        categoria_firma,
        tipo_flujo,
        creado_por,
        company_id,
        fecha_expiracion,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
      `,
      [
        tipo,
        titulo,
        DOCUMENT_STATES.DRAFT,
        codigoVerificacion,
        categoriaFirma,
        tipoFlujo,
        req.user.id,
        req.user.company_id,
        fechaExpiracion || null,
      ]
    );

    const documento = docResult.rows[0];
    const documentsStatus = mapLegacyStatusToDocumentsStatus(documento.estado);

    for (const [index, f] of firmantes.entries()) {
      await client.query(
        `
        INSERT INTO firmantes (
          documento_id,
          nombre,
          email,
          rut,
          rol,
          orden_firma,
          estado,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE', NOW(), NOW())
        `,
        [
          documento.id,
          f.nombre,
          f.email,
          f.rut || null,
          f.rol || null,
          f.ordenFirma ?? index + 1,
        ]
      );
    }

    await client.query(
      `
      INSERT INTO eventos_firma (
        documento_id,
        tipo_evento,
        metadata,
        created_at
      )
      VALUES ($1, 'CREADO', $2, NOW())
      `,
      [
        documento.id,
        JSON.stringify({
          fuente: "API",
          creado_por: req.user.id,
          estado_inicial: DOCUMENT_STATES.DRAFT,
        }),
      ]
    );

    const newDocumentId = await upsertDocumentMirror(client, {
      nuevoDocumentoId: documento.id,
      title: documento.titulo,
      status: documentsStatus,
      companyId: documento.company_id,
      ownerId: documento.creado_por,
      filePath: null,
      description: documento.tipo || null,
      signFlowType:
        (tipoFlujo || "SECUENCIAL") === "PARALELO" ? "PARALLEL" : "SEQUENTIAL",
      notaryMode: "NONE",
      countryCode: "CL",
      fechaExpiracion: documento.fecha_expiracion || null,
    });

    const signersArray = firmantes
      .filter((f) => f.rol !== "VISADOR")
      .map((f) => ({ name: f.nombre, email: f.email }));

    const visadoresArray = firmantes
      .filter((f) => f.rol === "VISADOR")
      .map((f) => ({ name: f.nombre, email: f.email }));

    await syncParticipantsFromFlow(client, {
      documentId: newDocumentId,
      signers: signersArray,
      visadores: visadoresArray,
    });

    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);

    await insertDocumentEvent({
      documentId: newDocumentId,
      participantId: null,
      actor: req.user?.name || `user:${req.user.id}`,
      action: "DOCUMENT_CREATED",
      details: "Documento creado en estado BORRADOR",
      fromStatus: null,
      toStatus: documentsStatus,
      eventType: "DOCUMENT_CREATED",
      ipAddress,
      userAgent,
      hashDocument: null,
      companyId: documento.company_id || null,
      userId: req.user.id || null,
      metadata: {
        fuente: "API",
        legacy_documento_id: documento.id,
        tipo: documento.tipo,
        categoria_firma: documento.categoria_firma,
        tipo_flujo: documento.tipo_flujo,
        signing_sequence: signersArray.length + visadoresArray.length,
      },
    });

    await client.query("COMMIT");

    const metadata = buildDocumentAuditMetadata({
      documentId: documento.id,
      title: documento.titulo,
      status: documentsStatus,
      companyId: documento.company_id || null,
      extra: {
        tipo: documento.tipo,
        categoria_firma: documento.categoria_firma,
        tipo_flujo: documento.tipo_flujo,
        fecha_expiracion: documento.fecha_expiracion,
        documents_equivalent_id: newDocumentId,
        documents_status: documentsStatus,
      },
    });

    logAudit({
      user: req.user,
      action: "DOCUMENT_FLOW_CREATED",
      entityType: "document",
      entityId: documento.id,
      metadata,
      req,
    });

    return res.status(201).json({
      documentoId: documento.id,
      documentsId: newDocumentId,
      codigoVerificacion,
      estado: documento.estado,
      message: "Flujo de documento creado exitosamente (BORRADOR)",
    });
  } catch (error) {
    await rollbackSafely(client);
    console.error("❌ Error creando flujo de documento:", error.message);
    console.error(error.stack);
    return res.status(500).json({
      code: "FLOW_CREATE_ERROR",
      message: "Error creando flujo de documento",
      detail: error.message,
    });
  } finally {
    client.release();
  }
}

/* ================================
   Enviar flujo
   ================================ */
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

/* ================================
   Firmar flujo por firmante (multi-firmante legacy)
   ================================ */
async function signFlow(req, res) {
  const { firmanteId } = req.params;
  const client = await getDbClient();

  try {
    await client.query("BEGIN");

    const firmanteRes = await client.query(
      `
      SELECT
        f.*,
        d.id AS documento_id,
        d.estado AS documento_estado,
        d.titulo,
        d.company_id,
        d.fecha_expiracion,
        d.categoria_firma
      FROM firmantes f
      JOIN documentos d ON d.id = f.documento_id
      WHERE f.id = $1
      `,
      [firmanteId]
    );

    if (firmanteRes.rowCount === 0) {
      await rollbackSafely(client);
      return res.status(404).json({
        code: "SIGNER_NOT_FOUND",
        message: "Firmante no encontrado",
      });
    }

    const firmante = firmanteRes.rows[0];

    if (firmante.estado === "FIRMADO") {
      await rollbackSafely(client);
      return res.status(400).json({
        code: "ALREADY_PROCESSED",
        message:
          firmante.rol === "VISADOR"
            ? "Este visador ya registró su visado"
            : "Este firmante ya firmó",
      });
    }

    if (firmante.estado === "RECHAZADO") {
      await rollbackSafely(client);
      return res.status(400).json({
        code: "ALREADY_REJECTED",
        message: "Este firmante rechazó el documento",
      });
    }

    const tipoFlujo = await getDocumentFlowType(client, firmante.documento_id);

    if (tipoFlujo === "SECUENCIAL") {
      const pendientesAntes = await validateSequentialSigning(client, {
        documentId: firmante.documento_id,
        order: firmante.orden_firma,
      });

      if (pendientesAntes > 0) {
        await rollbackSafely(client);
        return res.status(400).json({
          code: "SEQUENTIAL_BLOCKED",
          message:
            firmante.rol === "VISADOR"
              ? "Aún hay participantes anteriores pendientes antes del visado"
              : "Aún hay participantes anteriores en la secuencia que no han completado su acción",
        });
      }
    }

    const geoData = await getGeoFromIP(req.ip);

    await client.query(
      `
      UPDATE firmantes
      SET estado = 'FIRMADO',
          fecha_firma = NOW(),
          tipo_firma = CASE
            WHEN rol = 'VISADOR' THEN COALESCE(tipo_firma, 'VISADO')
            ELSE 'SIMPLE'
          END,
          ip_firma = $2,
          user_agent_firma = $3,
          geo_location = $4,
          updated_at = NOW()
      WHERE id = $1
      `,
      [
        firmanteId,
        req.ip || null,
        req.headers["user-agent"] || null,
        JSON.stringify(geoData || {}),
      ]
    );

    const newDocRes = await client.query(
      `
      SELECT id, company_id, status, hash_sha256, hash_documento
      FROM documents
      WHERE nuevo_documento_id = $1
      LIMIT 1
      `,
      [firmante.documento_id]
    );

    const newDocRow = newDocRes.rows[0] || null;
    const newDocumentId = newDocRow?.id || null;

    if (newDocumentId) {
      await updateParticipantStatus(client, {
        documentId: newDocumentId,
        email: firmante.email,
        role: firmante.rol,
      });
    }

    const actorIsReviewer = firmante.rol === "VISADOR";

    await client.query(
      `
      INSERT INTO eventos_firma (
        documento_id,
        firmante_id,
        tipo_evento,
        ip,
        user_agent,
        metadata,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
      [
        firmante.documento_id,
        firmanteId,
        actorIsReviewer ? "VISADO" : "FIRMADO",
        req.ip || null,
        req.headers["user-agent"] || null,
        JSON.stringify({
          fuente: "API",
          via: "signFlow",
          tipo_flujo: tipoFlujo,
          actor_role: firmante.rol,
          actor_email: firmante.email,
        }),
      ]
    );

    const { firmadosNum, totalNum } = await countLegacySignatures(
      client,
      firmante.documento_id
    );

    const { firmadosDpNum, totalDpNum } = await countParticipantSignatures(
      client,
      newDocumentId
    );

    const allSigned = totalNum > 0 && firmadosNum >= totalNum;

    let nuevoEstadoDocumento = firmante.documento_estado;
    let nuevoEstadoDocuments = mapLegacyStatusToDocumentsStatus(
      firmante.documento_estado
    );

    if (allSigned) {
      const { legacyStatus, documentsStatus } = mapFlowStateAfterSigned();

      nuevoEstadoDocumento = legacyStatus;
      nuevoEstadoDocuments = documentsStatus;

      await client.query(
        `
        UPDATE documentos
        SET estado = $1,
            firmado_en = NOW(),
            updated_at = NOW()
        WHERE id = $2
        `,
        [legacyStatus, firmante.documento_id]
      );

      if (newDocumentId) {
        await client.query(
          `
          UPDATE documents
          SET status = $1,
              firmado_en = NOW(),
              updated_at = NOW()
          WHERE id = $2
          `,
          [documentsStatus, newDocumentId]
        );
      }

      await cancelPendingReminders(client, firmante.documento_id);

      await client.query(
        `
        INSERT INTO eventos_firma (
          documento_id,
          tipo_evento,
          metadata,
          created_at
        )
        VALUES ($1, 'DOCUMENTO_FIRMADO_COMPLETO', $2, NOW())
        `,
        [
          firmante.documento_id,
          JSON.stringify({
            descripcion:
              "Todos los participantes requeridos completaron su acción",
            firmados: firmadosNum,
            total: totalNum,
          }),
        ]
      );
    } else {
      const { legacyStatus, documentsStatus } = mapFlowStateWhileSigning();

      nuevoEstadoDocumento = legacyStatus;
      nuevoEstadoDocuments = documentsStatus;

      await client.query(
        `
        UPDATE documentos
        SET estado = $1,
            updated_at = NOW()
        WHERE id = $2
        `,
        [legacyStatus, firmante.documento_id]
      );

      if (newDocumentId) {
        await client.query(
          `
          UPDATE documents
          SET status = $1,
              updated_at = NOW()
          WHERE id = $2
          `,
          [documentsStatus, newDocumentId]
        );
      }

      if (actorIsReviewer) {
        await cancelPendingReminders(client, firmante.documento_id);
      }
    }

    if (newDocumentId) {
      const flowDoc = {
        id: newDocumentId,
        company_id: newDocRow?.company_id || firmante.company_id || null,
        hash_document:
          newDocRow?.hash_sha256 || newDocRow?.hash_documento || null,
      };

      const fromStatus = mapLegacyStatusToDocumentsStatus(
        firmante.documento_estado
      );

      await insertFlowActorEvent({
        req,
        doc: flowDoc,
        actor: firmante.nombre || firmante.email || "Participante interno",
        fromStatus,
        toStatus: nuevoEstadoDocuments,
        eventType: actorIsReviewer ? "VISADO_INTERNAL" : "SIGNED_INTERNAL",
        action: actorIsReviewer
          ? "DOCUMENT_REVIEWED_INTERNAL"
          : "DOCUMENT_SIGNED_INTERNAL",
        details: actorIsReviewer
          ? `Visado registrado para ${firmante.email}`
          : `Firma registrada para ${firmante.email}`,
        userId: null,
        extraMetadata: {
          via: "signFlow",
          tipo_flujo: tipoFlujo,
          actor_role: firmante.rol,
          actor_email: firmante.email,
          actor_id: firmante.id,
          all_signed: allSigned,
          progress:
            totalNum > 0
              ? ((firmadosNum / totalNum) * 100).toFixed(1) + "%"
              : "0.0%",
          firmados_legacy: firmadosNum,
          total_legacy: totalNum,
          firmados_dp: firmadosDpNum,
          total_dp: totalDpNum,
        },
      });

      await insertFlowStatusChangedEvent({
        req,
        doc: flowDoc,
        actor: "system",
        fromStatus,
        toStatus: nuevoEstadoDocuments,
        details: actorIsReviewer
          ? "Cambio de estado por visado interno"
          : allSigned
          ? "Cambio de estado por firma final del flujo"
          : "Cambio de estado por avance del flujo de firma",
        extraMetadata: {
          via: "signFlow",
          trigger_role: firmante.rol,
          trigger_email: firmante.email,
          all_signed: allSigned,
        },
      });

      if (allSigned) {
        await insertFlowActorEvent({
          req,
          doc: flowDoc,
          actor: "system",
          fromStatus: fromStatus,
          toStatus: DOCUMENT_STATES.SIGNED,
          eventType: "DOCUMENT_COMPLETED",
          action: "DOCUMENT_COMPLETED",
          details:
            "Documento completado por todos los participantes requeridos",
          userId: null,
          extraMetadata: {
            via: "signFlow",
            firmados: firmadosNum,
            total: totalNum,
          },
        });
      }
    }

    await client.query("COMMIT");

    if (allSigned && firmante.company_id) {
      triggerWebhook(firmante.company_id, "document.signed", {
        documentoId: firmante.documento_id,
        titulo: firmante.titulo,
        firmantes_totales: totalNum,
      }).catch((err) =>
        console.error("Error en webhook document.signed:", err)
      );

      emitToCompany(firmante.company_id, "document:signed", {
        documentoId: firmante.documento_id,
        titulo: firmante.titulo,
      });
    }

    const metadata = buildDocumentAuditMetadata({
      documentId: firmante.documento_id,
      title: firmante.titulo,
      status: nuevoEstadoDocuments,
      companyId: firmante.company_id || null,
      extra: {
        categoria_firma: firmante.categoria_firma,
        fecha_expiracion: firmante.fecha_expiracion,
        firmante_id: firmante.id,
        firmante_email: firmante.email,
        firmante_rol: firmante.rol,
        tipo_flujo: tipoFlujo,
        actor_type: actorIsReviewer ? "REVIEWER" : "SIGNER",
        all_signed: allSigned,
        progress:
          totalNum > 0
            ? ((firmadosNum / totalNum) * 100).toFixed(1) + "%"
            : "0.0%",
        legacy_status: nuevoEstadoDocumento,
        documents_equivalent_id: newDocumentId,
        documents_status: nuevoEstadoDocuments,
        firmados_legacy: firmadosNum,
        total_legacy: totalNum,
        firmados_dp: firmadosDpNum,
        total_dp: totalDpNum,
      },
    });

    logAudit({
      user: null,
      action: actorIsReviewer
        ? "DOCUMENT_FLOW_REVIEWED"
        : "DOCUMENT_FLOW_SIGNED",
      entityType: "document",
      entityId: firmante.documento_id,
      metadata,
      req,
    });

    return res.json({
      mensaje: allSigned
        ? "Acción registrada y documento completado"
        : actorIsReviewer
        ? "Visado registrado. El flujo continúa"
        : "Firma registrada. Faltan participantes",
      documentoId: firmante.documento_id,
      documentsId: newDocumentId,
      allSigned,
      actorType: actorIsReviewer ? "REVIEWER" : "SIGNER",
      progress:
        totalNum > 0
          ? ((firmadosNum / totalNum) * 100).toFixed(1) + "%"
          : "0.0%",
    });
  } catch (error) {
    await rollbackSafely(client);
    console.error("❌ Error firmando flujo de documento:", error.message);
    console.error(error.stack);
    return res.status(500).json({
      code: "FLOW_SIGN_ERROR",
      message: "Error firmando flujo de documento",
      detail: error.message,
    });
  } finally {
    client.release();
  }
}

module.exports = {
  createFlow,
  sendFlow,
  signFlow,
};
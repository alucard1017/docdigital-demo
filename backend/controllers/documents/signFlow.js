// backend/controllers/documents/signFlow.js

const {
  DOCUMENT_STATES,
  getDbClient,
  rollbackSafely,
  countLegacySignatures,
  countParticipantSignatures,
  getDocumentFlowType,
  validateSequentialSigning,
  mapLegacyStatusToDocumentsStatus,
  mapFlowStateAfterSigned,
  mapFlowStateWhileSigning,
} = require("./flowCommon");
const {
  insertFlowActorEvent,
  insertFlowStatusChangedEvent,
} = require("./flowEventInserts");
const {
  updateParticipantStatus,
  PARTICIPANT_ROLES,
} = require("./flowParticipantsSync");
const { logAudit, buildDocumentAuditMetadata } = require("../../utils/auditLog");
const { triggerWebhook } = require("../../services/webhookService");
const { emitToCompany } = require("../../services/socketService");
const { getGeoFromIP } = require("../../utils/geoLocation");
const { getClientIp, getUserAgent } = require("./documentEventUtils");
const { cancelPendingReminders } = require("./flowHelpers");

/**
 * Normaliza el rol legacy al dominio de PARTICIPANT_ROLES.
 * VIS*, REV* -> REVIEWER
 * FINAL* -> FINAL_SIGNER
 * FIRM* -> SIGNER
 */
function normalizeRole(rawRole) {
  const role = String(rawRole || "").trim().toUpperCase();
  if (!role) return null;
  if (role.includes("VIS")) return PARTICIPANT_ROLES.REVIEWER;
  if (role.includes("REV")) return PARTICIPANT_ROLES.REVIEWER;
  if (role.includes("FINAL")) return PARTICIPANT_ROLES.FINAL_SIGNER;
  if (role.includes("FIRM")) return PARTICIPANT_ROLES.SIGNER;
  return role;
}

function buildProgressLabel(firmados, total) {
  if (!total || total <= 0) return "0.0%";
  return ((firmados / total) * 100).toFixed(1) + "%";
}

async function signFlow(req, res) {
  const { firmanteId } = req.params;

  if (!req.user) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Usuario no autenticado",
    });
  }

  const client = await getDbClient();

  try {
    await client.query("BEGIN");

    // 1) Firmante + documento legacy
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

    const firmanteRaw = firmanteRes.rows[0];
    const normalizedRole = normalizeRole(firmanteRaw.rol);

    const firmante = {
      ...firmanteRaw,
      rol: normalizedRole,
    };

    const actorIsReviewer = firmante.rol === PARTICIPANT_ROLES.REVIEWER;

    // 2) Validar estado actual del firmante (no repetir ni sobreescribir rechazo)
    if (firmante.estado === "FIRMADO") {
      await rollbackSafely(client);
      return res.status(400).json({
        code: "ALREADY_PROCESSED",
        message: actorIsReviewer
          ? "Este visador ya registró su visado"
          : "Este firmante ya firmó",
      });
    }

    if (firmante.estado === "RECHAZADO") {
      await rollbackSafely(client);
      return res.status(400).json({
        code: "ALREADY_REJECTED",
        message: actorIsReviewer
          ? "Este visador rechazó el documento"
          : "Este firmante rechazó el documento",
      });
    }

    // 3) Evitar doble visado por email en el mismo documento
    if (actorIsReviewer) {
      const dupVisadorRes = await client.query(
        `
        SELECT COUNT(*) AS count
        FROM firmantes
        WHERE documento_id = $1
          AND email = $2
          AND rol IN ('VISADOR', 'REVISOR')
          AND estado = 'FIRMADO'
        `,
        [firmante.documento_id, firmante.email]
      );

      const alreadyReviewer = Number(dupVisadorRes.rows[0]?.count || 0) > 0;

      if (alreadyReviewer) {
        await rollbackSafely(client);
        return res.status(400).json({
          code: "REVIEWER_ALREADY_SIGNED",
          message:
            "Este visador ya registró su visado para este documento",
        });
      }
    }

    // 4) Validar orden de firma en flujo secuencial (no saltar pasos)
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
          message: actorIsReviewer
            ? "El visado está bloqueado hasta que todos los participantes anteriores completen su acción"
            : "La firma está bloqueada hasta que todos los participantes anteriores completen su acción",
        });
      }
    }

    // 5) IP/UA + geolocalización para audit trail
    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    const geoData = await getGeoFromIP(ipAddress);

    // 6) Actualizar firmante legacy
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
        ipAddress || null,
        userAgent || null,
        JSON.stringify(geoData || {}),
      ]
    );

    // 7) Documento moderno (documents) + participant
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
        flowOrder: firmante.orden_firma || null,
      });
    }

    // 8) Evento legacy en eventos_firma (compat)
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
        ipAddress || null,
        userAgent || null,
        JSON.stringify({
          fuente: "API",
          via: "signFlow",
          tipo_flujo: tipoFlujo,
          actor_role: firmante.rol,
          actor_email: firmante.email,
          actor_id: firmante.id,
        }),
      ]
    );

    // 9) Conteos de firmas (legacy y moderno) para progreso y estados
    const { firmadosNum, totalNum } = await countLegacySignatures(
      client,
      firmante.documento_id
    );

    const { firmadosDpNum, totalDpNum } = await countParticipantSignatures(
      client,
      newDocumentId
    );

    const allSigned = totalNum > 0 && firmadosNum >= totalNum;
    const progressLabel = buildProgressLabel(firmadosNum, totalNum);

    let nuevoEstadoDocumento = firmante.documento_estado;
    let nuevoEstadoDocuments = mapLegacyStatusToDocumentsStatus(
      firmante.documento_estado
    );

    // 10) Actualizar estados del documento según completitud
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

    // 11) Eventos modernos en document_events (actor + cambio de estado)
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
        actor:
          firmante.nombre ||
          firmante.email ||
          "Participante interno",
        fromStatus,
        toStatus: nuevoEstadoDocuments,
        eventType: actorIsReviewer ? "VISADO_INTERNAL" : "SIGNED_INTERNAL",
        action: actorIsReviewer
          ? "DOCUMENT_REVIEWED_INTERNAL"
          : "DOCUMENT_SIGNED_INTERNAL",
        details: actorIsReviewer
          ? `Visado registrado para ${firmante.email}`
          : `Firma registrada para ${firmante.email}`,
        userId: req.user.id || null,
        extraMetadata: {
          via: "signFlow",
          tipo_flujo: tipoFlujo,
          actor_role: firmante.rol,
          actor_email: firmante.email,
          actor_id: firmante.id,
          all_signed: allSigned,
          progress: progressLabel,
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
          fromStatus,
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

    // 12) Webhooks / sockets cuando el documento queda completamente firmado
    if (allSigned && firmante.company_id) {
      const wsPayload = {
        id: firmante.documento_id,
        title: firmante.titulo,
        status: nuevoEstadoDocumento,
        companyId: firmante.company_id,
        totalSigners: totalNum,
        progress: progressLabel,
      };

      triggerWebhook(firmante.company_id, "document.signed", {
        documentoId: firmante.documento_id,
        titulo: firmante.titulo,
        firmantes_totales: totalNum,
      }).catch((err) =>
        console.error("Error en webhook document.signed:", err)
      );

      emitToCompany(firmante.company_id, "document:signed", wsPayload);
    }

    // 13) Audit log estructurado
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
        progress: progressLabel,
        legacy_status: nuevoEstadoDocumento,
        documents_equivalent_id: newDocumentId,
        documents_status: nuevoEstadoDocuments,
        firmados_legacy: firmadosNum,
        total_legacy: totalNum,
        firmados_dp: firmadosDpNum,
        total_dp: totalDpNum,
        actor_user_id: req.user.id || null,
        actor_name: req.user.name || null,
        ip: ipAddress || null,
        user_agent: userAgent || null,
        geo_location: geoData || null,
      },
    });

    logAudit({
      user: req.user,
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
      progress: progressLabel,
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
  signFlow,
};
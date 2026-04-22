const {
  crypto,
  DOCUMENT_STATES,
  getDbClient,
  rollbackSafely,
  upsertDocumentMirror,
  mapLegacyStatusToDocumentsStatus,
} = require("./flowCommon");

const { syncParticipantsFromFlow } = require("./flowParticipantsSync");

const {
  logAudit,
  buildDocumentAuditMetadata,
} = require("../../utils/auditLog");

const { validateCreateFlowBody } = require("./flowValidation");

const { getClientIp, getUserAgent } = require("./documentEventUtils");
const { insertDocumentEvent } = require("./documentEventInserts");

function normalizeRole(rawRole) {
  const role = String(rawRole || "").trim().toUpperCase();
  if (!role) return null;

  if (role.includes("VIS")) return "VISADOR";
  if (role.includes("REV")) return "VISADOR";
  if (role.includes("FINAL")) return "FIRMANTE_FINAL";
  if (role.includes("FIRM")) return "FIRMANTE";

  return role;
}

function normalizeFlowType(rawFlowType) {
  return String(rawFlowType || "SECUENCIAL").trim().toUpperCase() === "PARALELO"
    ? "PARALELO"
    : "SECUENCIAL";
}

function buildNormalizedParticipants(firmantes = [], tipoFlujo = "SECUENCIAL") {
  const normalizedFlowType = normalizeFlowType(tipoFlujo);

  const baseParticipants = firmantes
    .map((f, index) => {
      const role = normalizeRole(f.rol);

      return {
        nombre: String(f.nombre || "").trim(),
        email: String(f.email || "").trim().toLowerCase(),
        rut: f.rut ? String(f.rut).trim() : null,
        rol: role,
        ordenFirma:
          typeof f.ordenFirma === "number" && f.ordenFirma > 0
            ? f.ordenFirma
            : index + 1,
      };
    })
    .sort((a, b) => a.ordenFirma - b.ordenFirma);

  if (normalizedFlowType === "PARALELO") {
    return baseParticipants.map((p, index) => ({
      ...p,
      stepOrder: index + 1,
      flowOrder: p.ordenFirma,
      flowGroup: 1,
      isSigner: p.rol !== "VISADOR",
      isApprover: p.rol === "VISADOR",
    }));
  }

  return baseParticipants.map((p, index) => ({
    ...p,
    stepOrder: index + 1,
    flowOrder: index + 1,
    flowGroup: index + 1,
    isSigner: p.rol !== "VISADOR",
    isApprover: p.rol === "VISADOR",
  }));
}

async function createFlow(req, res) {
  console.log("DEBUG crear-flujo body >>>", req.body);

  if (!req.user) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Usuario no autenticado",
    });
  }

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

  const normalizedFlowType = normalizeFlowType(tipoFlujo);
  const normalizedParticipants = buildNormalizedParticipants(
    firmantes,
    normalizedFlowType
  );

  const hasAtLeastOneSigner = normalizedParticipants.some(
    (p) => p.isSigner
  );

  if (!hasAtLeastOneSigner) {
    return res.status(400).json({
      code: "NO_SIGNERS",
      message:
        "El flujo debe tener al menos un firmante distinto de visador.",
    });
  }

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
        normalizedFlowType,
        req.user.id,
        req.user.company_id,
        fechaExpiracion || null,
      ]
    );

    const documento = docResult.rows[0];
    const documentsStatus = mapLegacyStatusToDocumentsStatus(documento.estado);

    for (const participant of normalizedParticipants) {
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
          participant.nombre,
          participant.email,
          participant.rut,
          participant.rol,
          participant.ordenFirma,
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
          tipo_flujo: normalizedFlowType,
          participants_snapshot: normalizedParticipants.map((p) => ({
            nombre: p.nombre,
            email: p.email,
            rol: p.rol,
            ordenFirma: p.ordenFirma,
            stepOrder: p.stepOrder,
            flowOrder: p.flowOrder,
            flowGroup: p.flowGroup,
          })),
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
        normalizedFlowType === "PARALELO" ? "PARALLEL" : "SEQUENTIAL",
      notaryMode: "NONE",
      countryCode: "CL",
      fechaExpiracion: documento.fecha_expiracion || null,
    });

    await syncParticipantsFromFlow(client, {
      documentId: newDocumentId,
      participants: normalizedParticipants.map((p) => ({
        role: p.rol,
        name: p.nombre,
        email: p.email,
        rut: p.rut,
        stepOrder: p.stepOrder,
        flowOrder: p.flowOrder,
        flowGroup: p.flowGroup,
      })),
      flowType: normalizedFlowType,
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
        tipo_flujo: normalizedFlowType,
        participants_snapshot: normalizedParticipants.map((p) => ({
          nombre: p.nombre,
          email: p.email,
          rol: p.rol,
          ordenFirma: p.ordenFirma,
          stepOrder: p.stepOrder,
          flowOrder: p.flowOrder,
          flowGroup: p.flowGroup,
        })),
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
        tipo_flujo: normalizedFlowType,
        fecha_expiracion: documento.fecha_expiracion,
        documents_equivalent_id: newDocumentId,
        documents_status: documentsStatus,
        participants_count: normalizedParticipants.length,
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
      tipoFlujo: normalizedFlowType,
      participantsCount: normalizedParticipants.length,
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

module.exports = {
  createFlow,
};
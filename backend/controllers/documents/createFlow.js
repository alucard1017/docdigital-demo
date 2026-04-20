// backend/controllers/documents/createFlow.js

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

  if (!req.user) {
    return res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Usuario no autenticado",
    });
  }

  const client = await getDbClient();

  try {
    await client.query("BEGIN");

    const codigoVerificacion = crypto.randomUUID().slice(0, 8);

    const normalizedFlowType =
      (tipoFlujo || "SECUENCIAL").toUpperCase() === "PARALELO"
        ? "PARALELO"
        : "SECUENCIAL";

    // Normalizar roles de firmantes/visadores
    const normalizedFirmantes = firmantes.map((f, index) => {
      const normalizedRole = normalizeRole(f.rol);

      return {
        ...f,
        rol: normalizedRole,
        ordenFirma:
          typeof f.ordenFirma === "number" && f.ordenFirma > 0
            ? f.ordenFirma
            : index + 1,
      };
    });

    const hasAtLeastOneSigner = normalizedFirmantes.some(
      (f) => f.rol !== "VISADOR"
    );

    if (!hasAtLeastOneSigner) {
      await rollbackSafely(client);
      return res.status(400).json({
        code: "NO_SIGNERS",
        message:
          "El flujo debe tener al menos un firmante distinto de visador.",
      });
    }

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

    // Insertar firmantes legacy
    for (const [index, f] of normalizedFirmantes.entries()) {
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

    // Evento legacy de creación
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

    // Mirror en documents
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

    // Sincronizar participants (signers + visadores)
    const signersArray = normalizedFirmantes
      .filter((f) => f.rol !== "VISADOR")
      .map((f) => ({ name: f.nombre, email: f.email }));

    const visadoresArray = normalizedFirmantes
      .filter((f) => f.rol === "VISADOR")
      .map((f) => ({ name: f.nombre, email: f.email }));

    await syncParticipantsFromFlow(client, {
      documentId: newDocumentId,
      signers: signersArray,
      visadores: visadoresArray,
    });

    // Eventos en document_events
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
        tipo_flujo: normalizedFlowType,
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

module.exports = {
  createFlow,
};
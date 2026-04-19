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

module.exports = {
  createFlow,
};
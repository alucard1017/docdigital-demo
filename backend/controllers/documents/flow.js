// backend/controllers/documents/flow.js

const common = require("./common");
const { crypto, DOCUMENT_STATES } = common;

const pool = common?.db?.pool || common?.db;
if (!pool || typeof pool.query !== "function") {
  throw new Error(
    "No se pudo resolver un cliente/pool SQL válido desde ./common"
  );
}

const getDbClient = async () => {
  if (typeof pool.connect === "function") {
    return pool.connect();
  }

  return {
    query: (...args) => pool.query(...args),
    release: () => {},
  };
};

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
const {
  getClientIp,
  getUserAgent,
} = require("./documentEventUtils");
const {
  insertDocumentEvent,
} = require("./documentEventInserts");

/* ================================
   Helpers transacción + espejo
   ================================ */

const rollbackSafely = async (client) => {
  if (!client) return;
  try {
    await client.query("ROLLBACK");
  } catch (e) {
    console.error("❌ Error en rollback:", e.message);
    console.error(e.stack);
  }
};

const upsertDocumentMirror = async (
  client,
  {
    nuevoDocumentoId,
    title,
    status,
    companyId,
    ownerId,
    filePath = null,
    description = null,
    signFlowType = "SEQUENTIAL",
    notaryMode = "NONE",
    countryCode = "CL",
    enviadoEn = null,
    firmadoEn = null,
    fechaExpiracion = null,
    signedFilePath = null,
    legalSummary = null,
    hashOriginalFile = null,
    hashFinalFile = null,
    rutEmisor = null,
  }
) => {
  const query = `
    INSERT INTO documents (
      nuevo_documento_id,
      title,
      description,
      file_path,
      status,
      company_id,
      owner_id,
      sign_flow_type,
      notary_mode,
      country_code,
      enviado_en,
      firmado_en,
      fecha_expiracion,
      signed_file_path,
      legal_summary,
      hash_original_file,
      hash_final_file,
      rut_emisor,
      created_at,
      updated_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
      $11,$12,$13,$14,$15,$16,$17,$18,
      NOW(),NOW()
    )
    ON CONFLICT (nuevo_documento_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      file_path = EXCLUDED.file_path,
      status = EXCLUDED.status,
      company_id = EXCLUDED.company_id,
      owner_id = EXCLUDED.owner_id,
      sign_flow_type = EXCLUDED.sign_flow_type,
      notary_mode = EXCLUDED.notary_mode,
      country_code = EXCLUDED.country_code,
      enviado_en = EXCLUDED.enviado_en,
      firmado_en = EXCLUDED.firmado_en,
      fecha_expiracion = EXCLUDED.fecha_expiracion,
      signed_file_path = EXCLUDED.signed_file_path,
      legal_summary = EXCLUDED.legal_summary,
      hash_original_file = EXCLUDED.hash_original_file,
      hash_final_file = EXCLUDED.hash_final_file,
      rut_emisor = EXCLUDED.rut_emisor,
      updated_at = NOW()
    RETURNING id;
  `;

  const values = [
    nuevoDocumentoId,
    title,
    description,
    filePath,
    status,
    companyId,
    ownerId,
    signFlowType,
    notaryMode,
    countryCode,
    enviadoEn,
    firmadoEn,
    fechaExpiracion,
    signedFilePath,
    legalSummary,
    hashOriginalFile,
    hashFinalFile,
    rutEmisor,
  ];

  const result = await client.query(query, values);
  return result.rows[0].id;
};

/* ================================
   Sincronizar document_participants
   desde visadores + firmantes
   ================================ */

async function syncParticipantsFromFlow(client, {
  documentId,
  signers = [],
  visadores = [],
}) {
  await client.query(
    `DELETE FROM document_participants WHERE document_id = $1`,
    [documentId]
  );

  const values = [];
  const inserts = [];
  let idx = 1;

  // Visadores (grupo 1)
  visadores.forEach((v, i) => {
    inserts.push(
      `($${idx++}, 'VISADOR', 'PENDIENTE', NULL, NULL, NOW(), NOW(), $${idx++}, $${idx++}, 'VISADOR', $${idx++}, $${idx++}, $${idx++})`
    );
    values.push(
      documentId,           // document_id
      i + 1,                // step_order
      i + 1,                // flow_order
      v.name,               // name
      v.email,              // email
      1                     // flow_group
    );
  });

  const offset = visadores.length;

  // Firmantes (grupo 2, o 1 si no hay visadores)
  signers.forEach((s, i) => {
    inserts.push(
      `($${idx++}, 'FIRMANTE', 'PENDIENTE', NULL, NULL, NOW(), NOW(), $${idx++}, $${idx++}, 'FIRMANTE', $${idx++}, $${idx++}, $${idx++})`
    );
    values.push(
      documentId,                  // document_id
      offset + i + 1,              // step_order
      offset + i + 1,              // flow_order
      s.name,                      // name
      s.email,                     // email
      visadores.length > 0 ? 2 : 1 // flow_group
    );
  });

  if (!inserts.length) return;

  const sql = `
    INSERT INTO document_participants (
      document_id,
      role_in_doc,
      status,
      signed_at,
      comments,
      created_at,
      updated_at,
      step_order,
      flow_order,
      "role",
      "name",
      email,
      flow_group
    )
    VALUES ${inserts.join(", ")}
  `;

  await client.query(sql, values);
}

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
  {
    documentId,
    signers,
    intervalDays,
    maxAttempts,
    companyId,
  }
) => {
  if (!documentId || !signers?.length) return 0;

  // Primer recordatorio a las 12h
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

const getDocumentFlowType = async (client, documentId) => {
  const result = await client.query(
    `
    SELECT tipo_flujo
    FROM documentos
    WHERE id = $1
    `,
    [documentId]
  );

  return result.rows[0]?.tipo_flujo || "SECUENCIAL";
};

const validateSequentialSigning = async (client, { documentId, order }) => {
  const pendingBeforeRes = await client.query(
    `
    SELECT COUNT(*) AS pendientes
    FROM firmantes
    WHERE documento_id = $1
      AND orden_firma < $2
      AND estado <> 'FIRMADO'
    `,
    [documentId, order]
  );

  return Number(pendingBeforeRes.rows[0]?.pendientes || 0);
};

const updateParticipantStatus = async (client, { documentId, email, role }) => {
  await client.query(
    `
    UPDATE document_participants
    SET status = 'FIRMADO',
        signed_at = NOW(),
        updated_at = NOW()
    WHERE document_id = $1
      AND email = $2
      AND role_in_doc = COALESCE($3, role_in_doc)
    `,
    [documentId, email, role || null]
  );
};

const countLegacySignatures = async (client, documentId) => {
  const countRes = await client.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE estado = 'FIRMADO') AS firmados,
      COUNT(*) AS total
    FROM firmantes
    WHERE documento_id = $1
    `,
    [documentId]
  );

  const row = countRes.rows[0] || {};
  return {
    firmadosNum: Number(row.firmados || 0),
    totalNum: Number(row.total || 0),
  };
};

const countParticipantSignatures = async (client, documentId) => {
  if (!documentId) {
    return {
      firmadosDpNum: 0,
      totalDpNum: 0,
    };
  }

  const dpCountRes = await client.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE status = 'FIRMADO') AS firmados_dp,
      COUNT(*) AS total_dp
    FROM document_participants
    WHERE document_id = $1
    `,
    [documentId]
  );

  const row = dpCountRes.rows[0] || {};
  return {
    firmadosDpNum: Number(row.firmados_dp || 0),
    totalDpNum: Number(row.total_dp || 0),
  };
};

/* ================================
   Mapeo de estados
   ================================ */

const mapLegacyStatusToDocumentsStatus = (legacyStatus) => {
  switch (legacyStatus) {
    case "BORRADOR":
      return DOCUMENT_STATES.DRAFT;
    case "EN_FIRMA":
      return "PENDIENTE_FIRMA";
    case "FIRMADO":
      return DOCUMENT_STATES.SIGNED;
    case "RECHAZADO":
      return DOCUMENT_STATES.REJECTED;
    default:
      return legacyStatus || DOCUMENT_STATES.DRAFT;
  }
};

const mapFlowStateAfterSend = () => ({
  legacyStatus: "EN_FIRMA",
  documentsStatus: "PENDIENTE_FIRMA",
});

const mapFlowStateAfterSigned = () => ({
  legacyStatus: "FIRMADO",
  documentsStatus: DOCUMENT_STATES.SIGNED,
});

const mapFlowStateWhileSigning = () => ({
  legacyStatus: "EN_FIRMA",
  documentsStatus: "PENDIENTE_FIRMA",
});

const mapFlowStateAfterRejected = () => ({
  legacyStatus: "RECHAZADO",
  documentsStatus: DOCUMENT_STATES.REJECTED,
});

/* ================================
   Crear flujo (BORRADOR)
   ================================ */
async function createFlow(req, res) {
  console.log("DEBUG crear-flujo body >>>", req.body);

  const { valid, errors } = validateCreateFlowBody(req.body);
  if (!valid) {
    return res.status(400).json({
      error: "Datos inválidos",
      detalles: errors,
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
      status: mapLegacyStatusToDocumentsStatus(documento.estado),
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
      toStatus: DOCUMENT_STATES.DRAFT,
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
      },
    });

    await client.query("COMMIT");

    const metadata = buildDocumentAuditMetadata({
      documentId: documento.id,
      title: documento.titulo,
      status: mapLegacyStatusToDocumentsStatus(documento.estado),
      companyId: documento.company_id || null,
      extra: {
        tipo: documento.tipo,
        categoria_firma: documento.categoria_firma,
        tipo_flujo: documento.tipo_flujo,
        fecha_expiracion: documento.fecha_expiracion,
        documents_equivalent_id: newDocumentId,
        documents_status: mapLegacyStatusToDocumentsStatus(documento.estado),
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
      error: "Error creando flujo de documento",
      detalle: error.message,
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
    return res.status(400).json({ error });
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
      return res.status(404).json({ error: "Documento no encontrado" });
    }

    const documento = docRes.rows[0];

    if (documento.estado !== DOCUMENT_STATES.DRAFT) {
      await rollbackSafely(client);
      return res.status(400).json({
        error: "Solo puedes enviar documentos en estado BORRADOR",
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
        error: "El documento no tiene firmantes configurados",
      });
    }

    const firmantes = firmantesRes.rows;
    const tieneVisador = firmantes.some((f) => f.rol === "VISADOR");

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
        total_firmantes: firmantes.length,
        tiene_visador: tieneVisador,
        categoria_firma: documento.categoria_firma,
        fecha_expiracion: documento.fecha_expiracion,
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
      error: "Error enviando flujo de documento",
      detalle: error.message,
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
      return res.status(404).json({ error: "Firmante no encontrado" });
    }

    const firmante = firmanteRes.rows[0];

    if (firmante.estado === "FIRMADO") {
      await rollbackSafely(client);
      return res.status(400).json({ error: "Este firmante ya firmó" });
    }

    if (firmante.estado === "RECHAZADO") {
      await rollbackSafely(client);
      return res.status(400).json({
        error: "Este firmante rechazó el documento",
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
          error:
            "Aún hay firmantes anteriores en la secuencia que no han firmado",
        });
      }
    }

    const geoData = await getGeoFromIP(req.ip);

    await client.query(
      `
      UPDATE firmantes
      SET estado = 'FIRMADO',
          fecha_firma = NOW(),
          tipo_firma = 'SIMPLE',
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
      SELECT id, company_id
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
      VALUES ($1, $2, 'FIRMADO', $3, $4, $5, NOW())
      `,
      [
        firmante.documento_id,
        firmanteId,
        req.ip || null,
        req.headers["user-agent"] || null,
        JSON.stringify({
          fuente: "API",
          via: "firmar-flujo",
          tipo_flujo: tipoFlujo,
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
            descripcion: "Todos los firmantes han firmado",
            firmados: firmadosNum,
            total: totalNum,
          }),
        ]
      );
    } else if (firmante.rol === "VISADOR") {
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

      await cancelPendingReminders(client, firmante.documento_id);
    }

    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);

    if (newDocumentId) {
      await insertDocumentEvent({
        documentId: newDocumentId,
        participantId: null,
        actor: firmante.nombre || firmante.email || "Firmante interno",
        action: "DOCUMENT_SIGNED",
        details: `Firma registrada para firmante ${firmante.email}`,
        fromStatus: "PENDIENTE_FIRMA",
        toStatus: nuevoEstadoDocuments,
        eventType: "DOCUMENT_SIGNED",
        ipAddress,
        userAgent,
        hashDocument: null,
        companyId: newDocRow?.company_id || firmante.company_id || null,
        userId: null,
        metadata: {
          fuente: "API",
          via: "signFlow",
          tipo_flujo: tipoFlujo,
          firmante_id: firmante.id,
          firmante_email: firmante.email,
          firmante_rol: firmante.rol,
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
    }

    if (allSigned && newDocumentId) {
      await insertDocumentEvent({
        documentId: newDocumentId,
        participantId: null,
        actor: "system",
        action: "DOCUMENT_COMPLETED",
        details: "Documento firmado por todos los firmantes",
        fromStatus: "PENDIENTE_FIRMA",
        toStatus: DOCUMENT_STATES.SIGNED,
        eventType: "DOCUMENT_COMPLETED",
        ipAddress,
        userAgent,
        hashDocument: null,
        companyId: newDocRow?.company_id || firmante.company_id || null,
        userId: null,
        metadata: {
          fuente: "API",
          via: "signFlow",
          firmados: firmadosNum,
          total: totalNum,
        },
      });
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
      action: "DOCUMENT_FLOW_SIGNED",
      entityType: "document",
      entityId: firmante.documento_id,
      metadata,
      req,
    });

    return res.json({
      mensaje: allSigned
        ? "Firma registrada y documento completado"
        : "Firma registrada. Faltan firmantes",
      documentoId: firmante.documento_id,
      documentsId: newDocumentId,
      allSigned,
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
      error: "Error firmando flujo de documento",
      detalle: error.message,
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
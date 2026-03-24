// backend/controllers/documents/flow.js
const { db, crypto, DOCUMENT_STATES } = require("./common");
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

// Sincroniza document_participants a partir de los datos del flujo (visadores + firmantes)
async function syncParticipantsFromFlow({
  documentId,
  signers = [],
  visadores = [],
}) {
  // Borramos participantes existentes de este documento (full replace)
  await db.query(
    `DELETE FROM document_participants WHERE document_id = $1`,
    [documentId]
  );

  const values = [];
  const inserts = [];
  let idx = 1;

  // VISADORES primero (flow_order 1..n)
  visadores.forEach((v, i) => {
    inserts.push(
      `($${idx++}, 'VISADOR', 'PENDIENTE', NULL, NULL, NOW(), NOW(), $${idx++}, $${idx++}, 'VISADOR', $${idx++}, $${idx++})`
    );
    values.push(
      documentId,
      i + 1, // step_order
      i + 1, // flow_order
      v.name,
      v.email
    );
  });

  // FIRMANTES después (flow_order continuo)
  const offset = visadores.length;
  signers.forEach((s, i) => {
    inserts.push(
      `($${idx++}, 'FIRMANTE', 'PENDIENTE', NULL, NULL, NOW(), NOW(), $${idx++}, $${idx++}, 'FIRMANTE', $${idx++}, $${idx++})`
    );
    values.push(
      documentId,
      offset + i + 1,
      offset + i + 1,
      s.name,
      s.email
    );
  });

  if (inserts.length === 0) return;

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
      email
    )
    VALUES ${inserts.join(", ")}
  `;

  await db.query(sql, values);
}

/* ================================
   Crear flujo (BORRADOR, sin enviar correos)
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
    fechaExpiracion, // opcional
    tipoFlujo = "SECUENCIAL", // nuevo
  } = req.body;

  try {
    await db.query("BEGIN");

    const codigoVerificacion = crypto.randomUUID().slice(0, 8);

    const docResult = await db.query(
      `INSERT INTO documentos (
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
       RETURNING *`,
      [
        tipo,                       // $1
        titulo,                     // $2
        DOCUMENT_STATES.DRAFT,      // $3
        codigoVerificacion,         // $4
        categoriaFirma,             // $5
        tipoFlujo,                  // $6
        req.user.id,                // $7
        req.user.company_id,        // $8
        fechaExpiracion || null,    // $9
      ]
    );


    const documento = docResult.rows[0];

    for (const [index, f] of firmantes.entries()) {
      await db.query(
        `INSERT INTO firmantes (
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
         VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE', NOW(), NOW())`,
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

    await db.query(
      `INSERT INTO eventos_firma (
         documento_id,
         tipo_evento,
         metadata,
         created_at
       )
       VALUES ($1, 'CREADO', $2, NOW())`,
      [
        documento.id,
        JSON.stringify({
          fuente: "API",
          creado_por: req.user.id,
          estado_inicial: DOCUMENT_STATES.DRAFT,
        }),
      ]
    );

    // Construir arrays para document_participants
    const signersArray = firmantes
      .filter((f) => f.rol !== "VISADOR")
      .map((f) => ({ name: f.nombre, email: f.email }));

    const visadoresArray = firmantes
      .filter((f) => f.rol === "VISADOR")
      .map((f) => ({ name: f.nombre, email: f.email }));

    // NUEVO: sincronizar document_participants
    await syncParticipantsFromFlow({
      documentId: documento.id,
      signers: signersArray,
      visadores: visadoresArray,
    });

    await db.query("COMMIT");

    const metadata = buildDocumentAuditMetadata({
      documentId: documento.id,
      title: documento.titulo,
      status: documento.estado,
      companyId: documento.company_id,
      extra: {
        categoria_firma: documento.categoria_firma,
        firmantes: firmantes.length,
        fecha_expiracion: documento.fecha_expiracion,
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
      codigoVerificacion,
      estado: documento.estado,
      message: "Flujo de documento creado exitosamente (BORRADOR)",
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("❌ Error creando flujo de documento:", error);
    return res.status(500).json({ error: "Error creando flujo de documento" });
  }
}

/* ================================
   Enviar flujo (BORRADOR -> EN_REVISION / EN_FIRMA)
   + Crear recordatorios automáticos
   ================================ */
async function sendFlow(req, res) {
  const { valid, id, error } = validateSendFlowParams(req.params);
  if (!valid) {
    return res.status(400).json({ error });
  }

  try {
    await db.query("BEGIN");

    const docRes = await db.query(
      `SELECT id, titulo, estado, company_id
       FROM documentos
       WHERE id = $1`,
      [id]
    );

    if (docRes.rowCount === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({ error: "Documento no encontrado" });
    }

    const documento = docRes.rows[0];

    if (documento.estado !== DOCUMENT_STATES.DRAFT) {
      await db.query("ROLLBACK");
      return res.status(400).json({
        error: "Solo puedes enviar documentos en estado BORRADOR",
      });
    }

    const firmantesRes = await db.query(
      `SELECT id, rol, orden_firma, email
       FROM firmantes
       WHERE documento_id = $1
       ORDER BY orden_firma ASC`,
      [id]
    );

    if (firmantesRes.rowCount === 0) {
      await db.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "El documento no tiene firmantes configurados" });
    }

    const firmantes = firmantesRes.rows;
    const tieneVisador = firmantes.some((f) => f.rol === "VISADOR");

    const nuevoEstado = tieneVisador
      ? DOCUMENT_STATES.UNDER_REVIEW
      : DOCUMENT_STATES.SIGNING;

    await db.query(
      `UPDATE documentos
       SET estado = $1,
           enviado_en = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [nuevoEstado, id]
    );

    await db.query(
      `INSERT INTO eventos_firma (
         documento_id,
         tipo_evento,
         metadata,
         created_at
       )
       VALUES ($1, 'ENVIADO', $2, NOW())`,
      [
        id,
        JSON.stringify({
          fuente: "API",
          enviado_por: req.user.id,
          estado_inicial: nuevoEstado,
        }),
      ]
    );

    /* ========= CREAR RECORDATORIOS AUTOMÁTICOS ========= */
    // Obtener configuración de recordatorios de la empresa
    const configRes = await db.query(
      `SELECT interval_days, max_attempts, enabled
       FROM reminder_config
       WHERE company_id = $1`,
      [documento.company_id]
    );

    let intervalDays = 3;
    let maxAttempts = 3;
    let reminderEnabled = true;

    if (configRes.rowCount > 0) {
      const config = configRes.rows[0];
      intervalDays = config.interval_days;
      maxAttempts = config.max_attempts;
      reminderEnabled = config.enabled;
    }

    if (reminderEnabled) {
      const ahora = new Date();
      const proximoRecordatorio = new Date(
        ahora.getTime() + intervalDays * 24 * 60 * 60 * 1000
      );

      for (const firmante of firmantes) {
        await db.query(
          `INSERT INTO recordatorios (
             documento_id,
             firmante_id,
             email,
             tipo,
             status,
             scheduled_at,
             max_attempts,
             created_at,
             updated_at
           )
           VALUES ($1, $2, $3, 'AUTO', 'PENDING', $4, $5, NOW(), NOW())`,
          [
            id,
            firmante.id,
            firmante.email,
            proximoRecordatorio,
            maxAttempts,
          ]
        );
      }

      console.log(
        `✅ Creados ${firmantes.length} recordatorios automáticos para documento ${id} (intervalo: ${intervalDays} días)`
      );
    } else {
      console.log(
        `⏭️ Recordatorios automáticos deshabilitados para empresa ${documento.company_id}`
      );
    }

    await db.query("COMMIT");

// ========= DISPARAR WEBHOOK =========
if (documento.company_id) {
  triggerWebhook(documento.company_id, "document.sent", {
    documentoId: documento.id,
    titulo: documento.titulo,
    estado: nuevoEstado,
    firmantes: firmantes.length,
  }).catch((err) => console.error("Error en webhook:", err));

  // ========= NOTIFICACIÓN WEBSOCKET =========
  emitToCompany(documento.company_id, "document:sent", {
    documentoId: documento.id,
    titulo: documento.titulo,
    estado: nuevoEstado,
  });
}

// ========= NOTIFICAR AL CREADOR POR EMAIL =========
const creadorRes = await db.query(
  `SELECT u.email, u.name
   FROM users u
   JOIN documentos d ON d.creado_por = u.id
   WHERE d.id = $1`,
  [firmante.documento_id]
);

if (creadorRes.rowCount > 0) {
  const creador = creadorRes.rows[0];
  const { sendNotification } = require("../../services/emailService");
  
  const subject = `✅ Documento firmado completamente: ${firmante.titulo}`;
  const html = `
    <h2>Documento firmado exitosamente</h2>
    <p>Hola <strong>${creador.name}</strong>,</p>
    <p>El documento <strong>${firmante.titulo}</strong> ha sido firmado por todos los participantes.</p>
    <p><strong>Total de firmantes:</strong> ${totalNum}</p>
    <p>Puedes descargar el PDF sellado desde tu dashboard.</p>
    <a href="${process.env.FRONTEND_URL}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;margin-top:16px;">
      Ver en VeriFirma
    </a>
  `;

  sendNotification(creador.email, subject, html).catch(err => 
    console.error("Error enviando notificación al creador:", err)
  );
}

    const metadata = buildDocumentAuditMetadata({
      documentId: documento.id,
      title: documento.titulo,
      status: nuevoEstado,
      companyId: documento.company_id,
      extra: {
        firmantes: firmantes.length,
        tieneVisador,
        recordatorios_creados: reminderEnabled ? firmantes.length : 0,
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
      estado: nuevoEstado,
      recordatoriosCreados: reminderEnabled ? firmantes.length : 0,
      message: "Documento enviado a firma correctamente",
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("❌ Error enviando flujo de documento:", error);
    return res.status(500).json({ error: "Error enviando flujo de documento" });
  }
}

/* ================================
   Firmar flujo por firmante (público, por firmanteId)
   ================================ */
async function signFlow(req, res) {
  const { firmanteId } = req.params;

  try {
    await db.query("BEGIN");

    const firmanteRes = await db.query(
      `SELECT
         f.*,
         d.id     AS documento_id,
         d.estado AS documento_estado,
         d.titulo,
         d.company_id
       FROM firmantes f
       JOIN documentos d ON d.id = f.documento_id
       WHERE f.id = $1`,
      [firmanteId]
    );

    if (firmanteRes.rowCount === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({ error: "Firmante no encontrado" });
    }

    const firmante = firmanteRes.rows[0];

    if (firmante.estado === "FIRMADO") {
      await db.query("ROLLBACK");
      return res.status(400).json({ error: "Este firmante ya firmó" });
    }

    if (firmante.estado === "RECHAZADO") {
      await db.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Este firmante rechazó el documento" });
    }

// Validar orden SOLO si el flujo es SECUENCIAL
const docTipoRes = await db.query(
  `SELECT tipo_flujo FROM documentos WHERE id = $1`,
  [firmante.documento_id]
);

const tipoFlujo = docTipoRes.rows[0]?.tipo_flujo || "SECUENCIAL";

if (tipoFlujo === "SECUENCIAL") {
  const pendingBeforeRes = await db.query(
    `SELECT COUNT(*) AS pendientes
     FROM firmantes
     WHERE documento_id = $1
       AND orden_firma < $2
       AND estado <> 'FIRMADO'`,
    [firmante.documento_id, firmante.orden_firma]
  );
  const pendientesAntes = Number(pendingBeforeRes.rows[0].pendientes);

  if (pendientesAntes > 0) {
    await db.query("ROLLBACK");
    return res.status(400).json({
      error:
        "Aún hay firmantes anteriores en la secuencia que no han firmado",
    });
  }
}

// Obtener geolocalización
const geoData = await getGeoFromIP(req.ip);

await db.query(
  `UPDATE firmantes
   SET estado = 'FIRMADO',
       fecha_firma = NOW(),
       tipo_firma = 'SIMPLE',
       ip_firma = $2,
       user_agent_firma = $3,
       geo_location = $4,
       updated_at = NOW()
   WHERE id = $1`,
  [
    firmanteId, 
    req.ip || null, 
    req.headers["user-agent"] || null,
    JSON.stringify(geoData),
  ]
);

    // NUEVO: marcar también en document_participants como FIRMADO
    await db.query(
      `
      UPDATE document_participants
      SET status = 'FIRMADO',
          signed_at = NOW(),
          updated_at = NOW()
      WHERE document_id = $1
        AND email = $2
        AND role_in_doc = COALESCE($3, role_in_doc)
      `,
      [
        firmante.documento_id,
        firmante.email,
        firmante.rol || null,
      ]
    );

    await db.query(
      `INSERT INTO eventos_firma (
         documento_id,
         firmante_id,
         tipo_evento,
         ip,
         user_agent,
         metadata,
         created_at
       )
       VALUES ($1, $2, 'FIRMADO', $3, $4, $5, NOW())`,
      [
        firmante.documento_id,
        firmanteId,
        req.ip || null,
        req.headers["user-agent"] || null,
        JSON.stringify({ fuente: "API", via: "firmar-flujo" }),
      ]
    );

     const countRes = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE estado = 'FIRMADO') AS firmados,
         COUNT(*) AS total
       FROM firmantes
       WHERE documento_id = $1`,
      [firmante.documento_id]
    );

    const { firmados, total } = countRes.rows[0];
    const firmadosNum = Number(firmados);
    const totalNum = Number(total);
    const allSigned = firmadosNum >= totalNum;

    // NUEVO: recuento también con document_participants (por ahora solo para debug/futuro)
    const dpCountRes = await db.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status = 'FIRMADO') AS firmados_dp,
        COUNT(*) AS total_dp
      FROM document_participants
      WHERE document_id = $1
      `,
      [firmante.documento_id]
    );

    const { firmados_dp, total_dp } = dpCountRes.rows[0];
    const firmadosDpNum = Number(firmados_dp);
    const totalDpNum = Number(total_dp);
    const allSignedDp = firmadosDpNum >= totalDpNum;

    console.log(
      `DEBUG firmas legacy: ${firmadosNum}/${totalNum}, participants: ${firmadosDpNum}/${totalDpNum}`
    );

    let nuevoEstadoDocumento = firmante.documento_estado;

    if (allSigned) {
      nuevoEstadoDocumento = DOCUMENT_STATES.SIGNED;
      await db.query(
        `UPDATE documentos
         SET estado = $1,
             firmado_en = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [DOCUMENT_STATES.SIGNED, firmante.documento_id]
      );

      // ========= CANCELAR RECORDATORIOS =========
      await db.query(
        `UPDATE recordatorios
         SET status = 'CANCELLED',
             updated_at = NOW()
         WHERE documento_id = $1
           AND status IN ('PENDING', 'SENT')`,
        [firmante.documento_id]
      );

      console.log(
        `🛑 Recordatorios cancelados para documento ${firmante.documento_id}`
      );

// ========= DISPARAR WEBHOOK =========
if (firmante.company_id) {
  triggerWebhook(firmante.company_id, "document.signed", {
    documentoId: firmante.documento_id,
    titulo: firmante.titulo,
    firmantes_totales: totalNum,
  }).catch((err) => console.error("Error en webhook:", err));

  // ========= NOTIFICACIÓN WEBSOCKET =========
  emitToCompany(firmante.company_id, "document:signed", {
    documentoId: firmante.documento_id,
    titulo: firmante.titulo,
  });
}
      await db.query(
        `INSERT INTO eventos_firma (
           documento_id,
           tipo_evento,
           metadata,
           created_at
         )
         VALUES ($1, 'DOCUMENTO_FIRMADO_COMPLETO', $2, NOW())`,
        
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
      nuevoEstadoDocumento = DOCUMENT_STATES.SIGNING;
      await db.query(
        `UPDATE documentos
         SET estado = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [DOCUMENT_STATES.SIGNING, firmante.documento_id]
      );
    }

    await db.query("COMMIT");

    const metadata = buildDocumentAuditMetadata({
      documentId: firmante.documento_id,
      title: firmante.titulo,
      status: nuevoEstadoDocumento,
      companyId: firmante.company_id || null,
      extra: {
        firmante_id: firmante.id,
        firmante_email: firmante.email,
        all_signed: allSigned,
        progress: ((firmadosNum / totalNum) * 100).toFixed(1) + "%",
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
      allSigned,
      progress: ((firmadosNum / totalNum) * 100).toFixed(1) + "%",
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("❌ Error firmando flujo de documento:", error);
    return res
      .status(500)
      .json({ error: "Error firmando flujo de documento" });
  }
}

module.exports = {
  createFlow,
  sendFlow,
  signFlow,
};

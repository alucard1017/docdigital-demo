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
         creado_por,
         company_id,
         fecha_expiracion,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING *`,
      [
        tipo,
        titulo,
        DOCUMENT_STATES.DRAFT,
        codigoVerificacion,
        categoriaFirma,
        req.user.id,
        req.user.company_id,
        fechaExpiracion || null,
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
    const ahora = new Date();
    const proximoRecordatorio = new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 días después

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
         VALUES ($1, $2, $3, 'AUTO', 'PENDING', $4, 3, NOW(), NOW())`,
        [id, firmante.id, firmante.email, proximoRecordatorio]
      );
    }

    console.log(
      `✅ Creados ${firmantes.length} recordatorios automáticos para documento ${id}`
    );

    await db.query("COMMIT");

    const metadata = buildDocumentAuditMetadata({
      documentId: documento.id,
      title: documento.titulo,
      status: nuevoEstado,
      companyId: documento.company_id,
      extra: {
        firmantes: firmantes.length,
        tieneVisador,
        recordatorios_creados: firmantes.length,
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
      recordatoriosCreados: firmantes.length,
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

    await db.query(
      `UPDATE firmantes
       SET estado = 'FIRMADO',
           fecha_firma = NOW(),
           tipo_firma = 'SIMPLE',
           ip_firma = $2,
           user_agent_firma = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [firmanteId, req.ip || null, req.headers["user-agent"] || null]
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

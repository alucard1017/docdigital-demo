const { db, sellarPdfConQr, DOCUMENT_STATES } = require("./common");
const { logAudit } = require("../../utils/auditLog");

/* ================================
   Helpers internos
   ================================ */

const parseId = (raw) => {
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
};

function getClientIp(req) {
  return (
    (req.headers["x-real-ip"] ||
      req.headers["x-forwarded-for"]?.toString().split(",").pop().trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null) || null
  );
}

function getUserAgent(req) {
  return req.headers["user-agent"] || null;
}

function getDocumentHash(doc) {
  return (
    doc.final_hash_sha256 ||
    doc.sealed_hash_sha256 ||
    doc.hash_final_file ||
    doc.pdf_hash_final ||
    doc.hash_sha256 ||
    doc.hash_original_file ||
    null
  );
}

function buildOwnerMetadata({
  doc,
  req,
  fromStatus,
  toStatus,
  eventType,
  extra = {},
}) {
  return {
    source: "owner_panel",
    actor_type: "OWNER",
    owner_id: req?.user?.id || null,
    owner_name: req?.user?.name || null,
    document_title: doc.title || null,
    document_id: doc.id,
    company_id: doc.company_id || null,
    from_status: fromStatus,
    to_status: toStatus,
    event_type: eventType,
    ...extra,
  };
}

/* ================================
   POST: Firmar documento (propietario)
   ================================ */
async function signDocument(req, res) {
  try {
    const id = parseId(req.params.id);
    const userId = req.user.id;

    if (id === null) {
      return res.status(400).json({ message: "ID de documento inválido" });
    }

    const current = await db.query(
      `
      SELECT *
      FROM documents
      WHERE id = $1 AND owner_id = $2
      `,
      [id, userId]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: "No encontrado" });
    }

    const docActual = current.rows[0];

    if (docActual.status === DOCUMENT_STATES.SIGNED) {
      return res.status(400).json({ message: "El documento ya está firmado" });
    }

    if (docActual.status === DOCUMENT_STATES.REJECTED) {
      return res.status(400).json({ message: "Documento rechazado" });
    }

    if (
      docActual.requires_visado === true &&
      docActual.status === "PENDIENTE_VISADO"
    ) {
      return res.status(400).json({
        message: "Este documento requiere visación antes de firmar",
      });
    }

    const updateRes = await db.query(
      `
      UPDATE documents
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2 AND owner_id = $3
      RETURNING *
      `,
      [DOCUMENT_STATES.SIGNED, id, userId]
    );

    const doc = updateRes.rows[0];

    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    const hashDocument = getDocumentHash(doc);

    const fromStatus = docActual.status;
    const toStatus = DOCUMENT_STATES.SIGNED;
    const eventType = "SIGNED_OWNER";

    await db.query(
      `
      INSERT INTO document_events (
        document_id,
        participant_id,
        actor,
        action,
        details,
        from_status,
        to_status,
        event_type,
        ip_address,
        user_agent,
        hash_document,
        company_id,
        user_id,
        metadata
      )
      VALUES (
        $1, NULL, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13
      )
      `,
      [
        doc.id,
        req.user.name || "Propietario",
        "DOCUMENT_SIGNED_OWNER",
        "Firmado por propietario (aceptó aviso legal de uso de firma electrónica simple, con equivalencia a firma manuscrita conforme a la Ley N° 19.799).",
        fromStatus,
        toStatus,
        eventType,
        ipAddress,
        userAgent,
        hashDocument,
        doc.company_id || null,
        req.user.id || null,
        JSON.stringify(
          buildOwnerMetadata({ doc, req, fromStatus, toStatus, eventType })
        ),
      ]
    );

    await logAudit({
      user: req.user,
      action: "document_signed",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        from_status: fromStatus,
        to_status: toStatus,
      },
      req,
    });

    // Sellar PDF con QR / código y actualizar pdf_final_url si aplica
    try {
      if (doc.nuevo_documento_id) {
        const docNuevoRes = await db.query(
          `
          SELECT id, codigo_verificacion, categoria_firma
          FROM documentos
          WHERE id = $1
          `,
          [doc.nuevo_documento_id]
        );

        if (docNuevoRes.rowCount > 0) {
          const docNuevo = docNuevoRes.rows[0];
          const sourceKey = doc.pdf_original_url || doc.file_path;

          if (sourceKey) {
            await sellarPdfConQr({
              s3Key: sourceKey,
              documentoId: docNuevo.id,
              codigoVerificacion: docNuevo.codigo_verificacion,
              categoriaFirma: docNuevo.categoria_firma || "SIMPLE",
              numeroContratoInterno: doc.numero_contrato_interno,
            });

            const updatedDocRes = await db.query(
              `
              SELECT pdf_final_url
              FROM documents
              WHERE id = $1
              `,
              [doc.id]
            );

            if (updatedDocRes.rowCount > 0) {
              doc.pdf_final_url = updatedDocRes.rows[0].pdf_final_url;
            }
          }
        }
      }
    } catch (sealError) {
      console.error("⚠️ Error sellando PDF con QR:", sealError);
    }

    return res.json({
      ...doc,
      file_url: doc.pdf_final_url || doc.file_path,
      message: "Documento firmado exitosamente",
    });
  } catch (err) {
    console.error("❌ Error firmando documento:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   POST: Visar documento (propietario)
   ================================ */

async function viserDocumentInternalUpdate(id, userId, req = null) {
  const numericId = parseId(id);

  if (numericId === null) {
    return {
      error: { status: 400, body: { message: "ID de documento inválido" } },
    };
  }

  const current = await db.query(
    `
    SELECT *
    FROM documents
    WHERE id = $1 AND owner_id = $2
    `,
    [numericId, userId]
  );

  if (current.rowCount === 0) {
    return { error: { status: 404, body: { message: "No encontrado" } } };
  }

  const docActual = current.rows[0];

  if (docActual.status === DOCUMENT_STATES.SIGNED) {
    return { error: { status: 400, body: { message: "Ya firmado" } } };
  }

  if (docActual.status === DOCUMENT_STATES.REJECTED) {
    return {
      error: { status: 400, body: { message: "Documento rechazado" } },
    };
  }

  if (docActual.requires_visado !== true) {
    return {
      error: {
        status: 400,
        body: { message: "Este documento no requiere visación" },
      },
    };
  }

  if (docActual.status !== "PENDIENTE_VISADO") {
    return {
      error: {
        status: 400,
        body: {
          message:
            "Solo se pueden visar documentos en estado PENDIENTE_VISADO",
        },
      },
    };
  }

  const result = await db.query(
    `
    UPDATE documents
    SET status = $1,
        updated_at = NOW()
    WHERE id = $2 AND owner_id = $3
    RETURNING *
    `,
    ["PENDIENTE_FIRMA", numericId, userId]
  );

  const doc = result.rows[0];

  const ipAddress = req ? getClientIp(req) : null;
  const userAgent = req ? getUserAgent(req) : null;
  const hashDocument = getDocumentHash(doc);

  const fromStatus = docActual.status;
  const toStatus = "PENDIENTE_FIRMA";
  const eventType = "VISADO_OWNER";

  await db.query(
    `
    INSERT INTO document_events (
      document_id,
      participant_id,
      actor,
      action,
      details,
      from_status,
      to_status,
      event_type,
      ip_address,
      user_agent,
      hash_document,
      company_id,
      user_id,
      metadata
    )
    VALUES (
      $1, NULL, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12, $13
    )
    `,
    [
      doc.id,
      req?.user?.name || "Propietario",
      "DOCUMENT_VISADO_OWNER",
      "Documento visado por el propietario",
      fromStatus,
      toStatus,
      eventType,
      ipAddress,
      userAgent,
      hashDocument,
      doc.company_id || null,
      req?.user?.id || null,
      JSON.stringify(
        buildOwnerMetadata({ doc, req, fromStatus, toStatus, eventType })
      ),
    ]
  );

  return { doc, docActual };
}

async function visarDocument(req, res) {
  try {
    const id = req.params.id;
    const userId = req.user.id;

    const result = await viserDocumentInternalUpdate(id, userId, req);
    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }

    const { doc, docActual } = result;

    await logAudit({
      user: req.user,
      action: "document_visado",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        from_status: docActual.status,
        to_status: "PENDIENTE_FIRMA",
      },
      req,
    });

    return res.json({
      ...doc,
      file_url: doc.pdf_final_url || doc.file_path,
      message: "Documento visado exitosamente",
    });
  } catch (err) {
    console.error("❌ Error visado documento:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   POST: Rechazar documento (propietario)
   ================================ */
async function rejectDocument(req, res) {
  try {
    const id = parseId(req.params.id);
    const { motivo } = req.body || {};
    const userId = req.user.id;

    if (id === null) {
      return res.status(400).json({ message: "ID de documento inválido" });
    }

    if (!motivo || !motivo.trim()) {
      return res
        .status(400)
        .json({ message: "Debes indicar un motivo de rechazo." });
    }

    const current = await db.query(
      `
      SELECT *
      FROM documents
      WHERE id = $1 AND owner_id = $2
      `,
      [id, userId]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: "No encontrado" });
    }

    const docActual = current.rows[0];

    if (docActual.status === DOCUMENT_STATES.SIGNED) {
      return res.status(400).json({
        message: "Ya firmado, no se puede rechazar",
      });
    }

    if (docActual.status === DOCUMENT_STATES.REJECTED) {
      return res.status(400).json({ message: "Ya rechazado" });
    }

    const rejectReason = motivo.trim();

    const result = await db.query(
      `
      UPDATE documents
      SET status = $1,
          reject_reason = $2,
          updated_at = NOW()
      WHERE id = $3 AND owner_id = $4
      RETURNING *
      `,
      [DOCUMENT_STATES.REJECTED, rejectReason, id, userId]
    );

    const doc = result.rows[0];

    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    const hashDocument = getDocumentHash(doc);

    const fromStatus = docActual.status;
    const toStatus = DOCUMENT_STATES.REJECTED;
    const eventType = "REJECTED_OWNER";

    await db.query(
      `
      INSERT INTO document_events (
        document_id,
        participant_id,
        actor,
        action,
        details,
        from_status,
        to_status,
        event_type,
        ip_address,
        user_agent,
        hash_document,
        company_id,
        user_id,
        metadata
      )
      VALUES (
        $1, NULL, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13
      )
      `,
      [
        doc.id,
        req.user.name || "Propietario",
        "DOCUMENT_REJECTED_OWNER",
        `Documento rechazado: ${rejectReason}`,
        fromStatus,
        toStatus,
        eventType,
        ipAddress,
        userAgent,
        hashDocument,
        doc.company_id || null,
        req.user.id || null,
        JSON.stringify(
          buildOwnerMetadata({
            doc,
            req,
            fromStatus,
            toStatus,
            eventType,
            extra: { reason: rejectReason },
          })
        ),
      ]
    );

    await logAudit({
      user: req.user,
      action: "document_rejected",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        motivo: rejectReason,
        from_status: fromStatus,
        to_status: toStatus,
      },
      req,
    });

    return res.json({
      ...doc,
      file_url: doc.pdf_final_url || doc.file_path,
      message: "Documento rechazado exitosamente",
    });
  } catch (err) {
    console.error("❌ Error rechazando documento:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

module.exports = {
  signDocument,
  viserDocumentInternalUpdate,
  visarDocument,
  rejectDocument,
};
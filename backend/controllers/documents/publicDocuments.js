// backend/controllers/documents/publicDocuments.js
const db = require("../../db");
const { getSignedUrl } = require("../../services/storageR2");
const { sellarPdfConQr } = require("../../services/pdfSeal");
const { logAudit } = require("../../utils/auditLog");

/* ================================
   Utilidades comunes
   ================================ */

function isExpired(dateLike) {
  if (!dateLike) return false;
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? false : d < new Date();
}

function formatDateSafe(dateLike) {
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

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

function getDocumentHash(docRow) {
  if (!docRow) return null;
  return (
    docRow.final_hash_sha256 ||
    docRow.sealed_hash_sha256 ||
    docRow.hash_final_file ||
    docRow.pdf_hash_final ||
    docRow.hash_sha256 ||
    docRow.hash_original_file ||
    null
  );
}

function buildPublicMetadataBase({ doc, extra = {} }) {
  return {
    source: "public_link",
    document_id: doc?.id || null,
    company_id: doc?.company_id || null,
    numero_contrato_interno: doc?.numero_contrato_interno || null,
    ...extra,
  };
}

/**
 * Helper: busca documento + firmante asociado usando signature_token del DOCUMENTO.
 * Opcionalmente filtra por email (para amarrar firmante concreto).
 */
async function getDocumentAndSignerByDocumentToken(
  documentToken,
  emailFromQuery = null
) {
  const docRes = await db.query(
    `
    SELECT
      d.*,
      s.id     AS signer_id,
      s.status AS signer_status,
      s.name   AS signer_name,
      s.email  AS signer_email
    FROM documents d
    LEFT JOIN document_signers s
      ON s.document_id = d.id
      AND ($2::text IS NULL OR s.email = $2)
    WHERE d.signature_token = $1
    LIMIT 1
    `,
    [documentToken, emailFromQuery]
  );

  if (docRes.rowCount === 0) return null;
  return docRes.rows[0];
}

/* ================================
   GET: Datos + PDF para enlace público de FIRMA (por firmante, sign_token)
   ================================ */
async function getPublicDocBySignerToken(req, res) {
  try {
    const { token } = req.params;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Token inválido" });
    }

    const result = await db.query(
      `
      SELECT 
        d.*,
        d.destinatario_nombre,
        d.empresa_rut,
        d.requires_visado,
        d.signature_status,
        d.signature_token_expires_at,
        d.firmante_nombre,
        d.firmante_run,
        d.numero_contrato_interno,
        COALESCE(
          d.numero_contrato_interno,
          d.metadata->>'numero_contrato',
          d.metadata->>'numero_interno',
          d.metadata->>'contract_number',
          d.metadata->>'codigo_contrato'
        ) AS numero_contrato,
        s.id     AS signer_id,
        s.name   AS signer_name,
        s.email  AS signer_email,
        s.status AS signer_status,
        s.role   AS signer_role
      FROM document_signers s
      JOIN documents d ON d.id = s.document_id
      WHERE s.sign_token = $1
      `,
      [token]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Enlace inválido o documento no encontrado" });
    }

    const row = result.rows[0];

    if (isExpired(row.signature_token_expires_at)) {
      return res.status(410).json({
        message: "El enlace público ha expirado. Solicita uno nuevo al emisor.",
      });
    }

    const basePath =
      row.pdf_final_url || row.pdf_original_url || row.file_path || null;

    if (!basePath) {
      return res
        .status(404)
        .json({ message: "Documento sin archivo asociado" });
    }

    const pdfUrl = await getSignedUrl(basePath, 3600);

    // Registrar apertura específica de firmante
    try {
      const ipAddress = getClientIp(req);
      const userAgent = getUserAgent(req);
      const hashDocument = getDocumentHash(row);

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
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14
        )
        `,
        [
          row.id,
          row.signer_id || null,
          row.signer_name || row.signer_email || "Firmante externo",
          "PUBLIC_LINK_OPENED_SIGNER",
          "Apertura de enlace público de firma por firmante",
          row.status,
          row.status,
          "PUBLIC_LINK_OPENED_SIGNER",
          ipAddress,
          userAgent,
          hashDocument,
          row.company_id || null,
          null,
          JSON.stringify(
            buildPublicMetadataBase({
              doc: row,
              extra: {
                actor_type: "PUBLIC_SIGNER",
                signer_id: row.signer_id,
                signer_email: row.signer_email,
                signer_name: row.signer_name,
                opened_at: formatDateSafe(new Date()),
                link_type: "signer_token",
              },
            })
          ),
        ]
      );
    } catch (eventErr) {
      console.error(
        "⚠️ Error registrando PUBLIC_LINK_OPENED_SIGNER:",
        eventErr
      );
    }

    return res.json({
      document: {
        id: row.id,
        title: row.title,
        status: row.status,
        destinatario_nombre: row.destinatario_nombre,
        empresa_rut: row.empresa_rut,
        requires_visado: row.requires_visado,
        signature_status: row.signature_status,
        firmante_nombre: row.firmante_nombre,
        firmante_run: row.firmante_run,
        numero_contrato_interno: row.numero_contrato_interno,
        numero_contrato: row.numero_contrato || row.numero_contrato_interno || "",
        pdf_final_url: row.pdf_final_url || null,
        pdf_original_url: row.pdf_original_url || null,
      },
      currentSigner: {
        id: row.signer_id,
        name: row.signer_name,
        email: row.signer_email,
        status: row.signer_status,
        role: row.signer_role || "FIRMANTE",
      },
      pdfUrl,
    });
  } catch (err) {
    console.error("❌ Error cargando documento público (firmante):", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   GET: Datos + PDF usando signature_token del DOCUMENTO
   (enlace genérico, sin firmante concreto)
   ================================ */
async function getPublicDocByDocumentToken(req, res) {
  try {
    const { token } = req.params;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Token inválido" });
    }

    const result = await db.query(
      `
      SELECT 
        d.*,
        d.destinatario_nombre,
        d.empresa_rut,
        d.requires_visado,
        d.signature_status,
        d.signature_token_expires_at,
        d.firmante_nombre,
        d.firmante_run,
        d.numero_contrato_interno,
        d.visador_nombre,
        COALESCE(
          d.numero_contrato_interno,
          d.metadata->>'numero_contrato',
          d.metadata->>'numero_interno',
          d.metadata->>'contract_number',
          d.metadata->>'codigo_contrato'
        ) AS numero_contrato
      FROM documents d
      WHERE d.signature_token = $1
      `,
      [token]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Enlace inválido o documento no encontrado" });
    }

    const doc = result.rows[0];

    if (isExpired(doc.signature_token_expires_at)) {
      return res.status(410).json({
        message: "El enlace público ha expirado. Solicita uno nuevo al emisor.",
      });
    }

    const basePath =
      doc.pdf_final_url || doc.pdf_original_url || doc.file_path || null;

    if (!basePath) {
      return res
        .status(404)
        .json({ message: "Documento sin archivo asociado" });
    }

    const pdfUrl = await getSignedUrl(basePath, 3600);

    // Registrar apertura de invitación genérica
    try {
      const ipAddress = getClientIp(req);
      const userAgent = getUserAgent(req);
      const hashDocument = getDocumentHash(doc);

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
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14
        )
        `,
        [
          doc.id,
          null,
          "PUBLIC_USER",
          "INVITATION_OPENED",
          "Apertura de invitación pública de documento",
          doc.status,
          doc.status,
          "INVITATION_OPENED",
          ipAddress,
          userAgent,
          hashDocument,
          doc.company_id || null,
          null,
          JSON.stringify(
            buildPublicMetadataBase({
              doc,
              extra: {
                actor_type: "PUBLIC_VIEWER",
                opened_at: formatDateSafe(new Date()),
                link_type: "document_token",
              },
            })
          ),
        ]
      );
    } catch (eventErr) {
      console.error(
        "⚠️ Error registrando INVITATION_OPENED (document_events):",
        eventErr
      );
    }

    return res.json({
      document: {
        id: doc.id,
        title: doc.title,
        status: doc.status,
        destinatario_nombre: doc.destinatario_nombre,
        empresa_rut: doc.empresa_rut,
        requires_visado: doc.requires_visado,
        signature_status: doc.signature_status,
        firmante_nombre: doc.firmante_nombre,
        firmante_run: doc.firmante_run,
        numero_contrato_interno: doc.numero_contrato_interno,
        numero_contrato: doc.numero_contrato || doc.numero_contrato_interno || "",
        visador_nombre: doc.visador_nombre,
        pdf_final_url: doc.pdf_final_url || null,
        pdf_original_url: doc.pdf_original_url || null,
        pdfUrl,
      },
      pdfUrl,
    });
  } catch (err) {
    console.error("❌ Error cargando documento público (document):", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   POST: Firmar documento por token (firmante externo)
   Prioridad: 1) sign_token (document_signers) 2) signature_token (documents)
   ================================ */
async function publicSignDocument(req, res) {
  try {
    const { token } = req.params;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Token inválido" });
    }

    let current = await db.query(
      `
      SELECT 
        s.id     AS signer_id,
        s.status AS signer_status,
        s.name   AS signer_name,
        s.email  AS signer_email,
        d.*
      FROM document_signers s
      JOIN documents d ON d.id = s.document_id
      WHERE s.sign_token = $1
      `,
      [token]
    );

    if (current.rowCount === 0) {
      const rowByDoc = await getDocumentAndSignerByDocumentToken(token);
      if (!rowByDoc) {
        return res
          .status(404)
          .json({ message: "Enlace inválido o documento no encontrado" });
      }
      current = { rows: [rowByDoc], rowCount: 1 };
    }

    const row = current.rows[0];

    if (isExpired(row.signature_token_expires_at)) {
      return res
        .status(410)
        .json({ message: "El enlace de firma ha expirado" });
    }

    if (row.status === "RECHAZADO") {
      return res
        .status(400)
        .json({ message: "Documento rechazado, no se puede firmar" });
    }

    if (row.requires_visado === true && row.status === "PENDIENTE_VISADO") {
      return res.status(400).json({
        message: "Este documento requiere visación antes de firmar",
      });
    }

    if (row.signer_status === "FIRMADO") {
      return res
        .status(400)
        .json({ message: "Este firmante ya firmó el documento" });
    }

    // Marcar firmante (document_signers)
    await db.query(
      `
      UPDATE document_signers
      SET status = 'FIRMADO',
          signed_at = NOW()
      WHERE id = $1
      `,
      [row.signer_id]
    );

    // Sincronizar con document_participants
    try {
      await db.query(
        `
        UPDATE document_participants
        SET status = 'FIRMADO',
            signed_at = NOW(),
            updated_at = NOW()
        WHERE document_id = $1
          AND email = $2
        `,
        [row.id, row.signer_email]
      );
    } catch (errDp) {
      console.error(
        "⚠️ Error actualizando document_participants (publicSignDocument):",
        errDp
      );
    }

    // Contar firmantes
    const countRes = await db.query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'FIRMADO') AS signed_count,
        COUNT(*) AS total_signers
      FROM document_signers
      WHERE document_id = $1
      `,
      [row.id]
    );

    const { signed_count, total_signers } = countRes.rows[0];
    const allSigned = Number(signed_count) >= Number(total_signers);

    // Debug paralelo
    try {
      const dpCountRes = await db.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status = 'FIRMADO') AS signed_dp,
          COUNT(*) AS total_dp
        FROM document_participants
        WHERE document_id = $1
        `,
        [row.id]
      );
      const { signed_dp, total_dp } = dpCountRes.rows[0];
      console.log(
        `DEBUG publicSignDocument -> signers: ${signed_count}/${total_signers}, participants: ${signed_dp}/${total_dp}`
      );
    } catch (errCountDp) {
      console.error(
        "⚠️ Error contando en document_participants (publicSignDocument):",
        errCountDp
      );
    }

    let newDocStatus = row.status;
    let newSignatureStatus = row.signature_status;

    if (allSigned) {
      newDocStatus = "FIRMADO";
      newSignatureStatus = "FIRMADO";
    } else {
      newDocStatus = "PENDIENTE_FIRMA";
      newSignatureStatus = "PENDIENTE";
    }

    const docUpdateRes = await db.query(
      `
      UPDATE documents
      SET status = $1,
          signature_status = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [newDocStatus, newSignatureStatus, row.id]
    );
    const doc = docUpdateRes.rows[0];

    // Sincronizar con tabla legacy documentos/firmantes
    if (doc.nuevo_documento_id) {
      try {
        await db.query(
          `
          UPDATE documentos
          SET estado = $1,
              updated_at = NOW()
          WHERE id = $2
          `,
          [allSigned ? "FIRMADO" : "PENDIENTE_FIRMA", doc.nuevo_documento_id]
        );

        await db.query(
          `
          UPDATE firmantes
          SET estado = 'FIRMADO',
              fecha_firma = NOW(),
              tipo_firma = 'SIMPLE',
              updated_at = NOW()
          WHERE documento_id = $1
            AND email = $2
          `,
          [doc.nuevo_documento_id, row.signer_email]
        );
      } catch (syncErr) {
        console.error(
          "⚠️ Error sincronizando estado con tabla documentos:",
          syncErr
        );
      }
    }

    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    const hashDocument = getDocumentHash(doc);

    const fromStatus = row.status;
    const toStatus = newDocStatus;

    // Evento principal de firma pública
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
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14
      )
      `,
      [
        doc.id,
        row.signer_id || null,
        row.signer_name || row.signer_email || "Firmante externo",
        "SIGNED_PUBLIC",
        allSigned
          ? "Documento firmado por todos los firmantes desde enlace público"
          : `Firma registrada para firmante ${row.signer_email}`,
        fromStatus,
        toStatus,
        "SIGNED_PUBLIC",
        ipAddress,
        userAgent,
        hashDocument,
        doc.company_id || null,
        null,
        JSON.stringify(
          buildPublicMetadataBase({
            doc,
            extra: {
              actor_type: "PUBLIC_SIGNER",
              signer_id: row.signer_id,
              signer_email: row.signer_email,
              signer_name: row.signer_name,
              all_signed: allSigned,
            },
          })
        ),
      ]
    );

    // Evento STATUS_CHANGED si corresponde
    if (fromStatus !== toStatus) {
      try {
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
            $7, $8, $9, $10, $11, $12, $13, $14
          )
          `,
          [
            doc.id,
            "system",
            "STATUS_CHANGED",
            "Cambio de estado por firma pública",
            fromStatus,
            toStatus,
            "STATUS_CHANGED",
            ipAddress,
            userAgent,
            hashDocument,
            doc.company_id || null,
            null,
            JSON.stringify(
              buildPublicMetadataBase({
                doc,
                extra: {
                  reason: "all_signers_completed_public",
                  signer_email: row.signer_email,
                  signer_name: row.signer_name,
                },
              })
            ),
          ]
        );
      } catch (eventErr) {
        console.error(
          "⚠️ Error registrando STATUS_CHANGED (publicSignDocument):",
          eventErr
        );
      }
    }

    await logAudit({
      user: null,
      action: "PUBLIC_SIGN",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        signer_email: row.signer_email,
        signer_name: row.signer_name,
        all_signed: allSigned,
        previous_status: fromStatus,
        new_status: toStatus,
        source: "public_link",
      },
      req,
    });

    // Sellar PDF con QR cuando todos firmaron
    if (allSigned && doc.nuevo_documento_id) {
      try {
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
          const baseKey = doc.pdf_original_url || doc.file_path;

          const sealResult = await sellarPdfConQr({
            s3Key: baseKey,
            documentoId: doc.id,
            codigoVerificacion: docNuevo.codigo_verificacion,
            categoriaFirma: docNuevo.categoria_firma || "SIMPLE",
            numeroContratoInterno: doc.numero_contrato_interno,
          });

          const updatedDocRes = await db.query(
            `
            SELECT
              pdf_final_url,
              final_storage_key,
              final_file_url
            FROM documents
            WHERE id = $1
            `,
            [doc.id]
          );

          if (updatedDocRes.rowCount > 0) {
            const updatedDoc = updatedDocRes.rows[0];
            doc.pdf_final_url =
              updatedDoc.pdf_final_url ||
              updatedDoc.final_storage_key ||
              updatedDoc.final_file_url ||
              sealResult?.finalKey ||
              null;
          }
        }
      } catch (sealError) {
        console.error(
          "⚠️ Error sellando PDF con QR (firma pública):",
          sealError
        );
      }
    }

    return res.json({
      ...doc,
      numero_contrato_interno: doc.numero_contrato_interno,
      numero_contrato: doc.numero_contrato_interno,
      file_url: doc.pdf_final_url || doc.pdf_original_url || doc.file_path,
      documentStatus: newDocStatus,
      message: allSigned
        ? "Documento firmado correctamente por todos los firmantes"
        : "Firma registrada. Aún faltan firmantes por completar la firma",
    });
  } catch (err) {
    console.error("❌ Error firmando documento público:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   POST: Rechazar documento por token (firmante externo)
   ================================ */
async function publicRejectDocument(req, res) {
  try {
    const { token } = req.params;
    const { motivo } = req.body || {};

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Token inválido" });
    }

    if (!motivo || !motivo.trim()) {
      return res
        .status(400)
        .json({ message: "Debes indicar un motivo de rechazo." });
    }

    let current = await db.query(
      `
      SELECT 
        s.id     AS signer_id,
        s.status AS signer_status,
        s.name   AS signer_name,
        s.email  AS signer_email,
        d.*
      FROM document_signers s
      JOIN documents d ON d.id = s.document_id
      WHERE s.sign_token = $1
      `,
      [token]
    );

    if (current.rowCount === 0) {
      const rowByDoc = await getDocumentAndSignerByDocumentToken(token);
      if (!rowByDoc) {
        return res
          .status(404)
          .json({ message: "Enlace inválido o documento no encontrado" });
      }
      current = { rows: [rowByDoc], rowCount: 1 };
    }

    const row = current.rows[0];

    if (isExpired(row.signature_token_expires_at)) {
      return res
        .status(410)
        .json({ message: "El enlace de firma ha expirado" });
    }

    if (row.status === "FIRMADO") {
      return res
        .status(400)
        .json({ message: "Documento ya firmado, no se puede rechazar" });
    }

    if (row.status === "RECHAZADO") {
      return res
        .status(400)
        .json({ message: "Documento ya fue rechazado anteriormente" });
    }

    if (row.signer_status === "FIRMADO") {
      return res.status(400).json({
        message:
          "Este firmante ya firmó el documento, no puede rechazarlo ahora",
      });
    }

    if (row.signer_status === "RECHAZADO") {
      return res
        .status(400)
        .json({ message: "Este firmante ya rechazó el documento" });
    }

    // Rechazar firmante
    await db.query(
      `
      UPDATE document_signers
      SET status = 'RECHAZADO',
          rejected_at = NOW(),
          rejection_reason = $2
      WHERE id = $1
      `,
      [row.signer_id, motivo]
    );

    // Sincronizar con document_participants
    try {
      await db.query(
        `
        UPDATE document_participants
        SET status = 'RECHAZADO',
            updated_at = NOW()
        WHERE document_id = $1
          AND email = $2
        `,
        [row.id, row.signer_email]
      );
    } catch (errDp) {
      console.error(
        "⚠️ Error actualizando document_participants (publicRejectDocument):",
        errDp
      );
    }

    // Rechazar documento
    const docUpdateRes = await db.query(
      `
      UPDATE documents
      SET status = 'RECHAZADO',
          signature_status = 'RECHAZADO',
          reject_reason = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [row.id, motivo]
    );
    const doc = docUpdateRes.rows[0];

    // Sincronizar con legacy
    if (doc.nuevo_documento_id) {
      try {
        await db.query(
          `
          UPDATE documentos
          SET estado = 'RECHAZADO',
              updated_at = NOW()
          WHERE id = $1
          `,
          [doc.nuevo_documento_id]
        );

        await db.query(
          `
          UPDATE firmantes
          SET estado = 'RECHAZADO',
              updated_at = NOW()
          WHERE documento_id = $1
            AND email = $2
          `,
          [doc.nuevo_documento_id, row.signer_email]
        );
      } catch (syncErr) {
        console.error(
          "⚠️ Error sincronizando rechazo con tabla documentos:",
          syncErr
        );
      }
    }

    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    const hashDocument = getDocumentHash(doc);

    const fromStatus = row.status;
    const toStatus = "RECHAZADO";

    // Evento principal de rechazo público
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
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14
      )
      `,
      [
        doc.id,
        row.signer_id || null,
        row.signer_name || row.signer_email || "Firmante externo",
        "REJECTED_PUBLIC",
        `Documento rechazado desde enlace público. Motivo: ${motivo}`,
        fromStatus,
        toStatus,
        "REJECTED_PUBLIC",
        ipAddress,
        userAgent,
        hashDocument,
        doc.company_id || null,
        null,
        JSON.stringify(
          buildPublicMetadataBase({
            doc,
            extra: {
              actor_type: "PUBLIC_SIGNER",
              signer_id: row.signer_id,
              signer_email: row.signer_email,
              signer_name: row.signer_name,
              reason: motivo,
            },
          })
        ),
      ]
    );

    // STATUS_CHANGED por rechazo
    try {
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
          $7, $8, $9, $10, $11, $12, $13, $14
        )
        `,
        [
          doc.id,
          "system",
          "STATUS_CHANGED",
          "Cambio de estado por rechazo público",
          fromStatus,
          toStatus,
          "STATUS_CHANGED",
          ipAddress,
          userAgent,
          hashDocument,
          doc.company_id || null,
          null,
          JSON.stringify(
            buildPublicMetadataBase({
              doc,
              extra: {
                reason: "public_reject",
                signer_email: row.signer_email,
                signer_name: row.signer_name,
              },
            })
          ),
        ]
      );
    } catch (eventErr) {
      console.error(
        "⚠️ Error registrando STATUS_CHANGED (publicRejectDocument):",
        eventErr
      );
    }

    await logAudit({
      user: null,
      action: "PUBLIC_REJECT",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        signer_email: row.signer_email,
        signer_name: row.signer_name,
        motivo,
        previous_status: fromStatus,
        new_status: toStatus,
        source: "public_link",
      },
      req,
    });

    return res.json({
      ...doc,
      file_url: doc.pdf_final_url || doc.pdf_original_url || doc.file_path,
      documentStatus: "RECHAZADO",
      message: "Documento rechazado correctamente",
    });
  } catch (err) {
    console.error("❌ Error rechazando documento público:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   POST: Visar documento por token (visador externo)
   ================================ */
async function publicVisarDocument(req, res) {
  try {
    const { token } = req.params;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Token inválido" });
    }

    const current = await db.query(
      `
      SELECT * 
      FROM documents 
      WHERE signature_token = $1
      `,
      [token]
    );

    if (current.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Enlace inválido o documento no encontrado" });
    }

    const docActual = current.rows[0];

    if (isExpired(docActual.signature_token_expires_at)) {
      return res
        .status(410)
        .json({ message: "El enlace de visado ha expirado" });
    }

    if (docActual.status === "RECHAZADO") {
      return res
        .status(400)
        .json({ message: "Documento rechazado, no se puede visar" });
    }

    if (docActual.requires_visado !== true) {
      return res
        .status(400)
        .json({ message: "Este documento no requiere visación" });
    }

    if (docActual.status !== "PENDIENTE_VISADO") {
      return res.status(400).json({
        message: "Solo se pueden visar documentos en estado PENDIENTE_VISADO",
      });
    }

    const result = await db.query(
      `
      UPDATE documents
      SET status = $1,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      ["PENDIENTE_FIRMA", docActual.id]
    );
    const doc = result.rows[0];

    const ipAddress = getClientIp(req);
    const userAgent = getUserAgent(req);
    const hashDocument = getDocumentHash(doc);

    const fromStatus = docActual.status;
    const toStatus = "PENDIENTE_FIRMA";

    // Evento principal de visado público
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
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14
      )
      `,
      [
        doc.id,
        null,
        doc.visador_nombre || "Visador externo",
        "VISADO_PUBLIC",
        "Documento visado desde enlace público",
        fromStatus,
        toStatus,
        "VISADO_PUBLIC",
        ipAddress,
        userAgent,
        hashDocument,
        doc.company_id || null,
        null,
        JSON.stringify(
          buildPublicMetadataBase({
            doc,
            extra: {
              actor_type: "PUBLIC_VISADOR",
              visador_nombre: doc.visador_nombre || "Visador externo",
            },
          })
        ),
      ]
    );

    // STATUS_CHANGED por visado público
    try {
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
          $7, $8, $9, $10, $11, $12, $13, $14
        )
        `,
        [
          doc.id,
          "system",
          "STATUS_CHANGED",
          "Cambio de estado por visado público",
          fromStatus,
          toStatus,
          "STATUS_CHANGED",
          ipAddress,
          userAgent,
          hashDocument,
          doc.company_id || null,
          null,
          JSON.stringify(
            buildPublicMetadataBase({
              doc,
              extra: { reason: "public_visado" },
            })
          ),
        ]
      );
    } catch (eventErr) {
      console.error(
        "⚠️ Error registrando STATUS_CHANGED (publicVisarDocument):",
        eventErr
      );
    }

    await logAudit({
      user: null,
      action: "PUBLIC_VISADO",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        visador_nombre: doc.visador_nombre || "Visador externo",
        previous_status: fromStatus,
        new_status: toStatus,
        source: "public_link",
      },
      req,
    });

    return res.json({
      ...doc,
      file_url: doc.pdf_final_url || doc.pdf_original_url || doc.file_path,
      documentStatus: "PENDIENTE_FIRMA",
      message: "Documento visado correctamente desde enlace público",
    });
  } catch (err) {
    console.error("❌ Error visando documento público:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   GET: Verificación por código (QR / código verificación)
   ================================ */
async function verifyByCode(req, res) {
  try {
    const { codigo } = req.params;

    if (!codigo || typeof codigo !== "string") {
      return res
        .status(400)
        .json({ message: "Código de verificación inválido" });
    }

    const docResult = await db.query(
      `
      SELECT *
      FROM documentos
      WHERE codigo_verificacion = $1
      `,
      [codigo]
    );

    if (docResult.rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Documento no encontrado para este código" });
    }

    const documento = docResult.rows[0];

    const signersResult = await db.query(
      `
      SELECT id, nombre, email, rut, rol, orden_firma, estado, fecha_firma, tipo_firma
      FROM firmantes
      WHERE documento_id = $1
      ORDER BY orden_firma ASC
      `,
      [documento.id]
    );

    const eventosResult = await db.query(
      `
      SELECT id, tipo_evento, ip, user_agent, metadata, created_at
      FROM eventos_firma
      WHERE documento_id = $1
      ORDER BY created_at ASC
      `,
      [documento.id]
    );

    let basePath =
      documento.pdf_final_url ||
      documento.pdf_original_url ||
      documento.archivo_url ||
      documento.file_path ||
      null;

    let relatedDocument = null;

    if (!basePath) {
      const modernDocRes = await db.query(
        `
        SELECT
          id,
          nuevo_documento_id,
          file_path,
          pdf_original_url,
          pdf_final_url,
          company_id,
          numero_contrato_interno,
          status,
          hash_final_file,
          pdf_hash_final,
          hash_original_file,
          metadata
        FROM documents
        WHERE nuevo_documento_id = $1
        ORDER BY id DESC
        LIMIT 1
        `,
        [documento.id]
      );

      if (modernDocRes.rowCount > 0) {
        relatedDocument = modernDocRes.rows[0];
        basePath =
          relatedDocument.pdf_final_url ||
          relatedDocument.pdf_original_url ||
          relatedDocument.file_path ||
          null;
      }
    }

    let pdfUrl = null;
    if (basePath) {
      try {
        pdfUrl = await getSignedUrl(basePath, 3600);
      } catch (urlErr) {
        console.error("⚠️ Error generando signed URL en verifyByCode:", urlErr);
      }
    }

    const document = {
      id: documento.id,
      title: documento.titulo,
      status: documento.estado,
      tipo_tramite: documento.tipo,
      categoria_firma: documento.categoria_firma,
      hash_pdf: documento.hash_pdf,
      created_at: documento.created_at,
      updated_at: documento.updated_at,
      pdf_final_url:
        documento.pdf_final_url || relatedDocument?.pdf_final_url || null,
      pdf_url: pdfUrl,
    };

    const signers = signersResult.rows.map((s) => ({
      id: s.id,
      name: s.nombre,
      email: s.email,
      rut: s.rut,
      role: s.rol,
      order: s.orden_firma,
      status: s.estado,
      signed_at: s.fecha_firma,
      tipo_firma: s.tipo_firma,
    }));

    const events = eventosResult.rows.map((e) => ({
      id: e.id,
      event_type: e.tipo_evento,
      ip: e.ip,
      user_agent: e.user_agent,
      metadata: (() => {
        if (!e.metadata) return null;
        if (typeof e.metadata === "object") return e.metadata;
        try {
          return JSON.parse(e.metadata);
        } catch {
          return e.metadata;
        }
      })(),
      created_at: e.created_at,
      descripcion: e.tipo_evento,
    }));

    // Registrar verificación por código como evento público (si tenemos documents espejo)
    if (relatedDocument) {
      try {
        const ipAddress = getClientIp(req);
        const userAgent = getUserAgent(req);
        const hashDocument = getDocumentHash(relatedDocument);

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
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13, $14
          )
          `,
          [
            relatedDocument.id,
            null,
            "PUBLIC_VERIFY",
            "VERIFY_PUBLIC_CODE",
            "Verificación de documento mediante código de verificación público",
            relatedDocument.status || null,
            relatedDocument.status || null,
            "VERIFY_PUBLIC_CODE",
            ipAddress,
            userAgent,
            hashDocument,
            relatedDocument.company_id || null,
            null,
            JSON.stringify(
              buildPublicMetadataBase({
                doc: relatedDocument,
                extra: {
                  source: "public_verify",
                  codigo_verificacion: codigo,
                },
              })
            ),
          ]
        );
      } catch (eventErr) {
        console.error(
          "⚠️ Error registrando VERIFY_PUBLIC_CODE en document_events:",
          eventErr
        );
      }
    }

    return res.json({
      codigoVerificacion: documento.codigo_verificacion,
      document,
      signers,
      events,
    });
  } catch (err) {
    console.error("❌ Error en verificación por código:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

module.exports = {
  getPublicDocBySignerToken,
  getPublicDocByDocumentToken,
  publicSignDocument,
  publicRejectDocument,
  publicVisarDocument,
  verifyByCode,
};
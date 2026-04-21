// backend/controllers/documents/createDocument.js
const {
  db,
  validateLength,
  sellarPdfConQr,
  generarNumeroContratoInterno,
  generarCodigoVerificacion,
  aplicarMarcaAguaLocal,
  computeHash,
  DOCUMENT_STATES,
} = require("./common");

const pool = db?.pool || db;

const {
  normalizeBoolean,
  getSafeBaseFileName,
  normalizeText,
  sanitizeFileName,
  fetchPdfBufferFromUrl,
  toJson,
} = require("./documentUtils");

const { sanitizeSigners } = require("./documentSignerHelpers");

const {
  getReminderConfig,
  createAutomaticReminders,
  insertDocumentEvent,
  insertLegacyEvento,
  createLegacySigners,
  createCanonicalSigners,
  syncParticipantsFromSigners,
  uploadMainPdfToStorage,
} = require("./documentPersistence");

const { sendInvitationsInBackground } = require("./documentNotifications");

async function rollbackQuietly(client) {
  try {
    await client.query("ROLLBACK");
  } catch (_) {
    // swallow rollback errors
  }
}

async function createDocument(req, res) {
  const client = await pool.connect();
  let committed = false;

  const rollbackAndRespond = async (status, payload) => {
    if (!committed) {
      await rollbackQuietly(client);
    }
    return res.status(status).json(payload);
  };

  try {
    await client.query("BEGIN");

    const companyId =
      req.user?.company_id || req.user?.companyId || req.body.company_id;
    const userId = req.user?.id || req.user?.userId || null;
    const autoSendFlow = normalizeBoolean(req.body.autoSendFlow, false);

    const rawTitulo =
      req.body?.titulo ??
      req.body?.title ??
      req.body?.nombre ??
      "";

    const fileTitleFallback = getSafeBaseFileName(req.file?.originalname || "");

    const titulo =
      normalizeText(rawTitulo) ||
      fileTitleFallback ||
      "Documento sin título";

    const descripcion =
      normalizeText(req.body.descripcion || req.body.description || "") || null;

    const signers = sanitizeSigners(
      req.body.signers || req.body.firmantes || req.body.participants
    );

    const tipoTramiteRaw =
      req.body.tipo_tramite ||
      req.body.tipoTramite ||
      req.body.tipo_trámite ||
      null;

    const tipoTramite =
      typeof tipoTramiteRaw === "string"
        ? normalizeText(tipoTramiteRaw).toLowerCase()
        : null;

    const remoteUrl = String(req.body.pdfUrl || req.body.fileUrl || "").trim();

    console.log("[createDocument] Payload normalizado:", {
      companyId,
      userId,
      autoSendFlow,
      titulo,
      descripcion,
      signersCount: signers.length,
      hasFile: !!req.file,
      hasRemoteUrl: !!remoteUrl,
      tipoTramite,
    });

    if (!companyId) {
      return rollbackAndRespond(400, {
        message: "company_id es requerido para crear el documento",
        code: "COMPANY_ID_REQUIRED",
      });
    }

    if (!req.file && !remoteUrl) {
      return rollbackAndRespond(400, {
        message: "Debes adjuntar un PDF o un fileUrl/pdfUrl válido",
        code: "PDF_REQUIRED",
      });
    }

    if (!validateLength(titulo, 2, 255)) {
      return rollbackAndRespond(400, {
        message:
          "Título inválido: ingresa un título de 2 a 255 caracteres o sube un PDF con nombre válido",
        code: "TITLE_INVALID",
      });
    }

    if (!signers.length) {
      return rollbackAndRespond(400, {
        message: "Debes enviar al menos un firmante con email válido",
        code: "SIGNERS_REQUIRED",
      });
    }

    const requiresVisado = signers.some((s) => s.debe_visar === true);
    const verificationCode = generarCodigoVerificacion();
    const numeroContratoInterno = await generarNumeroContratoInterno(
      client,
      companyId
    );

    console.log(
      "[createDocument] numeroContratoInterno =>",
      numeroContratoInterno
    );

    let originalBuffer;
    let originalFilename;
    let mimeType = "application/pdf";

    if (req.file?.buffer) {
      originalBuffer = req.file.buffer;
      originalFilename =
        req.file.originalname || `documento-${Date.now()}.pdf`;
      mimeType = req.file.mimetype || mimeType;
    } else {
      originalBuffer = await fetchPdfBufferFromUrl(remoteUrl);

      const remoteName =
        req.body.fileName ||
        req.body.nombreArchivo ||
        `documento-${verificationCode}`;

      originalFilename = `${sanitizeFileName(remoteName)}.pdf`;
    }

    // 1) Generar preview con marca de agua, pero mantener el original limpio
    const watermarkedBuffer = await aplicarMarcaAguaLocal(originalBuffer);

    // Hash del documento base: usar SIEMPRE el original limpio
    const documentHash = computeHash(originalBuffer);

    // 2) Subir original limpio como archivo principal
    const originalUploadResult = await uploadMainPdfToStorage(
      {
        buffer: originalBuffer,
        originalname: originalFilename,
        mimetype: mimeType,
      },
      companyId,
      verificationCode
    );

    const originalStorageKey = originalUploadResult.key;
    const originalStorageUrl = originalUploadResult.url;

    // 3) Subir preview con marca de agua (opcional, pero recomendado)
    let previewStorageKey = null;
    let previewStorageUrl = null;

    try {
      const previewUploadResult = await uploadMainPdfToStorage(
        {
          buffer: watermarkedBuffer,
          originalname: originalFilename,
          mimetype: mimeType,
        },
        companyId,
        `${verificationCode}-preview`
      );

      previewStorageKey = previewUploadResult.key;
      previewStorageUrl = previewUploadResult.url;
    } catch (previewErr) {
      console.warn(
        "⚠️ Error subiendo PDF con marca de agua (preview). Se continúa solo con el original limpio:",
        previewErr.message
      );
    }

    const initialDocumentStatus = autoSendFlow
      ? requiresVisado
        ? "PENDIENTE_VISADO"
        : "PENDIENTE_FIRMA"
      : "BORRADOR";

    const initialLegacyStatus = autoSendFlow
      ? requiresVisado
        ? "PENDIENTE_VISADO"
        : DOCUMENT_STATES.SIGNING
      : DOCUMENT_STATES.DRAFT;

    const metadataPayload = {
      autoSendFlow,
      numeroContratoInterno,
      signerCount: signers.length,
      requires_visado: requiresVisado,
    };

    if (tipoTramite) {
      metadataPayload.tipo_tramite = tipoTramite;
    }

    const signatureToken = verificationCode;

    // 1) documents (modelo moderno, fuente para pdf_final_url)
    // file_path y storage_key apuntan al ORIGINAL limpio
    // pdf_original_url apunta al preview con marca si existe
    const { rows: documentRows } = await client.query(
      `
      INSERT INTO documents (
        owner_id,
        company_id,
        title,
        description,
        status,
        file_name,
        file_url,
        storage_key,
        hash_sha256,
        sealed_hash_sha256,
        verification_code,
        signature_token,
        requires_visado,
        created_by,
        metadata,
        file_path,
        pdf_original_url,
        tipo_tramite,
        original_storage_key,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15::jsonb,
        $16, $17, $18, $19,
        NOW(), NOW()
      )
      RETURNING *
      `,
      [
        userId,
        companyId,
        titulo,
        descripcion,
        initialDocumentStatus,
        originalFilename,
        originalStorageUrl,        // file_url (histórico / compat)
        originalStorageKey,        // storage_key (original limpio)
        documentHash,
        null,                      // sealed_hash_sha256
        verificationCode,
        signatureToken,
        requiresVisado,
        userId,
        toJson(metadataPayload, "{}"),
        originalStorageKey,        // file_path -> original limpio
        previewStorageUrl,         // pdf_original_url -> preview con marca (si existe)
        tipoTramite,
        originalStorageKey,        // original_storage_key -> original limpio
      ]
    );

    const document = documentRows[0];

    // 2) documentos (legacy, con código de verificación y número interno)
    const { rows: legacyRows } = await client.query(
      `
      INSERT INTO documentos (
        titulo,
        tipo,
        estado,
        categoria_firma,
        codigo_verificacion,
        creado_por,
        company_id,
        empresa_id,
        descripcion,
        url_archivo,
        hash_documento,
        hash_pdf,
        requiere_visado,
        numero_contrato_interno,
        tipo_flujo,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        NOW(), NOW()
      )
      RETURNING *
      `,
      [
        titulo,
        "DOCUMENTO",
        initialLegacyStatus,
        "FIRMA",
        verificationCode,
        userId,
        companyId,
        companyId,
        descripcion,
        originalStorageUrl,  // legacy apunta al original limpio
        documentHash,
        documentHash,
        requiresVisado,
        numeroContratoInterno,
        "SECUENCIAL",
      ]
    );

    const documentoNuevo = legacyRows[0];

    await client.query(
      `
      UPDATE documents
      SET nuevo_documento_id = $2,
          updated_at = NOW()
      WHERE id = $1
      `,
      [document.id, documentoNuevo.id]
    );

    // 3) firmantes legacy + canónicos + participants
    const legacySigners = await createLegacySigners(client, {
      documentoId: documentoNuevo.id,
      signers,
    });

    const canonicalSigners = await createCanonicalSigners(client, {
      documentId: document.id,
      companyId,
      signers,
    });

    const participants = await syncParticipantsFromSigners(client, {
      documentId: document.id,
      companyId,
      signers,
    });

    await insertDocumentEvent(client, {
      documentId: document.id,
      companyId,
      userId,
      eventType: "DOCUMENT_CREATED",
      details: {
        legacy_documento_id: documentoNuevo.id,
        autoSendFlow,
        signers: signers.length,
        requiresVisado,
      },
    });

    await insertLegacyEvento(client, {
      documentoId: documentoNuevo.id,
      usuarioId: userId,
      tipo: "DOCUMENTO_CREADO",
      descripcion: "Documento creado correctamente",
      metadata: {
        document_id: document.id,
        autoSendFlow,
        requiresVisado,
      },
    });

    let remindersCreated = 0;

    if (autoSendFlow) {
      await client.query(
        `
        UPDATE documentos
        SET estado = $2,
            updated_at = NOW()
        WHERE id = $1
        `,
        [documentoNuevo.id, initialLegacyStatus]
      );

      await client.query(
        `
        UPDATE documents
        SET status = $2,
            updated_at = NOW()
        WHERE id = $1
        `,
        [document.id, initialDocumentStatus]
      );

      await insertDocumentEvent(client, {
        documentId: document.id,
        companyId,
        userId,
        eventType: "DOCUMENT_SENT",
        details: {
          signers: signers.length,
          requiresVisado,
        },
      });

      await insertLegacyEvento(client, {
        documentoId: documentoNuevo.id,
        usuarioId: userId,
        tipo: "DOCUMENTO_ENVIADO",
        descripcion: "Documento enviado a firma/visado",
        metadata: {
          document_id: document.id,
          requiresVisado,
        },
      });

      const reminderConfig = await getReminderConfig(client, companyId);

      if (reminderConfig.enabled) {
        remindersCreated = await createAutomaticReminders(client, {
          documentId: document.id,
          signers,
        });
      }
    }

    await client.query("COMMIT");
    committed = true;

    // 4) Sellado post-commit (no bloquea la creación)
    try {
      const sealResult = await sellarPdfConQr({
        s3Key: originalStorageKey, // SIEMPRE desde el original limpio
        // IMPORTANTE: usamos documents.id, que es el que pdfSeal actualiza
        documentoId: document.id,
        codigoVerificacion: verificationCode,
        categoriaFirma: requiresVisado ? "AVANZADA" : "SIMPLE",
        numeroContratoInterno,
      });

      if (sealResult?.finalHash) {
        await pool.query(
          `
          UPDATE documents
          SET sealed_hash_sha256 = $2,
              updated_at = NOW()
          WHERE id = $1
          `,
          [document.id, sealResult.finalHash]
        );
      }
    } catch (err) {
      console.warn(
        "⚠️ Error sellando PDF con QR (post-commit, no bloqueante):",
        err.message
      );
    }

    if (autoSendFlow) {
      void sendInvitationsInBackground({
        companyId,
        documentId: document.id,
        documentoId: documentoNuevo.id,
        docTitle: titulo,
        code: verificationCode,
        signers: canonicalSigners,
        actorName: req.user?.nombre || req.user?.name || "Sistema",
        signatureToken,
      });
    }

    return res.status(201).json({
      message: autoSendFlow
        ? "Documento creado y enviado al flujo correctamente"
        : "Documento creado correctamente",
      id: document.id,
      documentoId: documentoNuevo.id,
      estado: autoSendFlow ? initialLegacyStatus : DOCUMENT_STATES.DRAFT,
      documentsStatus: autoSendFlow ? initialDocumentStatus : "BORRADOR",
      codigoVerificacion: verificationCode,
      numeroContratoInterno,
      recordatoriosCreados: remindersCreated,
      signersCount: canonicalSigners.length,
      participantsCount: participants.length,
      fileUrl: originalStorageUrl, // URL del original limpio
      hash: documentHash,
      legacyFirmantes: legacySigners.length,
      tipoTramite,
      requiresVisado,
    });
  } catch (error) {
    await rollbackQuietly(client);

    console.error("❌ Error en createDocument:", {
      message: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      message: "Error al crear el documento",
      error: error.message,
    });
  } finally {
    client.release();
  }
}

module.exports = {
  createDocument,
};
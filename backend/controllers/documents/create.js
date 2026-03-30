// backend/controllers/documents/create.js
const {
  path,
  fs,
  axios,
  db,
  uploadPdfToS3,
  getSignedUrl,
  sendSigningInvitation,
  sendVisadoInvitation,
  isValidEmail,
  validateLength,
  sellarPdfConQr,
  generarNumeroContratoInterno,
  generarCodigoVerificacion,
  aplicarMarcaAguaLocal,
  computeHash,
  DOCUMENT_STATES,
} = require("./common");

const pool = db?.pool || db;

/* ================================
   HELPERS GENERALES
   ================================ */

function normalizeBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return ["true", "1", "yes", "si", "sí"].includes(v);
  }
  if (typeof value === "number") return value === 1;
  return defaultValue;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toJson(value, fallback = null) {
  try {
    return value == null ? fallback : JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function safeLower(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ================================
   HELPERS FIRMANTES
   ================================ */

function buildSignerName(signer = {}) {
  return (
    signer.nombreCompleto ||
    signer.nombre ||
    signer.name ||
    [signer.nombres, signer.apellidos].filter(Boolean).join(" ").trim() ||
    "Firmante"
  );
}

function buildSignerEmail(signer = {}) {
  return (
    signer.email ||
    signer.correo ||
    signer.mail ||
    signer.email_address ||
    ""
  )
    .trim()
    .toLowerCase();
}

function buildSignerPhone(signer = {}) {
  return (
    signer.telefono ||
    signer.phone ||
    signer.celular ||
    signer.mobile ||
    null
  );
}

function buildSignerOrder(signer = {}, index = 0) {
  const value =
    signer.orden_firma ??
    signer.orden ??
    signer.order ??
    signer.sign_order ??
    index + 1;

  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : index + 1;
}

function buildSignerType(signer = {}) {
  return (
    signer.tipo ||
    signer.role ||
    signer.rol ||
    "FIRMANTE"
  )
    .toString()
    .trim()
    .toUpperCase();
}

function buildSignerMustSign(signer = {}) {
  if (signer.debe_firmar !== undefined)
    return normalizeBoolean(signer.debe_firmar, true);
  if (signer.must_sign !== undefined)
    return normalizeBoolean(signer.must_sign, true);
  return true;
}

function buildSignerMustReview(signer = {}) {
  if (signer.debe_visar !== undefined)
    return normalizeBoolean(signer.debe_visar, false);
  if (signer.must_review !== undefined)
    return normalizeBoolean(signer.must_review, false);
  return false;
}

function sanitizeSigners(rawSigners = []) {
  const signers = normalizeArray(rawSigners)
    .map((signer, index) => ({
      ...signer,
      nombre: buildSignerName(signer),
      email: buildSignerEmail(signer),
      telefono: buildSignerPhone(signer),
      orden: buildSignerOrder(signer, index),
      tipo: buildSignerType(signer),
      debe_firmar: buildSignerMustSign(signer),
      debe_visar: buildSignerMustReview(signer),
      mensaje_personalizado:
        signer.mensaje_personalizado || signer.customMessage || null,
    }))
    .filter((s) => s.email && isValidEmail(s.email));

  return uniqueBy(
    signers.sort((a, b) => a.orden - b.orden),
    (s) => `${safeLower(s.email)}|${s.orden}|${s.tipo}`
  );
}

/* ================================
   CONFIG DE RECORDATORIOS
   ================================ */

async function getReminderConfig(client, companyId) {
  try {
    const { rows } = await client.query(
      `
      SELECT interval_days, max_attempts, enabled
      FROM reminder_config
      WHERE company_id = $1
      LIMIT 1
      `,
      [companyId]
    );

    if (!rows.length) {
      return {
        enabled: true,
        intervalDays: 3,
        maxAttempts: 2,
      };
    }

    return {
      enabled: rows[0].enabled !== false,
      intervalDays: Number(rows[0].interval_days || 3),
      maxAttempts: Number(rows[0].max_attempts || 2),
    };
  } catch (error) {
    console.warn("⚠️ No se pudo leer reminder_config, usando defaults:", error.message);
    return {
      enabled: true,
      intervalDays: 3,
      maxAttempts: 2,
    };
  }
}

async function createAutomaticReminders(
  client,
  { documentId, signers, intervalDays, maxAttempts }
) {
  if (!documentId || !Array.isArray(signers) || !signers.length) return 0;
  if (!intervalDays || !maxAttempts || maxAttempts <= 0) return 0;

  let created = 0;

  for (const signer of signers) {
    if (!signer?.email) continue;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await client.query(
        `
        INSERT INTO recordatorios (
          documento_id,
          destinatario_email,
          destinatario_nombre,
          tipo,
          numero_intento,
          programado_para,
          estado,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          NOW() + (($6::int * $5::int) || ' days')::interval,
          'PENDIENTE',
          $7::jsonb,
          NOW(),
          NOW()
        )
        `,
        [
          documentId,
          signer.email,
          signer.nombre,
          signer.debe_visar ? "VISADO" : "FIRMA",
          attempt,
          intervalDays,
          JSON.stringify({
            signer_order: signer.orden,
            signer_type: signer.tipo,
          }),
        ]
      );
      created++;
    }
  }

  return created;
}

/* ================================
   EVENTOS: NUEVO + LEGACY
   ================================ */

async function insertDocumentEvent(client, payload) {
  const {
    documentId,
    companyId,
    userId,
    eventType,
    details = null,
  } = payload;

  try {
    await client.query(
      `
      INSERT INTO document_events (
        document_id,
        company_id,
        user_id,
        event_type,
        details,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
      `,
      [documentId, companyId, userId || null, eventType, toJson(details, "{}")]
    );
  } catch (error) {
    console.warn("⚠️ No se pudo insertar document_events:", error.message);
  }
}

async function insertLegacyEvento(client, payload) {
  const {
    documentoId,
    usuarioId,
    tipo,
    descripcion,
    metadata = null,
  } = payload;

  try {
    await client.query(
      `
      INSERT INTO eventos (
        documento_id,
        usuario_id,
        tipo,
        descripcion,
        metadata,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
      `,
      [documentoId, usuarioId || null, tipo, descripcion, toJson(metadata, "{}")]
    );
  } catch (error) {
    console.warn("⚠️ No se pudo insertar evento legacy:", error.message);
  }
}

/* ================================
   INSERT FIRMANTES (LEGACY + NUEVO)
   ================================ */

async function createLegacySigners(client, { documentoId, signers }) {
  const inserted = [];

  for (const signer of signers) {
    const { rows } = await client.query(
      `
      INSERT INTO firmantes (
        documento_id,
        nombre,
        email,
        telefono,
        orden,
        tipo,
        estado,
        debe_firmar,
        debe_visar,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'PENDIENTE', $7, $8, NOW(), NOW())
      RETURNING *
      `,
      [
        documentoId,
        signer.nombre,
        signer.email,
        signer.telefono,
        signer.orden,
        signer.tipo,
        signer.debe_firmar,
        signer.debe_visar,
      ]
    );

    inserted.push(rows[0]);
  }

  return inserted;
}

async function createCanonicalSigners(client, { documentId, companyId, signers }) {
  const inserted = [];

  for (const signer of signers) {
    const { rows } = await client.query(
      `
      INSERT INTO document_signers (
        document_id,
        company_id,
        name,
        email,
        phone,
        signer_order,
        role,
        status,
        must_sign,
        must_review,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'PENDIENTE', $8, $9, $10::jsonb, NOW(), NOW()
      )
      RETURNING *
      `,
      [
        documentId,
        companyId,
        signer.nombre,
        signer.email,
        signer.telefono,
        signer.orden,
        signer.tipo,
        signer.debe_firmar,
        signer.debe_visar,
        toJson(
          {
            mensaje_personalizado: signer.mensaje_personalizado,
          },
          "{}"
        ),
      ]
    );

    inserted.push(rows[0]);
  }

  return inserted;
}

async function syncParticipantsFromSigners(client, { documentId, companyId, signers }) {
  const inserted = [];

  for (const signer of signers) {
    const participantRole = signer.debe_visar ? "VISADOR" : "FIRMANTE";

    const { rows } = await client.query(
      `
      INSERT INTO document_participants (
        document_id,
        company_id,
        name,
        email,
        phone,
        role,
        sort_order,
        status,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'PENDIENTE', $8::jsonb, NOW(), NOW()
      )
      RETURNING *
      `,
      [
        documentId,
        companyId,
        signer.nombre,
        signer.email,
        signer.telefono,
        participantRole,
        signer.orden,
        toJson(
          {
            tipo_original: signer.tipo,
            debe_firmar: signer.debe_firmar,
            debe_visar: signer.debe_visar,
          },
          "{}"
        ),
      ]
    );

    inserted.push(rows[0]);
  }

  return inserted;
}

/* ================================
   STORAGE / PDF
   ================================ */

async function uploadMainPdfToStorage(file, companyId, code) {
  const ext = path.extname(file.originalname || ".pdf") || ".pdf";
  const key = `documents/${companyId}/${Date.now()}-${code}${ext}`;
  const uploaded = await uploadPdfToS3(file.buffer, key, file.mimetype || "application/pdf");

  if (typeof uploaded === "string") {
    return { key, url: uploaded };
  }

  return {
    key: uploaded?.key || key,
    url: uploaded?.url || uploaded?.Location || null,
  };
}

async function fetchPdfBufferFromUrl(url) {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(response.data);
}

/* ================================
   INVITACIONES ASÍNCRONAS
   ================================ */

async function sendInvitationsInBackground({
  companyId,
  documentId,
  documentoId,
  code,
  signers,
  publicUrl,
  actorName,
}) {
  const jobs = signers.map(async (signer) => {
    try {
      const payload = {
        companyId,
        documentId,
        documentoId,
        signerName: signer.nombre,
        signerEmail: signer.email,
        signerPhone: signer.telefono,
        verificationCode: code,
        publicUrl,
        actorName,
        signerOrder: signer.orden,
      };

      if (signer.debe_visar) {
        await sendVisadoInvitation(payload);
      } else {
        await sendSigningInvitation(payload);
      }

      return { ok: true, email: signer.email };
    } catch (error) {
      console.error(`❌ Error enviando invitación a ${signer.email}:`, error.message);
      return { ok: false, email: signer.email, error: error.message };
    }
  });

  return Promise.allSettled(jobs);
}

/* ================================
   CREATE DOCUMENT (LEGACY + NUEVO)
   ================================ */

async function createDocument(req, res) {
  const client = await pool.connect();

  let tempSignedUrl = null;

  try {
    await client.query("BEGIN");

    const companyId =
      req.user?.company_id || req.user?.companyId || req.body.company_id;
    const userId = req.user?.id || req.user?.userId || null;

    const autoSendFlow = normalizeBoolean(req.body.autoSendFlow, false);
    const titulo =
      req.body.titulo ||
      req.body.title ||
      req.body.nombre ||
      req.file?.originalname ||
      "Documento sin título";

    const descripcion = req.body.descripcion || req.body.description || null;

    const signers = sanitizeSigners(
      req.body.signers || req.body.firmantes || req.body.participants
    );

    if (!companyId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "company_id es requerido" });
    }

    if (!req.file && !req.body.pdfUrl && !req.body.fileUrl) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Debes enviar un PDF" });
    }

    if (!validateLength(titulo, 2, 255)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Título inválido" });
    }

    if (!signers.length) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "Debes enviar al menos un firmante válido" });
    }

    const requiresVisado = signers.some((s) => s.debe_visar);
    const verificationCode = generarCodigoVerificacion();
    const numeroContratoInterno = await generarNumeroContratoInterno(
      client,
      companyId
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
      const remoteUrl = req.body.pdfUrl || req.body.fileUrl;
      originalBuffer = await fetchPdfBufferFromUrl(remoteUrl);
      originalFilename = `documento-${Date.now()}.pdf`;
    }

    const watermarkedBuffer = await aplicarMarcaAguaLocal(originalBuffer);
    const documentHash = computeHash(watermarkedBuffer);

    const uploadResult = await uploadMainPdfToStorage(
      {
        buffer: watermarkedBuffer,
        originalname: originalFilename,
        mimetype: mimeType,
      },
      companyId,
      verificationCode
    );

    const storageKey = uploadResult.key;
    const storageUrl = uploadResult.url;

    let signedBuffer = null;
    try {
      if (storageKey && typeof getSignedUrl === "function") {
        tempSignedUrl = await getSignedUrl(storageKey, 900);
        signedBuffer = await fetchPdfBufferFromUrl(tempSignedUrl);
      }
    } catch (e) {
      console.warn(
        "⚠️ No se pudo recuperar signed URL para sellado inicial:",
        e.message
      );
    }

    let sealedHash = null;
    try {
      const sourceForSeal = signedBuffer || watermarkedBuffer;
      const sealedBuffer = await sellarPdfConQr(sourceForSeal, {
        verificationCode,
        hash: documentHash,
      });
      if (sealedBuffer && Buffer.isBuffer(sealedBuffer)) {
        sealedHash = computeHash(sealedBuffer);
      }
    } catch (e) {
      console.warn(
        "⚠️ No se pudo sellar PDF con QR en createDocument:",
        e.message
      );
    }

    const initialDocumentStatus = autoSendFlow
      ? "PENDIENTE_FIRMA"
      : "BORRADOR";

    const initialLegacyStatus = autoSendFlow
      ? DOCUMENT_STATES.SIGNING
      : DOCUMENT_STATES.DRAFT;

    const { rows: documentRows } = await client.query(
      `
      INSERT INTO documents (
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
        requires_review,
        created_by,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, NOW(), NOW()
      )
      RETURNING *
      `,
      [
        companyId,
        titulo,
        descripcion,
        initialDocumentStatus,
        originalFilename,
        storageUrl,
        storageKey,
        documentHash,
        sealedHash,
        verificationCode,
        requiresVisado,
        userId,
        toJson(
          {
            autoSendFlow,
            numeroContratoInterno,
            signerCount: signers.length,
          },
          "{}"
        ),
      ]
    );

    const document = documentRows[0];

    const { rows: legacyRows } = await client.query(
      `
      INSERT INTO documentos (
        empresa_id,
        titulo,
        descripcion,
        url_archivo,
        hash_documento,
        codigo_verificacion,
        estado,
        requiere_visado,
        creado_por,
        numero_contrato_interno,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
      )
      RETURNING *
      `,
      [
        companyId,
        titulo,
        descripcion,
        storageUrl,
        documentHash,
        verificationCode,
        initialLegacyStatus,
        requiresVisado,
        userId,
        numeroContratoInterno,
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
        [documentoNuevo.id, DOCUMENT_STATES.SIGNING]
      );

      await client.query(
        `
        UPDATE documents
        SET status = 'PENDIENTE_FIRMA',
            updated_at = NOW()
        WHERE id = $1
        `,
        [document.id]
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
        },
      });

      const reminderConfig = await getReminderConfig(client, companyId);

      if (reminderConfig.enabled) {
        remindersCreated = await createAutomaticReminders(client, {
          documentId: document.id,
          signers,
          intervalDays: reminderConfig.intervalDays,
          maxAttempts: reminderConfig.maxAttempts,
        });
      }
    }

    await client.query("COMMIT");
    client.release();

    const publicUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/public/documents/${verificationCode}`;

    if (autoSendFlow) {
      void sendInvitationsInBackground({
        companyId,
        documentId: document.id,
        documentoId: documentoNuevo.id,
        code: verificationCode,
        signers,
        publicUrl,
        actorName: req.user?.nombre || req.user?.name || "Sistema",
      });
    }

    return res.status(201).json({
      message: autoSendFlow
        ? "Documento creado y enviado a firma correctamente"
        : "Documento creado correctamente",
      id: document.id,
      documentoId: documentoNuevo.id,
      estado: autoSendFlow ? DOCUMENT_STATES.SIGNING : DOCUMENT_STATES.DRAFT,
      documentsStatus: autoSendFlow ? "PENDIENTE_FIRMA" : "BORRADOR",
      codigoVerificacion: verificationCode,
      recordatoriosCreados: remindersCreated,
      signersCount: canonicalSigners.length,
      participantsCount: participants.length,
      fileUrl: storageUrl,
      hash: documentHash,
      legacyFirmantes: legacySigners.length,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    client.release();

    console.error("❌ Error en createDocument:", error);

    return res.status(500).json({
      message: "Error al crear el documento",
      error: error.message,
    });
  }
}

/* ================================
   GET USER DOCUMENTS (FILTROS + PAGINACIÓN)
   ================================ */

function isGlobalAdmin(user) {
  return user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_GLOBAL";
}

function normalizeStatus(value) {
  if (!value) return null;
  return String(value).trim().toUpperCase();
}

async function getUserDocuments(req, res) {
  try {
    const user = req.user;

    if (!user || !user.id) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const {
      status,
      search,
      page = 1,
      limit = 20,
      company_id: queryCompanyId,
      sort = "created_at",
      order = "desc",
    } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (pageNum - 1) * limitNum;

    const allowedSortFields = {
      created_at: "d.created_at",
      updated_at: "d.updated_at",
      title: "d.title",
      status: "d.status",
    };

    const sortField = allowedSortFields[sort] || "d.created_at";
    const sortDirection = String(order).toLowerCase() === "asc" ? "ASC" : "DESC";

    const values = [];
    const where = [];

    if (isGlobalAdmin(user)) {
      if (queryCompanyId) {
        const companyIdNum = Number(queryCompanyId);
        if (!Number.isNaN(companyIdNum)) {
          values.push(companyIdNum);
          where.push(`d.company_id = $${values.length}`);
        }
      }
    } else {
      if (!user.company_id) {
        return res
          .status(400)
          .json({ message: "Tu usuario no tiene company_id asignado" });
      }

      values.push(user.company_id);
      where.push(`d.company_id = $${values.length}`);
    }

    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus) {
      values.push(normalizedStatus);
      where.push(`UPPER(d.status) = $${values.length}`);
    }

    if (search && String(search).trim()) {
      values.push(`%${String(search).trim()}%`);
      where.push(`(
        d.title ILIKE $${values.length}
        OR COALESCE(d.description, '') ILIKE $${values.length}
        OR COALESCE(d.verification_code, '') ILIKE $${values.length}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countSql = `
      SELECT COUNT(*) AS total
      FROM documents d
      ${whereSql}
    `;

    const countResult = await pool.query(countSql, values);
    const total = Number(countResult.rows[0]?.total || 0);

    values.push(limitNum);
    const limitIndex = values.length;

    values.push(offset);
    const offsetIndex = values.length;

    const dataSql = `
      SELECT
        d.id,
        d.title,
        d.description,
        d.status,
        d.company_id,
        d.created_by,
        d.created_at,
        d.updated_at,
        d.verification_code,
        COALESCE(s.signers_count, 0) AS signers_count
      FROM documents d
      LEFT JOIN (
        SELECT document_id, COUNT(*) AS signers_count
        FROM document_signers
        GROUP BY document_id
      ) s ON s.document_id = d.id
      ${whereSql}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${limitIndex}
      OFFSET $${offsetIndex}
    `;

    const dataResult = await pool.query(dataSql, values);

    return res.json({
      data: dataResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNextPage: offset + limitNum < total,
        hasPrevPage: pageNum > 1,
      },
      filters: {
        status: normalizedStatus,
        search: search || null,
        company_id: queryCompanyId || (isGlobalAdmin(user) ? null : user.company_id),
        sort,
        order: sortDirection.toLowerCase(),
      },
    });
  } catch (err) {
    console.error("❌ Error obteniendo documentos del usuario:", err);
    return res
      .status(500)
      .json({ message: "Error obteniendo documentos" });
  }
}

/* ================================
   EXPORTS
   ================================ */

module.exports = {
  createDocument,
  getUserDocuments,
};
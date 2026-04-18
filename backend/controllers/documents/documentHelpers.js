const {
  axios,
  db,
  uploadPdfToS3,
  sendSigningInvitation,
  sendVisadoInvitation,
  isValidEmail,
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

function stripInvisibleChars(value) {
  return String(value || "").replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function normalizeText(value) {
  return stripInvisibleChars(value)
    .replace(/\s+/g, " ")
    .trim();
}

function getSafeBaseFileName(filename) {
  return normalizeText(String(filename || "").replace(/\.pdf$/i, ""));
}

function sanitizeFileName(value, fallback = "documento") {
  const normalized = normalizeText(value)
    .replace(/[<>:"/\\|\?\*\x00-\x1F]/g, "-")
    .replace(/\.+$/g, "")
    .replace(/^\.+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  return normalized || fallback;
}

function buildSafeStorageFileName(originalname, code) {
  const safeBaseName = sanitizeFileName(
    getSafeBaseFileName(originalname || "documento"),
    "documento"
  );
  return `${Date.now()}-${code}-${safeBaseName}.pdf`;
}

async function fetchPdfBufferFromUrl(url) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) {
    throw new Error("URL vacía en fetchPdfBufferFromUrl");
  }

  const response = await axios.get(safeUrl, {
    responseType: "arraybuffer",
    timeout: 20000,
    maxContentLength: 25 * 1024 * 1024,
    maxBodyLength: 25 * 1024 * 1024,
    headers: {
      Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
    },
    validateStatus: (status) => status >= 200 && status < 300,
  });

  const contentType = String(
    response.headers?.["content-type"] || ""
  ).toLowerCase();

  if (
    contentType &&
    !contentType.includes("application/pdf") &&
    !contentType.includes("application/octet-stream")
  ) {
    console.warn(
      `⚠️ fetchPdfBufferFromUrl content-type inesperado: ${contentType}`
    );
  }

  const buffer = Buffer.from(response.data);
  if (!buffer.length) {
    throw new Error("El archivo remoto llegó vacío");
  }

  return buffer;
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
  return (signer.tipo || signer.role || signer.rol || "FIRMANTE")
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
   TOKEN DE FIRMANTE
   ================================ */

function generarSignToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/* ================================
   RECORDATORIOS
   ================================ */

async function getReminderConfig(client, companyId) {
  try {
    const { rows } = await client.query(
      `
      SELECT enabled
      FROM reminder_config
      WHERE company_id = $1
      LIMIT 1
      `,
      [companyId]
    );

    if (!rows.length) {
      return { enabled: true };
    }

    return {
      enabled: rows[0].enabled !== false,
    };
  } catch (error) {
    console.warn(
      "⚠️ No se pudo leer reminder_config, usando defaults:",
      error.message
    );
    return { enabled: true };
  }
}

async function createAutomaticReminders(client, { documentId, signers }) {
  if (!documentId || !Array.isArray(signers) || !signers.length) return 0;

  let created = 0;

  for (const signer of signers) {
    if (!signer?.email) continue;

    try {
      await client.query("SAVEPOINT sp_create_reminder");

      await client.query(
        `
        INSERT INTO recordatorios (
          documento_id,
          destinatario_email,
          destinatario_nombre,
          firmante_id,
          tipo,
          estado,
          intentos,
          max_intentos,
          proximo_intento_at,
          error_message,
          sent_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          NULL,
          $4,
          'pendiente',
          0,
          3,
          NOW() + INTERVAL '12 hours',
          NULL,
          NULL,
          NOW(),
          NOW()
        )
        `,
        [
          documentId,
          signer.email,
          signer.nombre,
          signer.debe_visar ? "VISADO" : "FIRMA",
        ]
      );

      await client.query("RELEASE SAVEPOINT sp_create_reminder");
      created++;
    } catch (err) {
      try {
        await client.query("ROLLBACK TO SAVEPOINT sp_create_reminder");
      } catch (_) {}

      console.error(
        `⚠️ No se pudo crear recordatorio para ${signer.email}:`,
        err.message
      );
    }
  }

  return created;
}

/* ================================
   EVENTOS
   ================================ */

async function insertDocumentEvent(client, payload) {
  const {
    documentId,
    companyId,
    userId,
    eventType,
    details = null,
  } = payload;

  const safeEventType = eventType || "DOCUMENT_CREATED";

  const action =
    safeEventType === "DOCUMENT_CREATED"
      ? "Documento creado"
      : safeEventType === "DOCUMENT_SENT"
      ? "Documento enviado"
      : safeEventType === "DOCUMENT_SIGNED"
      ? "Documento firmado"
      : safeEventType;

  try {
    await client.query(
      `
      INSERT INTO document_events (
        document_id,
        company_id,
        user_id,
        action,
        event_type,
        details,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
      `,
      [
        documentId,
        companyId,
        userId || null,
        action,
        safeEventType,
        toJson(details, "{}"),
      ]
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
   FIRMANTES
   ================================ */

async function createLegacySigners(client, { documentoId, signers }) {
  const inserted = [];

  for (const signer of signers) {
    const rolLegacy = signer.debe_visar ? "VISADOR" : "FIRMANTE";
    const tipoFirmaLegacy = "SIMPLE";

    const { rows } = await client.query(
      `
      INSERT INTO firmantes (
        documento_id,
        nombre,
        email,
        rut,
        rol,
        orden_firma,
        estado,
        tipo_firma,
        fecha_firma,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 'PENDIENTE', $7, NULL, NOW(), NOW()
      )
      RETURNING *
      `,
      [
        documentoId,
        signer.nombre,
        signer.email,
        null,
        rolLegacy,
        signer.orden,
        tipoFirmaLegacy,
      ]
    );

    inserted.push(rows[0]);
  }

  return inserted;
}

async function createCanonicalSigners(client, { documentId, companyId, signers }) {
  const inserted = [];

  for (const signer of signers) {
    const signToken = generarSignToken();

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
        sign_token,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        'PENDIENTE',
        $8, $9, $10::jsonb,
        $11,
        NOW(), NOW()
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
        toJson({ mensaje_personalizado: signer.mensaje_personalizado }, "{}"),
        signToken,
      ]
    );

    inserted.push(rows[0]);
  }

  return inserted;
}

async function syncParticipantsFromSigners(client, { documentId, companyId, signers }) {
  if (!documentId || !companyId || !Array.isArray(signers) || !signers.length) {
    return [];
  }

  const inserted = [];
  const flowGroup = 0;
  const sorted = [...signers].sort((a, b) => a.orden - b.orden);

  const byEmail = new Map();
  sorted.forEach((s) => {
    const email = (s.email || "").toLowerCase();
    if (!byEmail.has(email)) {
      byEmail.set(email, byEmail.size + 1);
    }
  });

  for (const signer of sorted) {
    const participantRole = signer.debe_visar ? "VISADOR" : "FIRMANTE";
    const email = (signer.email || "").toLowerCase();
    const flowOrder = byEmail.get(email) || 1;

    const { rows } = await client.query(
      `
      INSERT INTO document_participants (
        document_id,
        company_id,
        name,
        email,
        phone,
        role,
        flow_group,
        flow_order,
        sort_order,
        status,
        metadata,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        'PENDIENTE',
        $10::jsonb,
        NOW(), NOW()
      )
      ON CONFLICT ON CONSTRAINT uq_document_participants_flow_position
      DO NOTHING
      RETURNING *
      `,
      [
        documentId,
        companyId,
        signer.nombre,
        email,
        signer.telefono,
        participantRole,
        flowGroup,
        flowOrder,
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

    if (rows[0]) {
      inserted.push(rows[0]);
    }
  }

  return inserted;
}

/* ================================
   STORAGE
   ================================ */

async function uploadMainPdfToStorage(file, companyId, code) {
  if (!file?.buffer) {
    throw new Error("Archivo inválido en uploadMainPdfToStorage");
  }

  if (!companyId) {
    throw new Error("companyId requerido en uploadMainPdfToStorage");
  }

  if (!code) {
    throw new Error("code requerido en uploadMainPdfToStorage");
  }

  const safeFileName = buildSafeStorageFileName(file.originalname, code);
  const key = `documents/${companyId}/${safeFileName}`;

  const uploaded = await uploadPdfToS3(
    file.buffer,
    key,
    file.mimetype || "application/pdf"
  );

  return {
    key: uploaded?.key || key,
    url: uploaded?.url || uploaded?.Location || null,
  };
}

/* ================================
   INVITACIONES
   ================================ */

async function sendInvitationsInBackground({
  companyId,
  documentId,
  documentoId,
  docTitle,
  code,
  signers,
  actorName,
  signatureToken,
}) {
  const SIGNING_PORTAL_URL =
    process.env.SIGNING_PORTAL_URL || "https://firmar.verifirma.cl";

  const documentPublicUrl = `${SIGNING_PORTAL_URL}/document/${signatureToken}`;

  const jobs = signers.map(async (signer) => {
    try {
      const signerPublicUrl = `${SIGNING_PORTAL_URL}/?token=${signer.sign_token}`;

      const payload = {
        companyId,
        documentId,
        documentoId,
        docTitle,
        signerName: signer.name || signer.nombre,
        signerEmail: signer.email,
        signerPhone: signer.phone || signer.telefono,
        verificationCode: code,
        publicUrl: signerPublicUrl,
        actorName,
        signerOrder: signer.signer_order || signer.orden,
        documentPublicUrl,
      };

      const isVisador =
        (signer.role || signer.tipo || "").toUpperCase() === "VISADOR" ||
        signer.debe_visar;

      if (isVisador) {
        await sendVisadoInvitation(
          payload.signerEmail,
          payload.docTitle,
          payload.documentPublicUrl,
          payload.signerName,
          {
            documentoId: payload.documentoId,
            firmanteId: null,
          }
        );
      } else {
        await sendSigningInvitation(
          payload.signerEmail,
          payload.docTitle,
          payload.publicUrl,
          payload.signerName,
          {
            verificationCode: payload.verificationCode,
            qrTargetUrl: payload.publicUrl,
            documentoId: payload.documentoId,
            firmanteId: null,
          }
        );
      }

      return { ok: true, email: signer.email };
    } catch (error) {
      console.error(
        `❌ Error enviando invitación a ${signer.email}:`,
        error.message
      );
      return { ok: false, email: signer.email, error: error.message };
    }
  });

  return Promise.allSettled(jobs);
}

/* ================================
   LISTADO
   ================================ */

function isGlobalAdmin(user) {
  return user?.role === "SUPER_ADMIN" || user?.role === "ADMIN_GLOBAL";
}

function normalizeStatus(value) {
  if (!value) return null;
  return String(value).trim().toUpperCase();
}

module.exports = {
  pool,
  normalizeBoolean,
  normalizeArray,
  toJson,
  safeLower,
  uniqueBy,
  stripInvisibleChars,
  normalizeText,
  getSafeBaseFileName,
  sanitizeFileName,
  buildSafeStorageFileName,
  fetchPdfBufferFromUrl,
  buildSignerName,
  buildSignerEmail,
  buildSignerPhone,
  buildSignerOrder,
  buildSignerType,
  buildSignerMustSign,
  buildSignerMustReview,
  sanitizeSigners,
  generarSignToken,
  getReminderConfig,
  createAutomaticReminders,
  insertDocumentEvent,
  insertLegacyEvento,
  createLegacySigners,
  createCanonicalSigners,
  syncParticipantsFromSigners,
  uploadMainPdfToStorage,
  sendInvitationsInBackground,
  isGlobalAdmin,
  normalizeStatus,
};
const { db, uploadPdfToS3 } = require("./common");
const {
  toJson,
  buildSafeStorageFileName,
} = require("./documentUtils");
const { generarSignToken } = require("./documentSignerHelpers");

const pool = db?.pool || db;

/* ================================
   CONFIG / RECORDATORIOS
   ================================ */

async function getReminderConfig(client, companyId) {
  if (!companyId) {
    return { enabled: true };
  }

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
    const email = (signer?.email || "").trim().toLowerCase();
    if (!email) continue;

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
          email,
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
        `⚠️ No se pudo crear recordatorio para ${email}:`,
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
  } = payload || {};

  if (!documentId || !companyId) return;

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
  } = payload || {};

  if (!documentoId || !tipo) return;

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
   FIRMANTES / PARTICIPANTES
   ================================ */

async function createLegacySigners(client, { documentoId, signers }) {
  if (!documentoId || !Array.isArray(signers) || !signers.length) {
    return [];
  }

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
  if (!documentId || !companyId || !Array.isArray(signers) || !signers.length) {
    return [];
  }

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

/**
 * Sincroniza document_participants desde signers respetando:
 * (document_id, COALESCE(flow_group,0), flow_order, email)
 * y creando UNA entrada por email/documento.
 */
async function syncParticipantsFromSigners(client, { documentId, companyId, signers }) {
  if (!documentId || !companyId || !Array.isArray(signers) || !signers.length) {
    return [];
  }

  const inserted = [];
  const flowGroup = 0;

  const sorted = [...signers].sort((a, b) => a.orden - b.orden);

  const uniqueByEmail = [];
  const seenEmails = new Set();

  for (const signer of sorted) {
    const email = (signer.email || "").trim().toLowerCase();
    if (!email || seenEmails.has(email)) continue;
    seenEmails.add(email);
    uniqueByEmail.push(signer);
  }

  for (let i = 0; i < uniqueByEmail.length; i++) {
    const signer = uniqueByEmail[i];
    const email = (signer.email || "").trim().toLowerCase();
    const participantRole = signer.debe_visar ? "VISADOR" : "FIRMANTE";
    const flowOrder = i + 1;

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

/**
 * Genera un key estable para S3/Storage.
 * - companyId -> carpeta raíz
 * - code -> sufijo único ligado al documento/version
 * - purpose -> indica si es 'original', 'preview' o 'final'
 */
function buildPdfStorageKey(companyId, baseName, code, purpose = "original") {
  const safeFileName = buildSafeStorageFileName(baseName, code);

  const normalizedPurpose =
    purpose && typeof purpose === "string"
      ? purpose.toLowerCase()
      : "original";

  return `documents/${companyId}/${normalizedPurpose}/${safeFileName}`;
}

/**
 * Sube un PDF a storage con un key estructurado.
 * Se usa tanto para:
 * - original limpio (purpose='original')
 * - preview con marca de agua (purpose='preview')
 * - otros usos futuros ('final', etc.)
 */
async function uploadMainPdfToStorage(file, companyId, code, purpose = "original") {
  if (!file?.buffer) {
    throw new Error("Archivo inválido en uploadMainPdfToStorage");
  }

  if (!companyId) {
    throw new Error("companyId requerido en uploadMainPdfToStorage");
  }

  if (!code) {
    throw new Error("code requerido en uploadMainPdfToStorage");
  }

  const baseName = file.originalname || "documento.pdf";
  const key = buildPdfStorageKey(companyId, baseName, code, purpose);

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

module.exports = {
  pool,
  getReminderConfig,
  createAutomaticReminders,
  insertDocumentEvent,
  insertLegacyEvento,
  createLegacySigners,
  createCanonicalSigners,
  syncParticipantsFromSigners,
  uploadMainPdfToStorage,
  buildPdfStorageKey,
};
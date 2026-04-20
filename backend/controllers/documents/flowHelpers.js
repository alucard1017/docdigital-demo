// backend/controllers/documents/flowHelpers.js

async function getReminderConfig(client, companyId) {
  if (!companyId) {
    return {
      intervalDays: 3,
      maxAttempts: 3,
      enabled: true,
    };
  }

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
    intervalDays: Number(config.interval_days) > 0 ? Number(config.interval_days) : 3,
    maxAttempts: Number(config.max_attempts) > 0 ? Number(config.max_attempts) : 3,
    enabled: Boolean(config.enabled),
  };
}

async function createAutomaticReminders(
  client,
  { documentId, signers, intervalDays, maxAttempts, companyId }
) {
  if (!documentId || !Array.isArray(signers) || !signers.length) return 0;

  const safeIntervalDays =
    Number.isFinite(Number(intervalDays)) && Number(intervalDays) > 0
      ? Number(intervalDays)
      : 3;

  const safeMaxAttempts =
    Number.isFinite(Number(maxAttempts)) && Number(maxAttempts) > 0
      ? Number(maxAttempts)
      : 3;

  // Primera corrida: 12h después del envío para que no spamee al minuto 1
  const firstReminderAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

  for (const signer of signers) {
    if (!signer?.email) continue;

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
        safeMaxAttempts,
      ]
    );
  }

  return signers.length;
}

async function cancelPendingReminders(client, documentId) {
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
}

module.exports = {
  getReminderConfig,
  createAutomaticReminders,
  cancelPendingReminders,
};
const LEGACY_SIGNER_STATES = {
  PENDING: "PENDIENTE",
  SIGNED: "FIRMADO",
  REJECTED: "RECHAZADO",
};

const PARTICIPANT_ROLES = {
  REVIEWER: "VISADOR",
  SIGNER: "FIRMANTE",
};

/**
 * Sincroniza document_participants a partir de la configuración
 * de firmantes/visadores del flujo legacy.
 *
 * Reglas actuales:
 * - Se borran todos los participants previos del documento.
 * - Cada visador entra primero en el flujo (flow_order 1..N, flow_group = 1).
 * - Cada firmante entra después de los visadores:
 *   - flow_order continúa (offset + 1..M),
 *   - flow_group = 2 si hay visadores, si no, 1.
 * - step_order y flow_order arrancan en 1 y siguen correlativamente.
 */
async function syncParticipantsFromFlow(
  client,
  { documentId, signers = [], visadores = [] }
) {
  if (!documentId) {
    console.warn(
      "[syncParticipantsFromFlow] llamado sin documentId. Se omite sincronización."
    );
    return;
  }

  // Borrado completo para dejar el mirror limpio
  await client.query(
    `DELETE FROM document_participants WHERE document_id = $1`,
    [documentId]
  );

  const hasVisadores = Array.isArray(visadores) && visadores.length > 0;
  const hasSigners = Array.isArray(signers) && signers.length > 0;

  if (!hasVisadores && !hasSigners) {
    // No hay participantes configurados. No insertamos filas nuevas.
    return;
  }

  const values = [];
  const valueTuples = [];
  let idx = 1;

  const now = "NOW()"; // más legible en el SQL que repetir en JS

  // Primero, visadores
  if (hasVisadores) {
    visadores.forEach((v, i) => {
      const stepOrder = i + 1;
      const flowOrder = i + 1;
      const flowGroup = 1; // grupo de visación

      valueTuples.push(
        `($${idx++}, $${idx++}, '${LEGACY_SIGNER_STATES.PENDING}', NULL, NULL, ${now}, ${now}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
      );

      values.push(
        documentId, // document_id
        PARTICIPANT_ROLES.REVIEWER, // role_in_doc
        stepOrder,
        flowOrder,
        PARTICIPANT_ROLES.REVIEWER, // "role"
        v.name,
        v.email,
        flowGroup
      );
    });
  }

  const visadoresOffset = hasVisadores ? visadores.length : 0;

  // Después, firmantes
  if (hasSigners) {
    signers.forEach((s, i) => {
      const pos = visadoresOffset + i + 1;
      const stepOrder = pos;
      const flowOrder = pos;
      const flowGroup = hasVisadores ? 2 : 1; // grupo de firma posterior al visado

      valueTuples.push(
        `($${idx++}, $${idx++}, '${LEGACY_SIGNER_STATES.PENDING}', NULL, NULL, ${now}, ${now}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
      );

      values.push(
        documentId, // document_id
        PARTICIPANT_ROLES.SIGNER, // role_in_doc
        stepOrder,
        flowOrder,
        PARTICIPANT_ROLES.SIGNER, // "role"
        s.name,
        s.email,
        flowGroup
      );
    });
  }

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
    VALUES ${valueTuples.join(", ")}
  `;

  await client.query(sql, values);
}

/**
 * Actualiza el estado de un participant a FIRMADO.
 *
 * Reglas actuales:
 * - Matchea por document_id + email.
 * - Si se pasa role, también exige role_in_doc = role.
 * - No toca otros estados (no maneja RECHAZADO aún).
 */
const updateParticipantStatus = async (client, { documentId, email, role }) => {
  if (!documentId || !email) {
    console.warn(
      "[updateParticipantStatus] llamado sin documentId/email. Se omite update."
    );
    return;
  }

  await client.query(
    `
    UPDATE document_participants
    SET status = $3,
        signed_at = NOW(),
        updated_at = NOW()
    WHERE document_id = $1
      AND email = $2
      AND role_in_doc = COALESCE($4, role_in_doc)
    `,
    [
      documentId,
      email,
      LEGACY_SIGNER_STATES.SIGNED,
      role || null,
    ]
  );
};

module.exports = {
  syncParticipantsFromFlow,
  updateParticipantStatus,
  LEGACY_SIGNER_STATES,
  PARTICIPANT_ROLES,
};
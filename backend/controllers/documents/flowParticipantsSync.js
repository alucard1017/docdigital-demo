const LEGACY_SIGNER_STATES = {
  PENDING: "PENDIENTE",
  SIGNED: "FIRMADO",
  REJECTED: "RECHAZADO",
};

const PARTICIPANT_ROLES = {
  REVIEWER: "VISADOR",
  SIGNER: "FIRMANTE",
  FINAL_SIGNER: "FIRMANTE_FINAL",
};

function normalizeParticipantRole(rawRole) {
  const role = String(rawRole || "").trim().toUpperCase();

  if (!role) return PARTICIPANT_ROLES.SIGNER;
  if (role.includes("VIS")) return PARTICIPANT_ROLES.REVIEWER;
  if (role.includes("REV")) return PARTICIPANT_ROLES.REVIEWER;
  if (role.includes("FINAL")) return PARTICIPANT_ROLES.FINAL_SIGNER;
  if (role.includes("FIRM")) return PARTICIPANT_ROLES.SIGNER;

  return role;
}

function normalizeParticipants(participants = [], flowType = "SECUENCIAL") {
  const normalizedFlowType =
    String(flowType || "SECUENCIAL").trim().toUpperCase() === "PARALELO"
      ? "PARALELO"
      : "SECUENCIAL";

  const sorted = participants
    .map((p, index) => {
      const role = normalizeParticipantRole(p.role || p.rol);

      const rawOrder =
        typeof p.flowOrder === "number" && p.flowOrder > 0
          ? p.flowOrder
          : typeof p.stepOrder === "number" && p.stepOrder > 0
          ? p.stepOrder
          : typeof p.ordenFirma === "number" && p.ordenFirma > 0
          ? p.ordenFirma
          : index + 1;

      return {
        role,
        name: String(p.name || p.nombre || "").trim(),
        email: String(p.email || "").trim().toLowerCase(),
        stepOrder:
          typeof p.stepOrder === "number" && p.stepOrder > 0
            ? p.stepOrder
            : index + 1,
        flowOrder: rawOrder,
        flowGroup:
          typeof p.flowGroup === "number" && p.flowGroup > 0
            ? p.flowGroup
            : normalizedFlowType === "PARALELO"
            ? 1
            : rawOrder,
      };
    })
    .sort((a, b) => {
      if (a.flowOrder !== b.flowOrder) return a.flowOrder - b.flowOrder;
      if (a.stepOrder !== b.stepOrder) return a.stepOrder - b.stepOrder;
      return a.email.localeCompare(b.email);
    });

  return sorted.map((p, index) => ({
    ...p,
    stepOrder:
      normalizedFlowType === "PARALELO"
        ? index + 1
        : typeof p.stepOrder === "number" && p.stepOrder > 0
        ? p.stepOrder
        : index + 1,
    flowOrder:
      typeof p.flowOrder === "number" && p.flowOrder > 0
        ? p.flowOrder
        : index + 1,
    flowGroup:
      typeof p.flowGroup === "number" && p.flowGroup > 0
        ? p.flowGroup
        : normalizedFlowType === "PARALELO"
        ? 1
        : index + 1,
  }));
}

/**
 * Sincroniza document_participants preservando el orden real del flujo.
 *
 * Reglas:
 * - Se borran participants previos del documento dentro de la misma transacción.
 * - El orden lo define `participants`, no una separación artificial visadores/firma.
 * - Soporta SECUENCIAL y PARALELO mediante `flowGroup`.
 * - step_order y flow_order quedan persistidos de forma explícita.
 */
async function syncParticipantsFromFlow(
  client,
  { documentId, participants = [], flowType = "SECUENCIAL" }
) {
  if (!documentId) {
    console.warn(
      "[syncParticipantsFromFlow] llamado sin documentId. Se omite sincronización."
    );
    return;
  }

  await client.query(
    `DELETE FROM document_participants WHERE document_id = $1`,
    [documentId]
  );

  const normalizedParticipants = normalizeParticipants(participants, flowType);

  if (!normalizedParticipants.length) {
    return;
  }

  const values = [];
  const valueTuples = [];
  let idx = 1;

  normalizedParticipants.forEach((participant) => {
    valueTuples.push(
      `(
        $${idx++},
        $${idx++},
        '${LEGACY_SIGNER_STATES.PENDING}',
        NULL,
        NULL,
        NOW(),
        NOW(),
        $${idx++},
        $${idx++},
        $${idx++},
        $${idx++},
        $${idx++},
        $${idx++}
      )`
    );

    values.push(
      documentId,
      participant.role,
      participant.stepOrder,
      participant.flowOrder,
      participant.role,
      participant.name,
      participant.email,
      participant.flowGroup
    );
  });

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
 * Reglas:
 * - Matchea por document_id + email.
 * - Si se pasa role, exige role_in_doc = role.
 * - Si se pasa flowOrder, exige flow_order = flowOrder.
 * - Actualiza una sola fila objetivo.
 */
const updateParticipantStatus = async (
  client,
  { documentId, email, role, flowOrder }
) => {
  if (!documentId || !email) {
    console.warn(
      "[updateParticipantStatus] llamado sin documentId/email. Se omite update."
    );
    return;
  }

  const normalizedRole = role ? normalizeParticipantRole(role) : null;

  await client.query(
    `
    UPDATE document_participants
    SET status = $3,
        signed_at = NOW(),
        updated_at = NOW()
    WHERE id = (
      SELECT dp.id
      FROM document_participants dp
      WHERE dp.document_id = $1
        AND LOWER(dp.email) = LOWER($2)
        AND dp.role_in_doc = COALESCE($4, dp.role_in_doc)
        AND dp.flow_order = COALESCE($5, dp.flow_order)
      ORDER BY dp.flow_order ASC, dp.step_order ASC, dp.id ASC
      LIMIT 1
    )
    `,
    [
      documentId,
      email,
      LEGACY_SIGNER_STATES.SIGNED,
      normalizedRole,
      flowOrder || null,
    ]
  );
};

module.exports = {
  syncParticipantsFromFlow,
  updateParticipantStatus,
  LEGACY_SIGNER_STATES,
  PARTICIPANT_ROLES,
};
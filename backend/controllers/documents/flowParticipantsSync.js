// backend/controllers/documents/flowParticipantsSync.js

async function syncParticipantsFromFlow(
  client,
  { documentId, signers = [], visadores = [] }
) {
  await client.query(
    `DELETE FROM document_participants WHERE document_id = $1`,
    [documentId]
  );

  const values = [];
  const inserts = [];
  let idx = 1;

  visadores.forEach((v, i) => {
    inserts.push(
      `($${idx++}, 'VISADOR', 'PENDIENTE', NULL, NULL, NOW(), NOW(), $${idx++}, $${idx++}, 'VISADOR', $${idx++}, $${idx++}, $${idx++})`
    );
    values.push(
      documentId,
      i + 1,
      i + 1,
      v.name,
      v.email,
      1
    );
  });

  const offset = visadores.length;

  signers.forEach((s, i) => {
    inserts.push(
      `($${idx++}, 'FIRMANTE', 'PENDIENTE', NULL, NULL, NOW(), NOW(), $${idx++}, $${idx++}, 'FIRMANTE', $${idx++}, $${idx++}, $${idx++})`
    );
    values.push(
      documentId,
      offset + i + 1,
      offset + i + 1,
      s.name,
      s.email,
      visadores.length > 0 ? 2 : 1
    );
  });

  if (!inserts.length) return;

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
    VALUES ${inserts.join(", ")}
  `;

  await client.query(sql, values);
}

const updateParticipantStatus = async (client, { documentId, email, role }) => {
  await client.query(
    `
    UPDATE document_participants
    SET status = 'FIRMADO',
        signed_at = NOW(),
        updated_at = NOW()
    WHERE document_id = $1
      AND email = $2
      AND role_in_doc = COALESCE($3, role_in_doc)
    `,
    [documentId, email, role || null]
  );
};

module.exports = {
  syncParticipantsFromFlow,
  updateParticipantStatus,
};
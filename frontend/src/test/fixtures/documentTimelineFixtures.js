// frontend/src/test/fixtures/documentTimelineFixtures.js

export function buildTimelineEvent(overrides = {}) {
  return {
    id: 1,
    eventType: "DOCUMENT_CREATED",
    actor: "Sistema",
    actorType: "system",
    fromStatus: null,
    toStatus: "PENDIENTE_FIRMA",
    createdAt: "2026-04-17T04:55:41.781414Z",
    ip: null,
    userAgent: null,
    metadata: null,
    ...overrides,
  };
}

export function buildBaseTimeline(overrides = {}) {
  return {
    progress: 0,
    currentStep: "En curso",
    nextStep: "Por definir",
    events: [],
    ...overrides,
  };
}

// Caso realista con creado + abierto + rechazado
export function buildSampleTimeline() {
  return buildBaseTimeline({
    progress: 60,
    currentStep: "PENDIENTE_FIRMA",
    nextStep: "Firma del participante",
    events: [
      buildTimelineEvent({
        id: 88,
        eventType: "DOCUMENT_CREATED",
        actor: "Sistema",
        actorType: "system",
        fromStatus: null,
        toStatus: "PENDIENTE_FIRMA",
        createdAt: "2026-04-17T04:55:41.781414Z",
      }),
      buildTimelineEvent({
        id: 90,
        eventType: "PUBLIC_LINK_OPENED_SIGNER",
        actor: "juan nieto",
        actorType: "user",
        fromStatus: "PENDIENTE_FIRMA",
        toStatus: "PENDIENTE_FIRMA",
        createdAt: "2026-04-17T04:56:35.455374Z",
        ip: "10.199.50.3",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        metadata: {
          source: "public_link",
          link_type: "signer_token",
          signer_id: 43,
          actor_type: "PUBLIC_SIGNER",
          signer_name: "juan nieto",
          signer_email: "chuquid2000@gmail.com",
          numero_contrato_interno: "VF-2026-000022",
        },
      }),
      buildTimelineEvent({
        id: 91,
        eventType: "REJECTED_OWNER",
        actor: "ALUCARD",
        actorType: "user",
        fromStatus: "PENDIENTE_FIRMA",
        toStatus: "RECHAZADO",
        createdAt: "2026-04-17T15:10:05.620102Z",
        ip: "10.196.6.130",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
        metadata: {
          reason: "Cancelado por administrador",
          source: "owner_panel",
          owner_id: 1,
          actor_type: "OWNER",
          owner_name: "ALUCARD",
          document_title: "prueba 22",
        },
      }),
    ],
  });
}
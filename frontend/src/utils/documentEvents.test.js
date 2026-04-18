// frontend/src/utils/documentEvents.test.js
import { describe, expect, it } from "vitest";
import {
  formatTimelineTimestamp,
  getEventKind,
  getStableEventKey,
  mapDocumentEvent,
  normalizeStatus,
  normalizeTimeline,
} from "./documentEvents";

const rawCreated = {
  id: 88,
  actor: null,
  action: "Documento creado",
  metadata: null,
  to_status: null,
  created_at: "2026-04-17T04:55:41.781414",
  event_type: "DOCUMENT_CREATED",
  ip_address: null,
  user_agent: null,
  document_id: 22,
  from_status: null,
};

const rawOpenedSigner = {
  id: 90,
  actor: "juan nieto",
  action: "PUBLIC_LINK_OPENED_SIGNER",
  metadata: {
    source: "public_link",
    link_type: "signer_token",
    opened_at: "2026-04-17T04:56:35.458Z",
    signer_id: 43,
    actor_type: "PUBLIC_SIGNER",
    company_id: 1,
    document_id: 22,
    signer_name: "juan nieto",
    signer_email: "chuquid2000@gmail.com",
    numero_contrato_interno: "VF-2026-000022",
  },
  to_status: "PENDIENTE_FIRMA",
  created_at: "2026-04-17T04:56:35.455374",
  event_type: "PUBLIC_LINK_OPENED_SIGNER",
  ip_address: "10.199.50.3",
  user_agent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  document_id: 22,
  from_status: "PENDIENTE_FIRMA",
};

const rawRejectedOwner = {
  id: 91,
  actor: "ALUCARD",
  action: "DOCUMENT_REJECTED_OWNER",
  metadata: {
    reason: "Cancelado por administrador",
    source: "owner_panel",
    owner_id: 1,
    to_status: "RECHAZADO",
    actor_type: "OWNER",
    company_id: 1,
    event_type: "REJECTED_OWNER",
    owner_name: "ALUCARD",
    document_id: 22,
    from_status: "PENDIENTE_FIRMA",
    document_title: "prueba 22",
  },
  to_status: "RECHAZADO",
  created_at: "2026-04-17T15:10:05.620102",
  event_type: "REJECTED_OWNER",
  ip_address: "10.196.6.130",
  user_agent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  document_id: 22,
  from_status: "PENDIENTE_FIRMA",
};

const rawInvitationOpened = {
  id: 106,
  actor: "PUBLIC_USER",
  action: "INVITATION_OPENED",
  metadata: {
    source: "public_link",
    link_type: "document_token",
    opened_at: "2026-04-18T01:22:45.473Z",
    actor_type: "PUBLIC_VIEWER",
    company_id: 1,
    document_id: 27,
    numero_contrato_interno: "VF-2026-000027",
  },
  to_status: "PENDIENTE_FIRMA",
  created_at: "2026-04-18T01:22:45.471917",
  event_type: "INVITATION_OPENED",
  ip_address: "10.196.6.130",
  user_agent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  document_id: 27,
  from_status: "PENDIENTE_FIRMA",
};

describe("documentEvents utils", () => {
  describe("normalizeStatus", () => {
    it("normaliza estados legacy a enum frontend", () => {
      expect(normalizeStatus("BORRADOR")).toBe("DRAFT");
      expect(normalizeStatus("PENDIENTE_FIRMA")).toBe("PENDING_SIGNATURE");
      expect(normalizeStatus("FIRMADO")).toBe("SIGNED");
      expect(normalizeStatus("RECHAZADO")).toBe("REJECTED");
      expect(normalizeStatus("OTRO")).toBe("UNKNOWN");
    });
  });

  describe("getEventKind", () => {
    it("detecta created", () => {
      expect(getEventKind(rawCreated)).toBe("created");
    });

    it("detecta opened para signer token", () => {
      expect(getEventKind(rawOpenedSigner)).toBe("opened");
    });

    it("detecta rejected", () => {
      expect(getEventKind(rawRejectedOwner)).toBe("rejected");
    });
  });

  describe("mapDocumentEvent", () => {
    it("mapea evento creado de sistema", () => {
      const mapped = mapDocumentEvent(rawCreated);

      expect(mapped).toBeTruthy();
      expect(mapped.id).toBe(88);
      expect(mapped.documentId).toBe(22);
      expect(mapped.eventType).toBe("DOCUMENT_CREATED");
      expect(mapped.kind).toBe("created");
      expect(mapped.title).toBe("Documento creado");
      expect(mapped.actorType).toBe("system");
      expect(mapped.actor).toBe("Sistema");
      expect(mapped.showTechMeta).toBe(false);
      expect(mapped.timestamp).toBeInstanceOf(Date);
    });

    it("mapea apertura de signer token como usuario", () => {
      const mapped = mapDocumentEvent(rawOpenedSigner);

      expect(mapped.kind).toBe("opened");
      expect(mapped.title).toBe("Enlace de firma abierto");
      expect(mapped.actorType).toBe("user");
      expect(mapped.actor).toBe("juan nieto");
      expect(mapped.details).toContain("abrió el enlace de firma");
      expect(mapped.ip).toBe("10.199.50.3");
      expect(mapped.userAgent).toContain("Chrome");
      expect(mapped.showTechMeta).toBe(true);
      expect(mapped.fromStatusNorm).toBe("PENDING_SIGNATURE");
      expect(mapped.toStatusNorm).toBe("PENDING_SIGNATURE");
    });

    it("mapea rechazo owner con detalle humano", () => {
      const mapped = mapDocumentEvent(rawRejectedOwner);

      expect(mapped.kind).toBe("rejected");
      expect(mapped.title).toBe("Documento rechazado");
      expect(mapped.actorType).toBe("user");
      expect(mapped.actor).toBe("ALUCARD");
      expect(mapped.details).toContain("Cancelado por administrador");
      expect(mapped.fromStatusNorm).toBe("PENDING_SIGNATURE");
      expect(mapped.toStatusNorm).toBe("REJECTED");
      expect(mapped.showTechMeta).toBe(true);
    });

    it("mapea public viewer con label público", () => {
      const mapped = mapDocumentEvent(rawInvitationOpened);

      expect(mapped.kind).toBe("opened");
      expect(mapped.title).toBe("Documento público abierto");
      expect(mapped.actorType).toBe("user");
      expect(mapped.actor).toBe("Usuario público");
      expect(mapped.details).toContain("acceso público");
      expect(mapped.showTechMeta).toBe(true);
    });

    it("retorna null con input inválido", () => {
      expect(mapDocumentEvent(null)).toBeNull();
      expect(mapDocumentEvent(undefined)).toBeNull();
      expect(mapDocumentEvent("x")).toBeNull();
    });
  });

  describe("normalizeTimeline", () => {
    it("ordena eventos ascendente por fecha", () => {
      const timeline = normalizeTimeline({
        events: [rawRejectedOwner, rawCreated, rawOpenedSigner],
      });

      expect(timeline.hasEvents).toBe(true);
      expect(timeline.events).toHaveLength(3);
      expect(timeline.events[0].id).toBe(88);
      expect(timeline.events[1].id).toBe(90);
      expect(timeline.events[2].id).toBe(91);
    });

    it("toma progress y currentStep desde shape principal", () => {
      const timeline = normalizeTimeline({
        events: [rawCreated],
        progress: 55,
        currentStep: "PENDIENTE_FIRMA",
        nextStep: "Firma del participante",
      });

      expect(timeline.progress).toBe(55);
      expect(timeline.currentStep).toBe("PENDIENTE_FIRMA");
      expect(timeline.nextStep).toBe("Firma del participante");
    });

    it("tolera shape nested timeline", () => {
      const timeline = normalizeTimeline({
        timeline: {
          events: [rawCreated],
          progress: "40",
          currentStatus: "En curso",
          nextStep: "Revisión",
        },
      });

      expect(timeline.progress).toBe(40);
      expect(timeline.currentStep).toBe("En curso");
      expect(timeline.nextStep).toBe("Revisión");
      expect(timeline.events[0].id).toBe(88);
    });
  });

  describe("helpers de presentación", () => {
    it("genera key estable usando id", () => {
      const mapped = mapDocumentEvent(rawCreated);
      expect(getStableEventKey(mapped)).toBe("event-88");
    });

    it("formatea timestamp legible", () => {
      const text = formatTimelineTimestamp("2026-04-17T04:55:41.781414");
      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(0);
    });
  });
});
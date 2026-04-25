// src/views/__tests__/PublicSignView.expired.test.jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PublicSignView } from "../PublicSignView";

// Mocks de componentes secundarios para simplificar el test
vi.mock("../../components/PublicHeader", () => ({
  PublicHeader: () => <div data-testid="public-header" />,
}));

vi.mock("../../components/PublicFooter", () => ({
  PublicFooter: () => <div data-testid="public-footer" />,
}));

vi.mock("../../components/PublicPdfViewer", () => ({
  PublicPdfViewer: () => <div data-testid="public-pdf-viewer" />,
}));

vi.mock("../publicSign/PublicSignActions", () => ({
  PublicSignActions: () => <div data-testid="public-sign-actions" />,
}));

// Mock de usePublicSignLogic para controlar el estado "expired"
vi.mock("../publicSign/usePublicSignLogic", () => ({
  usePublicSignLogic: () => ({
    isVisado: false,
    pdfUrl: null,
    documentTitle: "Contrato de prueba",
    companyName: "Empresa S.A.",
    companyRut: "76.123.456-7",
    contractNumber: "CON-2026-001",
    procedureFieldLabel: "Trámite",
    procedureLabel: "Solicitud de servicio",
    signerRoleLabel: "Firmante final",
    participantInfo: {
      title: "Firmante",
      primary: "Juan Pérez",
      secondary: "juan@example.com",
    },
    viewState: {
      kind: "expired",
      title: "Enlace expirado",
      message:
        "Este enlace de firma expiró. Pide al remitente que te envíe un nuevo enlace.",
      canRetry: false,
    },
    statusBadge: {
      className: "badge badge--expired",
      label: "Enlace expirado",
    },
    canRenderDocument: false,
    canRenderActions: true,
    canSubmitAction: false,
    canReject: false,
    showReject: false,
    rejectReason: "",
    setRejectReason: vi.fn(),
    rejecting: false,
    rejectError: "",
    acceptedLegal: false,
    setAcceptedLegal: vi.fn(),
    legalError: "",
    signing: false,
    actionMessage: "",
    actionMessageType: "info",
    handleRetryLoad: vi.fn(),
    handleConfirm: vi.fn(),
    handleReject: vi.fn(),
    handleToggleReject: vi.fn(),
    setLegalError: vi.fn(),
  }),
  buildMetaTitle: (label, primary, secondary) =>
    `${label}: ${primary}${secondary ? ` - ${secondary}` : ""}`,
}));

describe("PublicSignView - estado expirado", () => {
  it("no muestra acciones y muestra mensaje de enlace expirado", () => {
    render(<PublicSignView />);

    // Hay al menos un título/texto con "Enlace expirado"
    const titles = screen.getAllByText("Enlace expirado");
    expect(titles.length).toBeGreaterThan(0);

    // Mensaje explicativo presente (aparece en intro y en card de estado)
    const messages = screen.getAllByText(
      "Este enlace de firma expiró. Pide al remitente que te envíe un nuevo enlace."
    );
    expect(messages.length).toBeGreaterThan(0);

    // No hay bloque de acciones de firma/visado/rechazo
    expect(screen.queryByTestId("public-sign-actions")).not.toBeInTheDocument();
  });
});
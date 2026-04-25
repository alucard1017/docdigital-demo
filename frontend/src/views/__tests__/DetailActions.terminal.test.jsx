// src/views/__tests__/DetailActions.terminal.test.jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DetailActions } from "../../components/DetailActions";
import { DOC_STATUS } from "../../constants";

vi.mock("../../hooks/useToast", () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

describe("DetailActions - documento firmado", () => {
  it("solo muestra Volver y Descargar cuando el documento está firmado", () => {
    render(
      <DetailActions
        puedeFirmar={true}
        puedeVisar={true}
        puedeRechazar={true}
        selectedDoc={{ id: 123, status: DOC_STATUS.FIRMADO }}
        setView={vi.fn()}
        setSelectedDoc={vi.fn()}
        manejarAccionDocumento={vi.fn()}
        canAdminDocumentActions={false}
      />
    );

    expect(
      screen.getByRole("button", { name: /volver a la bandeja/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /descargar pdf/i })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /firmar documento/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /visar documento/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^rechazar$/i })
    ).not.toBeInTheDocument();
  });
});
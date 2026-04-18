// frontend/src/components/Timeline.test.jsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { Timeline } from "./Timeline";
import { buildSampleTimeline, buildBaseTimeline } from "../test/fixtures/documentTimelineFixtures";

describe("Timeline component", () => {
  it("muestra el resumen de progreso y pasos", () => {
    const timeline = buildSampleTimeline();
    render(<Timeline timeline={timeline} />);

    expect(
      screen.getByRole("heading", { name: /progreso del documento/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/Estado actual/i)).toBeInTheDocument();
    expect(screen.getByText("PENDIENTE_FIRMA")).toBeInTheDocument();

    expect(screen.getByText(/Próximo paso/i)).toBeInTheDocument();
    expect(screen.getByText("Firma del participante")).toBeInTheDocument();

    expect(screen.getByText(/60\s*%/i)).toBeInTheDocument();
  });

  it("renderiza eventos creados, abiertos y rechazados con sus actores", () => {
    const timeline = buildSampleTimeline();
    render(<Timeline timeline={timeline} />);

    expect(screen.getByText("Documento creado")).toBeInTheDocument();
    expect(screen.getByText("Enlace de firma abierto")).toBeInTheDocument();
    expect(screen.getByText("Documento rechazado")).toBeInTheDocument();

    const sistemaMatches = screen.getAllByText(/Sistema/i);
    expect(sistemaMatches.length).toBeGreaterThanOrEqual(1);

    expect(
      screen.getByText(/juan nieto abrió el enlace de firma\./i)
    ).toBeInTheDocument();

    expect(
      screen.getByText((content) => content.replace(/\s+/g, " ").includes("Por: juan nieto"))
    ).toBeInTheDocument();

    expect(
      screen.getByText((content) => content.replace(/\s+/g, " ").includes("Por: ALUCARD"))
    ).toBeInTheDocument();
  });

  it("muestra detalles técnicos clave cuando existen", () => {
    const timeline = buildSampleTimeline();
    render(<Timeline timeline={timeline} />);

    expect(screen.getByText(/10\.199\.50\.3/)).toBeInTheDocument();
    expect(screen.getByText(/10\.196\.6\.130/)).toBeInTheDocument();

    expect(
      screen.getByText(/Cancelado por administrador/i)
    ).toBeInTheDocument();
  });

  it("muestra empty state cuando no hay eventos", () => {
    const timeline = buildBaseTimeline({ events: [], progress: 0, currentStep: null, nextStep: null });
    render(<Timeline timeline={timeline} />);

    expect(
      screen.getByText(
        /Este documento todavía no tiene eventos para mostrar/i
      )
    ).toBeInTheDocument();
  });

  it("muestra estado de carga cuando no se pasa timeline aún", () => {
    // @ts-expect-error
    render(<Timeline timeline={undefined} />);

    expect(
      screen.getByText(/Cargando historial del documento/i)
    ).toBeInTheDocument();
  });
});
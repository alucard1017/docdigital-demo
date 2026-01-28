// src/components/DetailHeader.jsx
import React from "react";

export function DetailHeader({ selectedDoc }) {
  return (
    <header className="topbar">
      <span
        style={{
          color: "#64748b",
          fontWeight: 500,
          fontSize: "0.9rem",
        }}
      >
        Revisión de Documento #{selectedDoc.id} - Estado {selectedDoc.status}
      </span>
      <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>
        Hola, <span style={{ color: "var(--primary)" }}>Alucard</span>
      </span>
    </header>
  );
}

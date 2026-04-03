import React from "react";

export function PublicHeader() {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "8px 12px",
        marginBottom: 12,
      }}
    >
      <img
        src="/favicon-32x32.png"
        alt="VeriFirma"
        style={{ width: 28, height: 28, borderRadius: 6 }}
      />
      <span
        style={{
          fontWeight: 700,
          letterSpacing: "0.06em",
          fontSize: "0.9rem",
          textTransform: "uppercase",
          color: "#e2e8f0",
        }}
      >
        VeriFirma · Plataforma de firma digital
      </span>
    </header>
  );
}
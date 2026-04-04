import React from "react";

export function PublicHeader() {
  return (
    <header
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px 12px",
        marginBottom: 8,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1400px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "12px 16px",
          borderRadius: 18,
          background: "rgba(2, 6, 23, 0.55)",
          border: "1px solid rgba(148, 163, 184, 0.16)",
          backdropFilter: "blur(10px)",
          boxSizing: "border-box",
        }}
      >
        <img
          src="/favicon-32x32.png"
          alt="VeriFirma"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            flexShrink: 0,
          }}
        />

        <span
          style={{
            fontWeight: 800,
            letterSpacing: "0.06em",
            fontSize: "0.95rem",
            textTransform: "uppercase",
            color: "#e2e8f0",
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          VeriFirma · Plataforma de firma digital
        </span>
      </div>
    </header>
  );
}
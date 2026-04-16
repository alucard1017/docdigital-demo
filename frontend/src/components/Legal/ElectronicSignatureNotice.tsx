import React from "react";

export function ElectronicSignatureNotice({
  checked,
  onChange,
  mode = "firma",
}) {
  const isVisado = mode === "visado";

  return (
    <div
      style={{
        marginTop: 6,
        borderRadius: 18,
        padding: 18,
        background: "rgba(15,23,42,0.72)",
        border: `1px solid ${
          isVisado ? "rgba(245,158,11,0.26)" : "rgba(96,165,250,0.26)"
        }`,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 999,
          background: isVisado
            ? "rgba(245,158,11,0.14)"
            : "rgba(59,130,246,0.14)",
          color: isVisado ? "#fcd34d" : "#93c5fd",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {isVisado ? "Aviso legal de visado" : "Aviso legal de firma"}
      </div>

      <p
        style={{
          margin: "0 0 10px",
          fontSize: 14,
          lineHeight: 1.7,
          color: "#e2e8f0",
        }}
      >
        {isVisado
          ? "Declaro que he leído y revisado el contenido del documento. Mi visado deja constancia de validación para continuar el flujo, mediante firma electrónica simple, con trazabilidad de fecha, hora y registro de actividad."
          : "Declaro que he leído el contenido del documento y acepto su firma mediante firma electrónica simple. Entiendo que esta actuación queda registrada con trazabilidad y produce los efectos previstos por la normativa aplicable."}
      </p>

      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          lineHeight: 1.65,
          color: "#94a3b8",
        }}
      >
        Referencia legal: Ley N° 19.799 sobre documentos electrónicos y firma
        electrónica en Chile.{" "}
        <a
          href="https://www.bcn.cl/leychile/navegar?idNorma=196640"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#93c5fd",
            textDecoration: "underline",
            fontWeight: 600,
          }}
        >
          Ver texto legal
        </a>
      </p>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          cursor: "pointer",
          padding: 14,
          borderRadius: 14,
          background: "rgba(2,6,23,0.64)",
          border: `1px solid ${
            checked
              ? isVisado
                ? "rgba(245,158,11,0.42)"
                : "rgba(96,165,250,0.42)"
              : "rgba(148,163,184,0.16)"
          }`,
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{
            marginTop: 3,
            width: 16,
            height: 16,
            accentColor: isVisado ? "#f59e0b" : "#2563eb",
            flexShrink: 0,
          }}
        />

        <span
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: "#f8fafc",
          }}
        >
          {isVisado
            ? "Acepto realizar el visado de este documento y declaro que actúo bajo mi responsabilidad, utilizando mis credenciales y datos personales."
            : "Acepto firmar este documento mediante firma electrónica simple y declaro que actúo bajo mi responsabilidad, utilizando mis credenciales y datos personales."}
        </span>
      </label>
    </div>
  );
}
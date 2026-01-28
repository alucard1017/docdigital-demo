// src/components/DetailActions.jsx
import React from "react";

export function DetailActions({
  puedeFirmar,
  puedeRechazar,
  selectedDoc,
  setView,
  setSelectedDoc,
  manejarAccionDocumento,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 12,
        borderTop: "1px solid #e5e7eb",
        paddingTop: 16,
      }}
    >
      <button
        type="button"
        className="btn-main"
        style={{
          background: "#e5e7eb",
          color: "#374151",
        }}
        onClick={() => {
          setView("list");
          setSelectedDoc(null);
        }}
      >
        Volver sin firmar
      </button>

      {puedeRechazar && (
        <button
          type="button"
          className="btn-main"
          style={{
            background: "#fee2e2",
            color: "#b91c1c",
          }}
          onClick={async () => {
            const motivo = window.prompt("Indique el motivo de rechazo:");
            if (!motivo) return;
            await manejarAccionDocumento(selectedDoc.id, "rechazar", {
              motivo,
            });
          }}
        >
          Rechazar
        </button>
      )}

      {puedeFirmar && (
        <button
          type="button"
          className="btn-main btn-primary"
          onClick={async () => {
            const ok = window.confirm(
              "Declaro que he leído íntegramente el documento, que estoy de acuerdo con su contenido y que autorizo su suscripción mediante firma electrónica simple, de conformidad con la Ley N° 19.799 sobre documentos y firma electrónica, otorgándole la misma validez y eficacia jurídica que a un documento firmado de forma manuscrita en soporte papel."
            );
            if (!ok) return;
            await manejarAccionDocumento(selectedDoc.id, "firmar");
          }}
        >
          Firmar documento
        </button>
      )}
    </div>
  );
}

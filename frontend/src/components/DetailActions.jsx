// src/components/DetailActions.jsx
import React from "react";

export function DetailActions({
  puedeFirmar,
  puedeVisar,
  puedeRechazar,
  selectedDoc,
  setView,
  setSelectedDoc,
  manejarAccionDocumento,
}) {
  if (!selectedDoc) return null;

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

      {puedeVisar && (
        <button
          type="button"
          className="btn-main"
          style={{
            background: "#fbbf24",
            color: "#78350f",
          }}
          onClick={async () => {
            const ok = window.confirm(
              "Declaro que he revisado íntegramente el documento, que tomo conocimiento de su contenido y que emito mi visado en conformidad, para los efectos que correspondan, en el marco de la Ley N° 19.799 sobre documentos electrónicos y firma electrónica. Entiendo que este visado quedará registrado electrónicamente junto con la trazabilidad del proceso."
            );
            if (!ok) return;
            await manejarAccionDocumento(selectedDoc.id, "visar");
          }}
        >
          Visar documento
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

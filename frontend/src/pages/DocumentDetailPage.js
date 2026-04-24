// src/pages/DocumentDetailPage.js
import React, { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useDocumentTimeline } from "../hooks/useDocumentTimeline";
import { Timeline } from "../components/Timeline";
import { ElectronicSignatureNotice } from "../components/Legal/ElectronicSignatureNotice";
import api from "../api/client";

export function DocumentDetailPage() {
  const { id } = useParams();
  const documentId = id ? Number(id) : null;

  const { data, loading, error, reload } = useDocumentTimeline(documentId);

  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [signing, setSigning] = useState(false);
  const [actionError, setActionError] = useState("");

  // Estado para recordatorio manual
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderSending, setReminderSending] = useState(false);

  if (!documentId || Number.isNaN(documentId)) {
    return <div style={{ padding: 20 }}>ID de documento inválido</div>;
  }

  const document = data?.document || null;

  const isSigned = document?.status === "FIRMADO";
  const isRejected = document?.status === "RECHAZADO";
  const isPending =
    document?.status === "PENDIENTE_FIRMA" ||
    document?.status === "PENDIENTE_VISADO";

  const defaultReminderText = useMemo(
    () =>
      `Hola, te recuerdo que tienes un documento pendiente en VeriFirma: "${document?.title ||
        "Documento"}". Por favor revísalo y completa la acción correspondiente.`,
    [document?.title]
  );

  const effectiveReminderMessage = useMemo(
    () => reminderMessage || "",
    [reminderMessage]
  );

  const handleViewPdf = async () => {
    if (!documentId) return;
    try {
      const res = await api.get(`/documents/${documentId}/download`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Error abriendo PDF interno:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudo abrir el PDF";
      alert("❌ " + msg);
    }
  };

  const handleSign = async () => {
    if (!documentId) return;

    if (!acceptedLegal) {
      alert("Debes aceptar el aviso legal antes de firmar.");
      return;
    }

    try {
      setSigning(true);
      setActionError("");

      await api.post(`/documents/${documentId}/firmar`);

      alert("✅ Documento firmado correctamente.");
      setAcceptedLegal(false);
      await reload();
    } catch (err) {
      console.error("Error firmando documento:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudo firmar el documento";
      setActionError(msg);
      alert("❌ " + msg);
    } finally {
      setSigning(false);
    }
  };

  const handleOpenReminder = () => {
    setReminderMessage(defaultReminderText);
    setReminderOpen(true);
  };

  const handleCloseReminder = () => {
    if (reminderSending) return;
    setReminderOpen(false);
    setReminderMessage("");
  };

  const handleSendReminder = async () => {
    if (!documentId) return;

    try {
      setReminderSending(true);

      await api.post(`/documents/${documentId}/recordatorio`, {
        message: effectiveReminderMessage.trim() || null,
      });

      alert("✅ Recordatorio enviado correctamente.");
      setReminderOpen(false);
      setReminderMessage("");
      await reload();
    } catch (err) {
      console.error("Error enviando recordatorio:", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudo enviar el recordatorio";
      alert("❌ " + msg);
    } finally {
      setReminderSending(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: 20 }}>
        <Timeline timeline={null} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <p style={{ color: "#ef4444", marginBottom: 8 }}>{error}</p>
        <button onClick={reload}>Reintentar</button>
      </div>
    );
  }

  if (!data || !document) {
    return null;
  }

  return (
    <div style={{ padding: 20, maxWidth: 960, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 4 }}>{document.title}</h2>
      <p style={{ marginBottom: 16, color: "#6b7280", fontSize: 14 }}>
        Estado actual: <strong>{document.status}</strong>
      </p>

      <div
        style={{
          marginBottom: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <button type="button" onClick={handleViewPdf} className="btn-main">
          Ver PDF
        </button>

        {!isSigned && !isRejected && (
          <button
            type="button"
            onClick={handleSign}
            className="btn-main btn-primary"
            disabled={!acceptedLegal || signing}
          >
            {signing ? "Firmando..." : "Firmar documento"}
          </button>
        )}

        {isPending && (
          <button
            type="button"
            onClick={handleOpenReminder}
            className="btn-main btn-secondary"
            style={{ marginLeft: "auto" }}
          >
            Enviar recordatorio
          </button>
        )}
      </div>

      {!isSigned && !isRejected && (
        <ElectronicSignatureNotice
          checked={acceptedLegal}
          onChange={setAcceptedLegal}
        />
      )}

      {actionError && (
        <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>
          {actionError}
        </p>
      )}

      <h3 style={{ marginTop: 24, marginBottom: 8 }}>Historial</h3>
      <Timeline timeline={data.timeline} />

      {/* Modal simple para recordatorio */}
      {reminderOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15,23,42,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 40,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 12,
              padding: 20,
              width: "100%",
              maxWidth: 520,
              boxShadow:
                "0 10px 25px rgba(15,23,42,0.25), 0 0 0 1px rgba(148,163,184,0.25)",
            }}
          >
            <h4 style={{ margin: 0, marginBottom: 8, fontSize: 16 }}>
              Enviar recordatorio
            </h4>
            <p
              style={{
                margin: 0,
                marginBottom: 12,
                fontSize: 13,
                color: "#6b7280",
              }}
            >
              Puedes personalizar el mensaje que se enviará a los
              destinatarios pendientes. Si lo dejas tal cual, se enviará este
              texto por defecto.
            </p>

            <textarea
              rows={5}
              style={{
                width: "100%",
                fontSize: 13,
                padding: 8,
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                resize: "vertical",
                marginBottom: 12,
              }}
              value={effectiveReminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 8,
              }}
            >
              <button
                type="button"
                onClick={handleCloseReminder}
                disabled={reminderSending}
                className="btn-main btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSendReminder}
                disabled={reminderSending}
                className="btn-main btn-primary"
              >
                {reminderSending ? "Enviando..." : "Enviar recordatorio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentDetailPage;
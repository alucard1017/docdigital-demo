import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../constants";

const API_URL = API_BASE_URL;

export function PublicSignView({ token }) {
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await fetch(`${API_URL}/api/public/docs/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "No se pudo cargar el documento");
        setDoc(data.document);
        setPdfUrl(data.pdfUrl);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchDoc();
  }, [token]);

  const handleSign = async () => {
    if (!accepted) {
      alert("Debes aceptar la declaración para poder firmar.");
      return;
    }
    setSigning(true);
    try {
      const res = await fetch(`${API_URL}/api/public/docs/${token}/firmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "No se pudo firmar el documento");
      alert("Documento firmado correctamente.");
      setDoc((prev) => prev ? { ...prev, status: "FIRMADO" } : prev);
    } catch (err) {
      alert(err.message);
    } finally {
      setSigning(false);
    }
  };

  if (loading) return <p style={{ padding: 24 }}>Cargando documento...</p>;
  if (error) return <p style={{ padding: 24, color: "red" }}>{error}</p>;
  if (!doc) return <p style={{ padding: 24 }}>Documento no encontrado</p>;

  const isSigned = doc.status === "FIRMADO";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <header>
        <h1>Firma de documento</h1>
        <p>
          Documento: <strong>{doc.title}</strong>
        </p>
        <p>
          Empresa: <strong>{doc.empresa_rut}</strong>
        </p>
        <p>
          Destinatario: <strong>{doc.destinatario_nombre}</strong>
        </p>
        <p>
          Estado actual: <strong>{doc.status}</strong>
        </p>
      </header>

      {/* Visor PDF público */}
      {pdfUrl ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", height: "70vh" }}>
          <iframe
            title="Documento PDF"
            src={pdfUrl}
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        </div>
      ) : (
        <p>No se pudo cargar el PDF.</p>
      )}

      {/* Panel de firma */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 16,
          background: "#f9fafb",
        }}
      >
        <h2>Confirmación de firma electrónica</h2>
        <p style={{ fontSize: 14, color: "#4b5563", marginTop: 8 }}>
          Declaro que he leído íntegramente el documento mostrado arriba, que estoy de acuerdo con su contenido
          y que autorizo su suscripción mediante firma electrónica simple, otorgándole la misma validez que a
          una firma manuscrita.
        </p>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            disabled={isSigned}
          />
          <span>Acepto la declaración anterior y deseo firmar el documento.</span>
        </label>

        <button
          type="button"
          className="btn-main btn-primary"
          style={{ marginTop: 16, opacity: isSigned ? 0.6 : 1 }}
          onClick={handleSign}
          disabled={!accepted || signing || isSigned}
        >
          {isSigned ? "Documento ya firmado" : signing ? "Firmando..." : "Firmar documento"}
        </button>
      </section>
    </div>
  );
}

// frontend/src/components/help/HelpPanel.jsx

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { createHelpQuery, getFaqs } from "../../services/helpService";
import FaqList from "./FaqList";

export default function HelpPanel({ isOpen, onClose }) {
  const { i18n } = useTranslation();

  const language = useMemo(() => {
    const lng = i18n?.language || "es";
    return lng.startsWith("en") ? "en" : "es";
  }, [i18n?.language]);

  const [faqs, setFaqs] = useState([]);
  const [loadingFaqs, setLoadingFaqs] = useState(false);
  const [faqError, setFaqError] = useState("");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadFaqs() {
      try {
        setLoadingFaqs(true);
        setFaqError("");
        const data = await getFaqs(language);
        if (!cancelled) {
          setFaqs(data);
        }
      } catch (error) {
        if (!cancelled) {
          setFaqError(error.message || "No se pudieron cargar las FAQs");
        }
      } finally {
        if (!cancelled) {
          setLoadingFaqs(false);
        }
      }
    }

    loadFaqs();

    return () => {
      cancelled = true;
    };
  }, [isOpen, language]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!subject.trim() || !message.trim()) {
      setSubmitMessage("Debes escribir asunto y mensaje.");
      return;
    }

    try {
      setSending(true);
      setSubmitMessage("");

      await createHelpQuery({
        subject: subject.trim(),
        message: message.trim(),
        source: "WEB_HELP_WIDGET",
      });

      setSubject("");
      setMessage("");
      setSubmitMessage("Consulta enviada correctamente.");
    } catch (error) {
      setSubmitMessage(error.message || "No se pudo enviar la consulta.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {isOpen && <div style={styles.backdrop} onClick={onClose} />}

      <aside
        style={{
          ...styles.panel,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
        }}
        aria-hidden={!isOpen}
      >
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>Ayuda</h3>
            <p style={styles.subtitle}>Preguntas frecuentes y soporte</p>
          </div>

          <button type="button" onClick={onClose} style={styles.closeButton}>
            ×
          </button>
        </div>

        <section style={styles.section}>
          <h4 style={styles.sectionTitle}>FAQs</h4>
          <FaqList items={faqs} loading={loadingFaqs} error={faqError} />
        </section>

        <section style={styles.section}>
          <h4 style={styles.sectionTitle}>Contactar soporte</h4>

          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              type="text"
              placeholder="Asunto"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={styles.input}
            />

            <textarea
              placeholder="Escribe tu consulta"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              style={styles.textarea}
            />

            <button type="submit" disabled={sending} style={styles.submitButton}>
              {sending ? "Enviando..." : "Enviar consulta"}
            </button>

            {submitMessage ? (
              <p style={styles.feedback}>{submitMessage}</p>
            ) : null}
          </form>
        </section>
      </aside>
    </>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    zIndex: 999,
  },
  panel: {
    position: "fixed",
    top: 0,
    right: 0,
    width: "420px",
    maxWidth: "100%",
    height: "100vh",
    background: "#f9fafb",
    boxShadow: "-8px 0 24px rgba(0,0,0,0.15)",
    zIndex: 1000,
    transition: "transform 220ms ease",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    padding: "20px",
    borderBottom: "1px solid #e5e7eb",
    background: "#ffffff",
    position: "sticky",
    top: 0,
  },
  title: {
    margin: 0,
    fontSize: "20px",
    color: "#111827",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: "13px",
    color: "#6b7280",
  },
  closeButton: {
    border: "none",
    background: "transparent",
    fontSize: "28px",
    lineHeight: 1,
    cursor: "pointer",
    color: "#374151",
  },
  section: {
    padding: "20px",
    borderBottom: "1px solid #e5e7eb",
  },
  sectionTitle: {
    margin: "0 0 12px",
    fontSize: "16px",
    color: "#111827",
  },
  form: {
    display: "grid",
    gap: "12px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    resize: "vertical",
  },
  submitButton: {
    border: "none",
    borderRadius: "10px",
    padding: "12px 14px",
    background: "#0f766e",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  feedback: {
    margin: 0,
    fontSize: "13px",
    color: "#374151",
  },
};
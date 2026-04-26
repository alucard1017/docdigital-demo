// frontend/src/components/help/HelpPanel.jsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { createHelpQuery, getFaqs } from "../../services/helpService";
import FaqList from "./FaqList";

function resolveLanguage(i18nLanguage) {
  if (typeof i18nLanguage !== "string") return "es";
  return i18nLanguage.toLowerCase().startsWith("en") ? "en" : "es";
}

export default function HelpPanel({ isOpen, onClose }) {
  const { t, i18n } = useTranslation();

  const language = useMemo(
    () => resolveLanguage(i18n?.language),
    [i18n?.language]
  );

  const [faqs, setFaqs] = useState([]);
  const [loadingFaqs, setLoadingFaqs] = useState(false);
  const [faqError, setFaqError] = useState("");

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;

    async function loadFaqs() {
      try {
        setLoadingFaqs(true);
        setFaqError("");
        const data = await getFaqs(language);

        if (!ignore) {
          setFaqs(data);
        }
      } catch (error) {
        if (!ignore) {
          setFaqError(
            error?.response?.data?.message ||
              error?.message ||
              t(
                "help.loadFaqsError",
                "No se pudieron cargar las preguntas frecuentes."
              )
          );
        }
      } finally {
        if (!ignore) {
          setLoadingFaqs(false);
        }
      }
    }

    loadFaqs();

    return () => {
      ignore = true;
    };
  }, [isOpen, language, t]);

  useEffect(() => {
    if (!isOpen) {
      setSubmitMessage("");
      setSubmitError("");
    }
  }, [isOpen]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (sending) return;

    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    if (!cleanSubject || !cleanMessage) {
      setSubmitError(
        t("help.missingSubjectAndMessage", "Debes escribir asunto y mensaje.")
      );
      setSubmitMessage("");
      return;
    }

    try {
      setSending(true);
      setSubmitError("");
      setSubmitMessage("");

      await createHelpQuery({
        subject: cleanSubject,
        message: cleanMessage,
        source: "WEB_HELP_WIDGET",
      });

      setSubject("");
      setMessage("");
      setSubmitMessage(
        t("help.submitSuccess", "Consulta enviada correctamente.")
      );
    } catch (error) {
      setSubmitError(
        error?.response?.data?.message ||
          error?.message ||
          t("help.submitError", "No se pudo enviar la consulta.")
      );
      setSubmitMessage("");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {isOpen ? <div style={styles.backdrop} onClick={onClose} /> : null}

      <aside
        style={{
          ...styles.panel,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          pointerEvents: isOpen ? "auto" : "none",
        }}
        aria-hidden={!isOpen}
      >
        <div style={styles.header}>
          <div>
            <h3 style={styles.title}>{t("help.title", "Ayuda")}</h3>
            <p style={styles.subtitle}>
              {t("help.subtitle", "Preguntas frecuentes y soporte")}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={styles.closeButton}
            aria-label={t("help.close", "Cerrar ayuda")}
          >
            ×
          </button>
        </div>

        <section style={styles.section}>
          <h4 style={styles.sectionTitle}>{t("help.faqsTitle", "FAQs")}</h4>
          <FaqList items={faqs} loading={loadingFaqs} error={faqError} />
        </section>

        <section style={styles.section}>
          <h4 style={styles.sectionTitle}>
            {t("help.contactTitle", "Contactar soporte")}
          </h4>

          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              type="text"
              placeholder={t("help.subjectPlaceholder", "Asunto")}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={styles.input}
              maxLength={180}
            />

            <textarea
              placeholder={t(
                "help.messagePlaceholder",
                "Escribe tu consulta"
              )}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              style={styles.textarea}
              maxLength={3000}
            />

            <button
              type="submit"
              disabled={sending}
              style={{
                ...styles.submitButton,
                opacity: sending ? 0.7 : 1,
                cursor: sending ? "not-allowed" : "pointer",
              }}
            >
              {sending
                ? t("help.sending", "Enviando...")
                : t("help.send", "Enviar consulta")}
            </button>

            {submitMessage ? (
              <p style={styles.feedbackSuccess}>{submitMessage}</p>
            ) : null}

            {submitError ? (
              <p style={styles.feedbackError}>{submitError}</p>
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
    background: "rgba(0, 0, 0, 0.35)",
    zIndex: 1090,
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
    zIndex: 1100,
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
    outline: "none",
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    resize: "vertical",
    outline: "none",
  },
  submitButton: {
    border: "none",
    borderRadius: "10px",
    padding: "12px 14px",
    background: "#0f766e",
    color: "#fff",
    fontWeight: 700,
  },
  feedbackSuccess: {
    margin: 0,
    fontSize: "13px",
    color: "#166534",
  },
  feedbackError: {
    margin: 0,
    fontSize: "13px",
    color: "#b91c1c",
  },
};
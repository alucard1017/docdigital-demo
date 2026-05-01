// frontend/src/components/help/HelpPanel.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Globe,
  LifeBuoy,
  MoonStar,
  Settings2,
  Send,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { createHelpQuery, getFaqs } from "../../services/helpService";
import FaqList from "./FaqList";
import "../../styles/helpPanel.css";

const DEFAULT_LANGUAGE = "es";
const DEFAULT_SOURCE = "WEB_HELP_WIDGET";

function normalizeUiLanguage(language) {
  if (typeof language !== "string") return DEFAULT_LANGUAGE;
  return language.toLowerCase().startsWith("en") ? "en" : "es";
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export default function HelpPanel({ panelId, isOpen, onClose, onOpenSettings }) {
  const { t, i18n } = useTranslation();

  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusedElementRef = useRef(null);
  const previousBodyOverflowRef = useRef("");
  const previousHtmlOverflowRef = useRef("");
  const requestIdRef = useRef(0);

  const language = useMemo(() => {
    return normalizeUiLanguage(i18n?.resolvedLanguage || i18n?.language);
  }, [i18n?.resolvedLanguage, i18n?.language]);

  const [faqs, setFaqs] = useState([]);
  const [loadingFaqs, setLoadingFaqs] = useState(false);
  const [faqError, setFaqError] = useState("");

  const [form, setForm] = useState({
    subject: "",
    message: "",
  });

  const [sending, setSending] = useState(false);
  const [submitState, setSubmitState] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const isBusy = sending;

  const resetSubmitFeedback = useCallback(() => {
    setSubmitState("idle");
    setSubmitMessage("");
  }, []);

  const handleClose = useCallback(() => {
    if (isBusy) return;
    onClose?.();
  }, [isBusy, onClose]);

  const handleOpenSettingsClick = useCallback(() => {
    if (isBusy) return;
    onClose?.();
    window.setTimeout(() => {
      onOpenSettings?.();
    }, 0);
  }, [isBusy, onClose, onOpenSettings]);

  const updateForm = useCallback(
    (patch) => {
      setForm((current) => ({
        ...current,
        ...patch,
      }));
      resetSubmitFeedback();
    },
    [resetSubmitFeedback]
  );

  useEffect(() => {
    if (!isOpen) return;

    previousFocusedElementRef.current =
      typeof document !== "undefined" ? document.activeElement : null;

    if (typeof document !== "undefined") {
      previousBodyOverflowRef.current = document.body.style.overflow;
      previousHtmlOverflowRef.current = document.documentElement.style.overflow;

      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus?.();
      panelRef.current?.focus?.();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);

      if (typeof document !== "undefined") {
        document.body.style.overflow = previousBodyOverflowRef.current || "";
        document.documentElement.style.overflow =
          previousHtmlOverflowRef.current || "";
      }

      previousFocusedElementRef.current?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const currentRequestId = ++requestIdRef.current;

    async function loadFaqs() {
      try {
        setLoadingFaqs(true);
        setFaqError("");

        const data = await getFaqs(language);

        if (requestIdRef.current !== currentRequestId) return;
        setFaqs(Array.isArray(data) ? data : []);
      } catch (error) {
        if (requestIdRef.current !== currentRequestId) return;

        setFaqError(
          error?.message ||
            t(
              "help.loadFaqsError",
              "No se pudieron cargar las preguntas frecuentes."
            )
        );
        setFaqs([]);
      } finally {
        if (requestIdRef.current === currentRequestId) {
          setLoadingFaqs(false);
        }
      }
    }

    loadFaqs();

    return () => {
      requestIdRef.current += 1;
    };
  }, [isOpen, language, t]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isBusy) {
        event.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBusy, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setLoadingFaqs(false);
      setFaqError("");
      requestIdRef.current += 1;
    }
  }, [isOpen]);

  const handleSubjectChange = useCallback(
    (event) => {
      updateForm({ subject: event.target.value });
    },
    [updateForm]
  );

  const handleMessageChange = useCallback(
    (event) => {
      updateForm({ message: event.target.value });
    },
    [updateForm]
  );

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      const cleanSubject = normalizeText(form.subject);
      const cleanMessage = normalizeText(form.message);

      if (!cleanSubject || !cleanMessage) {
        setSubmitState("error");
        setSubmitMessage(
          t(
            "help.missingSubjectAndMessage",
            "Debes escribir asunto y mensaje."
          )
        );
        return;
      }

      try {
        setSending(true);
        resetSubmitFeedback();

        await createHelpQuery({
          subject: cleanSubject,
          message: cleanMessage,
          source: DEFAULT_SOURCE,
        });

        setForm({
          subject: "",
          message: "",
        });
        setSubmitState("success");
        setSubmitMessage(
          t("help.submitSuccess", "Consulta enviada correctamente.")
        );
      } catch (error) {
        setSubmitState("error");
        setSubmitMessage(
          error?.message ||
            t("help.submitError", "No se pudo enviar la consulta.")
        );
      } finally {
        setSending(false);
      }
    },
    [form.message, form.subject, resetSubmitFeedback, t]
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="floating-help-backdrop is-open"
        onClick={handleClose}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        id={panelId}
        className="floating-help-panel floating-help-panel--fullscreen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="floating-help-title"
        aria-describedby="floating-help-description"
        aria-busy={loadingFaqs || sending}
        aria-hidden={!isOpen}
        onClick={(event) => event.stopPropagation()}
        tabIndex={-1}
      >
        <div className="floating-help-panel__header">
          <div>
            <h2 id="floating-help-title" className="floating-help-panel__title">
              {t("help.panelTitle", "Ayuda y ajustes")}
            </h2>
            <p
              id="floating-help-description"
              className="floating-help-panel__subtitle"
            >
              {t(
                "help.panelSubtitle",
                "Accede rápido a soporte, preguntas frecuentes y preferencias."
              )}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="floating-help-panel__close"
            onClick={handleClose}
            aria-label={t("help.close", "Cerrar ayuda")}
            disabled={sending}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="floating-help-panel__body">
          <section className="floating-help-section">
            <h3>{t("help.quickActionsTitle", "Acciones rápidas")}</h3>

            <button
              type="button"
              className="floating-help-shortcut"
              onClick={handleOpenSettingsClick}
              disabled={sending}
            >
              <span
                className="floating-help-shortcut__icon"
                aria-hidden="true"
              >
                <Settings2 size={16} />
              </span>

              <span className="floating-help-shortcut__content">
                <span className="floating-help-shortcut__title">
                  {t("help.shortcuts.settingsTitle", "Abrir ajustes")}
                </span>
                <span className="floating-help-shortcut__text">
                  {t(
                    "help.shortcuts.settingsText",
                    "Cambia tema, idioma y densidad de la interfaz."
                  )}
                </span>
              </span>

              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </section>

          <section className="floating-help-section">
            <h3>{t("help.quickQuestionsTitle", "Preguntas rápidas")}</h3>

            <div className="floating-help-item">
              <div className="floating-help-item__icon" aria-hidden="true">
                <Globe size={16} />
              </div>
              <div className="floating-help-item__content">
                <strong>
                  {t(
                    "help.quickQuestions.languageTitle",
                    "¿Cómo cambio el idioma?"
                  )}
                </strong>
                <p>
                  {t(
                    "help.quickQuestions.languageText",
                    "Desde Ajustes puedes seleccionar Español o English."
                  )}
                </p>
              </div>
            </div>

            <div className="floating-help-item">
              <div className="floating-help-item__icon" aria-hidden="true">
                <MoonStar size={16} />
              </div>
              <div className="floating-help-item__content">
                <strong>
                  {t(
                    "help.quickQuestions.themeTitle",
                    "¿Cómo activo modo claro u oscuro?"
                  )}
                </strong>
                <p>
                  {t(
                    "help.quickQuestions.themeText",
                    "Puedes elegir modo claro, oscuro o seguir el sistema."
                  )}
                </p>
              </div>
            </div>

            <div className="floating-help-item">
              <div className="floating-help-item__icon" aria-hidden="true">
                <LifeBuoy size={16} />
              </div>
              <div className="floating-help-item__content">
                <strong>
                  {t(
                    "help.quickQuestions.densityTitle",
                    "¿Qué hace la densidad compacta?"
                  )}
                </strong>
                <p>
                  {t(
                    "help.quickQuestions.densityText",
                    "Reduce espacios en tablas y listas para ver más contenido."
                  )}
                </p>
              </div>
            </div>
          </section>

          <section className="floating-help-section">
            <h3>{t("help.faqsTitle", "FAQs")}</h3>
            <FaqList items={faqs} loading={loadingFaqs} error={faqError} />
          </section>

          <section className="floating-help-section">
            <h3>{t("help.contactTitle", "Contactar soporte")}</h3>

            <form onSubmit={handleSubmit} className="floating-help-form">
              <label className="sr-only" htmlFor="help-subject">
                {t("help.subjectPlaceholder", "Asunto")}
              </label>
              <input
                id="help-subject"
                type="text"
                placeholder={t("help.subjectPlaceholder", "Asunto")}
                value={form.subject}
                onChange={handleSubjectChange}
                className="floating-help-input"
                disabled={sending}
                maxLength={160}
              />

              <label className="sr-only" htmlFor="help-message">
                {t("help.messagePlaceholder", "Escribe tu consulta")}
              </label>
              <textarea
                id="help-message"
                placeholder={t("help.messagePlaceholder", "Escribe tu consulta")}
                value={form.message}
                onChange={handleMessageChange}
                rows={4}
                className="floating-help-textarea"
                disabled={sending}
                maxLength={4000}
              />

              <button
                type="submit"
                disabled={sending}
                className="floating-help-submit"
              >
                <Send size={16} aria-hidden="true" />
                <span>
                  {sending
                    ? t("help.sending", "Enviando...")
                    : t("help.send", "Enviar consulta")}
                </span>
              </button>

              {submitMessage ? (
                <p
                  className={`floating-help-feedback ${
                    submitState === "error"
                      ? "floating-help-feedback--error"
                      : submitState === "success"
                      ? "floating-help-feedback--success"
                      : ""
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {submitMessage}
                </p>
              ) : null}
            </form>
          </section>
        </div>
      </aside>
    </>
  );
}
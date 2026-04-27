// src/components/help/HelpPanel.jsx
import { ChevronRight, Globe, LifeBuoy, MoonStar, Settings2, X } from "lucide-react";
import "../../styles/helpPanel.css";

export default function HelpPanel({ isOpen, onClose, onOpenSettings }) {
  if (!isOpen) return null;

  return (
    <>
      <div className="floating-help-backdrop" onClick={onClose} />

      <aside
        className="floating-help-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="floating-help-title"
      >
        <div className="floating-help-panel__header">
          <div>
            <h2 id="floating-help-title" className="floating-help-panel__title">
              Ayuda y ajustes
            </h2>
            <p className="floating-help-panel__subtitle">
              Accede rápido a ayuda, idioma, apariencia y preferencias de uso.
            </p>
          </div>

          <button
            type="button"
            className="floating-help-panel__close"
            onClick={onClose}
            aria-label="Cerrar ayuda"
          >
            <X size={18} />
          </button>
        </div>

        <div className="floating-help-panel__body">
          <section className="floating-help-section">
            <h3>Acciones rápidas</h3>

            <button
              type="button"
              className="floating-help-shortcut"
              onClick={onOpenSettings}
            >
              <span className="floating-help-shortcut__icon">
                <Settings2 size={16} />
              </span>

              <span className="floating-help-shortcut__content">
                <span className="floating-help-shortcut__title">
                  Abrir ajustes
                </span>
                <span className="floating-help-shortcut__text">
                  Cambia tema, idioma y densidad de la interfaz.
                </span>
              </span>

              <ChevronRight size={16} />
            </button>
          </section>

          <section className="floating-help-section">
            <h3>Preguntas frecuentes</h3>

            <div className="floating-help-item">
              <div className="floating-help-item__icon">
                <Globe size={16} />
              </div>
              <div className="floating-help-item__content">
                <strong>¿Cómo cambio el idioma?</strong>
                <p>
                  Abre Ajustes y selecciona el idioma de la aplicación en la
                  sección correspondiente.
                </p>
              </div>
            </div>

            <div className="floating-help-item">
              <div className="floating-help-item__icon">
                <MoonStar size={16} />
              </div>
              <div className="floating-help-item__content">
                <strong>¿Cómo activo modo oscuro o claro?</strong>
                <p>
                  Desde Ajustes puedes elegir entre tema del sistema, modo claro
                  o modo oscuro.
                </p>
              </div>
            </div>

            <div className="floating-help-item">
              <div className="floating-help-item__icon">
                <LifeBuoy size={16} />
              </div>
              <div className="floating-help-item__content">
                <strong>¿Qué hace la densidad compacta?</strong>
                <p>
                  Reduce espacios en tablas, listas y controles para mostrar más
                  información en pantalla.
                </p>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
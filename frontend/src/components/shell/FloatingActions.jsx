// src/components/shell/FloatingActions.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LifeBuoy, Settings2, Sparkles, X } from "lucide-react";
import HelpPanel from "../help/HelpPanel";
import SettingsPanel from "../settings/SettingsPanel";
import "../../styles/floatingActions.css";

export default function FloatingActions() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const rootRef = useRef(null);
  const menuId = useMemo(() => "floating-actions-menu", []);

  const closeFabMenu = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const closeHelp = useCallback(() => {
    setIsHelpOpen(false);
  }, []);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const openHelp = useCallback(() => {
    setIsExpanded(false);
    setIsHelpOpen(true);
  }, []);

  const openSettings = useCallback(() => {
    setIsExpanded(false);
    setIsHelpOpen(false);
    setIsSettingsOpen(true);
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target)) return;
      setIsExpanded(false);
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsExpanded(false);
        setIsHelpOpen(false);
        setIsSettingsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const showScreenDismiss = isExpanded || isHelpOpen || isSettingsOpen;

  return (
    <>
      <div className="floating-actions" ref={rootRef}>
        <div
          id={menuId}
          className={`floating-actions__menu ${
            isExpanded ? "floating-actions__menu--open" : ""
          }`}
          aria-hidden={!isExpanded}
        >
          <button
            type="button"
            className="floating-actions__item floating-actions__item--help"
            onClick={openHelp}
          >
            <span className="floating-actions__item-icon">
              <LifeBuoy size={16} />
            </span>
            <span className="floating-actions__item-label">Ayuda</span>
          </button>

          <button
            type="button"
            className="floating-actions__item floating-actions__item--settings"
            onClick={openSettings}
          >
            <span className="floating-actions__item-icon">
              <Settings2 size={16} />
            </span>
            <span className="floating-actions__item-label">Ajustes</span>
          </button>
        </div>

        <button
          type="button"
          className={`floating-actions__trigger ${isExpanded ? "is-open" : ""}`}
          aria-label={isExpanded ? "Cerrar menú rápido" : "Abrir ayuda y ajustes"}
          aria-expanded={isExpanded ? "true" : "false"}
          aria-controls={menuId}
          onClick={toggleExpanded}
        >
          <span className="floating-actions__trigger-ring" />
          <span className="floating-actions__trigger-icon">
            {isExpanded ? <X size={20} /> : <Sparkles size={20} />}
          </span>
        </button>
      </div>

      <HelpPanel
        isOpen={isHelpOpen}
        onClose={closeHelp}
        onOpenSettings={openSettings}
      />

      <SettingsPanel isOpen={isSettingsOpen} onClose={closeSettings} />

      {showScreenDismiss && (
        <button
          type="button"
          className="floating-actions__screen-dismiss"
          onClick={() => {
            closeFabMenu();
            closeHelp();
            closeSettings();
          }}
          aria-label="Cerrar paneles flotantes"
        />
      )}
    </>
  );
}
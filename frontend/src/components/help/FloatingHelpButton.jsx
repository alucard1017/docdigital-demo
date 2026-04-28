// src/components/help/FloatingHelpButton.jsx
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import HelpPanel from "./HelpPanel";

export default function FloatingHelpButton({ onOpenSettings }) {
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);

  const triggerRef = useRef(null);
  const panelId = useId();

  const triggerLabel = useMemo(
    () => t("help.title", "Ayuda"),
    [t]
  );

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus?.();
  }, []);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setIsOpen(false);
    onOpenSettings?.();
  }, [onOpenSettings]);

  const handleTriggerKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleToggle();
      }

      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        handleClose();
      }
    },
    [handleClose, handleToggle, isOpen]
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="floating-help-button"
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={panelId}
        title={triggerLabel}
      >
        <Sparkles size={20} aria-hidden="true" />
      </button>

      <HelpPanel
        panelId={panelId}
        isOpen={isOpen}
        onClose={handleClose}
        onOpenSettings={handleOpenSettings}
      />
    </>
  );
}
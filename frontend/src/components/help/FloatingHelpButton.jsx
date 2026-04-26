// frontend/src/components/help/FloatingHelpButton.jsx
import { useCallback, useState } from "react";
import HelpPanel from "./HelpPanel";

export default function FloatingHelpButton() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir ayuda"
        title="Ayuda"
        onClick={handleOpen}
        style={styles.button}
      >
        ?
      </button>

      <HelpPanel isOpen={isOpen} onClose={handleClose} />
    </>
  );
}

const styles = {
  button: {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    width: "56px",
    height: "56px",
    borderRadius: "999px",
    border: "none",
    background: "#0f766e",
    color: "#ffffff",
    fontSize: "24px",
    fontWeight: 700,
    lineHeight: 1,
    cursor: "pointer",
    boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
    zIndex: 1100,
  },
};
// frontend/src/components/help/FloatingHelpButton.jsx

import { useState } from "react";
import HelpPanel from "./HelpPanel";

export default function FloatingHelpButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir ayuda"
        style={styles.fab}
      >
        ?
      </button>

      <HelpPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}

const styles = {
  fab: {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    width: "56px",
    height: "56px",
    borderRadius: "999px",
    border: "none",
    background: "#0f766e",
    color: "#fff",
    fontSize: "24px",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
    zIndex: 1000,
  },
};
// src/components/help/HelpLauncher.jsx
import { useCallback, useState } from "react";
import FloatingHelpButton from "./FloatingHelpButton";
import SettingsPanel from "../settings/SettingsPanel";

export default function HelpLauncher() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const openSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  return (
    <>
      <FloatingHelpButton onOpenSettings={openSettings} />

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={closeSettings}
      />
    </>
  );
}
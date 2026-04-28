// src/components/shell/FloatingActions.jsx
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { LifeBuoy, Settings2, Sparkles, X } from "lucide-react";
import HelpPanel from "../help/HelpPanel";
import SettingsPanel from "../settings/SettingsPanel";
import "../../styles/floatingActions.css";

const PANEL_NONE = null;
const PANEL_HELP = "help";
const PANEL_SETTINGS = "settings";

export default function FloatingActions() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePanel, setActivePanel] = useState(PANEL_NONE);
  const [focusedActionIndex, setFocusedActionIndex] = useState(0);

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const actionRefs = useRef([]);

  const menuId = useId();

  const isHelpOpen = activePanel === PANEL_HELP;
  const isSettingsOpen = activePanel === PANEL_SETTINGS;
  const isAnyPanelOpen = activePanel !== PANEL_NONE;

  const actionItems = useMemo(
    () => [
      {
        key: PANEL_HELP,
        label: "Ayuda",
        icon: LifeBuoy,
        className: "floating-actions__item floating-actions__item--help",
        onSelect: () => {
          setIsExpanded(false);
          setActivePanel(PANEL_HELP);
        },
      },
      {
        key: PANEL_SETTINGS,
        label: "Ajustes",
        icon: Settings2,
        className:
          "floating-actions__item floating-actions__item--settings",
        onSelect: () => {
          setIsExpanded(false);
          setActivePanel(PANEL_SETTINGS);
        },
      },
    ],
    []
  );

  const closeFabMenu = useCallback(() => {
    setIsExpanded(false);
    setFocusedActionIndex(0);
  }, []);

  const closePanels = useCallback(() => {
    setActivePanel(PANEL_NONE);
  }, []);

  const closeAll = useCallback(() => {
    setIsExpanded(false);
    setActivePanel(PANEL_NONE);
    setFocusedActionIndex(0);
    triggerRef.current?.focus?.();
  }, []);

  const closeHelp = useCallback(() => {
    setActivePanel((current) => (current === PANEL_HELP ? PANEL_NONE : current));
    triggerRef.current?.focus?.();
  }, []);

  const closeSettings = useCallback(() => {
    setActivePanel((current) =>
      current === PANEL_SETTINGS ? PANEL_NONE : current
    );
    triggerRef.current?.focus?.();
  }, []);

  const handleOpenSettingsFromHelp = useCallback(() => {
    setActivePanel(PANEL_SETTINGS);
  }, []);

  const openMenu = useCallback((startIndex = 0) => {
    setIsExpanded(true);
    setFocusedActionIndex(startIndex);
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const focusActionAt = useCallback((index) => {
    const total = actionItems.length;
    if (!total) return;

    const normalizedIndex = ((index % total) + total) % total;
    setFocusedActionIndex(normalizedIndex);
    actionRefs.current[normalizedIndex]?.focus?.();
  }, [actionItems.length]);

  useEffect(() => {
    function handlePointerDownOutside(event) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target)) return;

      if (isExpanded) {
        setIsExpanded(false);
      }
    }

    function handleEscape(event) {
      if (event.key !== "Escape") return;

      if (isExpanded) {
        event.preventDefault();
        closeFabMenu();
        triggerRef.current?.focus?.();
        return;
      }

      if (activePanel !== PANEL_NONE) {
        event.preventDefault();
        closePanels();
        triggerRef.current?.focus?.();
      }
    }

    document.addEventListener("mousedown", handlePointerDownOutside);
    document.addEventListener("touchstart", handlePointerDownOutside, {
      passive: true,
    });
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
      document.removeEventListener("touchstart", handlePointerDownOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activePanel, closeFabMenu, closePanels, isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;

    const timer = window.setTimeout(() => {
      focusActionAt(focusedActionIndex);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isExpanded, focusedActionIndex, focusActionAt]);

  useEffect(() => {
    if (isExpanded) return;
    if (isAnyPanelOpen) return;

    triggerRef.current?.focus?.();
  }, [isExpanded, isAnyPanelOpen]);

  const handleTriggerKeyDown = useCallback(
    (event) => {
      switch (event.key) {
        case "ArrowDown":
        case "Enter":
        case " ":
          event.preventDefault();
          openMenu(0);
          break;
        case "ArrowUp":
          event.preventDefault();
          openMenu(actionItems.length - 1);
          break;
        default:
          break;
      }
    },
    [actionItems.length, openMenu]
  );

  const handleMenuKeyDown = useCallback(
    (event) => {
      switch (event.key) {
        case "ArrowDown":
        case "ArrowRight":
          event.preventDefault();
          focusActionAt(focusedActionIndex + 1);
          break;
        case "ArrowUp":
        case "ArrowLeft":
          event.preventDefault();
          focusActionAt(focusedActionIndex - 1);
          break;
        case "Home":
          event.preventDefault();
          focusActionAt(0);
          break;
        case "End":
          event.preventDefault();
          focusActionAt(actionItems.length - 1);
          break;
        case "Tab":
          closeFabMenu();
          break;
        default:
          break;
      }
    },
    [actionItems.length, closeFabMenu, focusActionAt, focusedActionIndex]
  );

  const showScreenDismiss = isExpanded;

  return (
    <>
      <div className="floating-actions" ref={rootRef}>
        <div
          id={menuId}
          className={`floating-actions__menu ${
            isExpanded ? "floating-actions__menu--open" : ""
          }`}
          role="menu"
          aria-hidden={!isExpanded}
          aria-label="Acciones rápidas"
          onKeyDown={handleMenuKeyDown}
        >
          {actionItems.map((item, index) => {
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                ref={(element) => {
                  actionRefs.current[index] = element;
                }}
                type="button"
                role="menuitem"
                tabIndex={isExpanded ? (focusedActionIndex === index ? 0 : -1) : -1}
                className={item.className}
                onClick={item.onSelect}
                onFocus={() => setFocusedActionIndex(index)}
              >
                <span className="floating-actions__item-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span className="floating-actions__item-label">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        <button
          ref={triggerRef}
          type="button"
          className={`floating-actions__trigger ${isExpanded ? "is-open" : ""}`}
          aria-label={isExpanded ? "Cerrar menú rápido" : "Abrir ayuda y ajustes"}
          aria-expanded={isExpanded}
          aria-controls={menuId}
          aria-haspopup="menu"
          onClick={toggleExpanded}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className="floating-actions__trigger-ring" />
          <span className="floating-actions__trigger-icon" aria-hidden="true">
            {isExpanded ? <X size={20} /> : <Sparkles size={20} />}
          </span>
        </button>
      </div>

      <HelpPanel
        isOpen={isHelpOpen}
        onClose={closeHelp}
        onOpenSettings={handleOpenSettingsFromHelp}
      />

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={closeSettings}
      />

      {showScreenDismiss && (
        <button
          type="button"
          className="floating-actions__screen-dismiss"
          onClick={closeFabMenu}
          aria-label="Cerrar menú flotante"
        />
      )}
    </>
  );
}
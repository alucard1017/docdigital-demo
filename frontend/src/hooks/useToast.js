// src/hooks/useToast.js
import { useContext } from "react";
import { ToastContext } from "../components/feedback/ToastProvider";

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error(
      "useToast debe usarse dentro de ToastProvider. Asegúrate de envolver tu app con <ToastProvider>."
    );
  }

  return context;
}
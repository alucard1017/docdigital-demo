// frontend/src/components/Onboarding/ProductTour.jsx
// Componente de tour de producto (stub compatible con React 19).
// Mantiene toda la lógica de pasos y guardado en backend, pero
// por ahora no monta react-joyride para evitar errores en producción.

import React, { useEffect, useState, useCallback } from "react";
import Joyride, { STATUS, EVENTS, ACTIONS } from "react-joyride-react-19";

const ProductTour = ({ tourId = "dashboard_principal", run, onFinish }) => {
  const [steps, setSteps] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const buildSteps = useCallback(() => {
    const baseSteps = [
      {
        target: ".hero-dashboard-title",
        content:
          "Este es tu panel principal, aquí ves el resumen de tus documentos y acciones rápidas.",
        title: "Panel principal",
        placement: "bottom",
      },
      {
        target: ".hero-dashboard-actions .btn-primary",
        content:
          "Haz clic aquí para crear un nuevo documento y enviarlo a firma.",
        title: "Nuevo documento",
        placement: "bottom",
      },
      {
        target: ".doc-table",
        content:
          "Aquí verás la lista de documentos, estados y acciones disponibles.",
        title: "Bandeja de documentos",
        placement: "top",
      },
      {
        target: ".sidebar-root",
        content:
          "Desde este menú puedes navegar a configuraciones, equipo, analytics y más.",
        title: "Navegación",
        placement: "right",
      },
    ];

    setSteps(baseSteps);
    setIsReady(true);
  }, []);

  const loadTourProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/onboarding/tour/${tourId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setStepIndex(0);
        return;
      }
      const data = await res.json();
      if (data.completed) {
        setStepIndex(0);
        setIsRunning(false);
      } else if (typeof data.currentStep === "number") {
        setStepIndex(data.currentStep);
      }
    } catch (err) {
      console.error("Error cargando progreso de tour:", err);
      setStepIndex(0);
    }
  }, [tourId]);

  const saveTourProgress = useCallback(
    async ({ completed, currentStep }) => {
      try {
        await fetch(`/api/onboarding/tour/${tourId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ completed, currentStep }),
        });
      } catch (err) {
        console.error("Error guardando progreso de tour:", err);
      }
    },
    [tourId]
  );

  useEffect(() => {
    buildSteps();
    loadTourProgress();
  }, [buildSteps, loadTourProgress]);

  useEffect(() => {
    if (run && isReady && steps.length > 0) {
      setIsRunning(true);
    } else {
      setIsRunning(false);
    }
  }, [run, isReady, steps]);

  const handleJoyrideCallback = async (data) => {
    const { status, type, index, action } = data;

    const finishedStatuses = ["finished", "skipped"];

    if (finishedStatuses.includes(status)) {
      setIsRunning(false);
      setStepIndex(0);
      await saveTourProgress({ completed: true, currentStep: 0 });
      if (onFinish) onFinish();
      return;
    }

    if (type === "step:after" || type === "target:notFound") {
      const newIndex = action === "prev" ? Math.max(index - 1, 0) : index + 1;
      setStepIndex(newIndex);
      await saveTourProgress({ completed: false, currentStep: newIndex });
    }
  };

  // Por ahora no renderizamos el tour para evitar conflictos con react-joyride.
  if (!isReady || !steps.length || !isRunning) {
    return null;
  }

  return null;
};

export default ProductTour;

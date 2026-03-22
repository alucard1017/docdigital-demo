// frontend/src/components/Onboarding/ProductTour.jsx
import React, { useEffect, useState, useCallback } from "react";
import Joyride, { STATUS, EVENTS, ACTIONS } from "react-joyride";

/**
 * ProductTour
 *
 * Props:
 * - tourId: string (ej: "dashboard_principal")
 * - run: boolean (empieza el tour cuando true)
 * - onFinish: () => void (se llama al terminar / saltar)
 */
const ProductTour = ({ tourId = "dashboard_principal", run, onFinish }) => {
  const [steps, setSteps] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // 1) Cargar configuración de pasos desde el frontend (hardcoded por ahora)
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
        target: ".sidebar-root", // asegúrate de tener esta clase en tu Sidebar
        content:
          "Desde este menú puedes navegar a configuraciones, equipo, analytics y más.",
        title: "Navegación",
        placement: "right",
      },
    ];

    setSteps(baseSteps);
    setIsReady(true);
  }, []);

  // 2) Cargar progreso guardado del tour desde tu backend
  const loadTourProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/onboarding/tour/${tourId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        // si no existe aún registro, comenzamos desde 0
        setStepIndex(0);
        return;
      }
      const data = await res.json();
      // Asumimos algo como { completed: false, currentStep: 0 }
      if (data.completed) {
        // si ya lo completó, no correr
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

  // 3) Guardar progreso en backend
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

  // 4) Preparar pasos y progreso al montar
  useEffect(() => {
    buildSteps();
    loadTourProgress();
  }, [buildSteps, loadTourProgress]);

  // 5) Arrancar el tour cuando run=true y ya está listo
  useEffect(() => {
    if (run && isReady && steps.length > 0) {
      setIsRunning(true);
    } else {
      setIsRunning(false);
    }
  }, [run, isReady, steps]);

  const handleJoyrideCallback = async (data) => {
    const { status, type, index, action } = data;

    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

    // Cuando termina o se salta
    if (finishedStatuses.includes(status)) {
      setIsRunning(false);
      setStepIndex(0);

      // Guardamos como completado
      await saveTourProgress({ completed: true, currentStep: 0 });

      if (onFinish) onFinish();
      return;
    }

    // Avance de pasos
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const newIndex =
        action === ACTIONS.PREV ? Math.max(index - 1, 0) : index + 1;

      setStepIndex(newIndex);

      // Guardamos progreso parcial
      await saveTourProgress({ completed: false, currentStep: newIndex });
    }
  };

  if (!isReady || !steps.length) return null;

  return (
    <Joyride
      steps={steps}
      run={isRunning}
      stepIndex={stepIndex}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      disableScrolling
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: "#4f46e5",
          zIndex: 10000,
        },
      }}
      locale={{
        back: "Atrás",
        close: "Cerrar",
        last: "Finalizar",
        next: "Siguiente",
        skip: "Saltar tour",
      }}
    />
  );
};

export default ProductTour;

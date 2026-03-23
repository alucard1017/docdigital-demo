// frontend/src/components/Onboarding/ProductTour.jsx
import React, { useEffect, useState, useCallback } from "react";
import * as JoyrideNS from "react-joyride";


const Joyride = JoyrideNS.default || JoyrideNS;
const { STATUS, EVENTS, ACTIONS } = JoyrideNS;

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

    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setIsRunning(false);
      setStepIndex(0);
      await saveTourProgress({ completed: true, currentStep: 0 });
      if (onFinish) onFinish();
      return;
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const newIndex =
        action === ACTIONS.PREV ? Math.max(index - 1, 0) : index + 1;

      setStepIndex(newIndex);
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

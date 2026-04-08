import React, { useCallback, useEffect, useRef, useState } from "react";
import Joyride, { STATUS, EVENTS, ACTIONS } from "react-joyride";
import api from "../../api/client";

const DEFAULT_TOUR_ID = "dashboard_principal";

const ProductTour = ({ tourId = DEFAULT_TOUR_ID, run = false, onFinish }) => {
  const [steps, setSteps] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const buildSteps = useCallback(() => {
    const baseSteps = [
      {
        target: ".hero-dashboard-title",
        title: "Panel principal",
        content:
          "Este es tu panel principal, aquí ves el resumen de tus documentos y acciones rápidas.",
        placement: "bottom",
        disableBeacon: true,
      },
      {
        target: ".hero-dashboard-actions .btn-primary",
        title: "Nuevo documento",
        content: "Haz clic aquí para crear un nuevo documento y enviarlo a firma.",
        placement: "bottom",
      },
      {
        target: ".doc-table",
        title: "Bandeja de documentos",
        content:
          "Aquí verás la lista de documentos, estados y acciones disponibles.",
        placement: "top",
      },
      {
        target: ".sidebar-root",
        title: "Navegación",
        content:
          "Desde este menú puedes navegar a configuraciones, equipo, analytics y más.",
        placement: "right",
      },
    ];

    const safeSteps = Array.isArray(baseSteps) ? baseSteps.filter(Boolean) : [];

    if (isMountedRef.current) {
      setSteps(safeSteps);
      setIsReady(true);
    }
  }, []);

  const loadTourProgress = useCallback(async () => {
    try {
      const res = await api.get(`/onboarding/tour/${tourId}`);
      const data = res?.data || {};

      if (!isMountedRef.current) return;

      if (data.completed) {
        setStepIndex(0);
        setIsRunning(false);
        return;
      }

      if (
        typeof data.currentStep === "number" &&
        Number.isInteger(data.currentStep) &&
        data.currentStep >= 0
      ) {
        setStepIndex(data.currentStep);
      } else {
        setStepIndex(0);
      }
    } catch (err) {
      console.error("[PRODUCT TOUR] Error cargando progreso:", err);
      if (isMountedRef.current) {
        setStepIndex(0);
      }
    }
  }, [tourId]);

  const saveTourProgress = useCallback(
    async ({ completed, currentStep }) => {
      try {
        await api.put(`/onboarding/tour/${tourId}`, {
          completed: Boolean(completed),
          currentStep:
            typeof currentStep === "number" && currentStep >= 0 ? currentStep : 0,
        });
      } catch (err) {
        console.error("[PRODUCT TOUR] Error guardando progreso:", err);
      }
    },
    [tourId]
  );

  useEffect(() => {
    buildSteps();
    loadTourProgress();
  }, [buildSteps, loadTourProgress]);

  useEffect(() => {
    const hasSteps = Array.isArray(steps) && steps.length > 0;
    const shouldRun = Boolean(run && isReady && hasSteps);

    if (isMountedRef.current) {
      setIsRunning(shouldRun);
    }
  }, [run, isReady, steps]);

  const handleJoyrideCallback = useCallback(
    async (data) => {
      const { status, type, index, action } = data || {};
      const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

      if (finishedStatuses.includes(status)) {
        if (isMountedRef.current) {
          setIsRunning(false);
          setStepIndex(0);
        }

        await saveTourProgress({ completed: true, currentStep: 0 });

        if (typeof onFinish === "function") {
          onFinish();
        }

        return;
      }

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        const currentIndex = typeof index === "number" ? index : 0;
        const computedNextIndex =
          action === ACTIONS.PREV
            ? Math.max(currentIndex - 1, 0)
            : currentIndex + 1;

        const boundedNextIndex = Math.min(
          computedNextIndex,
          Math.max(steps.length - 1, 0)
        );

        if (isMountedRef.current) {
          setStepIndex(boundedNextIndex);
        }

        await saveTourProgress({
          completed: false,
          currentStep: boundedNextIndex,
        });
      }
    },
    [onFinish, saveTourProgress, steps.length]
  );

  const hasSteps = Array.isArray(steps) && steps.length > 0;

  if (!isReady || !hasSteps) {
    return null;
  }

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
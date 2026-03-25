// frontend/src/components/Onboarding/OnboardingWizard.jsx
import React, { useEffect, useState } from "react";
import "./OnboardingWizard.css";
import api from "../../api/client";

const STEPS = [
  { id: 1, key: "welcome", label: "Bienvenido" },
  { id: 2, key: "profile", label: "Completar perfil" },
  { id: 3, key: "first_document", label: "Crear primer documento" },
  { id: 4, key: "invite_team", label: "Invitar equipo" },
  { id: 5, key: "finish", label: "Finalizar" },
];

const OnboardingWizard = ({ onCompleted, onSkipped }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);

  // Fetch initial onboarding status
  const fetchStatus = async () => {
  console.log("[ONBOARDING DEBUG] Intentando llamar a:", api.defaults.baseURL + "/onboarding/status");
    try {
      setLoading(true);
      setError("");

      if (!api) {
        throw new Error("API client no inicializado");
      }

      const res = await api.get("/onboarding/status");

      if (!res || !res.data) {
        throw new Error("Respuesta vacía del servidor");
      }

      const data = res.data;
      setStatus(data);

      // Set current step if available, otherwise keep default
      if (data && typeof data.current_step === "number") {
        setCurrentStep(data.current_step || 1);
      }
    } catch (err) {
      console.error("[ONBOARDING] Error fetching status:", {
        message: err?.message,
        status: err?.response?.status,
        url: err?.config?.url,
      });

      // Fallback: set default onboarding state
      setStatus({
        current_step: 1,
        completed: false,
        skipped: false,
      });
      setCurrentStep(1);
      // No mostrar error al usuario en el primer load
      setError("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Update step on backend
  const updateStep = async (step) => {
    try {
      setSaving(true);
      setError("");

      if (!api) {
        throw new Error("API client no inicializado");
      }

      await api.put("/onboarding/step", { step });
      setCurrentStep(step);
    } catch (err) {
      console.error("[ONBOARDING] Error updating step:", err?.message);
      setError("Error al guardar el progreso. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (currentStep >= STEPS.length) return;
    await updateStep(currentStep + 1);
  };

  const handleBack = async () => {
    if (currentStep <= 1) return;
    await updateStep(currentStep - 1);
  };

  const handleComplete = async () => {
    try {
      setSaving(true);
      setError("");

      if (!api) {
        throw new Error("API client no inicializado");
      }

      await api.post("/onboarding/complete");

      if (onCompleted) {
        onCompleted();
      }
    } catch (err) {
      console.error("[ONBOARDING] Error completing:", err?.message);
      setError("No se pudo completar el onboarding. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    try {
      setSaving(true);
      setError("");

      if (!api) {
        throw new Error("API client no inicializado");
      }

      await api.post("/onboarding/skip");

      if (onSkipped) {
        onSkipped();
      }
    } catch (err) {
      console.error("[ONBOARDING] Error skipping:", err?.message);
      setError("No se pudo saltar el onboarding. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="onboarding-step-content">
            <h2>Bienvenido a VeriFirma</h2>
            <p>
              Configuraremos tu cuenta para que puedas enviar tu primer
              documento a firma en menos de 2 minutos.
            </p>
            <ul>
              <li>Conocerás el panel principal.</li>
              <li>Crearás tu primer documento.</li>
              <li>Invitarás a tu equipo.</li>
            </ul>
          </div>
        );
      case 2:
        return (
          <div className="onboarding-step-content">
            <h2>Completa tu perfil</h2>
            <p>
              Asegúrate de que tu nombre, logo y datos de empresa estén listos
              para que tus documentos se vean profesionales.
            </p>
            <p className="onboarding-hint">
              Tip: ve a{" "}
              <strong className="onboarding-highlight">
                Configuración &gt; Perfil
              </strong>{" "}
              para actualizar tu información.
            </p>
          </div>
        );
      case 3:
        return (
          <div className="onboarding-step-content">
            <h2>Crea tu primer documento</h2>
            <p>
              Carga un PDF o utiliza una plantilla para crear tu primer flujo de
              firma.
            </p>
            <p className="onboarding-hint">
              Desde el dashboard, haz clic en{" "}
              <strong className="onboarding-highlight">
                "Nuevo documento"
              </strong>{" "}
              y añade los firmantes.
            </p>
          </div>
        );
      case 4:
        return (
          <div className="onboarding-step-content">
            <h2>Invita a tu equipo</h2>
            <p>
              Agrega a los miembros de tu equipo para que puedan crear y
              gestionar documentos contigo.
            </p>
            <p className="onboarding-hint">
              En{" "}
              <strong className="onboarding-highlight">
                Configuración &gt; Equipo
              </strong>{" "}
              puedes enviar invitaciones por correo.
            </p>
          </div>
        );
      case 5:
        return (
          <div className="onboarding-step-content">
            <h2>Todo listo 🎉</h2>
            <p>Ya tienes lo necesario para empezar a usar VeriFirma.</p>
            <p className="onboarding-hint">
              Siempre podrás volver a ver el tour desde el menú de ayuda.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="onboarding-overlay">
        <div className="onboarding-modal">
          <div className="onboarding-loading">Cargando onboarding...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-modal">
        <div className="onboarding-header">
          <div>
            <h1 className="onboarding-title">Primeros pasos en VeriFirma</h1>
            <p className="onboarding-subtitle">
              Paso {currentStep} de {STEPS.length}
            </p>
          </div>
          <button
            className="onboarding-skip"
            onClick={handleSkip}
            disabled={saving}
            title="Saltar el onboarding"
          >
            Saltar
          </button>
        </div>

        <div className="onboarding-progress-bar">
          {STEPS.map((step) => (
            <div
              key={step.id}
              className={`onboarding-progress-step ${
                step.id <= currentStep ? "active" : ""
              }`}
            >
              <div className="onboarding-progress-dot" />
              <span className="onboarding-progress-label">{step.label}</span>
            </div>
          ))}
        </div>

        {error && <div className="onboarding-error">{error}</div>}

        {renderStepContent()}

        <div className="onboarding-footer">
          <button
            className="onboarding-button secondary"
            onClick={handleBack}
            disabled={currentStep === 1 || saving}
            title="Ir al paso anterior"
          >
            Atrás
          </button>

          {currentStep < STEPS.length && (
            <button
              className="onboarding-button primary"
              onClick={handleNext}
              disabled={saving}
              title="Continuar al siguiente paso"
            >
              {saving ? "Guardando..." : "Continuar"}
            </button>
          )}

          {currentStep === STEPS.length && (
            <button
              className="onboarding-button primary"
              onClick={handleComplete}
              disabled={saving}
              title="Finalizar onboarding e ir al dashboard"
            >
              {saving ? "Guardando..." : "Ir al Dashboard"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;

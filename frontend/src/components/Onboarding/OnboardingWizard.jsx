// frontend/src/components/Onboarding/OnboardingWizard.jsx
import React, { useEffect, useState } from "react";
import "./OnboardingWizard.css";

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
  const [status, setStatus] = useState(null); // respuesta de /status

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/onboarding/status", {
        credentials: "include",
      });
      const data = await res.json();
      setStatus(data);
      if (data?.currentStep) {
        setCurrentStep(data.currentStep);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el estado de onboarding.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const updateStep = async (step) => {
    try {
      setSaving(true);
      setError("");
      await fetch("/api/onboarding/step", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ step }),
      });
      setCurrentStep(step);
    } catch (err) {
      console.error(err);
      setError("Error al guardar el progreso.");
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (currentStep >= STEPS.length) return;
    const nextStep = currentStep + 1;
    await updateStep(nextStep);
  };

  const handleBack = async () => {
    if (currentStep <= 1) return;
    const prevStep = currentStep - 1;
    await updateStep(prevStep);
  };

  const handleComplete = async () => {
    try {
      setSaving(true);
      setError("");
      await fetch("/api/onboarding/complete", {
        method: "POST",
        credentials: "include",
      });
      if (onCompleted) onCompleted();
    } catch (err) {
      console.error(err);
      setError("No se pudo completar el onboarding.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    try {
      setSaving(true);
      setError("");
      await fetch("/api/onboarding/skip", {
        method: "POST",
        credentials: "include",
      });
      if (onSkipped) onSkipped();
    } catch (err) {
      console.error(err);
      setError("No se pudo saltar el onboarding.");
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
              Configuraremos tu cuenta para que puedas enviar tu primer documento a firma en menos de 2 minutos.
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
              Asegúrate de que tu nombre, logo y datos de empresa estén listos para que tus documentos se vean profesionales.
            </p>
            <p className="onboarding-hint">
              Tip: ve a <strong className="onboarding-highlight">Configuración &gt; Perfil</strong> para actualizar tu información.
            </p>
          </div>
        );
      case 3:
        return (
          <div className="onboarding-step-content">
            <h2>Crea tu primer documento</h2>
            <p>
              Carga un PDF o utiliza una plantilla para crear tu primer flujo de firma.
            </p>
            <p className="onboarding-hint">
              Desde el dashboard, haz clic en{" "}
              <strong className="onboarding-highlight">“Nuevo documento”</strong> y añade los firmantes.
            </p>
          </div>
        );
      case 4:
        return (
          <div className="onboarding-step-content">
            <h2>Invita a tu equipo</h2>
            <p>
              Agrega a los miembros de tu equipo para que puedan crear y gestionar documentos contigo.
            </p>
            <p className="onboarding-hint">
              En <strong className="onboarding-highlight">Configuración &gt; Equipo</strong> puedes enviar invitaciones por correo.
            </p>
          </div>
        );
      case 5:
        return (
          <div className="onboarding-step-content">
            <h2>Todo listo 🎉</h2>
            <p>
              Ya tienes lo necesario para empezar a usar VeriFirma en producción.
            </p>
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
          >
            Atrás
          </button>

          {currentStep < STEPS.length && (
            <button
              className="onboarding-button primary"
              onClick={handleNext}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Continuar"}
            </button>
          )}

          {currentStep === STEPS.length && (
            <button
              className="onboarding-button primary"
              onClick={handleComplete}
              disabled={saving}
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

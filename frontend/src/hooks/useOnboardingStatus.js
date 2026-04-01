import { useCallback, useEffect, useState } from "react";
import api from "../api/client";

export function useOnboardingStatus(token) {
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [runProductTour, setRunProductTour] = useState(false);

  const checkOnboarding = useCallback(async () => {
    if (!token) return;

    try {
      setCheckingOnboarding(true);
      const res = await api.get("/onboarding/status");
      const data = res.data;

      if (data?.needsOnboarding) {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
    } catch (err) {
      console.error("[ONBOARDING CHECK] Error:", err.message);
      setShowOnboarding(false);
    } finally {
      setCheckingOnboarding(false);
    }
  }, [token]);

  const handleOnboardingCompleted = useCallback(() => {
    setShowOnboarding(false);
    setRunProductTour(true);
  }, []);

  const handleOnboardingSkipped = useCallback(() => {
    setShowOnboarding(false);
    setRunProductTour(false);
  }, []);

  useEffect(() => {
    if (token) {
      checkOnboarding();
    }
  }, [token, checkOnboarding]);

  return {
    checkingOnboarding,
    showOnboarding,
    runProductTour,
    setRunProductTour,
    checkOnboarding,
    handleOnboardingCompleted,
    handleOnboardingSkipped,
  };
}
import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/client";

export function useOnboardingStatus(token) {
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [runProductTour, setRunProductTour] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const checkOnboarding = useCallback(async () => {
    if (!token) {
      if (isMountedRef.current) {
        setShowOnboarding(false);
        setRunProductTour(false);
        setCheckingOnboarding(false);
      }
      return;
    }

    try {
      if (isMountedRef.current) {
        setCheckingOnboarding(true);
      }

      const res = await api.get("/onboarding/status");
      const data = res?.data || {};

      if (!isMountedRef.current) return;

      if (data?.needsOnboarding) {
        setShowOnboarding(true);
      } else {
        setShowOnboarding(false);
      }
    } catch (err) {
      console.error("[ONBOARDING CHECK] Error:", err);
      if (isMountedRef.current) {
        setShowOnboarding(false);
      }
    } finally {
      if (isMountedRef.current) {
        setCheckingOnboarding(false);
      }
    }
  }, [token]);

  const handleOnboardingCompleted = useCallback(() => {
    if (!isMountedRef.current) return;
    setShowOnboarding(false);
    setRunProductTour(true);
  }, []);

  const handleOnboardingSkipped = useCallback(() => {
    if (!isMountedRef.current) return;
    setShowOnboarding(false);
    setRunProductTour(false);
  }, []);

  useEffect(() => {
    if (token) {
      checkOnboarding();
      return;
    }

    if (isMountedRef.current) {
      setCheckingOnboarding(false);
      setShowOnboarding(false);
      setRunProductTour(false);
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
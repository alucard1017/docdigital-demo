// backend/routes/onboarding.js
const express = require("express");
const router = express.Router();

const {
  getOnboardingStatus,
  updateOnboardingStep,
  completeOnboarding,
  skipOnboarding,
  getTourProgress,
  updateTourProgress,
} = require("../controllers/onboardingController");

// Reutiliza el middleware de auth central
const { requireAuth } = require("./auth");

// Onboarding routes (todas protegidas)
router.get("/status", requireAuth, getOnboardingStatus);
router.put("/step", requireAuth, updateOnboardingStep);
router.post("/complete", requireAuth, completeOnboarding);
router.post("/skip", requireAuth, skipOnboarding);

// Product tour routes (también protegidas)
router.get("/tour/:tourId", requireAuth, getTourProgress);
router.put("/tour/:tourId", requireAuth, updateTourProgress);

module.exports = router;

const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboardingController');
const { authenticateToken } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Onboarding routes
router.get('/status', onboardingController.getOnboardingStatus);
router.put('/step', onboardingController.updateOnboardingStep);
router.post('/complete', onboardingController.completeOnboarding);
router.post('/skip', onboardingController.skipOnboarding);

// Product tour routes
router.get('/tour/:tourId', onboardingController.getTourProgress);
router.put('/tour/:tourId', onboardingController.updateTourProgress);

module.exports = router;

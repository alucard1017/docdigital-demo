// backend/routes/billing.js
const express = require("express");
const router = express.Router();
const billingController = require("../controllers/billingController");
// const authMiddleware = require("../middleware/auth"); // si ya tienes uno

// Aplica auth si corresponde:
// router.use(authMiddleware.protect);

router.get("/plans", billingController.getPlans);
router.get("/subscription", billingController.getSubscription);
router.post("/change-plan", billingController.changePlan);
router.get("/invoices", billingController.getInvoices);
router.get("/payment-methods", billingController.getPaymentMethods);
router.post(
  "/payment-methods/update",
  billingController.updatePaymentMethod
);

module.exports = router;

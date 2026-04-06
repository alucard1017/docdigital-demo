const express = require("express");
const router = express.Router();

const { requireAuth } = require("./auth");

const {
  getEmailMetrics,
  recordEmailEvent,
} = require("../controllers/analytics/emailMetricsController");

const {
  getCompanyAnalytics,
} = require("../controllers/analytics/companyAnalyticsController");

router.get("/company", requireAuth, getCompanyAnalytics);
router.get("/email-metrics", requireAuth, getEmailMetrics);
router.post("/email-event", recordEmailEvent);

module.exports = router;
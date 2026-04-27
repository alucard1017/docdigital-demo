// backend/routes/userPreferences.js
const express = require("express");
const router = express.Router();

const controller = require("../controllers/userPreferences.controller");
const { requireAuth } = require("./auth");

router.get("/", requireAuth, controller.getMyPreferences);
router.put("/", requireAuth, controller.updateMyPreferences);

module.exports = router;
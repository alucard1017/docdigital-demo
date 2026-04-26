const express = require("express");
const router = express.Router();

const controller = require("../controllers/userPreferences.controller");
const { requireAuth } = require("./auth");

router.get("/me/preferences", requireAuth, controller.getMyPreferences);
router.patch("/me/preferences", requireAuth, controller.updateMyPreferences);

module.exports = router;
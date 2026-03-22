// backend/routes/templates.js
const express = require("express");
const { requireAuth, requireRole } = require("./auth");
const {
  getTemplates,
  createTemplate,
  deleteTemplate,
} = require("../controllers/templates/templatesController");

const router = express.Router();

router.get("/", requireAuth, getTemplates);
router.post("/", requireAuth, requireRole("ADMIN"), createTemplate);
router.delete("/:id", requireAuth, requireRole("ADMIN"), deleteTemplate);

module.exports = router;

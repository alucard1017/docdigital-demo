// backend/routes/admin.js
const express = require("express");
const { requireAuth, requireRole } = require("./auth");
const {
  restoreEntity,
  getDeletedEntities,
} = require("../controllers/admin/restoreController");

const router = express.Router();

router.post("/restore/:type/:id", requireAuth, requireRole("SUPER_ADMIN"), restoreEntity);
router.get("/deleted/:type", requireAuth, requireRole("SUPER_ADMIN"), getDeletedEntities);

module.exports = router;

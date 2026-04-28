// backend/routes/userPreferences.js
const express = require("express");
const router = express.Router();

const {
  getMyPreferences,
  updateMyPreferences,
} = require("../controllers/userPreferences.controller");

/**
 * GET /api/user-preferences
 * Devuelve las preferencias del usuario autenticado.
 */
router.get("/", getMyPreferences);

/**
 * PUT /api/user-preferences
 * Crea o actualiza las preferencias del usuario autenticado.
 */
router.put("/", updateMyPreferences);

module.exports = router;
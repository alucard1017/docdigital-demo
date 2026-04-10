// backend/routes/public.js
const express = require("express");
const {
  getPublicDocBySignerToken,
  getPublicDocByDocumentToken,
  publicSignDocument,
  publicRejectDocument,
  publicVisarDocument,
  verifyByCode,
} = require("../controllers/documents/publicDocuments");

const router = express.Router();

/* ================================
   FIRMA / VISADO PÚBLICO
   Base final esperada: /api/public
   ================================ */

// GET /api/public/docs/:token
router.get("/docs/:token", getPublicDocBySignerToken);

// GET /api/public/docs/document/:token
router.get("/docs/document/:token", getPublicDocByDocumentToken);

// POST /api/public/docs/:token/firmar
router.post("/docs/:token/firmar", publicSignDocument);

// POST /api/public/docs/:token/rechazar
router.post("/docs/:token/rechazar", publicRejectDocument);

// POST /api/public/docs/:token/visar
router.post("/docs/:token/visar", publicVisarDocument);

// GET /api/public/verificar/:codigo
router.get("/verificar/:codigo", verifyByCode);

// GET /api/public/documents/:codigo
router.get("/documents/:codigo", verifyByCode);

module.exports = router;
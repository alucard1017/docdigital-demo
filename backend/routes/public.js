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
   Base esperada: /api/public
   ================================ */

// GET /api/public/docs/:token
// Acceso público para firmante usando document_signers.sign_token
router.get("/docs/:token", getPublicDocBySignerToken);

// GET /api/public/docs/document/:token
// Acceso público para documento usando documents.signature_token
router.get("/docs/document/:token", getPublicDocByDocumentToken);

// POST /api/public/docs/:token/firmar
// Registrar firma pública usando sign_token
router.post("/docs/:token/firmar", publicSignDocument);

// POST /api/public/docs/:token/rechazar
// Registrar rechazo público usando sign_token
router.post("/docs/:token/rechazar", publicRejectDocument);

// POST /api/public/docs/document/:token/visar
// Registrar visado público usando signature_token del documento
router.post("/docs/document/:token/visar", publicVisarDocument);

/* ================================
   VERIFICACIÓN POR CÓDIGO
   ================================ */

// GET /api/public/verificar/:codigo
router.get("/verificar/:codigo", verifyByCode);

// GET /api/public/documents/:codigo
// Alias de compatibilidad
router.get("/documents/:codigo", verifyByCode);

module.exports = router;
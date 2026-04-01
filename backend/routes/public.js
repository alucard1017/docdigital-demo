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

/**
 * GET /api/public/docs/:token
 * Datos + PDF para enlace público de firma por sign_token del firmante.
 */
router.get("/docs/:token", getPublicDocBySignerToken);

/**
 * GET /api/public/docs/document/:token
 * Datos + PDF usando signature_token del documento.
 */
router.get("/docs/document/:token", getPublicDocByDocumentToken);

/**
 * POST /api/public/docs/:token/firmar
 * Firmar documento por token público del firmante.
 */
router.post("/docs/:token/firmar", publicSignDocument);

/**
 * POST /api/public/docs/:token/rechazar
 * Rechazar documento por token público del firmante.
 */
router.post("/docs/:token/rechazar", publicRejectDocument);

/**
 * POST /api/public/docs/:token/visar
 * Visar documento por token público del documento.
 */
router.post("/docs/:token/visar", publicVisarDocument);

/* ================================
   VERIFICACIÓN PÚBLICA POR CÓDIGO
   ================================ */

/**
 * GET /api/public/verificar/:codigo
 * Ruta principal de verificación pública por código.
 */
router.get("/verificar/:codigo", verifyByCode);

/**
 * GET /api/public/documents/:codigo
 * Ruta de compatibilidad para enlaces ya enviados desde email / QR.
 */
router.get("/documents/:codigo", verifyByCode);

module.exports = router;
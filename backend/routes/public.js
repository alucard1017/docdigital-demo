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
   Base: /api/public
   ================================ */

/**
 * GET /api/public/docs/:token
 * Datos + PDF para enlace público de FIRMA (por firmante, sign_token).
 */
router.get("/docs/:token", getPublicDocBySignerToken);

/**
 * GET /api/public/docs/document/:token
 * Datos + PDF usando signature_token del DOCUMENTO (visado / consulta).
 */
router.get("/docs/document/:token", getPublicDocByDocumentToken);

/**
 * POST /api/public/docs/:token/firmar
 * Firmar documento por token (firmante externo, por sign_token).
 */
router.post("/docs/:token/firmar", publicSignDocument);

/**
 * POST /api/public/docs/:token/rechazar
 * Rechazar documento por token (firmante externo, por sign_token).
 */
router.post("/docs/:token/rechazar", publicRejectDocument);

/**
 * POST /api/public/docs/:token/visar
 * Visar documento por token (visador externo, por signature_token del doc).
 */
router.post("/docs/:token/visar", publicVisarDocument);

/* ================================
   VERIFICACIÓN POR CÓDIGO (QR)
   ================================ */

/**
 * GET /api/public/verificar/:codigo
 * Verificación pública por código (QR / código de verificación).
 */
router.get("/verificar/:codigo", verifyByCode);

module.exports = router;

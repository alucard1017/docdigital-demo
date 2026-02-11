// backend/routes/documents.js
const express = require('express');
const { requireAuth } = require('./auth');
const { upload, handleMulterError } = require('../middlewares/uploadPdf');
const documentsController = require('../controllers/documentsController');

const router = express.Router();

// Listar documentos del usuario
router.get('/', requireAuth, documentsController.getUserDocuments);

// Crear documento (sube PDF + lógica en controller)
router.post(
  '/',
  requireAuth,
  upload.single('file'),
  handleMulterError,
  documentsController.createDocument
);

// Obtener URL firmada para ver el PDF
router.get('/:id/pdf', documentsController.getDocumentPdf);

// Timeline del documento
router.get('/:id/timeline', documentsController.getTimeline);

// Firmantes del documento
router.get('/:id/signers', requireAuth, documentsController.getSigners);

// Acciones sobre el documento
router.post('/:id/firmar', requireAuth, documentsController.signDocument);
router.post('/:id/visar', requireAuth, documentsController.visarDocument);
router.post('/:id/rechazar', requireAuth, documentsController.rejectDocument);
router.post('/:id/reenviar', requireAuth, documentsController.resendReminder);

// Descargar PDF
router.get('/:id/download', documentsController.downloadDocument);

module.exports = router;

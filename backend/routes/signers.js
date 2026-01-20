// routes/signers.js
const express = require('express');
const router = express.Router();
const signerService = require('../services/signerService');
const documentService = require('../services/documentService');

// POST /api/docs/:id/signers  → añadir firmantes
router.post('/:id/signers', async (req, res) => {
  const documentId = req.params.id;
  const { signers } = req.body;

  if (!Array.isArray(signers) || signers.length === 0) {
    return res.status(400).json({ message: 'signers debe ser un arreglo' });
  }

  try {
    await signerService.addSigners(documentId, signers);
    res.status(201).json({ message: 'Firmantes añadidos correctamente' });
  } catch (err) {
    console.error('Error añadiendo firmantes:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// GET /api/docs/:id/signers  → listar firmantes
router.get('/:id/signers', async (req, res) => {
  const documentId = req.params.id;

  try {
    const signers = await signerService.getSignersByDocument(documentId);
    res.json(signers);
  } catch (err) {
    console.error('Error obteniendo firmantes:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /api/docs/:id/sign  → marcar uno como firmado
router.post('/:id/sign', async (req, res) => {
  const documentId = req.params.id;
  const { signerId } = req.body;

  if (!signerId) {
    return res.status(400).json({ message: 'signerId es obligatorio' });
  }

  try {
    // Marcar el firmante como firmado
    const changes = await signerService.markSignerAsSigned(documentId, signerId);
    if (changes === 0) {
      return res.status(404).json({ message: 'Firmante no encontrado para este documento' });
    }

    // Verificar si todos los firmantes han firmado
    const allSigned = await signerService.allSignersSigned(documentId);
    if (allSigned) {
      // Si todos firmaron, actualizar el documento a COMPLETADO usando documentService
      await new Promise((resolve, reject) => {
        documentService.actualizarEstadoDocumentoPorId(documentId, 'COMPLETADO', (err, changes) => {
          if (err) return reject(err);
          resolve();
        });
      });
      return res.json({ 
        message: 'Firma marcada y documento completado',
        documentStatus: 'COMPLETADO'
      });
    }

    res.json({ message: 'Firma marcada correctamente' });
  } catch (err) {
    console.error('Error marcando firma:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;

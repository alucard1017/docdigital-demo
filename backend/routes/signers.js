// routes/signers.js
const express = require('express');
const router = express.Router();
const signerService = require('../services/signerService');
const signerAuthService = require('../services/signerAuthService');
const documentService = require('../services/documentService');
const db = require('../db');

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

// POST /api/signers/:id/auth  → autentica un firmante y devuelve JWT
router.post('/auth/:id', async (req, res) => {
  const signerId = req.params.id;
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'email es obligatorio' });
  }

  try {
    // Verificar que el firmante existe y el email coincide
    const signer = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM signers WHERE id = ? AND email = ?',
        [signerId, email],
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });

    if (!signer) {
      return res.status(404).json({ message: 'Firmante no encontrado o email incorrecto' });
    }

    // Crear sesión y devolver token
    const token = await signerAuthService.createSignerSession(signerId, email);
    res.status(201).json({ 
      message: 'Autenticación exitosa',
      token,
      signerId
    });
  } catch (err) {
    console.error('Error autenticando firmante:', err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// POST /api/docs/:id/sign  → marcar uno como firmado (requiere JWT)
router.post('/:id/sign', async (req, res) => {
  const documentId = req.params.id;
  const { signerId, token } = req.body;

  if (!signerId || !token) {
    return res.status(400).json({ message: 'signerId y token son obligatorios' });
  }

  try {
    // Verificar que el token sea válido
    const session = await signerAuthService.getSessionByToken(token);
    if (!session || session.signer_id !== parseInt(signerId)) {
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }

    // Marcar el firmante como firmado
    const changes = await signerService.markSignerAsSigned(documentId, signerId);
    if (changes === 0) {
      return res.status(404).json({ message: 'Firmante no encontrado para este documento' });
    }

    // Verificar si todos los firmantes han firmado
    const allSigned = await signerService.allSignersSigned(documentId);
    if (allSigned) {
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

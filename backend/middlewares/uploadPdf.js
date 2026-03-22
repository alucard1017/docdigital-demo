// backend/middlewares/uploadPdf.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.memoryStorage(); // Cambio a memoria para validar antes de guardar

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Reducido a 10MB (más razonable)
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  },
});

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      message: 'El archivo supera el tamaño máximo permitido (10 MB).',
    });
  }
  if (err.message === 'Solo se permiten archivos PDF') {
    return res.status(400).json({ message: 'Solo se permiten archivos PDF' });
  }
  return next(err);
}

module.exports = {
  upload,
  handleMulterError,
};

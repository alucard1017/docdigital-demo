// backend/middlewares/pdfValidator.js
const { PDFDocument } = require("pdf-lib");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PAGES = 500;

/**
 * Middleware para validar PDFs subidos
 */
async function validatePdf(req, res, next) {
  try {
    if (!req.file) {
      return next();
    }

    const file = req.file;

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        message: `El archivo es demasiado grande. Máximo ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      });
    }

    // Validar MIME type real
    if (file.mimetype !== "application/pdf") {
      return res.status(400).json({
        message: "El archivo debe ser un PDF válido",
      });
    }

    // Validar que sea PDF válido y contar páginas
    try {
      const pdfDoc = await PDFDocument.load(file.buffer);
      const pageCount = pdfDoc.getPageCount();

      if (pageCount > MAX_PAGES) {
        return res.status(400).json({
          message: `El PDF tiene demasiadas páginas. Máximo ${MAX_PAGES} páginas`,
        });
      }

      if (pageCount === 0) {
        return res.status(400).json({
          message: "El PDF no tiene páginas válidas",
        });
      }

      // Adjuntar info al request para uso posterior
      req.pdfInfo = {
        pageCount,
        sizeBytes: file.size,
        sizeMB: (file.size / 1024 / 1024).toFixed(2),
      };

      console.log(`✅ PDF validado: ${pageCount} páginas, ${req.pdfInfo.sizeMB}MB`);
    } catch (pdfErr) {
      console.error("❌ Error validando PDF:", pdfErr);
      return res.status(400).json({
        message: "El archivo no es un PDF válido o está corrupto",
      });
    }

    return next();
  } catch (err) {
    console.error("❌ Error en middleware de validación PDF:", err);
    return res.status(500).json({
      message: "Error validando el archivo",
    });
  }
}

module.exports = { validatePdf };

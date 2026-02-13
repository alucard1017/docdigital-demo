// backend/services/excelExport.js
const XLSX = require('xlsx');
const db = require('../db');

/**
 * Genera un Excel con todos los documentos del usuario
 * Columnas: N° interno, Título, Estado, Firmante, Email, Fecha, Empresa, Tipo trámite, etc.
 */
async function generarExcelDocumentos(userId) {
  try {
    // 1) Traer todos los documentos del usuario
    const result = await db.query(
      `SELECT 
         id,
         numero_contrato_interno,
         title,
         status,
         firmante_nombre,
         firmante_email,
         created_at,
         updated_at,
         destinatario_nombre,
         tipo_tramite,
         requires_visado,
         visador_nombre,
         visador_email
       FROM documents
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const docs = result.rows;

    // 2) Formatear datos para Excel
    const data = docs.map((doc) => {
      const fechaCreacion = new Date(doc.created_at);
      const ahora = new Date();
      const diasDesdeCreacion = Math.floor(
        (ahora - fechaCreacion) / (1000 * 60 * 60 * 24)
      );

      return {
        'N° interno': doc.numero_contrato_interno || `#${doc.id}`,
        'Título': doc.title || '-',
        'Estado': doc.status || '-',
        'Firmante': doc.firmante_nombre || '-',
        'Email firmante': doc.firmante_email || '-',
        'Fecha creación': fechaCreacion.toLocaleDateString('es-CO'),
        'Empresa/Destinatario': doc.destinatario_nombre || '-',
        'Tipo de trámite': doc.tipo_tramite === 'notaria' ? 'Notarial' : 'Propio',
        'Requiere visado': doc.requires_visado ? 'Sí' : 'No',
        'Visador': doc.visador_nombre || '-',
        'Email visador': doc.visador_email || '-',
        'Días desde creación': diasDesdeCreacion,
        'Última actualización': new Date(doc.updated_at).toLocaleDateString(
          'es-CO'
        ),
      };
    });

    // 3) Crear workbook y sheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // 4) Ajustar ancho de columnas
    const maxWidth = 20;
    const colWidths = [
      { wch: 15 }, // N° interno
      { wch: 25 }, // Título
      { wch: 15 }, // Estado
      { wch: 20 }, // Firmante
      { wch: 25 }, // Email firmante
      { wch: 15 }, // Fecha creación
      { wch: 25 }, // Empresa
      { wch: 15 }, // Tipo trámite
      { wch: 12 }, // Requiere visado
      { wch: 20 }, // Visador
      { wch: 25 }, // Email visador
      { wch: 12 }, // Días desde creación
      { wch: 20 }, // Última actualización
    ];
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Documentos');

    // 5) Generar buffer y retornar
    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'buffer',
    });

    return excelBuffer;
  } catch (err) {
    console.error('Error generando Excel:', err);
    throw err;
  }
}

module.exports = {
  generarExcelDocumentos,
};

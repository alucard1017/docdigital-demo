// backend/controllers/documents/report.js
const { db, getSignedUrl } = require('./common');
const { PDFDocument, rgb } = require('pdf-lib');
const axios = require('axios');

/* ================================
   GET: Descargar PDF
   ================================ */
async function downloadDocument(req, res) {
  try {
    const id = req.params.id;

    const result = await db.query(
      `SELECT id, title, file_path 
       FROM documents
       WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ message: 'Documento no encontrado' });
    }

    const doc = result.rows[0];

    if (!doc.file_path) {
      return res
        .status(404)
        .json({ message: 'Documento sin archivo asociado' });
    }

    const signedUrl = await getSignedUrl(doc.file_path, 3600);

    const fileResponse = await axios.get(signedUrl, {
      responseType: 'stream',
    });

    const filename =
      (doc.title || `documento-${doc.id}`).replace(
        /[^a-zA-Z0-9-_]/g,
        '_'
      ) + '.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    fileResponse.data.pipe(res);
  } catch (err) {
    console.error('❌ Error en descarga de documento:', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/* ================================
   GET: Analytics del documento
   ================================ */
async function getDocumentAnalytics(req, res) {
  try {
    const userId = req.user.id;

    const docsRes = await db.query(
      `SELECT 
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'FIRMADO') AS firmados,
         COUNT(*) FILTER (WHERE status = 'RECHAZADO') AS rechazados,
         COUNT(*) FILTER (WHERE status IN ('PENDIENTE_FIRMA', 'PENDIENTE_VISADO')) AS pendientes,
         AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) AS horas_promedio_firma
       FROM documents
       WHERE owner_id = $1`,
      [userId]
    );

    const stats = docsRes.rows[0];

    const eventsRes = await db.query(
      `SELECT 
         DATE(created_at) AS fecha,
         COUNT(*) FILTER (WHERE action = 'FIRMADO_PUBLICO' OR action = 'FIRMADO') AS firmas_dia,
         COUNT(*) FILTER (WHERE action = 'RECHAZO_PUBLICO' OR action = 'RECHAZADO') AS rechazos_dia
       FROM document_events
       WHERE document_id IN (
         SELECT id FROM documents WHERE owner_id = $1
       )
       AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY fecha DESC`,
      [userId]
    );

    const timeline = eventsRes.rows;

    return res.json({
      summary: {
        total: Number(stats.total),
        firmados: Number(stats.firmados),
        rechazados: Number(stats.rechazados),
        pendientes: Number(stats.pendientes),
        tasa_firma_pct:
          stats.total > 0
            ? ((Number(stats.firmados) / Number(stats.total)) * 100).toFixed(1)
            : 0,
        tasa_rechazo_pct:
          stats.total > 0
            ? ((Number(stats.rechazados) / Number(stats.total)) * 100).toFixed(1)
            : 0,
        horas_promedio: stats.horas_promedio_firma
          ? parseFloat(stats.horas_promedio_firma).toFixed(1)
          : "N/A",
      },
      timeline,
    });
  } catch (err) {
    console.error("❌ Error obteniendo analytics:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   POST: Descargar reporte PDF con detalles
   ================================ */
async function downloadReportPdf(req, res) {
  try {
    const { id } = req.params;

    const docRes = await db.query(
      `SELECT * FROM documents WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );

    if (docRes.rowCount === 0) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    const doc = docRes.rows[0];

    const signersRes = await db.query(
      `SELECT * FROM document_signers WHERE document_id = $1 ORDER BY id ASC`,
      [id]
    );

    const eventsRes = await db.query(
      `SELECT * FROM document_events WHERE document_id = $1 ORDER BY created_at ASC`,
      [id]
    );

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const { height } = page.getSize();

    let yPos = height - 50;

    page.drawText(`REPORTE: ${doc.title}`, {
      x: 50,
      y: yPos,
      size: 18,
      color: rgb(0.1, 0.1, 0.1),
    });

    yPos -= 30;

    page.drawText(
      `Contrato: ${doc.numero_contrato_interno || "N/A"} | Estado: ${doc.status}`,
      {
        x: 50,
        y: yPos,
        size: 11,
        color: rgb(0.4, 0.4, 0.4),
      }
    );

    yPos -= 20;
    page.drawText(`Creado: ${new Date(doc.created_at).toLocaleString("es-CL")}`, {
      x: 50,
      y: yPos,
      size: 10,
      color: rgb(0.5, 0.5, 0.5),
    });

    yPos -= 25;

    page.drawText("FIRMANTES:", {
      x: 50,
      y: yPos,
      size: 12,
      color: rgb(0.1, 0.1, 0.1),
    });

    yPos -= 15;

    for (const signer of signersRes.rows) {
      const statusSymbol = signer.status === "FIRMADO" ? "✓" : signer.status === "RECHAZADO" ? "✗" : "○";
      const statusColor =
        signer.status === "FIRMADO"
          ? rgb(0.2, 0.7, 0.2)
          : signer.status === "RECHAZADO"
          ? rgb(0.8, 0.2, 0.2)
          : rgb(0.5, 0.5, 0.5);

      page.drawText(`${statusSymbol} ${signer.name} (${signer.email})`, {
        x: 70,
        y: yPos,
        size: 10,
        color: statusColor,
      });

      if (signer.signed_at) {
        page.drawText(
          `   Firmado: ${new Date(signer.signed_at).toLocaleString("es-CL")}`,
          {
            x: 70,
            y: yPos - 12,
            size: 9,
            color: rgb(0.6, 0.6, 0.6),
          }
        );
        yPos -= 24;
      } else if (signer.rejected_at) {
        page.drawText(
          `   Rechazado: ${new Date(signer.rejected_at).toLocaleString("es-CL")}`,
          {
            x: 70,
            y: yPos - 12,
            size: 9,
            color: rgb(0.8, 0.2, 0.2),
          }
        );
        if (signer.rejection_reason) {
          page.drawText(`   Motivo: ${signer.rejection_reason.substring(0, 50)}`, {
            x: 70,
            y: yPos - 24,
            size: 8,
            color: rgb(0.6, 0.6, 0.6),
          });
          yPos -= 36;
        } else {
          yPos -= 24;
        }
      } else {
        yPos -= 12;
      }
    }

    yPos -= 20;

    page.drawText("HISTORIAL DE EVENTOS:", {
      x: 50,
      y: yPos,
      size: 12,
      color: rgb(0.1, 0.1, 0.1),
    });

    yPos -= 15;

    for (const event of eventsRes.rows.slice(0, 10)) {
      page.drawText(
        `[${new Date(event.created_at).toLocaleString("es-CL")}] ${event.action}`,
        {
          x: 70,
          y: yPos,
          size: 9,
          color: rgb(0.5, 0.5, 0.5),
        }
      );

      if (event.details) {
        const detailText = event.details.substring(0, 60);
        page.drawText(`    ${detailText}${event.details.length > 60 ? "..." : ""}`, {
          x: 70,
          y: yPos - 10,
          size: 8,
          color: rgb(0.7, 0.7, 0.7),
        });
        yPos -= 20;
      } else {
        yPos -= 12;
      }
    }

    const pdfBytes = await pdfDoc.save();

    const filename = `reporte-${doc.numero_contrato_interno || doc.id}-${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("❌ Error descargando reporte PDF:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

module.exports = {
  downloadDocument,
  getDocumentAnalytics,
  downloadReportPdf,
};

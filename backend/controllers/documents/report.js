// backend/controllers/documents/report.js
const {
  db,
  getSignedUrl,
  computeHash,
  resolvePdfSourceByDocumentId,
  buildSafeFilename,
} = require("./common");
const { PDFDocument, rgb } = require("pdf-lib");
const axios = require("axios");
const { logAudit } = require("../../utils/auditLog");

/* ================================
   GET: Descargar PDF (prioriza copia firmada)
   ================================ */
async function downloadDocument(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "ID de documento requerido" });
    }

    const resolved = await resolvePdfSourceByDocumentId(id, req.user);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ message: resolved.message });
    }

    const { doc, directUrl, signedUrl, storageKey } = resolved;
    const url = directUrl || signedUrl;
    if (!url) {
      return res
        .status(404)
        .json({ message: "No se pudo resolver la URL del documento" });
    }

    const fileResponse = await axios.get(url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(fileResponse.data);

    // TODO (opcional): validar hash vs. final_hash_sha256 o similar.
    // const hash = computeHash(buffer);

    const filename = buildSafeFilename(doc.title, `documento-${doc.id}`);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    await logAudit({
      user: req.user,
      action: "DOWNLOAD_DOCUMENT",
      entityType: "document",
      entityId: doc.id,
      metadata: {
        sourceType: resolved.sourceType,
        storageKey: storageKey || null,
      },
      req,
    });

    return res.send(buffer);
  } catch (err) {
    console.error("❌ Error en descarga de documento:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   GET: Vista previa de PDF (prioriza copia firmada)
   ================================ */
async function previewDocument(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "ID de documento requerido" });
    }

    const resolved = await resolvePdfSourceByDocumentId(id, req.user);
    if (!resolved.ok) {
      return res.status(resolved.status).json({ message: resolved.message });
    }

    const { directUrl, signedUrl } = resolved;
    const url = directUrl || signedUrl;
    if (!url) {
      return res
        .status(404)
        .json({ message: "No se pudo resolver la URL del documento" });
    }

    const fileResponse = await axios.get(url, { responseType: "arraybuffer" });
    const buffer = Buffer.from(fileResponse.data);

    res.setHeader("Content-Type", "application/pdf");
    // Sin Content-Disposition: se muestra inline en iframe/visor
    return res.send(buffer);
  } catch (err) {
    console.error("❌ Error en vista previa de documento:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   GET: Analytics del documento / usuario
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

    const stats = docsRes.rows[0] || {};

    const eventsRes = await db.query(
      `SELECT
         DATE(created_at) AS fecha,
         COUNT(*) FILTER (WHERE action IN ('FIRMADO_PUBLICO', 'FIRMADO')) AS firmas_dia,
         COUNT(*) FILTER (WHERE action IN ('RECHAZO_PUBLICO', 'RECHAZADO')) AS rechazos_dia
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

    const total = Number(stats.total || 0);
    const firmados = Number(stats.firmados || 0);
    const rechazados = Number(stats.rechazados || 0);
    const pendientes = Number(stats.pendientes || 0);

    return res.json({
      summary: {
        total,
        firmados,
        rechazados,
        pendientes,
        tasa_firma_pct: total > 0 ? Number(((firmados / total) * 100).toFixed(1)) : 0,
        tasa_rechazo_pct: total > 0 ? Number(((rechazados / total) * 100).toFixed(1)) : 0,
        horas_promedio: stats.horas_promedio_firma
          ? Number(parseFloat(stats.horas_promedio_firma).toFixed(1))
          : null,
      },
      timeline,
    });
  } catch (err) {
    console.error("❌ Error obteniendo analytics:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
}

/* ================================
   GET: Descargar reporte PDF con detalles
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

    page.drawText(`REPORTE: ${doc.title || "Documento sin título"}`, {
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

    if (doc.created_at) {
      page.drawText(
        `Creado: ${new Date(doc.created_at).toLocaleString("es-CL")}`,
        {
          x: 50,
          y: yPos,
          size: 10,
          color: rgb(0.5, 0.5, 0.5),
        }
      );
      yPos -= 25;
    } else {
      yPos -= 15;
    }

    // Firmantes
    page.drawText("FIRMANTES:", {
      x: 50,
      y: yPos,
      size: 12,
      color: rgb(0.1, 0.1, 0.1),
    });

    yPos -= 15;

    for (const signer of signersRes.rows) {
      if (yPos < 80) break; // cortar, para no salirnos de la página

      const statusSymbol =
        signer.status === "FIRMADO"
          ? "✓"
          : signer.status === "RECHAZADO"
          ? "✗"
          : "○";

      const statusColor =
        signer.status === "FIRMADO"
          ? rgb(0.2, 0.7, 0.2)
          : signer.status === "RECHAZADO"
          ? rgb(0.8, 0.2, 0.2)
          : rgb(0.5, 0.5, 0.5);

      page.drawText(
        `${statusSymbol} ${signer.name || "Firmante"} (${signer.email || "sin email"})`,
        {
          x: 70,
          y: yPos,
          size: 10,
          color: statusColor,
        }
      );

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
          `   Rechazado: ${new Date(
            signer.rejected_at
          ).toLocaleString("es-CL")}`,
          {
            x: 70,
            y: yPos - 12,
            size: 9,
            color: rgb(0.8, 0.2, 0.2),
          }
        );
        if (signer.rejection_reason) {
          const motivo = signer.rejection_reason.substring(0, 80);
          page.drawText(`   Motivo: ${motivo}`, {
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

    // Historial de eventos (hasta 10 para que quepa)
    page.drawText("HISTORIAL DE EVENTOS:", {
      x: 50,
      y: yPos,
      size: 12,
      color: rgb(0.1, 0.1, 0.1),
    });

    yPos -= 15;

    for (const event of eventsRes.rows.slice(0, 10)) {
      if (yPos < 60) break;

      const fecha = event.created_at
        ? new Date(event.created_at).toLocaleString("es-CL")
        : "-";

      page.drawText(
        `[${fecha}] ${event.action || event.event_type || "EVENTO"}`,
        {
          x: 70,
          y: yPos,
          size: 9,
          color: rgb(0.5, 0.5, 0.5),
        }
      );

      if (event.details) {
        const detailText = event.details.substring(0, 90);
        page.drawText(
          `    ${detailText}${event.details.length > 90 ? "..." : ""}`,
          {
            x: 70,
            y: yPos - 10,
            size: 8,
            color: rgb(0.7, 0.7, 0.7),
          }
        );
        yPos -= 20;
      } else {
        yPos -= 12;
      }
    }

    const pdfBytes = await pdfDoc.save();
    const filename = `reporte-${
      doc.numero_contrato_interno || doc.id
    }-${new Date().toISOString().slice(0, 10)}.pdf`;

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
  previewDocument,
  getDocumentAnalytics,
  downloadReportPdf,
};
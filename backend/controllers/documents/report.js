// backend/controllers/documents/report.js
const { db, getSignedUrl, computeHash } = require("./common");
const { PDFDocument, rgb } = require("pdf-lib");
const axios = require("axios");
const { logAudit } = require("../../utils/auditLog");

/* ================================
   HELPERS
   ================================ */

function buildDocumentWhereClause({ id, user }) {
  const params = [id];
  let where = "id = $1";

  if (user && user.company_id) {
    params.push(user.company_id);
    where += " AND company_id = $2";
  }

  return { where, params };
}

function buildSafeFilename(base, fallbackPrefix) {
  const clean =
    (base || fallbackPrefix).toString().replace(/[^a-zA-Z0-9-_]/g, "_") ||
    fallbackPrefix;
  return `${clean}.pdf`;
}

/* ================================
   GET: Descargar PDF (prioriza copia firmada)
   ================================ */
async function downloadDocument(req, res) {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ message: "ID de documento requerido" });
    }

    const { where, params } = buildDocumentWhereClause({
      id,
      user: req.user,
    });

    const result = await db.query(
      `SELECT
         id,
         title,
         file_path,
         pdf_final_url,
         pdf_hash
       FROM documents
       WHERE ${where}`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    const doc = result.rows[0];

    const storageKey = doc.pdf_final_url || doc.file_path;
    if (!storageKey) {
      return res
        .status(404)
        .json({ message: "Documento sin archivo asociado" });
    }

    const signedUrl = await getSignedUrl(storageKey, 3600);

    const fileResponse = await axios.get(signedUrl, {
      responseType: "arraybuffer",
    });

    const buffer = Buffer.from(fileResponse.data);

    // Verificación de integridad (solo aviso)
    if (doc.pdf_hash) {
      const currentHash = computeHash(buffer);
      if (currentHash !== doc.pdf_hash) {
        console.error("❌ Hash de PDF no coincide para documento", doc.id);

        await logAudit({
          user: req.user || null,
          action: "document_hash_mismatch",
          entityType: "document",
          entityId: doc.id,
          metadata: {
            stored_hash: doc.pdf_hash,
            current_hash: currentHash,
            file_path: storageKey,
          },
          req,
        });

        res.setHeader(
          "X-Document-Hash-Warning",
          "El hash del PDF no coincide con el registrado"
        );
      }
    }

    const filename = buildSafeFilename(doc.title, `documento-${doc.id}`);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

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
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ message: "ID de documento requerido" });
    }

    const { where, params } = buildDocumentWhereClause({
      id,
      user: req.user,
    });

    const result = await db.query(
      `SELECT
         id,
         title,
         file_path,
         pdf_final_url,
         pdf_hash
       FROM documents
       WHERE ${where}`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Documento no encontrado" });
    }

    const doc = result.rows[0];

    const storageKey = doc.pdf_final_url || doc.file_path;
    if (!storageKey) {
      return res
        .status(404)
        .json({ message: "Documento sin archivo asociado" });
    }

    const signedUrl = await getSignedUrl(storageKey, 3600);

    const fileResponse = await axios.get(signedUrl, {
      responseType: "arraybuffer",
    });

    const buffer = Buffer.from(fileResponse.data);

    // Verificación de hash (solo log y header de warning)
    if (doc.pdf_hash) {
      const currentHash = computeHash(buffer);
      if (currentHash !== doc.pdf_hash) {
        await logAudit({
          user: req.user || null,
          action: "document_hash_mismatch_preview",
          entityType: "document",
          entityId: doc.id,
          metadata: {
            stored_hash: doc.pdf_hash,
            current_hash: currentHash,
            file_path: storageKey,
          },
          req,
        });

        res.setHeader(
          "X-Document-Hash-Warning",
          "El hash del PDF no coincide con el registrado (preview)"
        );
      }
    }

    res.setHeader("Content-Type", "application/pdf");
    // Importante: sin Content-Disposition, para que el navegador renderice en iframe
    return res.send(buffer);
  } catch (err) {
    console.error("❌ Error en vista previa de documento:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
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
        tasa_firma_pct:
          total > 0 ? ((firmados / total) * 100).toFixed(1) : 0,
        tasa_rechazo_pct:
          total > 0 ? ((rechazados / total) * 100).toFixed(1) : 0,
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

    page.drawText(`REPORTE: ${doc.title}`, {
      x: 50,
      y: yPos,
      size: 18,
      color: rgb(0.1, 0.1, 0.1),
    });

    yPos -= 30;

    page.drawText(
      `Contrato: ${doc.numero_contrato_interno || "N/A"} | Estado: ${
        doc.status
      }`,
      {
        x: 50,
        y: yPos,
        size: 11,
        color: rgb(0.4, 0.4, 0.4),
      }
    );

    yPos -= 20;
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

    page.drawText("FIRMANTES:", {
      x: 50,
      y: yPos,
      size: 12,
      color: rgb(0.1, 0.1, 0.1),
    });

    yPos -= 15;

    for (const signer of signersRes.rows) {
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
          page.drawText(
            `   Motivo: ${signer.rejection_reason.substring(0, 50)}`,
            {
              x: 70,
              y: yPos - 24,
              size: 8,
              color: rgb(0.6, 0.6, 0.6),
            }
          );
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
        `[${new Date(event.created_at).toLocaleString("es-CL")}] ${
          event.action
        }`,
        {
          x: 70,
          y: yPos,
          size: 9,
          color: rgb(0.5, 0.5, 0.5),
        }
      );

      if (event.details) {
        const detailText = event.details.substring(0, 60);
        page.drawText(
          `    ${detailText}${event.details.length > 60 ? "..." : ""}`,
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

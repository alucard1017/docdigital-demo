// backend/services/pdfSeal.js
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const bwipjs = require("@bwip-js/node");
const { PDFDocument, rgb, StandardFonts, degrees } = require("pdf-lib");
const {
  getObjectBuffer,
  uploadBufferToS3,
  getSignedUrl,
} = require("./storageR2");
const db = require("../db");
const crypto = require("crypto");

function parseGeoLocation(value) {
  if (!value) return "Desconocido";
  try {
    const geo = typeof value === "string" ? JSON.parse(value) : value;
    if (geo?.city && geo?.country) return `${geo.city}, ${geo.country}`;
    if (geo?.city) return geo.city;
    if (geo?.country) return geo.country;
    return "Desconocido";
  } catch {
    return "Desconocido";
  }
}

function formatFechaEvidencia(value) {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleString("es-CL", {
      timeZone: "America/Santiago",
    });
  } catch {
    return "N/A";
  }
}

function normalizeRoleLabel(role, actionType) {
  const r = String(role || "").trim().toUpperCase();
  if (r === "VISADOR") return "Visador";
  if (r === "APROBADOR") return "Aprobador";
  if (actionType === "VISADO") return "Visador";
  return "Firmante";
}

async function obtenerParticipantesEvidencia(documentoId) {
  const legacyRes = await db.query(
    `
    SELECT
      nombre,
      email,
      rol,
      estado,
      fecha_firma,
      ip_firma,
      user_agent_firma,
      geo_location,
      tipo_firma
    FROM firmantes
    WHERE documento_id = $1
      AND (
        estado = 'FIRMADO'
        OR UPPER(COALESCE(rol, '')) = 'VISADOR'
      )
    ORDER BY orden_firma ASC, fecha_firma ASC NULLS LAST, id ASC
    `,
    [documentoId]
  );

  const legacyRows = legacyRes.rows || [];

  const modernDocRes = await db.query(
    `
    SELECT id
    FROM documents
    WHERE id = $1 OR nuevo_documento_id = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [documentoId]
  );

  let modernDocumentId = null;
  if (modernDocRes.rowCount > 0) {
    modernDocumentId = modernDocRes.rows[0].id;
  }

  let canonicalRows = [];
  if (modernDocumentId) {
    const canonicalRes = await db.query(
      `
      SELECT
        name,
        email,
        role,
        status,
        signed_at,
        reviewed_at,
        ip_address,
        user_agent,
        metadata
      FROM document_signers
      WHERE document_id = $1
      ORDER BY signer_order ASC, signed_at ASC NULLS LAST, id ASC
      `,
      [modernDocumentId]
    );
    canonicalRows = canonicalRes.rows || [];
  }

  const legacyParticipants = legacyRows.map((row) => {
    const roleUpper = String(row.rol || "").trim().toUpperCase();
    const isVisador = roleUpper === "VISADOR";
    return {
      nombre: row.nombre || "Sin nombre",
      email: row.email || "N/A",
      role: row.rol || (isVisador ? "VISADOR" : "FIRMANTE"),
      actionType: isVisador ? "VISADO" : "FIRMA",
      fecha: row.fecha_firma || null,
      ip: row.ip_firma || "N/A",
      userAgent: row.user_agent_firma || "N/A",
      location: parseGeoLocation(row.geo_location),
      tipoFirma: isVisador ? "VISADO" : row.tipo_firma || "SIMPLE",
      source: "legacy",
    };
  });

  const seen = new Set(
    legacyParticipants.map((p) => `${p.email}|${p.actionType}|${p.role}`)
  );

  const canonicalParticipants = canonicalRows
    .filter((row) => {
      const roleUpper = String(row.role || "").trim().toUpperCase();
      const isVisador = roleUpper === "VISADOR";
      return row.status === "FIRMADO" || isVisador;
    })
    .map((row) => {
      const roleUpper = String(row.role || "").trim().toUpperCase();
      const isVisador = roleUpper === "VISADOR";
      const actionType = isVisador ? "VISADO" : "FIRMA";
      const fecha = isVisador
        ? row.reviewed_at || row.signed_at || null
        : row.signed_at || null;

      let location = "Desconocido";
      try {
        const meta =
          row.metadata && typeof row.metadata === "string"
            ? JSON.parse(row.metadata)
            : row.metadata || null;
        location = parseGeoLocation(meta?.geo_location || meta?.geo || null);
      } catch {
        location = "Desconocido";
      }

      return {
        nombre: row.name || "Sin nombre",
        email: row.email || "N/A",
        role: row.role || (isVisador ? "VISADOR" : "FIRMANTE"),
        actionType,
        fecha,
        ip: row.ip_address || "N/A",
        userAgent: row.user_agent || "N/A",
        location,
        tipoFirma: isVisador ? "VISADO" : "SIMPLE",
        source: "canonical",
      };
    })
    .filter((p) => {
      const key = `${p.email}|${p.actionType}|${p.role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return [...legacyParticipants, ...canonicalParticipants].sort((a, b) => {
    const da = a.fecha ? new Date(a.fecha).getTime() : 0;
    const dbb = b.fecha ? new Date(b.fecha).getTime() : 0;
    return da - dbb;
  });
}

/**
 * Sella un PDF existente añadiendo footer, QR, barra lateral
 * y certificado de evidencias, subiendo una nueva versión final
 * y actualizando la fila en documents (final_storage_key, pdf_final_url, etc.).
 */
async function sellarPdfConQr({
  s3Key,
  documentoId,
  codigoVerificacion,
  categoriaFirma,
  numeroContratoInterno,
}) {
  if (!s3Key) throw new Error("s3Key es obligatorio para sellar el PDF");
  if (!documentoId)
    throw new Error("documentoId es obligatorio para sellar el PDF");
  if (!codigoVerificacion) {
    throw new Error("codigoVerificacion es obligatorio para sellar el PDF");
  }

  console.log("📄 Sellando PDF con evidencias completas...", {
    documentoId,
    s3Key,
    codigoVerificacion,
  });

  const pdfBytes = await getObjectBuffer(s3Key);
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });

  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  if (!pages || totalPages === 0) {
    throw new Error("El PDF no tiene páginas");
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const numeroInternoTexto =
    numeroContratoInterno != null ? String(numeroContratoInterno) : "—";

  // 1) Footer en todas las páginas
  const footerFontSize = 8;
  const footerMarginY = 30;
  const footerColor = rgb(0.4, 0.4, 0.4);

  pages.forEach((page, index) => {
    const { width } = page.getSize();
    const pageNumber = index + 1;

    const footerText = `N° interno: ${numeroInternoTexto} · Página ${pageNumber} de ${totalPages} · verifirma.cl`;
    const textWidth = font.widthOfTextAtSize(footerText, footerFontSize);
    const x = (width - textWidth) / 2;

    page.drawText(footerText, {
      x,
      y: footerMarginY,
      size: footerFontSize,
      font,
      color: footerColor,
    });
  });

  // 2) Última página: logo, N° interno, QR, barra lateral, bloque legal
  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage.getSize();

  try {
    const logoPngBytes = await fs.promises.readFile(
      path.join(__dirname, "../assets/verifirma-logo.png")
    );
    const logoImage = await pdfDoc.embedPng(logoPngBytes);

    const logoWidth = 78;
    const logoHeight = (logoImage.height / logoImage.width) * logoWidth;

    const marginRight = 32;
    const marginTop = 52;

    const logoX = width - logoWidth - marginRight;
    const logoY = height - logoHeight - marginTop;

    lastPage.drawImage(logoImage, {
      x: logoX,
      y: logoY,
      width: logoWidth,
      height: logoHeight,
    });

    const internalFontSize = 8.2;

    lastPage.drawText("N° interno", {
      x: logoX,
      y: logoY - 14,
      size: internalFontSize,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });

    lastPage.drawText(numeroInternoTexto, {
      x: logoX,
      y: logoY - 26,
      size: internalFontSize + 0.4,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
  } catch (err) {
    console.error("⚠️ Error embebiendo logo en PDF sellado:", err);
  }

  const urlVerificacion = `https://verifirma.cl/verificar/${codigoVerificacion}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(urlVerificacion, {
      errorCorrectionLevel: "M",
    });
    const qrImage = await pdfDoc.embedPng(qrDataUrl);
    const qrSize = 80;

    const qrX = width - qrSize - 40;
    const qrY = 40;

    lastPage.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    });

    lastPage.drawText(
      "Verifique este documento\nescaneando el código QR\no visitando verifirma.cl",
      {
        x: qrX,
        y: qrY - 28,
        size: 7,
        font,
        color: rgb(0.25, 0.25, 0.25),
        lineHeight: 9,
      }
    );
  } catch (err) {
    console.error("⚠️ Error generando/embebiendo QR en PDF sellado:", err);
  }

  try {
    const barcodePngBuffer = await bwipjs.toBuffer({
      bcid: "code128",
      text: codigoVerificacion,
      scale: 1.1,
      height: 12,
      includetext: false,
      textxalign: "center",
      rotate: "R",
    });

    const barcodePng = await pdfDoc.embedPng(barcodePngBuffer);
    const barcodeWidth = 35;
    const barcodeHeight =
      (barcodePng.height / barcodePng.width) * barcodeWidth;

    const marginRight = 15;
    const barcodeX = width - barcodeWidth - marginRight;
    const barcodeY = height / 2 - barcodeHeight / 2;

    lastPage.drawImage(barcodePng, {
      x: barcodeX,
      y: barcodeY,
      width: barcodeWidth,
      height: barcodeHeight,
    });

    const textoLateral =
      "VeriFirma · Plataforma de firma electrónica · Seguridad digital sin fronteras · verifirma.cl";

    lastPage.drawText(textoLateral, {
      x: width - 5,
      y: barcodeY + barcodeHeight / 2 - 7,
      size: 7,
      font,
      color: rgb(0.2, 0.2, 0.2),
      rotate: degrees(90),
      maxWidth: height - 80,
      lineHeight: 9,
    });
  } catch (err) {
    console.error("⚠️ Error generando/embebiendo código de barras:", err);
  }

  const esAvanzada = categoriaFirma === "AVANZADA";

  const textoLegal = [
    "Certificado de firma electrónica",
    "",
    `Número interno: ${numeroInternoTexto}`,
    `Código de verificación: ${codigoVerificacion}`,
    `Verificación en línea: ${urlVerificacion}`,
    "",
    esAvanzada
      ? "Este documento ha sido firmado mediante Firma Electrónica Avanzada conforme a la Ley N° 19.799."
      : "Este documento ha sido firmado mediante Firma Electrónica Simple conforme a la Ley N° 19.799.",
    "La validez del presente documento puede ser verificada en el sitio indicado.",
    "Proveedor de servicios de firma: VeriFirma SpA – RUT 77.777.777-7.",
    "Zona horaria de registro de evidencias: America/Santiago.",
  ].join("\n");

  lastPage.drawText(textoLegal, {
    x: 40,
    y: 60,
    size: 8,
    font,
    color: rgb(0, 0, 0),
    lineHeight: 10,
  });

  // 3) Páginas de certificado de evidencias
  const participantes = await obtenerParticipantesEvidencia(documentoId);

  let evidencesPage = pdfDoc.addPage();
  let { height: evHeight } = evidencesPage.getSize();
  let evY = evHeight - 60;

  evidencesPage.drawText("Certificado de firma electrónica VeriFirma", {
    x: 50,
    y: evY,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  evY -= 30;

  const resumenDocLines = [
    `Número interno: ${numeroInternoTexto}`,
    `ID del documento (documents.id): ${documentoId}`,
    `Código de verificación: ${codigoVerificacion}`,
    `Verificación en línea: ${urlVerificacion}`,
  ];

  evidencesPage.drawText(resumenDocLines.join("\n"), {
    x: 50,
    y: evY,
    size: 9,
    font,
    color: rgb(0.1, 0.1, 0.1),
    lineHeight: 12,
  });

  evY -= 70;

  evidencesPage.drawText("Participantes y evidencias registradas", {
    x: 50,
    y: evY,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  evY -= 22;

  if (participantes.length > 0) {
    participantes.forEach((p, idx) => {
      if (evY < 120) {
        evidencesPage = pdfDoc.addPage();
        const sizeExtra = evidencesPage.getSize();
        evHeight = sizeExtra.height;
        evY = evHeight - 80;

        evidencesPage.drawText(
          "Certificado de firma electrónica VeriFirma (continuación)",
          {
            x: 50,
            y: evY,
            size: 11,
            font: fontBold,
            color: rgb(0, 0, 0),
          }
        );

        evY -= 30;
      }

      const roleLabel = normalizeRoleLabel(p.role, p.actionType);
      const fechaLabel =
        p.actionType === "VISADO"
          ? "Fecha y hora de visado"
          : "Fecha y hora de firma";

      const block = [
        `${roleLabel} ${idx + 1}: ${p.nombre || "Sin nombre"}`,
        `Email: ${p.email || "N/A"}`,
        `${fechaLabel}: ${formatFechaEvidencia(p.fecha)}`,
        `IP: ${p.ip || "N/A"}`,
        `Ubicación aproximada: ${p.location || "Desconocido"}`,
        `Tipo de acción: ${p.actionType}`,
        `Tipo de firma: ${p.tipoFirma || "N/A"}`,
      ].join("\n");

      evidencesPage.drawText(block, {
        x: 50,
        y: evY,
        size: 9,
        font,
        color: rgb(0.1, 0.1, 0.1),
        lineHeight: 11,
      });

      evY -= 92;
    });
  } else {
    evidencesPage.drawText(
      "No hay evidencias registradas para este documento.",
      {
        x: 50,
        y: evY,
        size: 9,
        font,
        color: rgb(0.4, 0.4, 0.4),
      }
    );
    evY -= 20;
  }

  // 4) Guardar y subir versión final
  const newPdfBytes = await pdfDoc.save();
  const newBuffer = Buffer.from(newPdfBytes);

  const finalHash = crypto.createHash("sha256").update(newBuffer).digest("hex");
  const finalKey = `documents/${documentoId}/final-${finalHash}.pdf`;

  await uploadBufferToS3(finalKey, newBuffer, "application/pdf");

  console.log("DEBUG HASH SELLADO >>", {
    documentoId,
    finalKey,
    finalHash,
  });

  let finalUrl = null;
  try {
    finalUrl = await getSignedUrl(finalKey, 60 * 60 * 24 * 7);
  } catch (err) {
    console.warn(
      "⚠️ No se pudo generar URL firmada larga para PDF final:",
      err.message
    );
  }

  await db.query(
    `
    UPDATE documents
    SET
      final_storage_key = $1,
      final_hash_sha256 = $2,
      final_file_url    = $3,
      pdf_final_url     = $4,
      updated_at        = NOW()
    WHERE id = $5
    `,
    [finalKey, finalHash, finalUrl, finalKey, documentoId]
  );

  console.log(
    `✅ PDF sellado con ${participantes.length} evidencias: ${finalKey}`
  );

  return {
    finalKey,
    finalHash,
    finalUrl,
  };
}

module.exports = {
  sellarPdfConQr,
};
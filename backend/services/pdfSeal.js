// backend/services/pdfSeal.js
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const bwipjs = require("@bwip-js/node");
const { PDFDocument, rgb, StandardFonts, degrees } = require("pdf-lib");
const { getObjectBuffer, uploadBufferToS3 } = require("./storageR2");
const db = require("../db");
const crypto = require("crypto");

/**
 * Sella el PDF del documento con QR, evidencias y certificación,
 * sube la versión final y guarda su hash y ruta final en la tabla documents.
 *
 * IMPORTANTE:
 * - documentoId debe ser el ID de la tabla `documents` (no de `documentos`).
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

  // 1) Descargar y cargar PDF base (sin tocar metadatos, para hash estable)
  const pdfBytes = await getObjectBuffer(s3Key);
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false });

  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  if (!pages || totalPages === 0) {
    throw new Error("El PDF no tiene páginas");
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const numeroInternoTexto = numeroContratoInterno || "N° interno: —";

  // 2) Obtener firmantes del documento (solo los que realmente firmaron)
  const firmantesRes = await db.query(
    `
    SELECT 
      nombre,
      email,
      fecha_firma,
      ip_firma,
      user_agent_firma,
      geo_location,
      tipo_firma
    FROM firmantes
    WHERE documento_id = $1 AND estado = 'FIRMADO'
    ORDER BY fecha_firma ASC
    `,
    [documentoId]
  );
  const firmantes = firmantesRes.rows || [];

  // 3) Footer en todas las páginas
  const footerFontSize = 8;
  const footerMarginY = 30;
  const footerColor = rgb(0.4, 0.4, 0.4);

  pages.forEach((page, index) => {
    const { width } = page.getSize();
    const pageNumber = index + 1;

    const footerText = `${numeroInternoTexto} · Página ${pageNumber} de ${totalPages} · verifirma.cl`;
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

  // 4) Última página del documento original: logo, QR, barra lateral y bloque legal corto
  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage.getSize();

  // 4.1 Logo
  try {
    const logoPngBytes = await fs.promises.readFile(
      path.join(__dirname, "../assets/verifirma-logo.png")
    );
    const logoImage = await pdfDoc.embedPng(logoPngBytes);
    const logoWidth = 90;
    const logoHeight = (logoImage.height / logoImage.width) * logoWidth;

    const logoX = width - logoWidth - 15;
    const logoY = height - logoHeight - 40;

    lastPage.drawImage(logoImage, {
      x: logoX,
      y: logoY,
      width: logoWidth,
      height: logoHeight,
    });

    lastPage.drawText(numeroInternoTexto, {
      x: logoX,
      y: logoY - 16,
      size: 9,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  } catch (err) {
    console.error("⚠️ Error embebiendo logo en PDF sellado:", err);
  }

  // 4.2 QR de verificación
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

  // 4.3 Código de barras lateral
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

  // 4.4 Bloque legal breve en la última página (sin tabla de evidencias)
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
    "Zona horaria: America/Santiago (Chile/Continental).",
  ].join("\n");

  lastPage.drawText(textoLegal, {
    x: 40,
    y: 60,
    size: 8,
    font,
    color: rgb(0, 0, 0),
    lineHeight: 10,
  });

  // 5) PÁGINA(S) DE CERTIFICADO DE EVIDENCIAS (al final)
  let evidencesPage = pdfDoc.addPage();
  let { width: evWidth, height: evHeight } = evidencesPage.getSize();
  let evY = evHeight - 60;

  // Título principal
  evidencesPage.drawText("Certificado de firma electrónica VeriFirma", {
    x: 50,
    y: evY,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  evY -= 30;

  // Datos generales del documento
  const resumenDocLines = [
    `Número interno: ${numeroInternoTexto}`,
    `ID del documento (platform): ${documentoId}`,
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

  // Subtítulo firmantes
  evidencesPage.drawText("Firmantes y evidencias registradas", {
    x: 50,
    y: evY,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  evY -= 22;

  if (firmantes.length > 0) {
    firmantes.forEach((f, idx) => {
      if (evY < 120) {
        // Si se llena la página, agregar otra para continuar
        evidencesPage = pdfDoc.addPage();
        const sizeExtra = evidencesPage.getSize();
        evWidth = sizeExtra.width;
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

      let location = "Desconocido";
      try {
        const geo = f.geo_location ? JSON.parse(f.geo_location) : null;
        if (geo && geo.city && geo.country) {
          location = `${geo.city}, ${geo.country}`;
        }
      } catch (err) {
        console.error("⚠️ Error parseando geo_location en PDF sellado:", err);
      }

      const fecha = f.fecha_firma
        ? new Date(f.fecha_firma).toLocaleString("es-CL", {
            timeZone: "America/Santiago",
          })
        : "N/A";

      const firmText = [
        `Firmante ${idx + 1}: ${f.nombre}`,
        `Email: ${f.email}`,
        `Fecha y hora de firma: ${fecha}`,
        `IP: ${f.ip_firma || "N/A"}`,
        `Ubicación aproximada: ${location}`,
        `Tipo de firma: ${f.tipo_firma || "SIMPLE"}`,
      ].join("\n");

      evidencesPage.drawText(firmText, {
        x: 50,
        y: evY,
        size: 9,
        font,
        color: rgb(0.1, 0.1, 0.1),
        lineHeight: 11,
      });

      evY -= 80;
    });
  } else {
    evidencesPage.drawText(
      "No hay firmas registradas para este documento.",
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

  // 6) Guardar, calcular hash, generar key inmutable y subir
  const newPdfBytes = await pdfDoc.save();
  const newBuffer = Buffer.from(newPdfBytes);

  const finalHash = crypto.createHash("sha256").update(newBuffer).digest("hex");

  const newKey = `documentos/${documentoId}/final-${finalHash}.pdf`;

  await uploadBufferToS3(newKey, newBuffer, "application/pdf");

  console.log("DEBUG HASH SELLADO >>", {
    documentoId,
    newKey,
    finalHash,
  });

  await db.query(
    `
    UPDATE documents
    SET pdf_final_url = $1,
        pdf_hash_final = $2
    WHERE id = $3
    `,
    [newKey, finalHash, documentoId]
  );

  console.log(`✅ PDF sellado con ${firmantes.length} evidencias: ${newKey}`);

  // Devolvemos la key final por si el caller la quiere usar
  return newKey;
}

module.exports = {
  sellarPdfConQr,
};
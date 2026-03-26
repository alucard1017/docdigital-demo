// backend/services/pdfSeal.js
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const bwipjs = require("@bwip-js/node");
const { PDFDocument, rgb, StandardFonts, degrees } = require("pdf-lib");
const { getObjectBuffer, uploadBufferToS3 } = require("./storageR2");
const db = require("../db");

async function sellarPdfConQr({
  s3Key,
  documentoId,
  codigoVerificacion,
  categoriaFirma,
  numeroContratoInterno,
}) {
  if (!s3Key) throw new Error("s3Key es obligatorio para sellar el PDF");
  if (!documentoId) throw new Error("documentoId es obligatorio para sellar el PDF");
  if (!codigoVerificacion) {
    throw new Error("codigoVerificacion es obligatorio para sellar el PDF");
  }

  console.log("📄 Sellando PDF con evidencias completas...");

  // 1) Descargar y cargar PDF base
  const pdfBytes = await getObjectBuffer(s3Key);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  if (!pages || totalPages === 0) throw new Error("El PDF no tiene páginas");

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const numeroInternoTexto = numeroContratoInterno || "N° interno: —";

  // 2) Obtener firmantes del documento
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

  const firmantes = firmantesRes.rows;

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

  // 4) Última página: logo, QR, tabla de evidencias
  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage.getSize();

  // Logo
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

  // QR
  const urlVerificacion = `https://verifirma.cl/verificar/${codigoVerificacion}`;
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

  // Código de barras lateral
  let barcodePng;
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
    barcodePng = await pdfDoc.embedPng(barcodePngBuffer);
  } catch (err) {
    console.error("⚠️ Error generando código de barras:", err);
    barcodePng = null;
  }

  if (barcodePng) {
    const barcodeWidth = 35;
    const barcodeHeight = (barcodePng.height / barcodePng.width) * barcodeWidth;

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
  }

  // 5) TABLA DE EVIDENCIAS DE FIRMAS
  let tableY = 350;

  lastPage.drawText("EVIDENCIAS DE FIRMA ELECTRÓNICA", {
    x: 40,
    y: tableY,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  });

  tableY -= 20;

  if (firmantes.length > 0) {
    firmantes.forEach((f, idx) => {
      const geo = f.geo_location ? JSON.parse(f.geo_location) : null;
      const location = geo ? `${geo.city}, ${geo.country}` : "Desconocido";
      const fecha = f.fecha_firma
        ? new Date(f.fecha_firma).toLocaleString("es-CL", {
            timeZone: "America/Santiago",
          })
        : "N/A";

      const firmText = [
        `Firmante ${idx + 1}: ${f.nombre}`,
        `Email: ${f.email}`,
        `Fecha: ${fecha}`,
        `IP: ${f.ip_firma || "N/A"}`,
        `Ubicación: ${location}`,
        `Tipo: ${f.tipo_firma || "SIMPLE"}`,
        "",
      ].join("\n");

      lastPage.drawText(firmText, {
        x: 40,
        y: tableY,
        size: 8,
        font,
        color: rgb(0.1, 0.1, 0.1),
        lineHeight: 10,
      });

      tableY -= 80;
    });
  } else {
    lastPage.drawText("No hay firmas registradas", {
      x: 40,
      y: tableY,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    tableY -= 20;
  }

  // Línea divisoria
  lastPage.drawLine({
    start: { x: 40, y: 75 },
    end: { x: width - 120, y: 75 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });

  // Bloque legal
  const esAvanzada = categoriaFirma === "AVANZADA";

  const textoLegal = [
    "Certificado de firma electrónica",
    "",
    `Número interno: ${numeroInternoTexto}`,
    `Documento ID: ${documentoId}`,
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

  // 6) Guardar y subir
  const newPdfBytes = await pdfDoc.save(); // Uint8Array [web:202]
  const newKey = s3Key.endsWith(".pdf")
    ? s3Key.replace(/\.pdf$/i, "_sellado.pdf")
    : `${s3Key}_sellado.pdf`;

  await uploadBufferToS3(newKey, newPdfBytes, "application/pdf");

  console.log(`✅ PDF sellado con ${firmantes.length} evidencias: ${newKey}`);

  return newKey;
}

module.exports = {
  sellarPdfConQr,
};
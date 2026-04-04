import React, { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export function PublicPdfViewer({ fileUrl }) {
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(900);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const el = document.getElementById("public-pdf-viewer-container");
    if (!el) return;

    const update = () => {
      setContainerWidth(el.clientWidth || 900);
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);

    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const pageWidth = useMemo(() => {
    const safeWidth = Math.max(280, containerWidth - 24);
    return safeWidth;
  }, [containerWidth]);

  return (
    <div id="public-pdf-viewer-container" className="public-pdf-viewer">
      <Document
        file={fileUrl}
        onLoadSuccess={({ numPages }) => {
          setLoadError("");
          setNumPages(numPages);
        }}
        onLoadError={(error) => {
          console.error("❌ Error real cargando PDF:", error);
          setLoadError(error?.message || "Error desconocido cargando PDF");
        }}
        loading={<div className="public-sign-pdf-empty">Cargando PDF...</div>}
        error={
          <div className="public-sign-pdf-empty">
            No se pudo cargar la vista del PDF.
            {loadError ? <div style={{ marginTop: 8 }}>{loadError}</div> : null}
          </div>
        }
        noData={
          <div className="public-sign-pdf-empty">
            No hay PDF disponible para mostrar.
          </div>
        }
      >
        {Array.from(new Array(numPages), (_, index) => (
          <div key={`page_${index + 1}`} className="public-pdf-page-wrap">
            <Page
              pageNumber={index + 1}
              width={pageWidth}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </div>
        ))}
      </Document>
    </div>
  );
}
// frontend/src/components/PublicPdfViewer.jsx
import React, { useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export function PublicPdfViewer({ fileUrl }) {
  const [numPages, setNumPages] = useState(null);
  const [loadError, setLoadError] = useState("");

  const file = useMemo(() => {
    if (!fileUrl) return null;
    return { url: fileUrl };
  }, [fileUrl]);

  function handleLoadSuccess({ numPages }) {
    setNumPages(numPages);
    setLoadError("");
  }

  function handleLoadError(error) {
    console.error("❌ Error real cargando PDF:", error);
    setLoadError(
      error?.message ||
        "No se pudo cargar la vista previa del PDF. Intenta abrir el documento completo."
    );
  }

  if (!fileUrl) {
    return (
      <div className="public-sign-pdf-empty">
        No hay una vista previa disponible para este documento.
      </div>
    );
  }

  return (
    <div className="public-pdf-viewer">
      {loadError ? (
        <div className="public-sign-pdf-empty">
          <div>{loadError}</div>
        </div>
      ) : null}

      <Document
        file={file}
        onLoadSuccess={handleLoadSuccess}
        onLoadError={handleLoadError}
        loading={
          <div className="public-sign-pdf-empty">
            Cargando vista previa del documento...
          </div>
        }
        error={
          <div className="public-sign-pdf-empty">
            No se pudo renderizar el PDF. Usa “Abrir documento completo”.
          </div>
        }
        noData={
          <div className="public-sign-pdf-empty">
            No hay archivo PDF disponible.
          </div>
        }
      >
        {!loadError &&
          Array.from(new Array(numPages || 0), (_, index) => (
            <div className="public-pdf-page-wrap" key={`page_${index + 1}`}>
              <Page
                pageNumber={index + 1}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                width={900}
              />
            </div>
          ))}
      </Document>
    </div>
  );
}
import { useCallback, useEffect, useState } from "react";

export function usePublicSign({
  apiRoot,
  isSigningPortal,
  isVerificationPortal,
}) {
  const [publicSignDoc, setPublicSignDoc] = useState(null);
  const [publicSignError, setPublicSignError] = useState("");
  const [publicSignLoading, setPublicSignLoading] = useState(false);
  const [publicSignToken, setPublicSignToken] = useState("");
  const [publicSignPdfUrl, setPublicSignPdfUrl] = useState("");
  const [publicSignMode, setPublicSignMode] = useState(null);
  const [publicView, setPublicView] = useState(null);

  const cargarFirmaPublica = useCallback(
    async (tokenParam) => {
      try {
        setPublicSignLoading(true);
        setPublicSignError("");

        const params = new URLSearchParams(window.location.search);
        const modeUrl = params.get("mode");
        const pathname = window.location.pathname;

        const isVisado = modeUrl === "visado";
        const isConsultaPublica = pathname === "/consulta-publica";

        const path =
          isVisado || isConsultaPublica
            ? `/public/docs/document/${tokenParam}`
            : `/public/docs/${tokenParam}`;

        const res = await fetch(`${apiRoot}${path}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "No se pudo cargar el documento");
        }

        if (isVisado || isConsultaPublica) {
          setPublicSignDoc({ document: data.document, signer: null });
          setPublicSignPdfUrl(data.pdfUrl);
        } else {
          setPublicSignDoc(data);
          setPublicSignPdfUrl(data.pdfUrl);
        }
      } catch (err) {
        console.error("Error cargando firma pública:", err);
        setPublicSignError(err.message || "No se pudo cargar el documento");
        setPublicSignDoc(null);
        setPublicSignPdfUrl("");
      } finally {
        setPublicSignLoading(false);
      }
    },
    [apiRoot]
  );

  useEffect(() => {
    const syncViewWithLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const tokenUrl = params.get("token");
      const modeUrl = params.get("mode");
      const pathname = window.location.pathname;

      const isFirmaPublicaPath =
        pathname === "/public/sign" ||
        pathname === "/firma-publica" ||
        (isSigningPortal && pathname === "/");

      const isConsultaPublica = pathname === "/consulta-publica";

      const isVerificationPublic =
        pathname === "/verificar" ||
        (isVerificationPortal && pathname === "/");

      if (tokenUrl && (isFirmaPublicaPath || isConsultaPublica)) {
        setPublicView("public-sign");
        setPublicSignToken(tokenUrl);
        setPublicSignMode(isFirmaPublicaPath ? modeUrl || null : null);
        cargarFirmaPublica(tokenUrl);
        return;
      }

      if (isVerificationPublic) {
        setPublicView("verification");
        return;
      }

      setPublicView(null);
    };

    syncViewWithLocation();
    window.addEventListener("popstate", syncViewWithLocation);

    return () => {
      window.removeEventListener("popstate", syncViewWithLocation);
    };
  }, [isSigningPortal, isVerificationPortal, cargarFirmaPublica]);

  return {
    publicSignDoc,
    publicSignError,
    publicSignLoading,
    publicSignToken,
    publicSignPdfUrl,
    publicSignMode,
    publicView,
    cargarFirmaPublica,
  };
}
// src/hooks/usePublicSign.js
import { useCallback, useEffect, useRef, useState } from "react";

function stripTrailingSlashes(value = "") {
  return String(value || "").trim().replace(/\/+$/, "");
}

function ensureApiBase(value = "") {
  const clean = stripTrailingSlashes(value);
  if (!clean) return "";
  return clean.endsWith("/api") ? clean : `${clean}/api`;
}

function getLocationSnapshot({ isSigningPortal, isVerificationPortal }) {
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname;

  const token = (params.get("token") || "").trim();
  const mode = (params.get("mode") || "").trim() || null;

  const isFirmaPublicaPath =
    pathname === "/public/sign" ||
    pathname === "/firma-publica" ||
    (isSigningPortal && pathname === "/");

  const isConsultaPublica = pathname === "/consulta-publica";

  const isVerificationPublic =
    pathname === "/verificar" ||
    pathname === "/verificacion-publica" ||
    (isVerificationPortal && pathname === "/");

  return {
    pathname,
    token,
    mode,
    isFirmaPublicaPath,
    isConsultaPublica,
    isVerificationPublic,
    publicView:
      token && (isFirmaPublicaPath || isConsultaPublica)
        ? "public-sign"
        : isVerificationPublic
        ? "verification"
        : null,
  };
}

function normalizePublicDocumentResponse(data, mode = null) {
  const normalizedDocument = data?.document || data || null;

  const normalizedSigner =
    data?.signer ||
    data?.currentSigner ||
    (Array.isArray(data?.signers) ? data.signers[0] : null) ||
    null;

  const normalizedPdfUrl =
    data?.pdfUrl ||
    data?.signedPdfUrl ||
    data?.previewUrl ||
    data?.document?.pdf_final_url ||
    data?.document?.pdfUrl ||
    data?.document?.signedPdfUrl ||
    data?.document?.previewUrl ||
    data?.document?.pdf_url ||
    data?.pdf_url ||
    "";

  return {
    raw: data,
    document: normalizedDocument,
    signer: normalizedSigner,
    pdfUrl: normalizedPdfUrl,
    mode,
  };
}

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

  const abortRef = useRef(null);
  const apiBase = ensureApiBase(apiRoot);

  const clearPublicState = useCallback(() => {
    setPublicSignDoc(null);
    setPublicSignError("");
    setPublicSignLoading(false);
    setPublicSignToken("");
    setPublicSignPdfUrl("");
    setPublicSignMode(null);
  }, []);

  const cargarFirmaPublica = useCallback(
    async (tokenParam, options = {}) => {
      const token = String(tokenParam || "").trim();
      const mode = options.mode ?? publicSignMode ?? null;

      if (!token) {
        setPublicSignError("No se recibió el token del documento.");
        setPublicSignDoc(null);
        setPublicSignPdfUrl("");
        return null;
      }

      if (!apiBase) {
        setPublicSignError("La URL del servicio público no está configurada.");
        setPublicSignDoc(null);
        setPublicSignPdfUrl("");
        return null;
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        setPublicSignLoading(true);
        setPublicSignError("");

        const path = `/public/docs/document/${encodeURIComponent(token)}`;
        const res = await fetch(`${apiBase}${path}`, {
          signal: controller.signal,
        });

        let data = {};
        try {
          data = await res.json();
        } catch {
          data = {};
        }

        if (!res.ok) {
          throw new Error(data?.message || "No se pudo cargar el documento");
        }

        const normalized = normalizePublicDocumentResponse(data, mode);

        setPublicSignDoc({
          ...normalized.raw,
          document: normalized.document,
          signer: normalized.signer,
        });
        setPublicSignPdfUrl(normalized.pdfUrl || "");
        setPublicSignToken(token);
        setPublicSignMode(mode);

        return normalized;
      } catch (err) {
        if (err?.name === "AbortError") {
          return null;
        }

        console.error("Error cargando firma pública:", err);
        setPublicSignError(err?.message || "No se pudo cargar el documento");
        setPublicSignDoc(null);
        setPublicSignPdfUrl("");
        return null;
      } finally {
        if (abortRef.current === controller) {
          setPublicSignLoading(false);
          abortRef.current = null;
        }
      }
    },
    [apiBase, publicSignMode]
  );

  useEffect(() => {
    const syncViewWithLocation = () => {
      const snapshot = getLocationSnapshot({
        isSigningPortal,
        isVerificationPortal,
      });

      setPublicView(snapshot.publicView);

      if (snapshot.publicView === "public-sign") {
        setPublicSignToken(snapshot.token);
        setPublicSignMode(snapshot.isFirmaPublicaPath ? snapshot.mode : null);
        cargarFirmaPublica(snapshot.token, {
          mode: snapshot.isFirmaPublicaPath ? snapshot.mode : null,
        });
        return;
      }

      if (snapshot.publicView === "verification") {
        setPublicSignToken("");
        setPublicSignMode(null);
        setPublicSignDoc(null);
        setPublicSignPdfUrl("");
        setPublicSignError("");
        setPublicSignLoading(false);
        return;
      }

      clearPublicState();
    };

    syncViewWithLocation();
    window.addEventListener("popstate", syncViewWithLocation);

    return () => {
      window.removeEventListener("popstate", syncViewWithLocation);
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [
    isSigningPortal,
    isVerificationPortal,
    cargarFirmaPublica,
    clearPublicState,
  ]);

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
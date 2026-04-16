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

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function getLocationSnapshot({ isSigningPortal, isVerificationPortal }) {
  const params = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname;

  const token = (params.get("token") || "").trim();
  const mode = (params.get("mode") || "").trim().toLowerCase() || null;

  const isFirmaPublicaPath =
    pathname === "/public/sign" ||
    pathname === "/firma-publica" ||
    (isSigningPortal && pathname === "/");

  const isConsultaPublica = pathname === "/consulta-publica";

  const isVerificationPublic =
    pathname === "/verificar" ||
    pathname === "/verificacion-publica" ||
    (isVerificationPortal && pathname === "/");

  const publicView =
    token && (isFirmaPublicaPath || isConsultaPublica)
      ? "public-sign"
      : isVerificationPublic
      ? "verification"
      : null;

  return {
    pathname,
    token,
    mode,
    isFirmaPublicaPath,
    isConsultaPublica,
    isVerificationPublic,
    publicView,
  };
}

function resolveTokenKind({
  pathname,
  mode,
  isFirmaPublicaPath,
  isConsultaPublica,
}) {
  const normalizedMode = String(mode || "").trim().toLowerCase();

  // Visado siempre por token de documento
  if (normalizedMode === "visado") {
    return "document";
  }

  // Consulta pública siempre por token de documento
  if (isConsultaPublica) {
    return "document";
  }

  // Enlace especial legacy de firma-publica -> documento
  if (pathname === "/firma-publica") {
    return "document";
  }

  // Portal normal de firma -> token de firmante
  if (pathname === "/public/sign" && isFirmaPublicaPath) {
    return "signer";
  }

  // Subdominio firmar raíz -> token de firmante por defecto
  return "signer";
}

function buildPublicLoadPath(token, tokenKind) {
  const encoded = encodeURIComponent(token);

  if (tokenKind === "document") {
    return `/public/docs/document/${encoded}`;
  }

  return `/public/docs/${encoded}`;
}

function normalizePublicDocumentResponse(data, mode = null) {
  const rawDocument =
    data?.document ||
    data?.doc ||
    data?.documento ||
    data?.signedDocument ||
    data?.signed_document ||
    data ||
    null;

  const signer =
    data?.signer ||
    data?.currentSigner ||
    rawDocument?.signer ||
    rawDocument?.currentSigner ||
    (Array.isArray(data?.signers) ? data.signers[0] : null) ||
    (Array.isArray(rawDocument?.signers) ? rawDocument.signers[0] : null) ||
    null;

  const metadata =
    rawDocument?.metadata ||
    rawDocument?.meta ||
    data?.metadata ||
    data?.meta ||
    {};

  const numeroContrato = firstNonEmpty(
    rawDocument?.numero_contrato,
    rawDocument?.numeroContrato,
    rawDocument?.numero_contrato_interno,
    rawDocument?.numeroInterno,
    rawDocument?.numero_interno,
    rawDocument?.nro_interno,
    rawDocument?.contract_number,
    rawDocument?.internal_number,
    rawDocument?.codigo_contrato,
    rawDocument?.codigoContrato,
    metadata?.numero_contrato,
    metadata?.numeroContrato,
    metadata?.numero_contrato_interno,
    metadata?.numero_interno,
    metadata?.contract_number,
    metadata?.codigo_contrato,
    data?.numero_contrato,
    data?.numeroContrato,
    data?.numero_contrato_interno,
    data?.numero_interno,
    data?.contract_number,
    data?.codigo_contrato
  );

  const companyName = firstNonEmpty(
    rawDocument?.empresa_nombre,
    rawDocument?.nombre_empresa,
    rawDocument?.destinatario_nombre,
    rawDocument?.company_name,
    rawDocument?.companyName,
    rawDocument?.razon_social,
    metadata?.empresa_nombre,
    metadata?.nombre_empresa,
    metadata?.destinatario_nombre,
    metadata?.company_name,
    metadata?.companyName,
    metadata?.razon_social,
    data?.empresa_nombre,
    data?.nombre_empresa,
    data?.destinatario_nombre,
    data?.company_name,
    data?.companyName
  );

  const companyRut = firstNonEmpty(
    rawDocument?.empresa_rut,
    rawDocument?.rut_empresa,
    rawDocument?.rut,
    rawDocument?.company_rut,
    rawDocument?.companyRut,
    metadata?.empresa_rut,
    metadata?.rut_empresa,
    metadata?.rut,
    metadata?.company_rut,
    metadata?.companyRut,
    data?.empresa_rut,
    data?.rut_empresa,
    data?.rut,
    data?.company_rut,
    data?.companyRut
  );

  const normalizedPdfUrl = firstNonEmpty(
    data?.pdfUrl,
    data?.signedPdfUrl,
    data?.previewUrl,
    rawDocument?.pdf_final_url,
    rawDocument?.final_file_url,
    rawDocument?.pdfUrl,
    rawDocument?.signedPdfUrl,
    rawDocument?.previewUrl,
    rawDocument?.pdf_url,
    rawDocument?.file_url,
    data?.pdf_url
  );

  const normalizedDocument = rawDocument
    ? {
        ...rawDocument,
        metadata,
        numero_contrato: numeroContrato || rawDocument?.numero_contrato || "",
        numeroContrato: numeroContrato || rawDocument?.numeroContrato || "",
        numero_contrato_interno:
          numeroContrato || rawDocument?.numero_contrato_interno || "",
        empresa_nombre: companyName || rawDocument?.empresa_nombre || "",
        company_name: companyName || rawDocument?.company_name || "",
        empresa_rut: companyRut || rawDocument?.empresa_rut || "",
      }
    : null;

  return {
    raw: data,
    document: normalizedDocument,
    signer,
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
  const [publicTokenKind, setPublicTokenKind] = useState("signer");

  const abortRef = useRef(null);
  const apiBase = ensureApiBase(apiRoot);

  const clearPublicState = useCallback(() => {
    setPublicSignDoc(null);
    setPublicSignError("");
    setPublicSignLoading(false);
    setPublicSignToken("");
    setPublicSignPdfUrl("");
    setPublicSignMode(null);
    setPublicTokenKind("signer");
  }, []);

  const cargarFirmaPublica = useCallback(
    async (tokenParam, options = {}) => {
      const token = String(tokenParam || "").trim();
      const mode = options.mode ?? null;
      const tokenKind = options.tokenKind ?? "signer";

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

        const path = buildPublicLoadPath(token, tokenKind);

        if (import.meta.env.DEV) {
          console.log("[PUBLIC LOAD]", {
            token,
            mode,
            tokenKind,
            path,
          });
        }

        const res = await fetch(`${apiBase}${path}`, {
          method: "GET",
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
          numero_contrato:
            normalized.document?.numero_contrato ||
            normalized.raw?.numero_contrato ||
            "",
        });

        setPublicSignPdfUrl(normalized.pdfUrl || "");
        setPublicSignToken(token);
        setPublicSignMode(mode);
        setPublicTokenKind(tokenKind);

        if (import.meta.env.DEV) {
          console.log("📄 Public sign payload normalizado:", normalized);
        }

        return normalized;
      } catch (err) {
        if (err?.name === "AbortError") {
          return null;
        }

        console.error("❌ Error cargando firma pública:", err);
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
    [apiBase]
  );

  useEffect(() => {
    const syncViewWithLocation = () => {
      const snapshot = getLocationSnapshot({
        isSigningPortal,
        isVerificationPortal,
      });

      setPublicView(snapshot.publicView);

      if (snapshot.publicView === "public-sign") {
        const nextToken = snapshot.token;
        const nextTokenKind = resolveTokenKind(snapshot);

        const nextMode =
          snapshot.mode ||
          (nextTokenKind === "document" ? "visado" : "firma");

        setPublicSignToken(nextToken);
        setPublicSignMode(nextMode);
        setPublicTokenKind(nextTokenKind);

        cargarFirmaPublica(nextToken, {
          mode: nextMode,
          tokenKind: nextTokenKind,
        });

        return;
      }

      if (snapshot.publicView === "verification") {
        clearPublicState();
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
    publicTokenKind,
    cargarFirmaPublica,
  };
}
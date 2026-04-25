// src/hooks/usePublicSign.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function stripTrailingSlashes(value = "") {
  return String(value ?? "")
    .trim()
    .replace(/\/+$/, "");
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

function normalizePathname(pathname = "/") {
  const clean = String(pathname ?? "").trim();
  if (!clean) return "/";
  const normalized = clean.replace(/\/+$/, "");
  return normalized || "/";
}

function extractTokenFromPath(pathname = "/") {
  const normalizedPath = normalizePathname(pathname);
  const segments = normalizedPath.split("/").filter(Boolean);
  if (!segments.length) return "";

  const documentIndex = segments.findIndex((segment) => segment === "document");
  if (documentIndex >= 0 && segments[documentIndex + 1]) {
    return String(segments[documentIndex + 1] ?? "").trim();
  }

  const signIndex = segments.findIndex((segment) => segment === "sign");
  if (signIndex >= 0 && segments[signIndex + 1]) {
    return String(segments[signIndex + 1] ?? "").trim();
  }

  const publicIndex = segments.findIndex((segment) => segment === "public");
  if (
    publicIndex >= 0 &&
    segments[publicIndex + 1] === "sign" &&
    segments[publicIndex + 2]
  ) {
    return String(segments[publicIndex + 2] ?? "").trim();
  }

  return "";
}

function isExactPublicPath(pathname, expected) {
  return normalizePathname(pathname) === expected;
}

function isDocumentTokenPath(pathname) {
  return /^\/document\/[^/]+$/i.test(normalizePathname(pathname));
}

function isPublicSignTokenPath(pathname) {
  return /^\/public\/sign\/[^/]+$/i.test(normalizePathname(pathname));
}

function getLocationSnapshot({ isSigningPortal, isVerificationPortal }) {
  if (typeof window === "undefined") {
    return {
      pathname: "/",
      token: "",
      tokenFromQuery: "",
      tokenFromPath: "",
      mode: null,
      isFirmaPublicaPath: false,
      isConsultaPublica: false,
      isVerificationPublic: false,
      isDocumentPath: false,
      isPublicSignTokenPath: false,
      publicView: null,
    };
  }

  const params = new URLSearchParams(window.location.search || "");
  const pathname = normalizePathname(window.location.pathname || "/");

  const tokenFromQuery = String(params.get("token") || "").trim();
  const tokenFromPath = extractTokenFromPath(pathname);
  const token = firstNonEmpty(tokenFromQuery, tokenFromPath);

  const mode = (params.get("mode") || "").trim().toLowerCase() || null;

  const isDocumentPath = isDocumentTokenPath(pathname);
  const isTokenizedPublicSignPath = isPublicSignTokenPath(pathname);

  const isFirmaPublicaPath =
    isExactPublicPath(pathname, "/public/sign") ||
    isExactPublicPath(pathname, "/firma-publica") ||
    isTokenizedPublicSignPath ||
    isDocumentPath ||
    (isSigningPortal && pathname === "/");

  const isConsultaPublica = isExactPublicPath(pathname, "/consulta-publica");

  const isVerificationPublic =
    isExactPublicPath(pathname, "/verificar") ||
    isExactPublicPath(pathname, "/verificacion-publica") ||
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
    tokenFromQuery,
    tokenFromPath,
    mode,
    isFirmaPublicaPath,
    isConsultaPublica,
    isVerificationPublic,
    isDocumentPath,
    isPublicSignTokenPath: isTokenizedPublicSignPath,
    publicView,
  };
}

/**
 * Determina el tipo de token esperado según la URL y el modo.
 * - "document": token de documento (visado o consulta)
 * - "signer": token de firmante (firma)
 */
function resolveTokenKind({
  pathname,
  mode,
  isFirmaPublicaPath,
  isConsultaPublica,
  isDocumentPath,
}) {
  const normalizedMode = String(mode ?? "").trim().toLowerCase();
  const normalizedPath = normalizePathname(pathname);

  if (normalizedMode === "visado") return "document";
  if (isConsultaPublica) return "document";
  if (isDocumentPath) return "document";
  if (normalizedPath === "/firma-publica") return "document";

  if (
    normalizedPath === "/public/sign" ||
    /^\/public\/sign\/[^/]+$/i.test(normalizedPath)
  ) {
    return "signer";
  }

  if (isFirmaPublicaPath) {
    return normalizedMode === "visado" ? "document" : "signer";
  }

  return "signer";
}

/**
 * Construye el path de carga según tipo de token.
 */
function buildPublicLoadPath(token, tokenKind) {
  const encoded = encodeURIComponent(token);
  if (tokenKind === "document") {
    return `/public/docs/document/${encoded}`;
  }
  return `/public/docs/${encoded}`;
}

/**
 * Normaliza la respuesta pública del backend para que el resto del frontend
 * tenga siempre las mismas claves.
 */
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

  const requiresVisado = Boolean(
    rawDocument?.requires_visado ??
      rawDocument?.requiresVisado ??
      rawDocument?.requiere_visado ??
      metadata?.requires_visado ??
      metadata?.requiresVisado ??
      metadata?.requiere_visado ??
      data?.requires_visado ??
      data?.requiresVisado ??
      data?.requiere_visado ??
      false
  );

  const normalizedDocument = rawDocument
    ? {
        ...rawDocument,
        metadata,
        requires_visado: requiresVisado,
        requiresVisado: requiresVisado,
        numero_contrato: numeroContrato || rawDocument?.numero_contrato || "",
        numeroContrato: numeroContrato || rawDocument?.numeroContrato || "",
        numero_contrato_interno:
          numeroContrato || rawDocument?.numero_contrato_interno || "",
        empresa_nombre: companyName || rawDocument?.empresa_nombre || "",
        company_name: companyName || rawDocument?.company_name || "",
        empresa_rut: companyRut || rawDocument?.empresa_rut || "",
      }
    : null;

  const backendMode = String(
    data?.mode || data?.public_mode || data?.tipo_acceso || ""
  )
    .trim()
    .toLowerCase();

  const effectiveMode =
    mode || (backendMode === "visado" ? "visado" : backendMode || null);

  const backendTokenKind = String(
    data?.public_token_kind || data?.token_kind || ""
  )
    .trim()
    .toLowerCase();

  const effectiveTokenKind =
    backendTokenKind === "document" || backendTokenKind === "signer"
      ? backendTokenKind
      : null;

  return {
    raw: data,
    document: normalizedDocument,
    signer,
    pdfUrl: normalizedPdfUrl,
    mode: effectiveMode,
    tokenKind: effectiveTokenKind,
  };
}

/**
 * Traducir un error HTTP/mensaje a un mensaje más humano.
 * (El kind final lo deriva usePublicSignLogic / classifyPublicError).
 */
function normalizePublicError(err) {
  const status = err?.status;
  const rawMessage = String(
    err?.payload?.message || err?.message || ""
  ).trim();

  const lower = rawMessage.toLowerCase();

  if (!status && !rawMessage) {
    return {
      code: "unknown",
      message:
        "No se pudo cargar el documento. Intenta nuevamente en unos segundos.",
    };
  }

  if (
    status === 404 ||
    lower.includes("no se encontró") ||
    lower.includes("not found")
  ) {
    return {
      code: "invalid",
      message:
        "Este enlace no es válido o el documento ya no está disponible. Verifica que el link esté completo o pide uno nuevo.",
    };
  }

  if (
    status === 410 ||
    lower.includes("expirado") ||
    lower.includes("vencido") ||
    lower.includes("expired")
  ) {
    return {
      code: "expired",
      message:
        "Este enlace de firma expiró. Pide al remitente que te envíe un nuevo enlace.",
    };
  }

  if (status === 400 && lower.includes("token")) {
    return {
      code: "invalid",
      message:
        "No pudimos reconocer este enlace. Asegúrate de que el link no esté cortado o modificado.",
    };
  }

  if (
    status === 403 ||
    lower.includes("rejected") ||
    lower.includes("rechazado")
  ) {
    return {
      code: "rejected",
      message:
        "Este documento fue rechazado y el flujo de firma quedó cerrado.",
    };
  }

  return {
    code: "generic",
    message:
      rawMessage ||
      "No se pudo cargar el documento. Intenta nuevamente o contacta al remitente.",
  };
}

export function usePublicSign({
  apiRoot,
  isSigningPortal,
  isVerificationPortal,
}) {
  const [publicSignDoc, setPublicSignDoc] = useState(null);
  const [publicSignError, setPublicSignError] = useState("");
  const [publicSignErrorCode, setPublicSignErrorCode] = useState(null);
  const [publicSignLoading, setPublicSignLoading] = useState(false);
  const [publicSignToken, setPublicSignToken] = useState("");
  const [publicSignPdfUrl, setPublicSignPdfUrl] = useState("");
  const [publicSignMode, setPublicSignMode] = useState(null);
  const [publicView, setPublicView] = useState(null);
  const [publicTokenKind, setPublicTokenKind] = useState(null);

  const abortRef = useRef(null);
  const apiBase = useMemo(() => ensureApiBase(apiRoot), [apiRoot]);

  const clearPublicState = useCallback(() => {
    setPublicSignDoc(null);
    setPublicSignError("");
    setPublicSignErrorCode(null);
    setPublicSignLoading(false);
    setPublicSignToken("");
    setPublicSignPdfUrl("");
    setPublicSignMode(null);
    setPublicTokenKind(null);
    setPublicView(null);
  }, []);

  const cargarFirmaPublica = useCallback(
    async (tokenParam, options = {}) => {
      const token = String(tokenParam || "").trim();
      const requestedMode = options.mode ?? null;
      const requestedTokenKind =
        options.tokenKind === "document" || options.tokenKind === "signer"
          ? options.tokenKind
          : null;

      if (!token) {
        setPublicSignError("No se recibió el token del documento.");
        setPublicSignErrorCode("invalid");
        setPublicSignDoc(null);
        setPublicSignPdfUrl("");
        return null;
      }

      if (!apiBase) {
        setPublicSignError("La URL del servicio público no está configurada.");
        setPublicSignErrorCode("generic");
        setPublicSignDoc(null);
        setPublicSignPdfUrl("");
        return null;
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      async function doFetch(tokenKindToUse) {
        const effectiveKind =
          tokenKindToUse === "document" || tokenKindToUse === "signer"
            ? tokenKindToUse
            : requestedMode === "visado"
            ? "document"
            : "signer";

        const path = buildPublicLoadPath(token, effectiveKind);

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
          const error = new Error(
            data?.message || "No se pudo cargar el documento"
          );
          error.status = res.status;
          error.payload = data;
          throw error;
        }

        return {
          res,
          data,
          tokenKindUsed: effectiveKind,
        };
      }

      try {
        setPublicSignLoading(true);
        setPublicSignError("");
        setPublicSignErrorCode(null);

        const firstKind =
          requestedTokenKind ||
          (requestedMode === "visado" ? "document" : "signer");

        let result;

        try {
          result = await doFetch(firstKind);
        } catch (err) {
          if (err?.name === "AbortError") throw err;

          const message = String(
            err?.payload?.message || err?.message || ""
          ).toLowerCase();

          const shouldRetryAsDocument =
            firstKind === "signer" &&
            (message.includes("visado") ||
              message.includes("documento") ||
              message.includes("document token"));

          const shouldRetryAsSigner =
            firstKind === "document" &&
            (message.includes("firma") ||
              message.includes("firmante") ||
              message.includes("signer"));

          if (shouldRetryAsDocument) {
            result = await doFetch("document");
          } else if (shouldRetryAsSigner) {
            result = await doFetch("signer");
          } else {
            throw err;
          }
        }

        const normalized = normalizePublicDocumentResponse(
          result.data,
          requestedMode
        );

        const nextTokenKind =
          normalized.tokenKind ||
          result.tokenKindUsed ||
          (requestedMode === "visado" ? "document" : "signer");

        const nextMode =
          normalized.mode ||
          requestedMode ||
          (nextTokenKind === "document" ? "visado" : "firma");

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
        setPublicSignMode(nextMode);
        setPublicTokenKind(nextTokenKind);

        if (import.meta.env.DEV) {
          console.log("[PublicAccessSnapshot]", {
            token,
            requestedMode,
            requestedTokenKind,
            nextMode,
            nextTokenKind,
            hasDocument: !!normalized.document,
            hasSigner: !!normalized.signer,
            pdfUrl: normalized.pdfUrl || "",
            viewStateFromApi:
              normalized.raw?.viewState || normalized.raw?.view_state || null,
          });
        }

        return normalized;
      } catch (err) {
        if (err?.name === "AbortError") {
          return null;
        }

        const normalizedError = normalizePublicError(err);
        setPublicSignError(normalizedError.message);
        setPublicSignErrorCode(normalizedError.code);
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

      if (import.meta.env.DEV) {
        console.log("[PublicAccessLocationSnapshot]", snapshot);
      }

      setPublicView(snapshot.publicView);

      if (snapshot.publicView === "public-sign") {
        const nextToken = snapshot.token;
        const nextTokenKind = resolveTokenKind(snapshot);

        const nextModeFromUrl = snapshot.mode;
        const nextMode =
          nextModeFromUrl ||
          (nextTokenKind === "document" ? "visado" : "firma");

        setPublicSignToken(nextToken);
        setPublicSignMode(nextMode);
        setPublicTokenKind(nextTokenKind);

        if (!nextToken) {
          setPublicSignDoc(null);
          setPublicSignPdfUrl("");
          setPublicSignError("");
          setPublicSignErrorCode(null);
          setPublicSignLoading(false);
          return;
        }

        cargarFirmaPublica(nextToken, {
          mode: nextMode,
          tokenKind: nextTokenKind,
        });

        return;
      }

      if (snapshot.publicView === "verification") {
        clearPublicState();
        setPublicView("verification");
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
    publicSignErrorCode,
    publicSignLoading,
    publicSignToken,
    publicSignPdfUrl,
    publicSignMode,
    publicView,
    publicTokenKind,
    cargarFirmaPublica,
  };
}
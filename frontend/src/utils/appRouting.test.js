// src/utils/appRouting.test.js
import { describe, it, expect } from "vitest";
import {
  getProtectedViewFromPath,
  getPublicAccessSnapshot,
  getEffectivePublicRouteState,
  resolveAppEntry,
} from "./appRouting";

describe("appRouting utils", () => {
  describe("getProtectedViewFromPath", () => {
    it("mapea rutas protegidas conocidas", () => {
      expect(getProtectedViewFromPath("/documents")).toBe("list");
      expect(getProtectedViewFromPath("/new-document")).toBe("upload");
      expect(getProtectedViewFromPath("/dashboard")).toBe("dashboard");
    });

    it("vuelve a list en rutas desconocidas", () => {
      expect(getProtectedViewFromPath("/cualquier-cosa")).toBe("list");
    });
  });

  describe("getPublicAccessSnapshot", () => {
    it("detecta firma pública por query token", () => {
      const result = getPublicAccessSnapshot({
        pathname: "/public/sign",
        search: "?token=abc123",
        isSigningPortal: false,
        isVerificationPortal: false,
      });

      expect(result.tokenFromUrl).toBe("abc123");
      expect(result.isPublicSigningAccess).toBe(true);
      expect(result.isPublicVerificationAccess).toBe(false);
      expect(result.isAnyPublicAccess).toBe(true);
      expect(result.isDocumentTokenPath).toBe(false);
    });

    it("detecta /document/:token como acceso público de visado", () => {
      const result = getPublicAccessSnapshot({
        pathname: "/document/token-xyz",
        search: "",
        isSigningPortal: false,
        isVerificationPortal: false,
      });

      expect(result.tokenFromUrl).toBe("token-xyz");
      expect(result.isPublicSigningAccess).toBe(true);
      expect(result.isAnyPublicAccess).toBe(true);
      expect(result.isDocumentTokenPath).toBe(true);
    });

    it("detecta verificación pública", () => {
      const result = getPublicAccessSnapshot({
        pathname: "/verificar",
        search: "",
        isSigningPortal: false,
        isVerificationPortal: false,
      });

      expect(result.isPublicVerificationAccess).toBe(true);
      expect(result.isPublicSigningAccess).toBe(false);
      expect(result.isAnyPublicAccess).toBe(true);
    });

    it("detecta root como portal de firma por subdominio", () => {
      const result = getPublicAccessSnapshot({
        pathname: "/",
        search: "?token=tok-root",
        isSigningPortal: true,
        isVerificationPortal: false,
      });

      expect(result.isPublicSigningAccess).toBe(true);
      expect(result.tokenFromUrl).toBe("tok-root");
    });

    it("no marca acceso público cuando no corresponde", () => {
      const result = getPublicAccessSnapshot({
        pathname: "/documents",
        search: "",
        isSigningPortal: false,
        isVerificationPortal: false,
      });

      expect(result.isAnyPublicAccess).toBe(false);
      expect(result.tokenFromUrl).toBe("");
    });
  });

  describe("getEffectivePublicRouteState", () => {
    it("usa visado/document para /document/:token", () => {
      const result = getEffectivePublicRouteState({
        search: "",
        isDocumentTokenPath: true,
      });

      expect(result.effectivePublicModeFromUrl).toBe("visado");
      expect(result.effectiveTokenKindFromUrl).toBe("document");
    });

    it("interpreta mode=firma", () => {
      const result = getEffectivePublicRouteState({
        search: "?mode=firma",
        isDocumentTokenPath: false,
      });

      expect(result.effectivePublicModeFromUrl).toBe("firma");
      expect(result.effectiveTokenKindFromUrl).toBe("signer");
    });

    it("interpreta mode=visado", () => {
      const result = getEffectivePublicRouteState({
        search: "?mode=visado",
        isDocumentTokenPath: false,
      });

      expect(result.effectivePublicModeFromUrl).toBe("visado");
      expect(result.effectiveTokenKindFromUrl).toBe("document");
    });

    it("defaultea a firma cuando no viene mode", () => {
      const result = getEffectivePublicRouteState({
        search: "",
        isDocumentTokenPath: false,
      });

      expect(result.effectivePublicModeFromUrl).toBe("firma");
      expect(result.effectiveTokenKindFromUrl).toBe("signer");
    });
  });

  describe("resolveAppEntry", () => {
    it("prioriza session loading", () => {
      const result = resolveAppEntry({
        authLoading: true,
        isAuthenticated: false,
        path: "/login",
        publicAccess: {},
      });

      expect(result.screen).toBe("session-loading");
    });

    it("envía a verificación pública", () => {
      const result = resolveAppEntry({
        authLoading: false,
        isAuthenticated: false,
        path: "/verificar",
        publicAccess: {
          isPublicVerificationAccess: true,
          isPublicSigningAccess: false,
        },
      });

      expect(result.screen).toBe("public-verification");
    });

    it("envía a firma pública", () => {
      const result = resolveAppEntry({
        authLoading: false,
        isAuthenticated: false,
        path: "/document/token-123",
        publicAccess: {
          isPublicVerificationAccess: false,
          isPublicSigningAccess: true,
        },
      });

      expect(result.screen).toBe("public-sign");
    });

    it("mantiene forgot password como ruta pública auth", () => {
      const result = resolveAppEntry({
        authLoading: false,
        isAuthenticated: false,
        path: "/forgot-password",
        publicAccess: {
          isPublicVerificationAccess: false,
          isPublicSigningAccess: false,
        },
      });

      expect(result.screen).toBe("forgot-password");
    });

    it("mantiene login cuando no hay sesión", () => {
      const result = resolveAppEntry({
        authLoading: false,
        isAuthenticated: false,
        path: "/login",
        publicAccess: {
          isPublicVerificationAccess: false,
          isPublicSigningAccess: false,
        },
      });

      expect(result.screen).toBe("login");
    });

    it("envía a protected app cuando hay sesión", () => {
      const result = resolveAppEntry({
        authLoading: false,
        isAuthenticated: true,
        path: "/documents",
        publicAccess: {
          isPublicVerificationAccess: false,
          isPublicSigningAccess: false,
        },
      });

      expect(result.screen).toBe("protected-app");
    });
  });
});
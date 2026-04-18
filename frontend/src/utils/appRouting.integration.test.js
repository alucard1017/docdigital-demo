// src/utils/appRouting.integration.test.js
import { describe, it, expect } from "vitest";
import {
  getPublicAccessSnapshot,
  getEffectivePublicRouteState,
  resolveAppEntry,
} from "./appRouting";

function resolveRouteScenario({
  pathname,
  search = "",
  authLoading = false,
  isAuthenticated = false,
  isSigningPortal = false,
  isVerificationPortal = false,
}) {
  const publicAccess = getPublicAccessSnapshot({
    pathname,
    search,
    isSigningPortal,
    isVerificationPortal,
  });

  const publicRouteState = getEffectivePublicRouteState({
    search,
    isDocumentTokenPath: publicAccess.isDocumentTokenPath,
  });

  const entry = resolveAppEntry({
    authLoading,
    isAuthenticated,
    path: pathname,
    publicAccess,
  });

  return {
    publicAccess,
    publicRouteState,
    entry,
  };
}

describe("appRouting integration", () => {
  it("resuelve /document/:token como public sign + visado/document", () => {
    const result = resolveRouteScenario({
      pathname: "/document/abc123",
      isAuthenticated: false,
    });

    expect(result.publicAccess.isPublicSigningAccess).toBe(true);
    expect(result.publicAccess.isDocumentTokenPath).toBe(true);
    expect(result.publicRouteState.effectivePublicModeFromUrl).toBe("visado");
    expect(result.publicRouteState.effectiveTokenKindFromUrl).toBe("document");
    expect(result.entry.screen).toBe("public-sign");
  });

  it("resuelve /verificar como public verification", () => {
    const result = resolveRouteScenario({
      pathname: "/verificar",
      isAuthenticated: false,
    });

    expect(result.publicAccess.isPublicVerificationAccess).toBe(true);
    expect(result.entry.screen).toBe("public-verification");
  });

  it("resuelve /login como login si no hay sesión", () => {
    const result = resolveRouteScenario({
      pathname: "/login",
      isAuthenticated: false,
    });

    expect(result.publicAccess.isAnyPublicAccess).toBe(false);
    expect(result.entry.screen).toBe("login");
  });

  it("resuelve root de subdominio firmar con token como acceso público", () => {
    const result = resolveRouteScenario({
      pathname: "/",
      search: "?token=tok123",
      isAuthenticated: false,
      isSigningPortal: true,
    });

    expect(result.publicAccess.isPublicSigningAccess).toBe(true);
    expect(result.publicAccess.tokenFromUrl).toBe("tok123");
    expect(result.entry.screen).toBe("public-sign");
  });
});
// src/App.jsx
import { useState, useEffect, useCallback } from "react";
import "./App.css";
import { Sidebar } from "./components/Sidebar";
import { DetailView } from "./components/DetailView";
import { ListHeader } from "./components/ListHeader";
import { DocumentRow } from "./components/DocumentRow";
import { DOC_STATUS, API_BASE_URL } from "./constants";
import { LoginView } from "./views/LoginView";
import { PublicSignView } from "./views/PublicSignView";
import { NewDocumentForm } from "./views/NewDocumentForm";
import { UsersAdminView } from "./views/UsersAdminView";
import { DashboardView } from "./views/DashboardView";
import { VerificationView } from "./views/VerificationView";
import { CompaniesAdminView } from "./views/CompaniesAdminView";
import { StatusAdminView } from "./views/StatusAdminView";
import { AuditLogsView } from "./views/AuditLogsView";
import { AuthLogsView } from "./views/AuthLogsView";
import { getSubdomain } from "./utils/subdomain";
import RemindersConfigView from "./views/RemindersConfigView";
import EmailMetricsView from "./views/EmailMetricsView";
import { useSocket } from "./hooks/useSocket";
import PricingView from "./views/PricingView";
import ProfileView from "./views/ProfileView";
import TemplatesView from "./views/TemplatesView";
import ForgotPasswordView from "./views/ForgotPasswordView";
import ResetPasswordView from "./views/ResetPasswordView";
import CompanyAnalyticsView from "./views/CompanyAnalyticsView";
import OnboardingWizard from "./components/Onboarding/OnboardingWizard";
import ProductTour from "./components/Onboarding/ProductTour";
import RegisterView from "./views/RegisterView";
import api from "./api/client";

/* ========= Helpers de rol ========= */

function isSuperAdmin(user) {
  return user?.role === "SUPER_ADMIN";
}
function isGlobalAdmin(user) {
  return user?.role === "ADMIN_GLOBAL";
}
function isCompanyAdmin(user) {
  return user?.role === "ADMIN";
}
function isAnyAdmin(user) {
  return isSuperAdmin(user) || isGlobalAdmin(user) || isCompanyAdmin(user);
}

/* ========= Helpers RUN ========= */

function formatRun(value) {
  let clean = (value || "").replace(/[^0-9kK]/g, "");
  if (!clean) return "";
  const MAX_LEN = 10;
  if (clean.length > MAX_LEN) clean = clean.slice(0, MAX_LEN);
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (!body) return dv;
  return `${formattedBody}-${dv}`;
}

function formatRunDoc(value) {
  let clean = (value || "").replace(/[^0-9kK]/g, "");
  if (clean.length === 0) return "";
  if (clean.length > 10) clean = clean.slice(0, 10);
  if (clean.length <= 1) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!body) return dv;

  return body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "-" + dv;
}

/* ========= Component ========= */

function App() {
  const subdomain = getSubdomain();
  const isVerificationPortal = subdomain === "verificar";
  const isSigningPortal = subdomain === "firmar";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailMode, setIsEmailMode] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [view, setView] = useState("list");

  const [formErrors, setFormErrors] = useState({});
  const [tipoTramite, setTipoTramite] = useState("propio");

  const [token, setToken] = useState(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem("token") || "" : ""
  );
  const [user, setUser] = useState(() => {
    try {
      return typeof localStorage !== "undefined"
        ? JSON.parse(localStorage.getItem("user") || "null")
        : null;
    } catch {
      return null;
    }
  });

  // === Onboarding ===
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [runProductTour, setRunProductTour] = useState(false);

  const [loadingDocs, setLoadingDocs] = useState(false);
  const [errorDocs, setErrorDocs] = useState("");
  const [docs, setDocs] = useState([]);

  const [showVisador, setShowVisador] = useState(false);
  const [extraSigners, setExtraSigners] = useState([]);

  const [sort, setSort] = useState("title_asc");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);

  const [publicSignDoc, setPublicSignDoc] = useState(null);
  const [publicSignError, setPublicSignError] = useState("");
  const [publicSignLoading, setPublicSignLoading] = useState(false);
  const [publicSignToken, setPublicSignToken] = useState("");
  const [publicSignPdfUrl, setPublicSignPdfUrl] = useState("");
  const [publicSignMode, setPublicSignMode] = useState(null);

  const [firmanteRunValue, setFirmanteRunValue] = useState("");
  const [empresaRutValue, setEmpresaRutValue] = useState("");

  const apiRoot = API_BASE_URL;

  // WebSocket para notificaciones en tiempo real
  const socket = useSocket(token);

  /* =============================== */
  /* CARGA DE DOCUMENTOS             */
  /* =============================== */

  const cargarDocs = useCallback(
    async (sortParam = sort) => {
      if (!token) return;
      setLoadingDocs(true);
      setErrorDocs("");

      try {
        const res = await api.get("/docs", {
          params: { sort: sortParam },
        });

        const data = res.data;
        setDocs(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Fallo al cargar documentos:", err);
        const msg =
          err.response?.data?.message ||
          err.message ||
          "No se pudieron cargar los documentos. Intenta nuevamente.";
        setErrorDocs(msg);
      } finally {
        setLoadingDocs(false);
      }
    },
    [sort, token]
  );

  // WebSocket listeners
  useEffect(() => {
    if (!token) return;

    const handleSent = (data) => {
      console.log("📡 Documento enviado:", data);
      alert(`✅ Documento enviado: ${data.titulo}`);
      cargarDocs();
    };

    const handleSigned = (data) => {
      console.log("📡 Documento firmado:", data);
      alert(`✅ Documento firmado: ${data.titulo}`);
      cargarDocs();
    };

    socket.on("document:sent", handleSent);
    socket.on("document:signed", handleSigned);

    return () => {
      socket.off("document:sent", handleSent);
      socket.off("document:signed", handleSigned);
    };
  }, [token, socket, cargarDocs]);

// Cargar URL de PDF para la vista de detalle
useEffect(() => {
  if (!selectedDoc?.id) {
    setPdfUrl(null);
    return;
  }

  let objectUrl;

  (async () => {
    try {
      const res = await api.get(`/documents/${selectedDoc.id}/preview`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);
    } catch (err) {
      console.error("Error preparando URL de PDF:", err);
      setPdfUrl(null);
    }
  })();

  return () => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  };
}, [selectedDoc?.id]);

  /* =============================== */
  /* FIRMA / VISADO PÚBLICO          */
  /* =============================== */

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

  /* =============================== */
  /* RUTAS PÚBLICAS (sin login)      */
  /* =============================== */

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
        setView("public-sign");
        setPublicSignToken(tokenUrl);
        setPublicSignMode(isFirmaPublicaPath ? modeUrl || null : null);
        cargarFirmaPublica(tokenUrl);
        return;
      }

      if (isVerificationPublic) {
        setView("verification");
        return;
      }
    };

    syncViewWithLocation();
    window.addEventListener("popstate", syncViewWithLocation);
    return () => window.removeEventListener("popstate", syncViewWithLocation);
  }, [isVerificationPortal, isSigningPortal, cargarFirmaPublica]);

  // Carga inicial de documentos cuando estás en la vista de lista
  useEffect(() => {
    if (!token) return;
    if (view !== "list") return;
    cargarDocs();
  }, [token, view, sort, cargarDocs]);

  /* =============================== */
  /* LOGIN                           */
  /* =============================== */

  async function handleLogin(e) {
    e.preventDefault();
    setIsLoggingIn(true);
    setMessage("Conectando con el servidor seguro...");

    const inputVal = identifier.trim();
    const isEmail = inputVal.includes("@");

    const cleanValue = isEmail
      ? inputVal.toLowerCase()
      : inputVal.replace(/[^0-9kK]/g, "").toUpperCase();

    if (!isEmail && cleanValue.length < 2) {
      setMessage("❌ El RUT ingresado no es válido");
      setIsLoggingIn(false);
      return;
    }

    if (import.meta.env.DEV) {
      console.log("[LOGIN] payload:", { identifier: cleanValue, isEmail });
    }

    try {
      const res = await api.post("/auth/login", {
        identifier: cleanValue,
        password,
      });

      const data = res.data;
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setMessage("Acceso concedido");
      setView("list");
      checkOnboarding();
    } catch (err) {
      console.error("[LOGIN ERROR]", err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Error de conexión, intenta nuevamente.";
      setMessage("❌ " + msg);
    } finally {
      setIsLoggingIn(false);
    }
  }

  /* =============================== */
  /* ACCIONES: FIRMAR / VISAR ...    */
  /* =============================== */

  async function manejarAccionDocumento(id, accion, extraData = {}) {
    if (accion === "ver") {
      const doc = docs.find((d) => d.id === id);
      if (!doc) {
        alert("No se encontró el documento.");
        return;
      }

      try {
        const res = await api.get(`/docs/${doc.id}/pdf`);
        const data = res.data;
        if (!data || !data.url) {
          throw new Error("No se pudo obtener el PDF");
        }
        window.open(data.url, "_blank", "noopener,noreferrer");
      } catch (err) {
        console.error("Error abriendo PDF:", err);
        const msg =
          err.response?.data?.message ||
          err.message ||
          "No se pudo abrir el PDF";
        alert("❌ " + msg);
      }
      return;
    }

    try {
      let body = undefined;

      if (accion === "rechazar") {
        body = { motivo: extraData.motivo };
      }

      const res = await api.post(
        `/docs/${id}/${accion}`,
        body ? body : undefined
      );

      const data = res.data;

      if (accion === "firmar") {
        alert("✅ Documento firmado correctamente");
      } else if (accion === "visar") {
        alert("✅ Documento visado correctamente");
      } else if (accion === "rechazar") {
        alert("✅ Documento rechazado correctamente");
      } else if (data?.message) {
        alert("✅ " + data.message);
      }

      await cargarDocs();
      setView("list");
      setSelectedDoc(null);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudo procesar la acción";
      alert("❌ " + msg);
    }
  }

  /* =============================== */
  /* SESIÓN                          */
  /* =============================== */

  const logout = () => {
    localStorage.clear();
    setToken("");
    setUser(null);
    window.location.reload();
  };

  const handleTestError = () => {
    throw new Error("Frontend test error");
  };

  // === Onboarding: consulta estado ===
const checkOnboarding = useCallback(async () => {
  if (!token) return;
  try {
    setCheckingOnboarding(true);
    const res = await api.get("/onboarding/status");
    const data = res.data;
    if (data?.needsOnboarding) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  } catch (err) {
    console.error("[ONBOARDING CHECK] Error:", err.message);
    // Fallback: no mostrar onboarding si falla
    setShowOnboarding(false);
  } finally {
    setCheckingOnboarding(false);
  }
}, [token]);

  const handleOnboardingCompleted = () => {
    setShowOnboarding(false);
    setRunProductTour(true);
  };

  const handleOnboardingSkipped = () => {
    setShowOnboarding(false);
    setRunProductTour(false);
  };

  useEffect(() => {
    if (token) {
      checkOnboarding();
    }
  }, [token, checkOnboarding]);

  /* =============================== */
  /* MODO DE VISTA (RUTAS)           */
  /* =============================== */

  const pathname = window.location.pathname;

  let mode = "app";

  if (!token && pathname === "/forgot-password") {
    return <ForgotPasswordView />;
  }

  if (!token && pathname === "/reset-password") {
    return <ResetPasswordView />;
  }

  if (!token && pathname === "/register") {
    return <RegisterView />;
  }

  if (isVerificationPortal) {
    mode = "verification-portal";
  } else if (isSigningPortal) {
    mode = "signing-portal";
  } else if (!isVerificationPortal && pathname === "/verificar") {
    mode = "verification-route";
  } else if (view === "public-sign") {
    mode = "public-sign";
  } else if (view === "verification") {
    mode = "verification-view";
  }

  /* =============================== */
  /* RENDER SEGÚN MODO               */
  /* =============================== */

  if (
    mode === "verification-portal" ||
    mode === "verification-route" ||
    mode === "verification-view"
  ) {
    return <VerificationView API_URL={apiRoot} />;
  }

  if (mode === "signing-portal" || mode === "public-sign") {
    return (
      <PublicSignView
        publicSignLoading={publicSignLoading}
        publicSignError={publicSignError}
        publicSignDoc={publicSignDoc}
        publicSignPdfUrl={publicSignPdfUrl}
        publicSignToken={publicSignToken}
        publicSignMode={publicSignMode}
        API_URL={apiRoot}
        cargarFirmaPublica={cargarFirmaPublica}
      />
    );
  }

  if (!token) {
    const displayIdentifier =
      isEmailMode || identifier.includes("@")
        ? identifier
        : formatRun(identifier);

    if (pathname === "/register") {
      return <RegisterView />;
    }

    return (
      <LoginView
        identifier={displayIdentifier}
        setIdentifier={(value) => {
          if (/[a-zA-Z]/.test(value) || value.includes("@")) {
            setIsEmailMode(true);
            setIdentifier(value);
          } else {
            setIsEmailMode(false);
            const clean = value.replace(/[^0-9kK]/g, "");
            setIdentifier(clean);
          }
        }}
        password={password}
        setPassword={setPassword}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        showHelp={showHelp}
        setShowHelp={setShowHelp}
        message={message}
        isLoggingIn={isLoggingIn}
        handleLogin={handleLogin}
      />
    );
  }

  /* =============================== */
  /* VISTA DETALLE DOCUMENTO         */
  /* =============================== */

  if (view === "detail" && selectedDoc) {
    const requiereVisado = selectedDoc.requires_visado === true;

    const puedeVisar =
      requiereVisado && selectedDoc.status === DOC_STATUS.PENDIENTE;

    const puedeFirmar =
      (!requiereVisado && selectedDoc.status === DOC_STATUS.PENDIENTE) ||
      (requiereVisado && selectedDoc.status === DOC_STATUS.VISADO);

    const puedeRechazar = ![
      DOC_STATUS.FIRMADO,
      DOC_STATUS.RECHAZADO,
    ].includes(selectedDoc.status);

    return (
      <DetailView
        selectedDoc={selectedDoc}
        pdfUrl={pdfUrl}
        puedeFirmar={puedeFirmar}
        puedeVisar={puedeVisar}
        puedeRechazar={puedeRechazar}
        manejarAccionDocumento={manejarAccionDocumento}
        setView={setView}
        setSelectedDoc={setSelectedDoc}
        logout={logout}
        currentUser={user}
      />
    );
  }

  /* =============================== */
  /* LISTA DOCUMENTOS + OTRAS VISTAS */
  /* =============================== */

  const docsFiltrados = docs.filter((d) => {
    const esPendiente =
      d.status === DOC_STATUS.PENDIENTE ||
      d.status === DOC_STATUS.PENDIENTE_VISADO ||
      d.status === DOC_STATUS.PENDIENTE_FIRMA;

    if (statusFilter === "PENDIENTES" && !esPendiente) return false;
    if (statusFilter === "VISADOS" && d.status !== DOC_STATUS.VISADO)
      return false;
    if (statusFilter === "FIRMADOS" && d.status !== DOC_STATUS.FIRMADO)
      return false;
    if (statusFilter === "RECHAZADOS" && d.status !== DOC_STATUS.RECHAZADO)
      return false;

    if (search.trim() !== "") {
      const q = search.toLowerCase();
      const titulo = (d.title || "").toLowerCase();
      const empresa = (d.destinatario_nombre || "").toLowerCase();
      if (!titulo.includes(q) && !empresa.includes(q)) return false;
    }

    return true;
  });

  const pendientes = docs.filter(
    (d) =>
      d.status === DOC_STATUS.PENDIENTE ||
      d.status === DOC_STATUS.PENDIENTE_VISADO ||
      d.status === DOC_STATUS.PENDIENTE_FIRMA
  ).length;

  const visados = docs.filter((d) => d.status === DOC_STATUS.VISADO).length;
  const firmados = docs.filter((d) => d.status === DOC_STATUS.FIRMADO).length;
  const rechazados = docs.filter(
    (d) => d.status === DOC_STATUS.RECHAZADO
  ).length;

  const totalFiltrado = docsFiltrados.length;
  const totalPaginas = Math.ceil(totalFiltrado / pageSize) || 1;
  const docsPaginados = docsFiltrados.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const anyAdmin = isAnyAdmin(user);
  const isGlobalAdminOrOwner =
    !!user &&
    (user.role === "SUPER_ADMIN" ||
      user.role === "ADMIN_GLOBAL" ||
      user.id === 7);

  return (
    <div className="dashboard-root">
      {showOnboarding && (
        <OnboardingWizard
          onCompleted={handleOnboardingCompleted}
          onSkipped={handleOnboardingSkipped}
        />
      )}

      <div className="dashboard-layout">
        <Sidebar
          user={user}
          docs={docs}
          pendientes={pendientes}
          view={view}
          setView={setView}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          logout={logout}
          isAnyAdmin={anyAdmin}
        />

        <div className="content-body">
          <ProductTour
            tourId="dashboard_principal"
            run={runProductTour}
            onFinish={() => setRunProductTour(false)}
          />

          {view === "list" && (
            <ListHeader
              sort={sort}
              setSort={(value) => {
                setSort(value);
                setPage(1);
                cargarDocs(value);
              }}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              search={search}
              setSearch={setSearch}
              totalFiltrado={totalFiltrado}
              pendientes={pendientes}
              visados={visados}
              firmados={firmados}
              rechazados={rechazados}
              onSync={cargarDocs}
            />
          )}

          {view === "list" && (
            <>
              <div className="hero-dashboard">
                <div className="hero-dashboard-inner">
                  <h1 className="hero-dashboard-title">
                    Gestiona todas tus firmas digitales en un solo lugar
                  </h1>
                  <p className="hero-dashboard-text">
                    Envía contratos, actas y documentos legales para firma
                    electrónica avanzada en minutos. Sigue el estado en tiempo
                    real y mantén un historial completo de cada trámite.
                  </p>
                  <div className="hero-dashboard-actions">
                    <button
                      type="button"
                      className="btn-main btn-primary"
                      onClick={() => setView("upload")}
                      style={{ paddingInline: 22 }}
                    >
                      + Nuevo documento para firma
                    </button>
                    <button
                      type="button"
                      className="btn-main"
                      onClick={cargarDocs}
                      style={{
                        backgroundColor: "#020617",
                        color: "#e5e7eb",
                        border: "1px solid #1e293b",
                        paddingInline: 22,
                      }}
                    >
                      Ver documentos enviados
                    </button>
                  </div>
                </div>
              </div>

              {loadingDocs ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  <div style={{ marginBottom: 12, fontWeight: 600 }}>
                    Cargando tu bandeja de documentos…
                  </div>
                  <p
                    style={{
                      fontSize: "0.9rem",
                      color: "#9ca3af",
                      marginTop: 4,
                    }}
                  >
                    Esto puede tardar unos segundos.
                  </p>
                  <div className="spinner" />
                </div>
              ) : errorDocs ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "#b91c1c",
                  }}
                >
                  <p style={{ marginBottom: 8, fontWeight: 700 }}>
                    Ocurrió un problema al cargar la bandeja.
                  </p>
                  <p
                    style={{
                      marginBottom: 16,
                      fontSize: "0.9rem",
                      color: "#b91c1c",
                    }}
                  >
                    {errorDocs ||
                      "Por favor, revisa tu conexión e inténtalo nuevamente."}
                  </p>
                  <button className="btn-main btn-primary" onClick={cargarDocs}>
                    Reintentar carga
                  </button>
                </div>
              ) : docsPaginados.length === 0 ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  <h3 style={{ marginBottom: 8 }}>
                    No encontramos documentos para mostrar.
                  </h3>
                  <p
                    style={{
                      marginBottom: 4,
                      fontSize: "0.9rem",
                      color: "#94a3b8",
                    }}
                  >
                    Puede que no existan documentos con los filtros actuales.
                  </p>
                  <p
                    style={{
                      marginBottom: 16,
                      fontSize: "0.9rem",
                      color: "#94a3b8",
                    }}
                  >
                    Ajusta los filtros o crea un nuevo flujo de firma digital.
                  </p>
                  <button
                    className="btn-main"
                    onClick={() => setView("upload")}
                    style={{
                      background: "#e2e8f0",
                      color: "#1e293b",
                    }}
                  >
                    Crear nuevo trámite
                  </button>
                </div>
              ) : (
                <>
                  <div className="table-wrapper">
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th>N° de contrato</th>
                          <th>Título del documento</th>
                          <th>Tipo de trámite</th>
                          <th style={{ textAlign: "center" }}>Estado actual</th>
                          <th>Firmante final</th>
                          <th style={{ textAlign: "center" }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {docsPaginados.map((d) => (
                          <DocumentRow
                            key={d.id}
                            doc={d}
                            onOpenDetail={(doc) => {
                              setSelectedDoc(doc);
                              setView("detail");
                            }}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 16,
                      fontSize: "0.85rem",
                    }}
                  >
                    <span>
                      Página {page} de {totalPaginas || 1}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn-main"
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        className="btn-main"
                        disabled={
                          page === totalPaginas || totalPaginas === 0
                        }
                        onClick={() =>
                          setPage((p) => Math.min(totalPaginas, p + 1))
                        }
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {view === "upload" && (
            <NewDocumentForm
              tipoTramite={tipoTramite}
              setTipoTramite={setTipoTramite}
              formErrors={formErrors}
              setFormErrors={setFormErrors}
              showVisador={showVisador}
              setShowVisador={setShowVisador}
              extraSigners={extraSigners}
              setExtraSigners={setExtraSigners}
              firmanteRunValue={firmanteRunValue}
              setFirmanteRunValue={setFirmanteRunValue}
              empresaRutValue={empresaRutValue}
              setEmpresaRutValue={setEmpresaRutValue}
              formatRunDoc={formatRunDoc}
              setView={setView}
              cargarDocs={cargarDocs}
            />
          )}

          {view === "users" && anyAdmin && <UsersAdminView />}

          {view === "dashboard" && anyAdmin && <DashboardView user={user} />}

          {view === "companies" && anyAdmin && (
            <CompaniesAdminView API_URL={apiRoot} />
          )}

          {view === "status" && anyAdmin && (
            <StatusAdminView API_URL={apiRoot} />
          )}

          {view === "audit-logs" && isGlobalAdminOrOwner && (
            <AuditLogsView API_URL={apiRoot} />
          )}

          {view === "auth-logs" && isGlobalAdminOrOwner && (
            <AuthLogsView API_URL={apiRoot} />
          )}

          {view === "reminders-config" && anyAdmin && <RemindersConfigView />}

          {view === "email-metrics" && anyAdmin && <EmailMetricsView />}

          {view === "pricing" && <PricingView />}

          {view === "profile" && <ProfileView />}

          {view === "templates" && anyAdmin && <TemplatesView />}

          {view === "company-analytics" && anyAdmin && (
            <CompanyAnalyticsView />
          )}

          {import.meta.env.MODE !== "production" && (
            <button onClick={handleTestError}>Probar error Sentry</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

// src/App.jsx
import { useEffect, useMemo, useState } from "react";
import "./App.css";

import { Sidebar } from "./components/Sidebar";
import { DetailView } from "./components/DetailView";
import { ListHeader } from "./components/ListHeader";
import { DocumentRow } from "./components/DocumentRow";
import OnboardingWizard from "./components/Onboarding/OnboardingWizard";
import ProductTour from "./components/Onboarding/ProductTour";

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
import RemindersConfigView from "./views/RemindersConfigView";
import EmailMetricsView from "./views/EmailMetricsView";
import PricingView from "./views/PricingView";
import ProfileView from "./views/ProfileView";
import TemplatesView from "./views/TemplatesView";
import ForgotPasswordView from "./views/ForgotPasswordView";
import ResetPasswordView from "./views/ResetPasswordView";
import CompanyAnalyticsView from "./views/CompanyAnalyticsView";
import RegisterView from "./views/RegisterView";

import { getSubdomain } from "./utils/subdomain";
import {
  getPath,
  getNavigationEventName,
  navigateTo,
  replaceTo,
} from "./utils/router";
import { isAnyAdmin, canViewAuditLogs } from "./utils/permissions";

import { useSocket } from "./hooks/useSocket";
import { useOnboardingStatus } from "./hooks/useOnboardingStatus";
import { usePublicSign } from "./hooks/usePublicSign";
import { useDocuments } from "./hooks/useDocuments";
import { useToast } from "./hooks/useToast";
import { useAuth } from "./hooks/useAuth";

const ROUTE_MAP = {
  "/": "list",
  "/documents": "list",
  "/new-document": "upload",
  "/users": "users",
  "/dashboard": "dashboard",
  "/companies": "companies",
  "/status": "status",
  "/audit-logs": "audit-logs",
  "/auth-logs": "auth-logs",
  "/reminders-config": "reminders-config",
  "/email-metrics": "email-metrics",
  "/pricing": "pricing",
  "/profile": "profile",
  "/templates": "templates",
  "/company-analytics": "company-analytics",
};

const VIEW_TO_PATH = {
  list: "/documents",
  upload: "/new-document",
  users: "/users",
  dashboard: "/dashboard",
  companies: "/companies",
  status: "/status",
  "audit-logs": "/audit-logs",
  "auth-logs": "/auth-logs",
  "reminders-config": "/reminders-config",
  "email-metrics": "/email-metrics",
  pricing: "/pricing",
  profile: "/profile",
  templates: "/templates",
  "company-analytics": "/company-analytics",
};

function getProtectedViewFromPath(path) {
  return ROUTE_MAP[path] || "list";
}

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
  if (!clean) return "";
  if (clean.length > 10) clean = clean.slice(0, 10);
  if (clean.length <= 1) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  if (!body) return dv;
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}

function App() {
  const subdomain = getSubdomain();
  const isVerificationPortal = subdomain === "verificar";
  const isSigningPortal = subdomain === "firmar";

  const [path, setPath] = useState(() => getPath());
  const [view, setView] = useState(() => getProtectedViewFromPath(getPath()));

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [formErrors, setFormErrors] = useState({});
  const [tipoTramite, setTipoTramite] = useState("propio");
  const [showVisador, setShowVisador] = useState(false);
  const [extraSigners, setExtraSigners] = useState([]);
  const [firmanteRunValue, setFirmanteRunValue] = useState("");
  const [empresaRutValue, setEmpresaRutValue] = useState("");

  const apiRoot = API_BASE_URL;

  const { user, token, login, logout, authLoading, isAuthenticated } = useAuth();
  const { addToast } = useToast();

  const {
    loadingDocs,
    errorDocs,
    docs,
    sort,
    setSort,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    page,
    setPage,
    selectedDoc,
    setSelectedDoc,
    pdfUrl,
    cargarDocs,
    manejarAccionDocumento,
    docsFiltrados,
    docsPaginados,
    pendientes,
    visados,
    firmados,
    rechazados,
    totalFiltrado,
    totalPaginas,
  } = useDocuments(token);

  const {
    checkingOnboarding,
    showOnboarding,
    runProductTour,
    setRunProductTour,
    checkOnboarding,
    handleOnboardingCompleted,
    handleOnboardingSkipped,
  } = useOnboardingStatus(token);

  const {
    publicSignDoc,
    publicSignError,
    publicSignLoading,
    publicSignToken,
    publicSignPdfUrl,
    publicSignMode,
    publicView,
    cargarFirmaPublica,
  } = usePublicSign({
    apiRoot,
    isSigningPortal,
    isVerificationPortal,
  });

  const {
    connected: socketConnected,
    on: socketOn,
    off: socketOff,
  } = useSocket(token);

  const safeDocs = useMemo(() => (Array.isArray(docs) ? docs : []), [docs]);
  const safeDocsFiltrados = useMemo(
    () => (Array.isArray(docsFiltrados) ? docsFiltrados : []),
    [docsFiltrados]
  );
  const safeDocsPaginados = useMemo(
    () => (Array.isArray(docsPaginados) ? docsPaginados : []),
    [docsPaginados]
  );

  const safePendientes = Number.isFinite(pendientes) ? pendientes : 0;
  const safeVisados = Number.isFinite(visados) ? visados : 0;
  const safeFirmados = Number.isFinite(firmados) ? firmados : 0;
  const safeRechazados = Number.isFinite(rechazados) ? rechazados : 0;
  const safeTotalFiltrado = Number.isFinite(totalFiltrado) ? totalFiltrado : 0;
  const safeTotalPaginas =
    Number.isFinite(totalPaginas) && totalPaginas > 0 ? totalPaginas : 1;

  const anyAdmin = isAnyAdmin(user);
  const canAudit = !!user && canViewAuditLogs(user);

  useEffect(() => {
    const syncPath = () => {
      const nextPath = getPath();
      setPath(nextPath);

      if (!isAuthenticated) return;

      setView((currentView) => {
        if (currentView === "detail" && selectedDoc) return currentView;
        return getProtectedViewFromPath(nextPath);
      });
    };

    const navigationEvent = getNavigationEventName();

    window.addEventListener("popstate", syncPath);
    window.addEventListener(navigationEvent, syncPath);

    return () => {
      window.removeEventListener("popstate", syncPath);
      window.removeEventListener(navigationEvent, syncPath);
    };
  }, [isAuthenticated, selectedDoc]);

  useEffect(() => {
    if (authLoading) return;

    const publicAuthPaths = ["/login", "/forgot-password", "/reset-password", "/register"];

    if (!isAuthenticated && !publicAuthPaths.includes(path)) {
      setView("list");
      setSelectedDoc(null);
      replaceTo("/login");
      return;
    }

    if (isAuthenticated && publicAuthPaths.includes(path)) {
      replaceTo("/documents");
    }
  }, [authLoading, isAuthenticated, path]);

  useEffect(() => {
    if (!token) return;
    if (typeof socketOn !== "function" || typeof socketOff !== "function") return;

    const handleSent = (data) => {
      addToast({
        type: "success",
        title: "Documento enviado",
        message: data?.titulo
          ? `"${data.titulo}" se envió correctamente`
          : "El documento se envió correctamente",
      });
      cargarDocs();
    };

    const handleSigned = (data) => {
      addToast({
        type: "success",
        title: "Documento firmado",
        message: data?.titulo
          ? `"${data.titulo}" se firmó correctamente`
          : "El documento se firmó correctamente",
      });
      cargarDocs();
    };

    socketOn("document:sent", handleSent);
    socketOn("document:signed", handleSigned);

    return () => {
      socketOff("document:sent", handleSent);
      socketOff("document:signed", handleSigned);
    };
  }, [token, socketOn, socketOff, cargarDocs, addToast]);

  const handleLogout = useMemo(
    () => () => {
      setSelectedDoc(null);
      setView("list");
      logout({ redirectTo: "/login", replace: true });
    },
    [logout]
  );

  const handleNavigateProtected = (nextView) => {
    const nextPath = VIEW_TO_PATH[nextView] || "/documents";

    if (nextView === "list") {
      setPage(1);
    }

    setSelectedDoc(null);
    setView(nextView);
    navigateTo(nextPath);
  };

  const handleOpenDetail = (doc) => {
    setSelectedDoc(doc);
    setView("detail");
  };

  const handleBackToList = () => {
    setSelectedDoc(null);
    handleNavigateProtected("list");
  };

  const handleAfterCreateDocument = async () => {
    await cargarDocs();
    handleNavigateProtected("list");
  };

  const handleTestError = () => {
    throw new Error("Frontend test error");
  };

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

    try {
      await login({
        identifier: cleanValue,
        password,
        rememberMe,
      });

      setMessage("Acceso concedido");
      setPassword("");
      setView("list");
      setSelectedDoc(null);
      replaceTo("/documents");

      if (typeof checkOnboarding === "function") {
        checkOnboarding();
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Error de conexión, intenta nuevamente.";

      setMessage(`❌ ${msg}`);

      addToast({
        type: "error",
        title: "No se pudo iniciar sesión",
        message: msg,
      });
    } finally {
      setIsLoggingIn(false);
    }
  }

  if (authLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        Cargando sesión...
      </div>
    );
  }

  if (publicView === "verification") {
    return <VerificationView API_URL={apiRoot} />;
  }

  if (publicView === "public-sign") {
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

  if (!isAuthenticated && path === "/forgot-password") return <ForgotPasswordView />;
  if (!isAuthenticated && path === "/reset-password") return <ResetPasswordView />;
  if (!isAuthenticated && path === "/register") return <RegisterView />;

  if (!isAuthenticated) {
    const displayIdentifier =
      isEmailMode || identifier.includes("@") ? identifier : formatRun(identifier);

    return (
      <LoginView
        identifier={displayIdentifier}
        setIdentifier={(value) => {
          if (/[a-zA-Z]/.test(value) || value.includes("@")) {
            setIsEmailMode(true);
            setIdentifier(value);
          } else {
            setIsEmailMode(false);
            setIdentifier(value.replace(/[^0-9kK]/g, ""));
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
        rememberMe={rememberMe}
        setRememberMe={setRememberMe}
      />
    );
  }

  if (view === "detail" && selectedDoc) {
    const requiereVisado = selectedDoc.requires_visado === true;

    const puedeVisar =
      requiereVisado && selectedDoc.status === DOC_STATUS.PENDIENTE;

    const puedeFirmar =
      (!requiereVisado && selectedDoc.status === DOC_STATUS.PENDIENTE) ||
      (requiereVisado && selectedDoc.status === DOC_STATUS.VISADO);

    const puedeRechazar = ![DOC_STATUS.FIRMADO, DOC_STATUS.RECHAZADO].includes(
      selectedDoc.status
    );

    return (
      <DetailView
        selectedDoc={selectedDoc}
        pdfUrl={pdfUrl}
        puedeFirmar={puedeFirmar}
        puedeVisar={puedeVisar}
        puedeRechazar={puedeRechazar}
        manejarAccionDocumento={manejarAccionDocumento}
        setView={handleBackToList}
        setSelectedDoc={setSelectedDoc}
        logout={handleLogout}
        currentUser={user}
      />
    );
  }

  const renderProtectedView = () => {
    if (view === "list") {
      return (
        <>
          <ListHeader
            sort={sort}
            setSort={(value) => {
              setSort(value);
              setPage(1);
              cargarDocs(value);
            }}
            statusFilter={statusFilter}
            setStatusFilter={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            search={search}
            setSearch={(value) => {
              setSearch(value);
              setPage(1);
            }}
            totalFiltrado={safeTotalFiltrado}
            pendientes={safePendientes}
            visados={safeVisados}
            firmados={safeFirmados}
            rechazados={safeRechazados}
            onSync={cargarDocs}
          />

          <div className="inbox-header-card">
            <div className="inbox-header-main">
              <h2 className="inbox-title">Documentos recientes</h2>
              <p className="inbox-subtitle">
                Revisa estados, abre contratos y gestiona tus trámites desde esta bandeja.
              </p>
            </div>

            <div className="inbox-header-actions">
              <button
                type="button"
                className="btn-main btn-primary"
                onClick={() => handleNavigateProtected("upload")}
              >
                + Nuevo documento
              </button>

              <button
                type="button"
                className="btn-main btn-ghost"
                onClick={cargarDocs}
              >
                Actualizar bandeja
              </button>
            </div>
          </div>

          {loadingDocs ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
              <div style={{ marginBottom: 12, fontWeight: 600 }}>
                Cargando tu bandeja de documentos…
              </div>
              <p style={{ fontSize: "0.9rem", color: "#9ca3af", marginTop: 4 }}>
                Esto puede tardar unos segundos.
              </p>
              <div className="spinner" />
            </div>
          ) : errorDocs ? (
            <div style={{ padding: 40, textAlign: "center", color: "#b91c1c" }}>
              <p style={{ marginBottom: 8, fontWeight: 700 }}>
                Ocurrió un problema al cargar la bandeja.
              </p>
              <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#b91c1c" }}>
                {errorDocs || "Por favor, revisa tu conexión e inténtalo nuevamente."}
              </p>
              <button className="btn-main btn-primary" onClick={cargarDocs}>
                Reintentar carga
              </button>
            </div>
          ) : safeDocsFiltrados.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
              <h3 style={{ marginBottom: 8 }}>
                No encontramos documentos para mostrar.
              </h3>
              <p style={{ marginBottom: 4, fontSize: "0.9rem", color: "#94a3b8" }}>
                Puede que no existan documentos con los filtros actuales.
              </p>
              <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#94a3b8" }}>
                Ajusta los filtros o crea un nuevo flujo de firma digital.
              </p>
              <button
                className="btn-main"
                onClick={() => handleNavigateProtected("upload")}
                style={{ background: "#e2e8f0", color: "#1e293b" }}
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
                      <th className="col-title">Contrato / Documento</th>
                      <th className="col-type">Tipo</th>
                      <th className="col-status" style={{ textAlign: "center" }}>
                        Estado
                      </th>
                      <th className="col-party">Firmante / Empresa</th>
                      <th className="col-actions" style={{ textAlign: "center" }}>
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeDocsPaginados.map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        doc={doc}
                        onOpenDetail={handleOpenDetail}
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
                  Página {page} de {safeTotalPaginas}
                </span>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn-main"
                    disabled={page === 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="btn-main"
                    disabled={page === safeTotalPaginas}
                    onClick={() =>
                      setPage((prev) => Math.min(safeTotalPaginas, prev + 1))
                    }
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      );
    }

    if (view === "upload") {
      return (
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
          goToList={handleAfterCreateDocument}
          cargarDocs={cargarDocs}
        />
      );
    }

    if (view === "users" && anyAdmin) return <UsersAdminView />;
    if (view === "dashboard" && anyAdmin) return <DashboardView user={user} />;
    if (view === "companies" && anyAdmin) return <CompaniesAdminView API_URL={apiRoot} />;
    if (view === "status" && anyAdmin) return <StatusAdminView API_URL={apiRoot} />;
    if (view === "audit-logs" && canAudit) return <AuditLogsView API_URL={apiRoot} />;
    if (view === "auth-logs" && canAudit) return <AuthLogsView API_URL={apiRoot} />;
    if (view === "reminders-config" && anyAdmin) return <RemindersConfigView />;
    if (view === "email-metrics" && anyAdmin) return <EmailMetricsView />;
    if (view === "pricing") return <PricingView />;
    if (view === "profile") return <ProfileView />;
    if (view === "templates" && anyAdmin) return <TemplatesView />;
    if (view === "company-analytics" && anyAdmin) return <CompanyAnalyticsView />;

    return (
      <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
        <h3 style={{ marginBottom: 8 }}>Vista no disponible</h3>
        <p style={{ marginBottom: 16 }}>
          No tienes permisos o la sección solicitada no existe.
        </p>
        <button
          type="button"
          className="btn-main btn-primary"
          onClick={() => handleNavigateProtected("list")}
        >
          Volver a documentos
        </button>
      </div>
    );
  };

  return (
    <div className="dashboard-root">
      {showOnboarding && (
        <OnboardingWizard
          onCompleted={handleOnboardingCompleted}
          onSkipped={handleOnboardingSkipped}
          checking={checkingOnboarding}
        />
      )}

      <div className="dashboard-layout">
        <Sidebar
          user={user}
          docs={safeDocs}
          pendientes={safePendientes}
          view={view}
          setView={handleNavigateProtected}
          statusFilter={statusFilter}
          setStatusFilter={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          logout={handleLogout}
          isAnyAdmin={anyAdmin}
          socketConnected={socketConnected}
        />

        <div className="content-body">
          <ProductTour
            tourId="dashboard_principal"
            run={runProductTour}
            onFinish={() => setRunProductTour(false)}
          />

          {renderProtectedView()}

          {import.meta.env.MODE !== "production" && (
            <button type="button" onClick={handleTestError}>
              Probar error Sentry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
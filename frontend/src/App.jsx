// src/App.jsx
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  lazy,
  Suspense,
} from "react";
import "./App.css";

import { Sidebar } from "./components/Sidebar";
import { DetailView } from "./components/DetailView";
import { ListHeader } from "./components/ListHeader";
import { DocumentRow } from "./components/DocumentRow";

import { DOC_STATUS, API_BASE_URL } from "./constants";

import { LoginView } from "./views/LoginView";
import { PublicSignView } from "./views/PublicSignView";
import { NewDocumentForm } from "./views/NewDocumentForm";
import { VerificationView } from "./views/VerificationView";
import ForgotPasswordView from "./views/ForgotPasswordView";
import ResetPasswordView from "./views/ResetPasswordView";
import RegisterView from "./views/RegisterView";
import ProfileView from "./views/ProfileView";

import { getSubdomain } from "./utils/subdomain";
import {
  getPath,
  getNavigationEventName,
  navigateTo,
  replaceTo,
} from "./utils/router";
import { isAnyAdmin, canViewAuditLogs } from "./utils/permissions";
import { formatRun, formatRunDoc } from "./utils/formatters";

import { useSocket } from "./hooks/useSocket";
import { useOnboardingStatus } from "./hooks/useOnboardingStatus";
import { usePublicSign } from "./hooks/usePublicSign";
import { useDocuments } from "./hooks/useDocuments";
import { useToast } from "./hooks/useToast";
import { useAuth } from "./hooks/useAuth";

const OnboardingWizardLazy = lazy(
  () => import("./components/Onboarding/OnboardingWizard")
);
const ProductTourLazy = lazy(
  () => import("./components/Onboarding/ProductTour")
);

const UsersAdminView = lazy(() => import("./views/UsersAdminView"));
const DashboardView = lazy(() => import("./views/DashboardView"));
const CompaniesAdminView = lazy(() => import("./views/CompaniesAdminView"));
const StatusAdminView = lazy(() => import("./views/StatusAdminView"));
const AuditLogsView = lazy(() => import("./views/AuditLogsView"));
const AuthLogsView = lazy(() => import("./views/AuthLogsView"));
const RemindersConfigView = lazy(
  () => import("./views/RemindersConfigView")
);
const EmailMetricsView = lazy(() => import("./views/EmailMetricsView"));
const PricingView = lazy(() => import("./views/PricingView"));
const TemplatesView = lazy(() => import("./views/TemplatesView"));
const CompanyAnalyticsView = lazy(
  () => import("./views/CompanyAnalyticsView")
);

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

const VALID_PROTECTED_VIEWS = new Set(Object.values(ROUTE_MAP));

const PUBLIC_AUTH_PATHS = new Set([
  "/login",
  "/forgot-password",
  "/reset-password",
  "/register",
]);

function getProtectedViewFromPath(path) {
  return ROUTE_MAP[path] || "list";
}

function getLocationSnapshot() {
  if (typeof window === "undefined") {
    return { pathname: "/", search: "" };
  }

  return {
    pathname: window.location.pathname || "/",
    search: window.location.search || "",
  };
}

function getPublicAccessSnapshot({
  pathname,
  search,
  isSigningPortal,
  isVerificationPortal,
}) {
  const params = new URLSearchParams(search || "");
  const token = (params.get("token") || "").trim();

  const isPublicSigningAccess =
    !!token &&
    (pathname === "/public/sign" ||
      pathname === "/firma-publica" ||
      pathname === "/consulta-publica" ||
      (isSigningPortal && pathname === "/"));

  const isPublicVerificationAccess =
    pathname === "/verificar" ||
    pathname === "/verificacion-publica" ||
    (isVerificationPortal && pathname === "/");

  return {
    tokenFromUrl: token,
    isPublicSigningAccess,
    isPublicVerificationAccess,
    isAnyPublicAccess: isPublicSigningAccess || isPublicVerificationAccess,
  };
}

function ProtectedModuleFallback() {
  return <div className="protected-fallback">Cargando módulo…</div>;
}

function SessionLoadingFallback() {
  return <div className="session-loading">Cargando sesión...</div>;
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

  const { user, token, login, logout, authLoading, isAuthenticated } =
    useAuth();
  const { addToast } = useToast();

  const locationSnapshot = useMemo(() => getLocationSnapshot(), [path]);

  const {
    tokenFromUrl,
    isPublicSigningAccess,
    isPublicVerificationAccess,
    isAnyPublicAccess,
  } = useMemo(
    () =>
      getPublicAccessSnapshot({
        pathname: locationSnapshot.pathname,
        search: locationSnapshot.search,
        isSigningPortal,
        isVerificationPortal,
      }),
    [locationSnapshot, isSigningPortal, isVerificationPortal]
  );

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
    pagination,
    totalGlobal,
    pendientesGlobal,
    visadosGlobal,
    firmadosGlobal,
    rechazadosGlobal,
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
    publicTokenKind,
    cargarFirmaPublica,
  } = usePublicSign({
    apiRoot,
    isSigningPortal,
    isVerificationPortal,
  });

  const {
    status: socketStatus,
    lastError: socketLastError,
    canRetry: socketCanRetry,
    retry: retrySocket,
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
  const safeVisadosFiltered = Number.isFinite(visados) ? visados : 0;
  const safeFirmados = Number.isFinite(firmados) ? firmados : 0;
  const safeRechazados = Number.isFinite(rechazados) ? rechazados : 0;
  const safeTotalFiltrado = Number.isFinite(totalFiltrado)
    ? totalFiltrado
    : 0;
  const safeTotalPaginas =
    Number.isFinite(totalPaginas) && totalPaginas > 0 ? totalPaginas : 1;
  const safeCurrentPage =
    Number.isFinite(pagination?.page) && pagination.page > 0
      ? pagination.page
      : 1;

  const safeTotalDocsGlobal = Number.isFinite(totalGlobal)
    ? totalGlobal
    : safeDocs.length;
  const safeTotalPendientesGlobal = Number.isFinite(pendientesGlobal)
    ? pendientesGlobal
    : safePendientes;
  const safeVisadosGlobal = Number.isFinite(visadosGlobal)
    ? visadosGlobal
    : 0;
  const safeFirmadosGlobal = Number.isFinite(firmadosGlobal)
    ? firmadosGlobal
    : 0;
  const safeRechazadosGlobal = Number.isFinite(rechazadosGlobal)
    ? rechazadosGlobal
    : 0;

  const anyAdmin = isAnyAdmin(user);
  const canAudit = !!user && canViewAuditLogs(user);

  const refreshDocs = useCallback(
    async (overrides = {}) =>
      cargarDocs({
        page,
        sort,
        statusFilter,
        search,
        force: true,
        ...overrides,
      }),
    [cargarDocs, page, sort, statusFilter, search]
  );

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
    if (isAnyPublicAccess) return;

    if (!isAuthenticated) {
      if (!PUBLIC_AUTH_PATHS.has(path)) {
        setSelectedDoc(null);
        setView("list");
        replaceTo("/login");
      }
      return;
    }

    if (PUBLIC_AUTH_PATHS.has(path)) {
      replaceTo("/documents");
    }
  }, [
    authLoading,
    isAuthenticated,
    path,
    isAnyPublicAccess,
    setSelectedDoc,
  ]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (view === "detail") return;

    const expectedView = getProtectedViewFromPath(path);

    if (VALID_PROTECTED_VIEWS.has(expectedView) && view !== expectedView) {
      setView(expectedView);
      return;
    }

    if (!VALID_PROTECTED_VIEWS.has(view)) {
      setSelectedDoc(null);
      setView("list");
      replaceTo("/documents");
    }
  }, [view, path, isAuthenticated, setSelectedDoc]);

  useEffect(() => {
    if (!token) return;
    if (typeof socketOn !== "function" || typeof socketOff !== "function") {
      return;
    }

    const handleSent = (data) => {
      addToast({
        type: "success",
        title: "Documento enviado",
        message: data?.titulo
          ? `"${data.titulo}" se envió correctamente.`
          : "El documento se envió correctamente.",
      });

      refreshDocs({ page: 1 });
    };

    const handleSigned = (data) => {
      addToast({
        type: "success",
        title: "Documento firmado",
        message: data?.titulo
          ? `"${data.titulo}" se firmó correctamente.`
          : "El documento se firmó correctamente.",
      });

      refreshDocs({ page: 1 });
    };

    socketOn("document:sent", handleSent);
    socketOn("document:signed", handleSigned);

    return () => {
      socketOff("document:sent", handleSent);
      socketOff("document:signed", handleSigned);
    };
  }, [token, socketOn, socketOff, addToast, refreshDocs]);

  useEffect(() => {
    if (!socketLastError) return;

    if (socketStatus === "error" || socketStatus === "disconnected") {
      addToast({
        type: "error",
        title: "Problema con la conexión en tiempo real",
        message: socketLastError,
      });
    }
  }, [socketStatus, socketLastError, addToast]);

  const handleLogout = useCallback(() => {
    setSelectedDoc(null);
    setView("list");
    logout({ redirectTo: "/login", replace: true });
  }, [logout, setSelectedDoc]);

  const handleNavigateProtected = useCallback(
    (nextView) => {
      const nextPath = VIEW_TO_PATH[nextView] || "/documents";

      if (nextView === "list") {
        setPage(1);
      }

      setSelectedDoc(null);
      setView(nextView);
      navigateTo(nextPath);
    },
    [setPage, setSelectedDoc]
  );

  const handleOpenDetail = useCallback(
    (doc) => {
      setSelectedDoc(doc);
      setView("detail");
    },
    [setSelectedDoc]
  );

  const handleBackToList = useCallback(() => {
    setSelectedDoc(null);
    handleNavigateProtected("list");
  }, [handleNavigateProtected, setSelectedDoc]);

  const handleAfterCreateDocument = useCallback(async () => {
    setPage(1);
    await refreshDocs({ page: 1 });
    handleNavigateProtected("list");
  }, [refreshDocs, handleNavigateProtected, setPage]);

  const handleTestError = useCallback(() => {
    throw new Error("Frontend test error");
  }, []);

  const handleLogin = useCallback(
    async (e) => {
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
    },
    [
      identifier,
      password,
      rememberMe,
      login,
      checkOnboarding,
      addToast,
      setSelectedDoc,
    ]
  );

  const renderListView = () => {
    if (loadingDocs) {
      return (
        <div className="list-state list-state--loading">
          <div className="list-state-title">
            Cargando tu bandeja de documentos…
          </div>
          <p className="list-state-text">
            Esto puede tardar unos segundos.
          </p>
          <div className="spinner" />
        </div>
      );
    }

    if (errorDocs) {
      return (
        <div className="list-state list-state--error">
          <p className="list-state-title">
            Ocurrió un problema al cargar la bandeja.
          </p>
          <p className="list-state-text list-state-text--strong">
            {errorDocs ||
              "Por favor, revisa tu conexión e inténtalo nuevamente."}
          </p>
          <button
            className="btn-main btn-primary"
            onClick={() => refreshDocs()}
          >
            Reintentar carga
          </button>
        </div>
      );
    }

    if (safeDocsFiltrados.length === 0) {
      return (
        <div className="list-state list-state--empty">
          <h3 className="list-state-title">
            No encontramos documentos para mostrar.
          </h3>
          <p className="list-state-text">
            Puede que no existan documentos con los filtros actuales.
          </p>
          <p className="list-state-text">
            Ajusta los filtros o crea un nuevo flujo de firma digital.
          </p>
          <button
            className="btn-main list-empty-cta"
            onClick={() => handleNavigateProtected("upload")}
          >
            Crear nuevo trámite
          </button>
        </div>
      );
    }

    return (
      <>
        <div className="table-wrapper">
          <table className="doc-table">
            <thead>
              <tr>
                <th className="col-title">Contrato / Documento</th>
                <th className="col-type">Tipo</th>
                <th className="col-status text-center">Estado</th>
                <th className="col-party">Participante</th>
                <th className="col-actions text-center">Acciones</th>
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

        <div className="list-pagination">
          <span>
            Página {safeCurrentPage} de {safeTotalPaginas} ·{" "}
            {safeTotalFiltrado} documentos
          </span>

          <div className="list-pagination-controls">
            <button
              type="button"
              className="btn-main"
              disabled={safeCurrentPage <= 1 || loadingDocs}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Anterior
            </button>

            <button
              type="button"
              className="btn-main"
              disabled={loadingDocs || safeCurrentPage >= safeTotalPaginas}
              onClick={() =>
                setPage((prev) => Math.min(safeTotalPaginas, prev + 1))
              }
            >
              Siguiente
            </button>
          </div>
        </div>
      </>
    );
  };

  const renderProtectedView = useCallback(() => {
    if (view === "list") {
      return (
        <>
          <ListHeader
            sort={sort}
            setSort={(value) => {
              setSort(value);
              setPage(1);
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
            visados={safeVisadosFiltered}
            firmados={safeFirmados}
            rechazados={safeRechazados}
            onSync={() => refreshDocs()}
          />

          <div className="inbox-header-card">
            <div className="inbox-header-main">
              <h2 className="inbox-title">Documentos recientes</h2>
              <p className="inbox-subtitle">
                Revisa estados, abre contratos y gestiona tus trámites
                desde esta bandeja.
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
                onClick={() => refreshDocs()}
              >
                Actualizar bandeja
              </button>
            </div>
          </div>

          {renderListView()}
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
    if (view === "dashboard" && anyAdmin) {
      return <DashboardView user={user} />;
    }
    if (view === "companies" && anyAdmin) {
      return <CompaniesAdminView API_URL={apiRoot} />;
    }
    if (view === "status" && anyAdmin) {
      return <StatusAdminView API_URL={apiRoot} />;
    }
    if (view === "audit-logs" && canAudit) {
      return <AuditLogsView API_URL={apiRoot} />;
    }
    if (view === "auth-logs" && canAudit) {
      return <AuthLogsView API_URL={apiRoot} />;
    }
    if (view === "reminders-config" && anyAdmin) {
      return <RemindersConfigView />;
    }
    if (view === "email-metrics" && anyAdmin) {
      return <EmailMetricsView />;
    }
    if (view === "pricing") return <PricingView />;
    if (view === "profile") return <ProfileView />;
    if (view === "templates" && anyAdmin) return <TemplatesView />;
    if (view === "company-analytics" && anyAdmin) {
      return <CompanyAnalyticsView />;
    }

    return <div className="redirect-fallback">Redirigiendo…</div>;
  }, [
    view,
    sort,
    setSort,
    setPage,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    safeTotalFiltrado,
    safePendientes,
    safeVisadosFiltered,
    safeFirmados,
    safeRechazados,
    refreshDocs,
    tipoTramite,
    formErrors,
    showVisador,
    extraSigners,
    firmanteRunValue,
    empresaRutValue,
    handleAfterCreateDocument,
    cargarDocs,
    anyAdmin,
    canAudit,
    user,
    apiRoot,
    handleNavigateProtected,
  ]);

  // 1) Sesión en carga
  if (authLoading) {
    return <SessionLoadingFallback />;
  }

  // 2) Portales públicos: verificación
  if (isPublicVerificationAccess) {
    return <VerificationView API_URL={apiRoot} />;
  }

  // 3) Portales públicos: firma / visado
  if (isPublicSigningAccess) {
    const effectiveToken = tokenFromUrl || publicSignToken || "";

    return (
      <PublicSignView
        publicSignLoading={publicSignLoading}
        publicSignError={publicSignError}
        publicSignDoc={publicSignDoc}
        publicSignPdfUrl={publicSignPdfUrl}
        publicSignToken={effectiveToken}
        publicSignMode={publicSignMode}
        publicTokenKind={publicTokenKind}
        API_URL={apiRoot}
        cargarFirmaPublica={cargarFirmaPublica}
      />
    );
  }

  // 4) Auth público
  if (!isAuthenticated && path === "/forgot-password") {
    return <ForgotPasswordView />;
  }

  if (!isAuthenticated && path === "/reset-password") {
    return <ResetPasswordView />;
  }

  if (!isAuthenticated && path === "/register") {
    return <RegisterView />;
  }

  // 5) Login
  if (!isAuthenticated) {
    const displayIdentifier =
      isEmailMode || identifier.includes("@")
        ? identifier
        : formatRun(identifier);

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

  // 6) Detalle
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
        setView={handleBackToList}
        setSelectedDoc={setSelectedDoc}
        logout={handleLogout}
        currentUser={user}
      />
    );
  }

  // 7) Dashboard protegido
  return (
    <div className="dashboard-root">
      <Suspense
        fallback={
          showOnboarding ? (
            <div className="onboarding-fallback">
              Preparando guía interactiva…
            </div>
          ) : null
        }
      >
        {showOnboarding && (
          <OnboardingWizardLazy
            onCompleted={handleOnboardingCompleted}
            onSkipped={handleOnboardingSkipped}
            checking={checkingOnboarding}
          />
        )}
      </Suspense>

      <div className="dashboard-layout">
        <Sidebar
          user={user}
          totalDocuments={safeTotalDocsGlobal}
          totalPendientes={safeTotalPendientesGlobal}
          totalVisados={safeVisadosGlobal}
          totalFirmados={safeFirmadosGlobal}
          totalRechazados={safeRechazadosGlobal}
          view={view}
          setView={handleNavigateProtected}
          logout={handleLogout}
          isAnyAdmin={anyAdmin}
          socketStatus={socketStatus}
          socketLastError={socketLastError}
          socketCanRetry={socketCanRetry}
          onRetrySocket={retrySocket}
        />

        <div className="content-body">
          <Suspense
            fallback={
              runProductTour ? (
                <div className="product-tour-fallback">
                  Cargando tour interactivo…
                </div>
              ) : null
            }
          >
            <ProductTourLazy
              tourId="dashboard_principal"
              run={runProductTour}
              onFinish={() => setRunProductTour(false)}
            />
          </Suspense>

          <Suspense fallback={<ProtectedModuleFallback />}>
            {renderProtectedView()}
          </Suspense>

          {import.meta.env.MODE !== "production" && (
            <button
              type="button"
              className="sentry-test-button"
              onClick={handleTestError}
            >
              Probar error Sentry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
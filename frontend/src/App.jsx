import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
} from "react";
import "./App.css";

import { useTranslation } from "react-i18next";

import Sidebar from "./components/Sidebar";
import DetailView from "./components/DetailView";
import { ListHeader } from "./components/ListHeader";
import DocumentRow from "./components/DocumentRow";
import ConnectionBanner from "./components/ConnectionBanner";

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
import {
  isAnyAdmin,
  isEffectiveGlobalAdmin,
  canViewAuditLogs,
  canAccessProtectedView,
  canManageUsers,
  canViewTemplates,
  canManageReminders,
  canViewDashboard,
  canManageCompanies,
  canManageSystemStatus,
  canViewEmailMetrics,
  canViewCompanyAnalytics,
} from "./utils/permissions";
import { formatRun, formatRunDoc } from "./utils/formatters";

import {
  PUBLIC_AUTH_PATHS,
  VALID_PROTECTED_VIEWS,
  VIEW_TO_PATH,
  getProtectedViewFromPath,
  getLocationSnapshot,
  getPublicAccessSnapshot,
  getEffectivePublicRouteState,
  resolveAppEntry,
} from "./utils/appRouting";

import { useSocket } from "./hooks/useSocket";
import { useOnboardingStatus } from "./hooks/useOnboardingStatus";
import { usePublicSign } from "./hooks/usePublicSign";
import { useDocuments } from "./hooks/useDocuments";
import { useToast } from "./hooks/useToast";
import { useAuth } from "./hooks/useAuth";

import FloatingActions from "./components/shell/FloatingActions";

/* ============================
   Lazy views / modules
   ============================ */

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

/* ============================
   Fallbacks
   ============================ */

function ProtectedModuleFallback() {
  const { t } = useTranslation();
  return (
    <div className="protected-fallback">
      {t("app.protectedFallback", "Cargando módulo…")}
    </div>
  );
}

function SessionLoadingFallback() {
  const { t } = useTranslation();
  return (
    <div className="session-loading">
      {t("app.sessionLoading", "Cargando sesión...")}
    </div>
  );
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

/* ============================
   App
   ============================ */

function App() {
  const { t } = useTranslation();

  const subdomain = getSubdomain();
  const isVerificationPortal = subdomain === "verificar";
  const isSigningPortal = subdomain === "firmar";
  const apiRoot = API_BASE_URL;

  const [path, setPath] = useState(() => getPath());
  const [view, setView] = useState(() => getProtectedViewFromPath(getPath()));

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [formErrors, setFormErrors] = useState({});
  const [tipoTramite, setTipoTramite] = useState("propio");
  const [showVisador, setShowVisador] = useState(false);
  const [extraSigners, setExtraSigners] = useState([]);
  const [firmanteRunValue, setFirmanteRunValue] = useState("");
  const [empresaRutValue, setEmpresaRutValue] = useState("");

  const { user, token, login, logout, authLoading, isAuthenticated } =
    useAuth();
  const { addToast } = useToast();

  const locationSnapshot = useMemo(() => getLocationSnapshot(), [path]);

  const publicAccess = useMemo(
    () =>
      getPublicAccessSnapshot({
        pathname: locationSnapshot.pathname,
        search: locationSnapshot.search,
        isSigningPortal,
        isVerificationPortal,
      }),
    [locationSnapshot, isSigningPortal, isVerificationPortal]
  );

  const { tokenFromUrl, isAnyPublicAccess, isDocumentTokenPath } =
    publicAccess;

  const { effectivePublicModeFromUrl, effectiveTokenKindFromUrl } = useMemo(
    () =>
      getEffectivePublicRouteState({
        search: locationSnapshot.search,
        isDocumentTokenPath,
      }),
    [locationSnapshot.search, isDocumentTokenPath]
  );

  const entryDecision = useMemo(
    () =>
      resolveAppEntry({
        authLoading,
        isAuthenticated,
        path,
        publicAccess,
      }),
    [authLoading, isAuthenticated, path, publicAccess]
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

  const safePendientes = safeNumber(pendientes);
  const safeVisadosFiltrados = safeNumber(visados);
  const safeFirmados = safeNumber(firmados);
  const safeRechazados = safeNumber(rechazados);
  const safeTotalFiltrado = safeNumber(totalFiltrado);
  const safeTotalPaginas =
    Number.isFinite(totalPaginas) && totalPaginas > 0 ? totalPaginas : 1;
  const safeCurrentPage =
    Number.isFinite(pagination?.page) && pagination.page > 0
      ? pagination.page
      : 1;

  const safeTotalDocsGlobal = safeNumber(totalGlobal, safeDocs.length);
  const safeTotalPendientesGlobal = safeNumber(
    pendientesGlobal,
    safePendientes
  );
  const safeVisadosGlobal = safeNumber(visadosGlobal);
  const safeFirmadosGlobal = safeNumber(firmadosGlobal);
  const safeRechazadosGlobal = safeNumber(rechazadosGlobal);

  const anyAdmin = isAnyAdmin(user);
  const isGlobalAdmin = isEffectiveGlobalAdmin(user);
  const canAudit = canViewAuditLogs(user);

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
  }, [handleNavigateProtected]);

  const handleLogout = useCallback(() => {
    setSelectedDoc(null);
    setView("list");
    logout({ redirectTo: "/login", replace: true });
  }, [logout]);

  const handleAfterCreateDocument = useCallback(async () => {
    setPage(1);
    await refreshDocs({ page: 1 });
    handleNavigateProtected("list");
  }, [refreshDocs, handleNavigateProtected]);

  const handleTestError = useCallback(() => {
    throw new Error("Frontend test error");
  }, []);

  const handleLogin = useCallback(
    async (event) => {
      event.preventDefault();
      setIsLoggingIn(true);
      setMessage(
        t("app.login.connecting", "Conectando con el servidor seguro...")
      );

      const inputVal = identifier.trim();
      const isEmail = inputVal.includes("@");

      const cleanValue = isEmail
        ? inputVal.toLowerCase()
        : inputVal.replace(/[^0-9kK]/g, "").toUpperCase();

      if (!isEmail && cleanValue.length < 2) {
        setMessage(t("app.login.invalidRut", "❌ El RUT ingresado no es válido"));
        setIsLoggingIn(false);
        return;
      }

      try {
        await login({
          identifier: cleanValue,
          password,
          rememberMe,
        });

        setMessage(t("app.login.accessGranted", "Acceso concedido"));
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
          t("app.login.defaultError", "Error de conexión, intenta nuevamente.");

        setMessage(`❌ ${msg}`);

        addToast({
          type: "error",
          title: t("app.login.toastTitle", "No se pudo iniciar sesión"),
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
      t,
    ]
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
  }, [authLoading, isAuthenticated, isAnyPublicAccess, path]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (view === "detail") return;

    const expectedView = getProtectedViewFromPath(path);

    if (!VALID_PROTECTED_VIEWS.has(expectedView)) {
      setSelectedDoc(null);
      setView("list");
      replaceTo("/documents");
      return;
    }

    if (!canAccessProtectedView(user, expectedView)) {
      setSelectedDoc(null);
      setView("list");
      replaceTo("/documents");
      return;
    }

    if (view !== expectedView) {
      setView(expectedView);
    }
  }, [view, path, isAuthenticated, user]);

  useEffect(() => {
    if (!token) return;
    if (typeof socketOn !== "function" || typeof socketOff !== "function") {
      return;
    }

    const handleSent = (data) => {
      if (import.meta.env.DEV) {
        console.log("[WS] document:sent recibido:", data);
      }

      const title = data?.title || data?.titulo || null;

      addToast({
        type: "success",
        title: t("app.toasts.documentSentTitle", "Documento enviado"),
        message: title
          ? t(
              "app.toasts.documentSentWithTitle",
              '"{{title}}" se envió correctamente.',
              { title }
            )
          : t(
              "app.toasts.documentSent",
              "El documento se envió correctamente."
            ),
      });

      if (socketStatus === "connected") {
        refreshDocs({ page: 1 });
      }
    };

    const handleSigned = (data) => {
      if (import.meta.env.DEV) {
        console.log("[WS] document:signed recibido:", data);
      }

      const title = data?.title || data?.titulo || null;

      addToast({
        type: "success",
        title: t("app.toasts.documentSignedTitle", "Documento firmado"),
        message: title
          ? t(
              "app.toasts.documentSignedWithTitle",
              '"{{title}}" se firmó correctamente.',
              { title }
            )
          : t(
              "app.toasts.documentSigned",
              "El documento se firmó correctamente."
            ),
      });

      if (socketStatus === "connected") {
        refreshDocs({ page: 1 });
      }
    };

    socketOn("document:sent", handleSent);
    socketOn("document:signed", handleSigned);

    return () => {
      socketOff("document:sent", handleSent);
      socketOff("document:signed", handleSigned);
    };
  }, [token, socketOn, socketOff, addToast, refreshDocs, socketStatus, t]);

  useEffect(() => {
    if (!token) return;
    if (socketStatus === "connected") return;

    const intervalId = window.setInterval(() => {
      refreshDocs();
    }, 90000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [token, socketStatus, refreshDocs]);

  const hasShownSocketToastRef = useRef(false);

  useEffect(() => {
    if (!socketStatus) return;

    if (socketStatus === "connected") {
      hasShownSocketToastRef.current = false;
      return;
    }

    if (hasShownSocketToastRef.current) return;
    hasShownSocketToastRef.current = true;

    if (import.meta.env.DEV && socketLastError) {
      console.warn("[WS] Problema de conexión en tiempo real:", socketLastError);
    }

    let title = t(
      "app.socket.toasts.limitedTitle",
      "Conexión en tiempo real limitada"
    );
    let msg = t(
      "app.socket.toasts.limitedMessage",
      "No pudimos mantener la conexión en tiempo real. Tu bandeja seguirá actualizándose cada cierto tiempo."
    );

    const isErrorLike =
      socketStatus === "error" || socketStatus === "disconnected";

    if (socketStatus === "connecting") {
      title = t(
        "app.socket.toasts.connectingTitle",
        "Conectando en tiempo real…"
      );
      msg = t(
        "app.socket.toasts.connectingMessage",
        "Estamos intentando establecer la conexión en tiempo real. Puedes seguir usando la aplicación normalmente."
      );
    }

    if (socketStatus === "reconnecting") {
      title = t(
        "app.socket.toasts.reconnectingTitle",
        "Reconectando en tiempo real…"
      );
      msg = t(
        "app.socket.toasts.reconnectingMessage",
        "Perdimos la conexión en tiempo real, estamos intentando restablecerla. La bandeja se seguirá actualizando de forma periódica."
      );
    }

    addToast({
      type: isErrorLike ? "error" : "warning",
      title,
      message: msg,
    });
  }, [socketStatus, socketLastError, addToast, t]);

  const renderListView = useCallback(() => {
    if (loadingDocs) {
      return (
        <div className="list-state list-state--loading">
          <div className="list-state-title">
            {t("app.list.loadingTitle", "Cargando tu bandeja de documentos…")}
          </div>
          <p className="list-state-text">
            {t("app.list.loadingSubtitle", "Esto puede tardar unos segundos.")}
          </p>
          <div className="spinner" />
        </div>
      );
    }

    if (errorDocs) {
      return (
        <div className="list-state list-state--error">
          <p className="list-state-title">
            {t("app.list.errorTitle", "Ocurrió un problema al cargar la bandeja.")}
          </p>
          <p className="list-state-text list-state-text--strong">
            {errorDocs ||
              t(
                "app.list.errorFallback",
                "Por favor, revisa tu conexión e inténtalo nuevamente."
              )}
          </p>
          <button
            className="btn-main btn-primary"
            onClick={() => refreshDocs()}
          >
            {t("app.list.retry", "Reintentar carga")}
          </button>
        </div>
      );
    }

    if (safeDocsFiltrados.length === 0) {
      return (
        <div className="list-state list-state--empty">
          <h3 className="list-state-title">
            {t("app.list.emptyTitle", "No encontramos documentos para mostrar.")}
          </h3>
          <p className="list-state-text">
            {t(
              "app.list.emptySubtitle1",
              "Puede que no existan documentos con los filtros actuales."
            )}
          </p>
          <p className="list-state-text">
            {t(
              "app.list.emptySubtitle2",
              "Ajusta los filtros o crea un nuevo flujo de firma digital."
            )}
          </p>
          <button
            className="btn-main list-empty-cta"
            onClick={() => handleNavigateProtected("upload")}
          >
            {t("app.list.emptyCta", "Crear nuevo trámite")}
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
                <th className="col-title">
                  {t("app.table.columns.contractDocument", "Contrato / Documento")}
                </th>
                <th className="col-type">{t("app.table.columns.type", "Tipo")}</th>
                <th className="col-status text-center">
                  {t("app.table.columns.status", "Estado")}
                </th>
                <th className="col-party">
                  {t("app.table.columns.participant", "Participante")}
                </th>
                <th className="col-actions text-center">
                  {t("app.table.columns.actions", "Acciones")}
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

        <div className="list-pagination">
          <span>
            {t(
              "app.pagination.summary",
              "Página {{current}} de {{total}} · {{count}} documentos",
              {
                current: safeCurrentPage,
                total: safeTotalPaginas,
                count: safeTotalFiltrado,
              }
            )}
          </span>

          <div className="list-pagination-controls">
            <button
              type="button"
              className="btn-main"
              disabled={safeCurrentPage <= 1 || loadingDocs}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              {t("app.pagination.prev", "Anterior")}
            </button>

            <button
              type="button"
              className="btn-main"
              disabled={loadingDocs || safeCurrentPage >= safeTotalPaginas}
              onClick={() =>
                setPage((prev) => Math.min(safeTotalPaginas, prev + 1))
              }
            >
              {t("app.pagination.next", "Siguiente")}
            </button>
          </div>
        </div>
      </>
    );
  }, [
    loadingDocs,
    errorDocs,
    safeDocsFiltrados.length,
    safeDocsPaginados,
    handleOpenDetail,
    safeCurrentPage,
    safeTotalPaginas,
    safeTotalFiltrado,
    refreshDocs,
    handleNavigateProtected,
    setPage,
    t,
  ]);

  const protectedViewElement = useMemo(() => {
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
            visados={safeVisadosFiltrados}
            firmados={safeFirmados}
            rechazados={safeRechazados}
            onSync={() => refreshDocs()}
            token={token}
          />

          <div className="inbox-header-card">
            <div className="inbox-header-main">
              <h2 className="inbox-title">
                {t("app.inbox.title", "Documentos recientes")}
              </h2>
              <p className="inbox-subtitle">
                {t(
                  "app.inbox.subtitle",
                  "Revisa estados, abre contratos y gestiona tus trámites desde esta bandeja."
                )}
              </p>
            </div>

            <div className="inbox-header-actions">
              <button
                type="button"
                className="btn-main btn-primary"
                onClick={() => handleNavigateProtected("upload")}
              >
                {t("app.inbox.newDocument", "+ Nuevo documento")}
              </button>

              <button
                type="button"
                className="btn-main btn-ghost"
                onClick={() => refreshDocs()}
              >
                {t("app.inbox.refresh", "Actualizar bandeja")}
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

    if (view === "users" && canManageUsers(user)) return <UsersAdminView />;
    if (view === "reminders-config" && canManageReminders(user)) {
      return <RemindersConfigView />;
    }
    if (view === "templates" && canViewTemplates(user)) {
      return <TemplatesView />;
    }
    if (view === "dashboard" && canViewDashboard(user)) {
      return <DashboardView user={user} />;
    }
    if (view === "companies" && canManageCompanies(user)) {
      return <CompaniesAdminView API_URL={apiRoot} />;
    }
    if (view === "status" && canManageSystemStatus(user)) {
      return <StatusAdminView API_URL={apiRoot} />;
    }
    if (view === "audit-logs" && canViewAuditLogs(user)) {
      return <AuditLogsView API_URL={apiRoot} />;
    }
    if (view === "auth-logs" && canViewAuditLogs(user)) {
      return <AuthLogsView API_URL={apiRoot} />;
    }
    if (view === "email-metrics" && canViewEmailMetrics(user)) {
      return <EmailMetricsView />;
    }
    if (view === "company-analytics" && canViewCompanyAnalytics(user)) {
      return <CompanyAnalyticsView />;
    }
    if (view === "pricing") return <PricingView />;
    if (view === "profile") return <ProfileView />;

    return (
      <div className="redirect-fallback">
        {t("app.redirectFallback", "Redirigiendo…")}
      </div>
    );
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
    safeVisadosFiltrados,
    safeFirmados,
    safeRechazados,
    refreshDocs,
    renderListView,
    tipoTramite,
    formErrors,
    showVisador,
    extraSigners,
    firmanteRunValue,
    empresaRutValue,
    handleAfterCreateDocument,
    cargarDocs,
    user,
    apiRoot,
    handleNavigateProtected,
    token,
    t,
  ]);

  if (entryDecision.screen === "session-loading") {
    return <SessionLoadingFallback />;
  }

  if (entryDecision.screen === "public-verification") {
    return <VerificationView API_URL={apiRoot} />;
  }

  if (entryDecision.screen === "public-sign") {
    const effectiveToken = (tokenFromUrl || publicSignToken || "").trim();

    const effectivePublicMode =
      publicSignMode || effectivePublicModeFromUrl || "firma";

    const effectiveTokenKind =
      publicTokenKind ||
      effectiveTokenKindFromUrl ||
      (effectivePublicMode === "visado" ? "document" : "signer");

    if (import.meta.env.DEV) {
      console.log("[PublicAccessSnapshot]", {
        path,
        tokenFromUrl,
        publicSignToken,
        effectiveToken,
        effectivePublicMode,
        effectiveTokenKind,
        isDocumentTokenPath,
      });
    }

    return (
      <PublicSignView
        publicSignLoading={publicSignLoading}
        publicSignError={publicSignError}
        publicSignDoc={publicSignDoc}
        publicSignPdfUrl={publicSignPdfUrl}
        publicSignToken={effectiveToken}
        publicSignMode={effectivePublicMode}
        publicTokenKind={effectiveTokenKind}
        API_URL={apiRoot}
        cargarFirmaPublica={cargarFirmaPublica}
      />
    );
  }

  if (entryDecision.screen === "forgot-password") {
    return <ForgotPasswordView />;
  }

  if (entryDecision.screen === "reset-password") {
    return <ResetPasswordView />;
  }

  if (entryDecision.screen === "register") {
    return <RegisterView />;
  }

  if (entryDecision.screen === "login") {
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
        showHelp={false}
        setShowHelp={() => {}}
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

  return (
    <div className="dashboard-root">
      <ConnectionBanner
        status={socketStatus}
        lastError={socketLastError}
        canRetry={socketCanRetry}
        onRetry={retrySocket}
      />

      <Suspense
        fallback={
          showOnboarding ? (
            <div className="onboarding-fallback">
              {t("app.onboarding.fallback", "Preparando guía interactiva…")}
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

        <div className="main-area">
          <div className="content-body">
            <Suspense
              fallback={
                runProductTour ? (
                  <div className="product-tour-fallback">
                    {t("app.tour.fallback", "Cargando tour interactivo…")}
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
              {protectedViewElement}
            </Suspense>

            {import.meta.env.MODE !== "production" && (
              <button
                type="button"
                className="sentry-test-button"
                onClick={handleTestError}
              >
                {t("app.sentryTest", "Probar error Sentry")}
              </button>
            )}

            <FloatingActions />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
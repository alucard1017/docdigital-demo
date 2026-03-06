// src/App.jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import "./App.css";
import { Sidebar } from "./components/Sidebar";
import { DetailView } from "./components/DetailView";
import { ListHeader } from "./components/ListHeader";
import { DocumentRow } from "./components/DocumentRow";
import { DOC_STATUS, apiUrl } from "./constants";
import { LoginView } from "./views/LoginView";
import { PublicSignView } from "./views/PublicSignView";
import { NewDocumentForm } from "./views/NewDocumentForm";
import { UsersAdminView } from "./views/UsersAdminView";
import { DashboardView } from "./views/DashboardView";
import { VerificationView } from "./views/VerificationView";
import { getSubdomain } from "./utils/subdomain";

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

  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user") || "null")
  );

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
  const [events, setEvents] = useState([]);
  const [pdfUrl, setPdfUrl] = useState(null);

  const [publicSignDoc, setPublicSignDoc] = useState(null);
  const [publicSignError, setPublicSignError] = useState("");
  const [publicSignLoading, setPublicSignLoading] = useState(false);
  const [publicSignToken, setPublicSignToken] = useState("");
  const [publicSignPdfUrl, setPublicSignPdfUrl] = useState("");
  const [publicSignMode, setPublicSignMode] = useState(null);

  const [firmanteRunValue, setFirmanteRunValue] = useState("");
  const [empresaRutValue, setEmpresaRutValue] = useState("");

  const apiRoot = useMemo(() => apiUrl("/"), []);

  /* =============================== */
  /* FIRMA / VISADO PÚBLICO          */
  /* =============================== */

  const cargarFirmaPublica = useCallback(async (tokenParam) => {
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
          ? `/api/public/docs/document/${tokenParam}`
          : `/api/public/docs/${tokenParam}`;

      const res = await fetch(apiUrl(path));
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
  }, []);

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

  /* =============================== */
  /* TIMELINE + PDF DEL DETALLE      */
  /* =============================== */

  useEffect(() => {
    if (!token || !selectedDoc || view !== "detail") {
      if (view !== "detail") setEvents([]);
      return;
    }

    const cargarEventos = async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/docs/${selectedDoc.id}/timeline`),
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        setEvents(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error cargando eventos:", err);
      }
    };

    cargarEventos();
  }, [token, selectedDoc, view]);

  useEffect(() => {
    if (!token || !selectedDoc) {
      setPdfUrl(null);
      return;
    }

    const fetchPdfUrl = async () => {
      try {
        const res = await fetch(apiUrl(`/api/docs/${selectedDoc.id}/pdf`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "No se pudo obtener el PDF");
        }
        setPdfUrl(data.url);
      } catch (err) {
        console.error("Error obteniendo URL de PDF:", err);
        setPdfUrl(null);
      }
    };

    fetchPdfUrl();
  }, [token, selectedDoc]);

  /* =============================== */
  /* CARGA DE DOCUMENTOS             */
  /* =============================== */

  const cargarDocs = useCallback(
    async (sortParam = sort) => {
      if (!token) return;
      setLoadingDocs(true);
      setErrorDocs("");

      try {
        const res = await fetch(
          apiUrl(`/api/docs?sort=${encodeURIComponent(sortParam)}`),
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setToken("");
          setUser(null);
          return;
        }

        if (!res.ok) {
          setErrorDocs(
            "No se pudieron cargar los documentos. Intenta nuevamente."
          );
          return;
        }

        const data = await res.json();
        setDocs(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Fallo al cargar documentos:", err);
        setErrorDocs("Error de conexión con el servidor.");
      } finally {
        setLoadingDocs(false);
      }
    },
    [sort, token]
  );

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
    setMessage("🚀 Conectando con el servidor seguro...");

    const isEmail = isEmailMode || identifier.includes("@");
    const value = isEmail
      ? identifier.trim()
      : identifier.replace(/[^0-9kK]/g, "");

    try {
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: value, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Credenciales no válidas");
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setMessage("✅ Acceso concedido");
    } catch (err) {
      console.error("Error en login:", err);
      setMessage(
        err.message ||
          "❌ Error de conexión, intenta nuevamente en unos segundos."
      );
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
        const res = await fetch(apiUrl(`/api/docs/${doc.id}/pdf`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "No se pudo obtener el PDF");
        }
        window.open(data.url, "_blank", "noopener,noreferrer");
      } catch (err) {
        console.error("Error abriendo PDF:", err);
        alert("❌ " + (err.message || "No se pudo abrir el PDF"));
      }
      return;
    }

    try {
      let body;
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      if (accion === "rechazar") {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify({ motivo: extraData.motivo });
      }

      const res = await fetch(apiUrl(`/api/docs/${id}/${accion}`), {
        method: "POST",
        headers,
        body,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "No se pudo actualizar el documento");
      }

      if (accion === "firmar") {
        alert("✅ Documento firmado correctamente");
      } else if (accion === "visar") {
        alert("✅ Documento visado correctamente");
      } else if (accion === "rechazar") {
        alert("✅ Documento rechazado correctamente");
      }

      await cargarDocs();
      setView("list");
      setSelectedDoc(null);
    } catch (err) {
      alert("❌ " + (err.message || "No se pudo procesar la acción"));
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

  /* =============================== */
  /* MODO DE VISTA (UN SOLO PUNTO)   */
  /* =============================== */

  const pathname = window.location.pathname;

  let mode = "app"; // por defecto: app normal (login + dashboard)

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

  if (mode === "signing-portal") {
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

  if (mode === "public-sign") {
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
        events={events}
        manejarAccionDocumento={manejarAccionDocumento}
        setView={setView}
        setSelectedDoc={setSelectedDoc}
        logout={logout}
        token={token}
        currentUser={user}
      />
    );
  }

  const docsFiltrados = useMemo(() => {
    return docs.filter((d) => {
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
  }, [docs, statusFilter, search]);

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

  return (
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
        isAnyAdmin={isAnyAdmin(user)}
      />

      <div className="content-body">
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
            token={token}
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
                          token={token}
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
                      disabled={page === totalPaginas || totalPaginas === 0}
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
            API_URL={apiRoot}
            token={token}
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

        {view === "users" && isAnyAdmin(user) && (
          <UsersAdminView API_URL={apiRoot} token={token} />
        )}

        {view === "dashboard" && isAnyAdmin(user) && (
          <DashboardView user={user} token={token} />
        )}

        {import.meta.env.MODE !== "production" ? (
          <button onClick={handleTestError}>Probar error Sentry</button>
        ) : null}
      </div>
    </div>
  );
}

export default App;

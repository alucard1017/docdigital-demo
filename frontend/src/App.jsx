import { useState, useEffect } from 'react';
import './App.css';
import { Sidebar } from './components/Sidebar';
import { DetailView } from './components/DetailView';
import { ListHeader } from './components/ListHeader';
import { DocumentRow } from './components/DocumentRow';
import { DOC_STATUS } from './constants';
import { API_BASE_URL } from "./constants";
import { LoginView } from './views/LoginView';
import { PublicSignView } from './views/PublicSignView';
import { NewDocumentForm } from './views/NewDocumentForm';
import { UsersAdminView } from './views/UsersAdminView';
import { UserForm } from '../components/admin/UserForm';

const API_URL = API_BASE_URL;

/**
 * FUNCIÓN DE FORMATEO DE RUN DETALLADA
 * Mantiene el orden y añade puntos y guion: 10.538.065-6
 */
function formatRun(value) {
  let clean = value.replace(/[^0-9kK]/g, '');
  if (!clean) return '';
  const MAX_LEN = 10;
  if (clean.length > MAX_LEN) clean = clean.slice(0, MAX_LEN);
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (!body) return dv;
  return formattedBody + '-' + dv;
}

function formatRunDoc(value) {
  let clean = value.replace(/[^0-9kK]/g, '');
  if (clean.length === 0) return '';
  if (clean.length > 10) clean = clean.slice(0, 10);

  if (clean.length <= 1) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  if (!body) return dv;

  return body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
}

function App() {
  /* ===============================
     ESTADOS DE LA APLICACIÓN
     =============================== */

  // Login
  const [run, setRun] = useState(formatRun('1053806586'));
  const [password, setPassword] = useState('kmzwa8awaa');

  // UI
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'upload' | 'detail'

  // Errores del formulario de subida
  const [formErrors, setFormErrors] = useState({});
  const [tipoTramite, setTipoTramite] = useState("propio");

  // Sesión
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem('user'))
  );
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [errorDocs, setErrorDocs] = useState('');
  const [docs, setDocs] = useState([]);

  // Configuración de firma
  const [showVisador, setShowVisador] = useState(false);
  const [extraSigners, setExtraSigners] = useState([]);

  // Orden y filtros de la bandeja
  const [sort, setSort] = useState('title_asc');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [search, setSearch] = useState('');

  // Paginación
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Documento seleccionado para la vista detalle
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [events, setEvents] = useState([]);

  // URL firmada del PDF del documento en detalle
  const [pdfUrl, setPdfUrl] = useState(null);

  // Firma pública por token
  const [publicSignDoc, setPublicSignDoc] = useState(null);
  const [publicSignError, setPublicSignError] = useState('');
  const [publicSignLoading, setPublicSignLoading] = useState(false);
  const [publicSignToken, setPublicSignToken] = useState('');
  const [publicSignPdfUrl, setPublicSignPdfUrl] = useState('');

  const [firmanteRunValue, setFirmanteRunValue] = useState('');
  const [empresaRutValue, setEmpresaRutValue] = useState('');

  async function cargarFirmaPublica(token) {
    try {
      setPublicSignLoading(true);
      setPublicSignError('');

      const res = await fetch(`${API_URL}/api/public/docs/${token}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'No se pudo cargar el documento');
      }

      setPublicSignDoc(data.document);
      setPublicSignPdfUrl(data.pdfUrl);
    } catch (err) {
      setPublicSignError(err.message);
      setPublicSignDoc(null);
      setPublicSignPdfUrl('');
    } finally {
      setPublicSignLoading(false);
    }
  }

  // Ping para despertar el backend en Render
  useEffect(() => {
    fetch(`${API_URL}/api/health`).catch(() => {});
  }, []);

  // Detectar ?token= en la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenUrl = params.get('token');
    const isFirmaPublica = window.location.pathname === '/firma-publica';

    if (tokenUrl && isFirmaPublica) {
      setView('public-sign');
      setPublicSignToken(tokenUrl);
      cargarFirmaPublica(tokenUrl);
    }
  }, []);

  // Cargar eventos del documento seleccionado
  useEffect(() => {
    async function cargarEventos() {
      if (!token || !selectedDoc) return;
      try {
        const res = await fetch(
          `${API_URL}/api/docs/${selectedDoc.id}/timeline`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await res.json();
        setEvents(data);
      } catch (err) {
        console.error('Error cargando eventos:', err);
      }
    }

    if (view === 'detail') {
      cargarEventos();
    } else {
      setEvents([]);
    }
  }, [token, selectedDoc, view]);

  // Cargar URL firmada del PDF para el documento seleccionado
  useEffect(() => {
    if (!token || !selectedDoc) {
      setPdfUrl(null);
      return;
    }

    const fetchPdfUrl = async () => {
      try {
        const res = await fetch(`${API_URL}/api/docs/${selectedDoc.id}/pdf`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'No se pudo obtener el PDF');
        }
        setPdfUrl(data.url); // URL firmada desde S3
      } catch (err) {
        console.error('Error obteniendo URL de PDF:', err);
        setPdfUrl(null);
      }
    };

    fetchPdfUrl();
  }, [token, selectedDoc]);

  // Cargar documentos automáticamente cuando haya token y vista lista
  useEffect(() => {
    if (!token) return;
    if (view !== 'list') return;
    cargarDocs();
  }, [token, view, sort]);

  /* ===============================
     LOGIN
     =============================== */
  async function handleLogin(e) {
    e.preventDefault();
    setIsLoggingIn(true);
    setMessage('🚀 Conectando con el servidor seguro...');

    const cleanRun = run.replace(/[^0-9kK]/g, '');

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run: cleanRun, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Credenciales no válidas');
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setMessage('✅ Acceso concedido');
    } catch (err) {
      setMessage(
        '❌ Error de conexión, intenta nuevamente en unos segundos.'
      );
    } finally {
      setIsLoggingIn(false);
    }
  }

  /* ===============================
     CARGA DE DOCUMENTOS
     =============================== */
  async function cargarDocs(sortParam = sort) {
    if (!token) return;
    setLoadingDocs(true);
    setErrorDocs('');

    try {
      const res = await fetch(
        `${API_URL}/api/docs?sort=${encodeURIComponent(sortParam)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken('');
        setUser(null);
        return;
      }

      if (!res.ok) {
        console.error('Error al cargar documentos:', res.status);
        setErrorDocs(
          'No se pudieron cargar los documentos. Intenta nuevamente.'
        );
        return;
      }

      const data = await res.json();
      setDocs(data);
    } catch (err) {
      console.error('Fallo al cargar documentos:', err);
      setErrorDocs('Error de conexión con el servidor.');
    } finally {
      setLoadingDocs(false);
    }
  }

  /* ===============================
     ACCIONES: FIRMAR / VISAR / VER
     =============================== */
  async function manejarAccionDocumento(id, accion, extraData = {}) {
    if (accion === 'ver') {
      const doc = docs.find((d) => d.id === id);
      if (!doc) {
        alert('No se encontró el documento.');
        return;
      }

      try {
        const res = await fetch(`${API_URL}/api/docs/${doc.id}/pdf`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'No se pudo obtener el PDF');
        }
        window.open(data.url, '_blank'); // URL firmada desde el backend
      } catch (err) {
        console.error('Error abriendo PDF:', err);
        alert('❌ ' + err.message);
      }
      return;
    }

    try {
      let body = undefined;
      let headers = {
        Authorization: `Bearer ${token}`,
      };

      if (accion === 'rechazar') {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ motivo: extraData.motivo });
      }

      const res = await fetch(`${API_URL}/api/docs/${id}/${accion}`, {
        method: 'POST',
        headers,
        body,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'No se pudo actualizar el documento');
      }

      if (accion === 'firmar') {
        alert('✅ Documento firmado correctamente');
      } else if (accion === 'visar') {
        alert('✅ Documento visado correctamente');
      } else if (accion === 'rechazar') {
        alert('✅ Documento rechazado correctamente');
      }

      await cargarDocs();
      setView('list');
      setSelectedDoc(null);
    } catch (err) {
      alert('❌ ' + err.message);
    }
  }

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setUser(null);
    window.location.reload();
  };

  /* ===============================
     VISTA LOGIN
     =============================== */
  if (!token) {
    return (
      <LoginView
        run={run}
        setRun={(value) => setRun(formatRun(value))}
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

  // ===============================
  // VISTA FIRMA PÚBLICA POR TOKEN
  // ===============================
  if (view === 'public-sign') {
    return (
      <PublicSignView
        publicSignLoading={publicSignLoading}
        publicSignError={publicSignError}
        publicSignDoc={publicSignDoc}
        publicSignPdfUrl={publicSignPdfUrl}
        publicSignToken={publicSignToken}
        API_URL={API_URL}
        cargarFirmaPublica={cargarFirmaPublica}
      />
    );
  }

  /* ===============================
     VISTA DETALLE DE DOCUMENTO
     =============================== */
  if (view === 'detail' && selectedDoc) {
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
      />
    );
  }

  /* ===============================
     FILTRO EN MEMORIA PARA LA BANDEJA
     =============================== */
  const docsFiltrados = docs.filter((d) => {
    if (statusFilter === 'PENDIENTES' && d.status !== DOC_STATUS.PENDIENTE) {
      return false;
    }
    if (statusFilter === 'VISADOS' && d.status !== DOC_STATUS.VISADO) {
      return false;
    }
    if (statusFilter === 'FIRMADOS' && d.status !== DOC_STATUS.FIRMADO) {
      return false;
    }
    if (statusFilter === 'RECHAZADOS' && d.status !== DOC_STATUS.RECHAZADO) {
      return false;
    }

    if (search.trim() !== '') {
      const q = search.toLowerCase();
      const titulo = (d.title || '').toLowerCase();
      const empresa = (d.destinatario_nombre || '').toLowerCase();
      if (!titulo.includes(q) && !empresa.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const pendientes = docs.filter(
    (d) => d.status === DOC_STATUS.PENDIENTE
  ).length;
  const visados = docs.filter(
    (d) => d.status === DOC_STATUS.VISADO
  ).length;
  const firmados = docs.filter(
    (d) => d.status === DOC_STATUS.FIRMADO
  ).length;
  const rechazados = docs.filter(
    (d) => d.status === DOC_STATUS.RECHAZADO
  ).length;
  const totalFiltrado = docsFiltrados.length;

  const totalPaginas = Math.ceil(docsFiltrados.length / pageSize);
  const docsPaginados = docsFiltrados.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  /* ===============================
     VISTA DASHBOARD (LIST + UPLOAD)
     =============================== */

  console.log('DEBUG SUPER MEGA SIMPLE v3');
  console.log('DEBUG ESTADO:', {
    view,
    loadingDocs,
    errorDocs,
    docsPaginadosLength: docsPaginados.length,
  });
  console.log('DEBUG USER:', user);
  console.log('DEBUG tipoTramite:', tipoTramite);

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
      />

      <div className="content-body">
        <ListHeader
          sort={sort}
          setSort={setSort}
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

        {/* ===============================
            VISTA LISTA DE DOCUMENTOS
           ================================ */}
        {view === 'list' && (
          <>
            {/* HERO DASHBOARD */}
            <div className="hero-dashboard">
              <div className="hero-dashboard-inner">
                <h1 className="hero-dashboard-title">
                  Gestiona todas tus firmas digitales en un solo lugar
                </h1>
                <p className="hero-dashboard-text">
                  Envía contratos, actas y documentos legales para firma electrónica
                  avanzada en minutos. Sigue el estado en tiempo real y mantén un
                  historial completo de cada trámite.
                </p>
                <div className="hero-dashboard-actions">
                  <button
                    type="button"
                    className="btn-main btn-primary"
                    onClick={() => setView('upload')}
                    style={{ paddingInline: 22 }}
                  >
                    + Nuevo documento para firma
                  </button>
                  <button
                    type="button"
                    className="btn-main"
                    onClick={cargarDocs}
                    style={{
                      backgroundColor: '#020617',
                      color: '#e5e7eb',
                      border: '1px solid #1e293b',
                      paddingInline: 22,
                    }}
                  >
                    Ver documentos enviados
                  </button>
                </div>
              </div>
            </div>

            {/* (por ahora oculto) Resumen rápido */}
            <div
              style={{
                display: 'none',
                minWidth: 200,
                height: 130,
                borderRadius: 18,
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background:
                  'radial-gradient(circle at 0 0, rgba(56, 189, 248, 0.25), transparent 55%), radial-gradient(circle at 100% 100%, rgba(129, 140, 248, 0.18), transparent 55%)',
                padding: 14,
              }}
            >
              <p
                style={{
                  fontSize: '0.8rem',
                  color: '#e5e7eb',
                  marginBottom: 8,
                  fontWeight: 600,
                }}
              >
                Resumen rápido
              </p>
              <p style={{ fontSize: '0.8rem', color: '#cbd5f5' }}>
                Próximo paso: conecta tu dominio{' '}
                <span style={{ color: '#a5b4fc' }}>app.verifirma.cl</span> y
                completa tu primer flujo de firma real.
              </p>
            </div>

            {loadingDocs ? (
              // LOADER
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  color: '#64748b',
                }}
              >
                <div style={{ marginBottom: 12, fontWeight: 600 }}>
                  Cargando tu bandeja de documentos…
                </div>
                <p
                  style={{
                    fontSize: '0.9rem',
                    color: '#9ca3af',
                    marginTop: 4,
                  }}
                >
                  Esto puede tardar unos segundos.
                </p>
                <div className="spinner" />
              </div>
            ) : errorDocs ? (
              // ERROR BONITO
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  color: '#b91c1c',
                }}
              >
                <p style={{ marginBottom: 8, fontWeight: 700 }}>
                  Ocurrió un problema al cargar la bandeja.
                </p>
                <p style={{ marginBottom: 16, fontSize: '0.9rem' }}>
                  {errorDocs ||
                    'Por favor, revisa tu conexión e inténtalo nuevamente.'}
                </p>
                <button
                  className="btn-main btn-primary"
                  onClick={cargarDocs}
                >
                  Reintentar carga
                </button>
              </div>
            ) : docsPaginados.length === 0 ? (
              // ESTADO VACÍO
              <div
                style={{
                  padding: 40,
                  textAlign: 'center',
                  color: '#64748b',
                }}
              >
                <h3 style={{ marginBottom: 8 }}>
                  No encontramos documentos para mostrar.
                </h3>
                <p
                  style={{
                    marginBottom: 4,
                    fontSize: '0.9rem',
                    color: '#94a3b8',
                  }}
                >
                  Puede que no existan documentos con los filtros
                  actuales.
                </p>
                <p
                  style={{
                    marginBottom: 16,
                    fontSize: '0.9rem',
                    color: '#94a3b8',
                  }}
                >
                  Ajusta los filtros o crea un nuevo flujo de firma
                  digital.
                </p>
                <button
                  className="btn-main"
                  onClick={() => setView('upload')}
                  style={{
                    background: '#e2e8f0',
                    color: '#1e293b',
                  }}
                >
                  Crear nuevo trámite
                </button>
              </div>
            ) : (
              <>
                {/* Tabla de documentos */}
                <div className="table-wrapper">
                  <table className="doc-table">
                    <thead>
                      <tr>
                        <th>N° de contrato</th>
                        <th>Título del Documento</th>
                        <th>Tipo de trámite</th>
                        <th>Fecha de creación</th>
                        <th style={{ textAlign: 'center' }}>
                          Estado Actual
                        </th>
                        <th>Firmante Final</th>
                        <th style={{ textAlign: 'center' }}>Acciones</th>
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
                            setView('detail');
                          }}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: 16,
                    fontSize: '0.85rem',
                  }}
                >
                  <span>
                    Página {page} de {totalPaginas || 1}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn-main"
                      disabled={page === 1}
                      onClick={() =>
                        setPage((p) => Math.max(1, p - 1))
                      }
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
                        setPage((p) =>
                          Math.min(totalPaginas, p + 1)
                        )
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

        {/* ===============================
            VISTA SUBIDA NUEVO DOCUMENTO
           =============================== */}
        {view === 'upload' && (
          <NewDocumentForm
            API_URL={API_URL}
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
        {/* ===============================
              VISTA ADMIN USUARIOS
          =============================== */}
        {view === 'users' && (
          <UsersAdminView API_URL={API_URL} token={token} />
        )}
      </div>
    </div>
  );
}

export default App;

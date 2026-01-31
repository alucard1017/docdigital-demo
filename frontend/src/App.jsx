import { useState, useEffect } from 'react';
import './App.css';
import { Sidebar } from './components/Sidebar';
import { DetailView } from './components/DetailView';
import { ListHeader } from './components/ListHeader';
import { DocumentRow } from './components/DocumentRow';
import { DOC_STATUS } from './constants';
import { API_BASE_URL } from "./constants";

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

  const [firmanteRunValue, setFirmanteRunValue] = useState('');
  const [empresaRutValue, setEmpresaRutValue] = useState('');


  async function cargarFirmaPublica(token) {
    try {
      setPublicSignLoading(true);
      setPublicSignError('');
      const res = await fetch(`${API_URL}/api/docs/public/sign/${token}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'No se pudo cargar el documento');
        }

        setPublicSignDoc(data);
      } catch (err) {
        setPublicSignError(err.message);
        setPublicSignDoc(null);
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

    if (tokenUrl) {
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
      <div className="login-bg">
        <div className="login-card">
          <h1
            style={{
              textAlign: 'center',
              color: '#1e3a8a',
              marginBottom: 10,
              fontSize: '2rem',
              fontWeight: 800,
            }}
          >
            Firma Express
          </h1>
          <p
            style={{
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.85rem',
              marginBottom: 35,
            }}
          >
            Inicie sesión para gestionar sus documentos
          </p>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  display: 'block',
                  marginBottom: 10,
                  color: '#475569',
                }}
              >
                RUN / USUARIO
              </label>
              <input
                className="input-field"
                value={run}
                onChange={(e) => setRun(formatRun(e.target.value))}
                required
              />
            </div>

            <div style={{ marginBottom: 25 }}>
              <label
                style={{
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  display: 'block',
                  marginBottom: 10,
                  color: '#475569',
                }}
              >
                CONTRASEÑA
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input-field"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: '70px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 15,
                    top: 14,
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                >
                  {showPassword ? 'OCULTAR' : 'VER'}
                </button>
              </div>
            </div>

            <button
              className="btn-main btn-primary"
              style={{ width: '100%', fontSize: '1.1rem' }}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Conectando…' : 'ACCEDER AL PORTAL'}
            </button>
            <button
              type="button"
              style={{
                width: '100%',
                marginTop: 20,
                fontSize: 12,
                color: '#64748b',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              onClick={() => setShowHelp(!showHelp)}
            >
              ¿Perdiste tu contraseña o ClaveÚnica?
            </button>
          </form>

          {showHelp && (
            <div className="help-panel">
              <strong>Recuperación de acceso:</strong>
              <br />
              Si utiliza ClaveÚnica, recupérela en{' '}
              <strong>claveunica.gob.cl</strong>. Para cuentas
              administrativas (Alucard), contacte al soporte técnico.
            </div>
          )}

          {message && (
            <p
              style={{
                textAlign: 'center',
                marginTop: 30,
                fontWeight: 700,
                color: message.includes('❌') ? '#ef4444' : '#10b981',
              }}
            >
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }
  // ===============================
  // VISTA FIRMA PÚBLICA POR TOKEN
  // ===============================
  if (view === 'public-sign') {
    const pdfUrl = publicSignDoc?.file_url || "";
    
    return (
      <div className="login-bg">
        <div className="login-card" style={{ maxWidth: 800 }}>
          <h1
            style={{
              textAlign: 'center',
              color: '#1e3a8a',
              marginBottom: 10,
              fontSize: '2rem',
              fontWeight: 800,
            }}
          >
            Firma de Documento
          </h1>

          {publicSignLoading && (
            <p style={{ textAlign: 'center', marginTop: 20 }}>
              Cargando información del documento…
            </p>
          )}

          {publicSignError && (
            <p
            style={{
              textAlign: 'center',
              marginTop: 20,
              color: '#b91c1c',
              fontWeight: 600,
            }}
          >
            {publicSignError}
          </p>
        )}

        {publicSignDoc && !publicSignLoading && !publicSignError && (
          <>
          <p
          style={{
            textAlign: 'center',
            color: '#64748b',
            marginBottom: 20,
          }}
        >
          Documento: <strong>{publicSignDoc.title}</strong>
          <br />
          Empresa:{' '}
          <strong>{publicSignDoc.destinatario_nombre}</strong> (RUT{' '}
          {publicSignDoc.empresa_rut})
        </p>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-main btn-primary"
          style={{ textDecoration: 'none' }}
        >
          Ver documento en PDF
        </a>
        </div>

            <p
              style={{
                fontSize: '0.9rem',
                color: '#64748b',
                marginBottom: 20,
              }}
            >
              Representante legal:{' '}
              <strong>{publicSignDoc.firmante_nombre}</strong> (RUN{' '}
              {publicSignDoc.firmante_run})
            </p>

            {publicSignDoc.signature_status === 'FIRMADO' ? (
              <p
                style={{
                  textAlign: 'center',
                  color: '#16a34a',
                  fontWeight: 700,
                  marginTop: 10,
                }}
              >
                Este documento ya fue firmado.
              </p>
            ) : (
              <button
                className="btn-main btn-primary"
                style={{ width: '100%', marginTop: 10 }}
                onClick={async () => {
                  try {
                    const res = await fetch(
                      `${API_URL}/api/docs/public/sign/${publicSignToken}/confirm`,
                      { method: 'POST' }
                    );
                    const data = await res.json();
                    if (!res.ok) {
                      throw new Error(
                        data.message || 'No se pudo registrar la firma'
                      );
                    }
                    alert('✅ Firma registrada correctamente');
                    cargarFirmaPublica(publicSignToken);
                  } catch (err) {
                    alert('❌ ' + err.message);
                  }
                }}
              >
                FIRMAR DOCUMENTO
              </button>
            )}
          </>
        )}
      </div>
    </div>
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
    // filtro por estado
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
    // 'TODOS' no filtra nada

    // filtro por texto
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

  // Conteos globales por estado (independientes de filtros/búsqueda)
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

  // Paginación calculada a partir del filtro
  const totalPaginas = Math.ceil(docsFiltrados.length / pageSize);
  const docsPaginados = docsFiltrados.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  /* ===============================
     VISTA DASHBOARD (LIST + UPLOAD)
     =============================== */
     console.log('DEBUG SIMPLE');
     
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

        {console.log('DEBUG ESTADO:', {
          view,
          loadingDocs,
          errorDocs,
          docsPaginadosLength: docsPaginados.length,
          })}

        {view === 'list' ? (
          <div>
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
                <p
                  style={{ marginBottom: 16, fontSize: '0.9rem' }}
                >
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
                  Crear nuevo documento
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
          </div>
        ) : (
          /* ===============================
             VISTA SUBIDA NUEVO DOCUMENTO
             =============================== */
          <div className="card-premium">
            <h1
              style={{
                margin: 0,
                fontSize: '2rem',
                fontWeight: 800,
              }}
            >
              Nuevo Documento para Firma
            </h1>
            <p
              style={{
                color: '#64748b',
                marginBottom: 30,
                fontSize: '1.05rem',
              }}
            >
              Configure los participantes y cargue el PDF.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setFormErrors({});

                const form = e.target;
                const formData = new FormData(form);

                const firmanteRun = firmanteRunValue;
                const empresaRut = empresaRutValue;

                const firmanteRunClean = firmanteRunValue.replace(/[^0-9kK]/g, '');
                const empresaRutClean = empresaRutValue.replace(/[^0-9kK]/g, '');

                const title = form.title.value.trim();
                const firmanteEmail = form.firmante_email.value.trim();
                // Campos del firmante
                const firmanteNombre1 =
                  form.firmante_nombre1.value.trim();
                const firmanteNombre2 =
                  (form.firmante_nombre2?.value || '').trim();
                const firmanteApellido1 =
                  form.firmante_apellido1.value.trim();
                const firmanteApellido2 =
                  (form.firmante_apellido2?.value || '').trim();
                const firmanteMovil =
                  form.firmante_movil.value.trim(); 

                // Campos del destinatario / empresa
                const destinatarioNombre =
                  form.destinatario_nombre?.value.trim() || '';
                const destinatarioEmail =
                  form.destinatario_email.value.trim();

                const file = form.file.files[0];

                const newErrors = {};

                if (!title)
                  newErrors.title = 'Este campo es obligatorio.';
                if (!file)
                  newErrors.file = 'Adjunta un archivo PDF.';

                // Validación mínimos del firmante
                if (!firmanteNombre1)
                  newErrors.firmante_nombre1 =
                    'Este campo es obligatorio.';
                if (!firmanteApellido1)
                  newErrors.firmante_apellido1 =
                    'Este campo es obligatorio.';
                if (!firmanteEmail)
                  newErrors.firmante_email =
                    'Ingresa un correo válido.';
                if (!firmanteRunClean)
                  newErrors.firmante_run = 'RUN / RUT es obligatorio.';
                else {
                  if (firmanteRunClean.length < 8 || firmanteRunClean.length > 10) {
                    newErrors.firmante_run = 'RUN inválido (ej: 12.345.678-9)';
                  }
                }
                if (!firmanteMovil)
                  newErrors.firmante_movil = 'El teléfono es obligatorio.';

                // Validación mínimos del destinatario / empresa
                if (!destinatarioNombre)
                  newErrors.destinatario_nombre =
                    'Este campo es obligatorio.';
                if (!destinatarioEmail)
                  newErrors.destinatario_email =
                    'Ingresa un correo válido.';
                if (!empresaRutClean)
                  newErrors.empresa_rut = 'El RUT de la empresa es obligatorio.';
                else {
                  if (empresaRutClean.length < 8 || empresaRutClean.length > 10) {
                    newErrors.empresa_rut = 'RUT inválido (ej: 12.345.678-9)';
                  }
                } 

                if (Object.keys(newErrors).length > 0) {
                  setFormErrors(newErrors);
                  return;
                }

                // Opcional: construir nombres completos y agregarlos al formData
                const firmanteNombreCompleto = [
                  firmanteNombre1,
                  firmanteNombre2,
                  firmanteApellido1,
                  firmanteApellido2,
                  ].filter(Boolean).join(' ');

                  formData.append('firmante_nombre_completo', firmanteNombreCompleto);
                  formData.append('firmante_run', firmanteRunValue);
                  formData.append('firmante_movil', firmanteMovil);
                  formData.append('empresa_rut', empresaRutValue);
                  formData.append('requiresVisado', showVisador ? 'true' : 'false');;

                try {
                  const res = await fetch(
                    `${API_URL}/api/docs`,
                    {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${token}`,
                      },
                      body: formData,
                    }
                  );
                  if (!res.ok) throw new Error('Fallo en la subida');
                  alert('✅ ¡Documento procesado correctamente!');
                  form.reset();
                  setShowVisador(false);
                  setExtraSigners([]);
                  setFirmanteRunValue('');
                  setEmpresaRutValue('');
                  setView('list');
                  cargarDocs();
                } catch (err) {
                  alert(err.message);
                }
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr',
                  gap: 24,
                  marginBottom: 24,
                }}
              >
                <div>
                  <label
                    style={{
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      display: 'block',
                      marginBottom: 10,
                    }}
                  >
                    TÍTULO DEL DOCUMENTO
                  </label>
                  <input
                    name="title"
                    className="input-field"
                    required
                    placeholder="Ej: Contrato de Arriendo"
                  />
                  {formErrors.title && (
                    <p
                      style={{
                        color: '#b91c1c',
                        fontSize: '0.8rem',
                        marginTop: 4,
                      }}
                    >
                      {formErrors.title}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    style={{
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      display: 'block',
                      marginBottom: 10,
                    }}
                  >
                    ARCHIVO PDF
                  </label>
                  <input
                    type="file"
                    name="file"
                    accept=".pdf"
                    required
                    style={{ fontSize: '0.85rem' }}
                  />
                  {formErrors.file && (
                    <p
                      style={{
                        color: '#b91c1c',
                        fontSize: '0.8rem',
                        marginTop: 4,
                      }}
                    >
                      {formErrors.file}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: 30 }}>
                <label
                  style={{
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    display: 'block',
                    marginBottom: 10,
                  }}
                >
                  DESCRIPCIÓN Y OBSERVACIONES
                </label>
                <textarea
                  name="description"
                  className="input-field"
                  rows="4"
                  placeholder="Indique detalles relevantes..."
                />
              </div>

              <div
                style={{
                  background: '#f1f5f9',
                  padding: 24,
                  borderRadius: 22,
                  marginBottom: 32,
                  border: '1px solid #e2e8f0',
                }}
              >
                <label
                  style={{
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '1.05rem',
                    color: '#1e293b',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showVisador}
                    onChange={(e) =>
                      setShowVisador(e.target.checked)
                    }
                    style={{
                      marginRight: 15,
                      width: 22,
                      height: 22,
                    }}
                  />
                  ¿Este envío requiere la revisión previa de un
                  Visador?
                </label>

                {showVisador && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 20,
                      marginTop: 24,
                    }}
                  >
                    <input
                      name="visador_nombre"
                      className="input-field"
                      placeholder="Nombre Visador"
                      required={showVisador}
                    />
                    <input
                      name="visador_email"
                      type="email"
                      className="input-field"
                      placeholder="Email Visador"
                      required={showVisador}
                    />
                    <input
                      name="visador_movil"
                      className="input-field"
                      placeholder="Móvil (Opcional)"
                    />
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 24,
                }}
              >
                {/* FIRMANTE FINAL */}
                <div className="card-mini" style={{ marginTop: 0 }}>
                  <h4>✍️ Firmante Final (Responsable)</h4>
                  <div className="card-content">
                    <input
                      name="firmante_nombre1"
                      className="input-field"
                      required
                      placeholder="Primer nombre *"
                    />
                    {formErrors.firmante_nombre1 && (
                      <p
                        style={{
                          color: '#b91c1c',
                          fontSize: '0.8rem',
                          marginTop: 4,
                        }}
                      >
                        {formErrors.firmante_nombre1}
                      </p>
                    )}

                    <input
                      name="firmante_nombre2"
                      className="input-field"
                      placeholder="Segundo nombre"
                    />

                    <input
                      name="firmante_apellido1"
                      className="input-field"
                      required
                      placeholder="Primer apellido *"
                    />
                    {formErrors.firmante_apellido1 && (
                      <p
                        style={{
                          color: '#b91c1c',
                          fontSize: '0.8rem',
                          marginTop: 4,
                        }}
                      >
                        {formErrors.firmante_apellido1}
                      </p>
                    )}

                    <input
                      name="firmante_apellido2"
                      className="input-field"
                      placeholder="Segundo apellido"
                    />

                    <input
                      name="firmante_email"
                      type="email"
                      className="input-field"
                      required
                      placeholder="Email corporativo *"
                    />
                    {formErrors.firmante_email && (
                      <p
                        style={{
                          color: '#b91c1c',
                          fontSize: '0.8rem',
                          marginTop: 4,
                        }}
                      >
                        {formErrors.firmante_email}
                      </p>
                    )}

                    <input
                      name="firmante_run"
                      className="input-field"
                      required
                      placeholder="RUN / RUT del representante *"
                      value={firmanteRunValue}
                     onChange={(e) => setFirmanteRunValue(formatRunDoc(e.target.value))}
                    />
                    {formErrors.firmante_run && (
                      <p
                        style={{
                          color: '#b91c1c',
                          fontSize: '0.8rem',
                          marginTop: 4,
                        }}
                      >
                        {formErrors.firmante_run}
                      </p>
                    )}

                    <input
                      name="firmante_movil"
                      className="input-field"
                      required
                      placeholder="Teléfono móvil del representante *"
                    />
                    {formErrors.firmante_movil && (
                      <p
                        style={{
                          color: '#b91c1c',
                          fontSize: '0.8rem',
                          marginTop: 4,
                        }}
                      >
                        {formErrors.firmante_movil}
                      </p>
                    )}
                  </div>
                </div>

                {/* DESTINATARIO / EMPRESA */}
                <div className="card-mini" style={{ marginTop: 0 }}>
                  <h4>🏢 Destinatario / Empresa</h4>
                  <div className="card-content">
                    <input
                      name="destinatario_nombre"
                      className="input-field"
                      required
                      placeholder="Razón Social *"
                    />
                    {formErrors.destinatario_nombre && (
                      <p
                        style={{
                          color: '#b91c1c',
                          fontSize: '0.8rem',
                          marginTop: 4,
                        }}
                      >
                        {formErrors.destinatario_nombre}
                      </p>
                    )}

                    <input
                      name="empresa_rut"
                      className="input-field"
                      required
                      placeholder="RUT de la empresa *"
                      value={empresaRutValue}
                      onChange={(e) => setEmpresaRutValue(formatRunDoc(e.target.value))}
                    />
                    {formErrors.empresa_rut && (
                      <p
                        style={{
                          color: '#b91c1c',
                          fontSize: '0.8rem',
                          marginTop: 4,
                        }}
                      >
                        {formErrors.empresa_rut}
                      </p>
                    )}

                    <input
                      name="destinatario_email"
                      type="email"
                      className="input-field"
                      required
                      placeholder="Email de contacto *"
                    />
                    {formErrors.destinatario_email && (
                      <p
                        style={{
                          color: '#b91c1c',
                          fontSize: '0.8rem',
                          marginTop: 4,
                        }}
                      >
                        {formErrors.destinatario_email}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {extraSigners.map((signer, index) => (
                <div
                  key={signer.id}
                  className="card-mini"
                >
                  <h4>
                    <span>
                      ➕ Firmante Adicional #{index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExtraSigners(
                          extraSigners.filter(
                            (s) => s.id !== signer.id
                          )
                        )
                      }
                      style={{
                        color: '#ef4444',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                      }}
                    >
                      ELIMINAR
                    </button>
                  </h4>
                  <div
                    className="card-content"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 20,
                    }}
                  >
                    <input
                      name={`extra_nombre_${index}`}
                      className="input-field"
                      placeholder="Nombre completo *"
                      required
                    />
                    <input
                      name={`extra_email_${index}`}
                      type="email"
                      className="input-field"
                      placeholder="Email *"
                      required
                    />
                    <input
                      name={`extra_movil_${index}`}
                      className="input-field"
                      placeholder="Móvil"
                    />
                  </div>
                </div>
              ))}

              <div
                style={{
                  marginTop: 32,
                  display: 'flex',
                  gap: 16,
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: 24,
                }}
              >
                <button
                  type="button"
                  className="btn-main"
                  onClick={() =>
                    setExtraSigners([
                      ...extraSigners,
                      { id: Date.now() },
                    ])
                  }
                  style={{
                    background: '#e2e8f0',
                    color: '#475569',
                    padding: '12px 26px',
                  }}
                >
                  + Añadir firmante adicional
                </button>
                <button
                  type="submit"
                  className="btn-main btn-primary"
                  style={{
                    padding: '12px 80px',
                    fontSize: '1rem',
                    flexGrow: 1,
                  }}
                >
                  INICIAR FLUJO DE FIRMA DIGITAL
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

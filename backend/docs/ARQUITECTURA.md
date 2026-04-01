Arquitectura VeriFirma – Backend & Frontend
Este documento resume cómo está organizada la aplicación VeriFirma a nivel de módulos, qué hace cada parte y cómo se conectan entre sí. La idea es que cualquier persona nueva en el proyecto pueda ubicarse en menos de 10 minutos y tenga claro dónde tocar para backend, frontend, auditoría y tiempo real.

1. Visión general
VeriFirma es una aplicación multi‑tenant de firma electrónica con:

Backend Node.js/Express:

API REST bajo /api.

Autenticación JWT + cookies (según entorno).

Auditoría centralizada.

Gestión de PDFs (hash, sello, QR, verificación de integridad).

Integración con almacenamiento tipo S3/R2.

Jobs programados (recordatorios).

Frontend React (SPA):

Panel de usuario y panel administrador.

Portales públicos de firma y verificación.

Comunicación con API vía axios centralizado (frontend/src/api/client.js).

WebSockets mediante socket.io-client encapsulado en useSocket.

Auditoría centralizada:

audit_log: acciones de negocio (documentos, usuarios, empresas, etc.).

auth_log: eventos de autenticación (login, fallos, cambios de contraseña).

Seguridad y multi‑tenant:

Roles: USER, ADMIN, ADMIN_GLOBAL, SUPER_ADMIN (y OWNER configurado).

company_id en tablas clave.

Verificación de integridad de PDFs por hash (sha256) cada vez que se descarga o visualiza.

2. Backend (backend/)
2.1 Entrypoint y configuración
backend/server.js
Responsable de levantar toda la API y el servidor HTTP:

Configuración inicial:

Carga de variables de entorno (.env, .env.development, etc.).

Inicialización de Sentry para captura de errores.

Express y middlewares globales:

Helmet, CORS configurado manualmente, parsers JSON/URL‑encoded.

Rate limiting general y específico por tipo de ruta.

requestMeta (middleware): agrega requestId, IP y user‑agent a req para trazabilidad y auditoría.

Rutas principales (todas bajo /api):

/api/auth – autenticación.

/api/users – administración de usuarios.

/api/docs – documentos y flujos de firma.

/api/public – endpoints públicos (firma, verificación).

/api/companies – gestión de empresas.

/api/health – health‑check de API + DB + storage.

/api/info – información básica de la API.

Static & SPA:

En producción sirve el frontend compilado (React) como SPA.

Errores y jobs:

Manejo de errores global: errorHandler + reporte a Sentry.

Ruta 404 JSON consistente.

Registro de tareas programadas (backend/jobs/reminderScheduler) para recordatorios de firma.

2.2 Rutas principales (backend/routes/)
backend/routes/auth.js
Endpoints:

POST /api/auth/login – login por RUN o correo + contraseña.

GET /api/auth/me – información de la sesión actual.

Middlewares:

requireAuth – valida JWT (y/o cookies) y expone req.user.

requireRole – valida que el usuario tenga un rol mínimo dado.

Auditoría de autenticación con logAuth:

login_failed – usuario no encontrado, inactivo o contraseña incorrecta.

login_success – incluye user_id, rol y company_id cuando aplica.

backend/routes/users.js
Endpoints principales:

GET /api/users – listado de usuarios.

POST /api/users – creación.

PUT /api/users/:id – actualización.

DELETE /api/users/:id – borrado.

POST /api/users/:id/reset-password – reset de contraseña por admin.

Reglas de negocio:

OWNER (RUN configurado) no se puede borrar ni modificar salvo por sí mismo.

ADMIN_GLOBAL y SUPER_ADMIN tienen privilegios globales.

ADMIN opera solo dentro de su company_id.

Auditoría:

logAudit:

user_registered_public

user_created

user_updated

user_deleted

password_reset_by_admin

logAuth:

password_change cuando un admin resetea la contraseña de un usuario.

backend/routes/documents.js
Endpoints bajo /api/docs:

Listado de documentos: GET /api/docs.

Estadísticas: GET /api/docs/stats.

Analytics: GET /api/docs/analytics.

Creación de flujo/documento:

POST /api/docs

POST /api/docs/crear-flujo.

Acciones sobre un documento:

POST /api/docs/:id/firmar

POST /api/docs/:id/visar

POST /api/docs/:id/rechazar.

Recordatorios automáticos y manuales.

Timeline, PDF, descarga y reportes: GET /api/docs/:id/*.

Seguridad multi‑tenant:

checkDocumentCompanyScope: asegura que el documento pertenece a la company_id del usuario (salvo admins globales).

isGlobalAdmin: identifica SUPER_ADMIN / ADMIN_GLOBAL.

Auditoría:

logAuditAction envuelve algunas respuestas clave de documentos para registrar la operación en auditoría; hay una migración en curso desde auditoria_documentos hacia audit_log unificado.

2.3 Controladores de documentos (backend/controllers/documents/)
common.js
Utilidades y servicios compartidos entre controladores:

Dependencias:

db (PostgreSQL), axios, fs, path, crypto.

Servicios externos:

Email: sendSigningInvitation, sendVisadoInvitation.

Storage: uploadPdfToS3, getSignedUrl (R2/S3).

PDFs:

Uso de PDFDocument, rgb, degrees.

Marca de agua: aplicarMarcaAguaLocal.

Sellado visual con QR: sellarPdfConQr.

Identificadores internos y verificación:

computeHash(buffer) – calcula hash sha256 de un PDF.

generarNumeroContratoInterno – correlativo interno de documento.

generarCodigoVerificacion – código alfanumérico para verificación pública.

Auditoría heredada:

registrarAuditoria – logger antiguo sobre auditoria_documentos, en fase de sustitución por audit_log.

create.js
getUserDocuments(req, res):

Lista documentos visibles para el usuario logueado.

Soporta ordenamiento por fecha, número interno, etc.

createDocument(req, res):

Validación de PDF:

Requerido.

mimetype = application/pdf.

Tamaño máximo (por defecto 10 MB).

Calcula pdf_hash (sha256) del archivo original.

Sube a S3:

PDF original.

PDF con marca de agua “VERIFIRMA”.

Inserta en tablas:

documents: datos de negocio (título, destinatario, firmante, visador, etc.).

company_id del usuario.

pdf_hash, original_url, final_url.

Modelo de flujo modernizado:

Crea registro en documentos + firmantes (nuevo modelo de flujo).

Notificaciones:

Envía correos al firmante principal y adicionales.

Envía notificaciones de visado (si aplica).

Envía correo informativo al destinatario.

Auditoría:

logAudit con action: "document_created" y metadatos relevantes.

signing.js
signDocument(req, res):

Valida que se pueda firmar (estado correcto, visado previo si es requerido).

Cambia estado a FIRMADO.

Registra evento en document_events.

Para el modelo nuevo (nuevo_documento_id):

Recupera datos de documentos.

Sella el PDF con QR, actualiza pdf_final_url.

Auditoría:

logAudit con action: "document_signed".

visarDocument(req, res):

Pasa de PENDIENTE_VISADO a PENDIENTE_FIRMA.

Registra evento VISADO.

logAudit con action: "document_visado".

rejectDocument(req, res):

Cambia estado a RECHAZADO con motivo.

Registra evento RECHAZADO.

logAudit con action: "document_rejected".

timeline.js
getDocumentPdf(req, res):

Recupera rutas/URLs de PDF y pdf_hash.

Elige PDF final (si firmado) o original (si pendiente).

Descarga el archivo desde S3, recalcula sha256 y compara con pdf_hash.

Hash inconsistente:

Devuelve 409.

Registra public_document_hash_mismatch en audit_log.

Hash consistente:

Genera URL firmada y la devuelve al frontend para descarga/visualización.

getTimeline(req, res):

Devuelve datos básicos del documento.

Devuelve lista ordenada de document_events (timeline).

Calcula paso actual, siguiente paso y progreso estimado.

getSigners(req, res):

Verifica que el documento pertenezca a la company_id del usuario autenticado.

Devuelve firmantes (document_signers) y su estado.

report.js
downloadDocument(req, res):

Descarga PDF autenticado usando getSignedUrl.

Recalcula hash de contenido y compara con pdf_hash.

Si mismatch:

Registra document_hash_mismatch en audit_log.

Devuelve 409.

Si todo ok:

Devuelve el buffer al cliente.

getDocumentAnalytics(req, res):

Métricas por usuario:

Total de documentos, firmados, rechazados, pendientes.

Tasa de firma/rechazo.

Tiempo medio de firma.

Timeline agregado de eventos por día (actividad histórica).

downloadReportPdf(req, res):

Genera un PDF resumen del documento:

Resumen de datos principales.

Lista de firmantes, estados y fechas.

Eventos relevantes del timeline.

2.4 Auditoría (backend/utils/audit.js)
logAudit({ user, action, entityType, entityId, metadata, req }):

Inserta en audit_log:

user_id, company_id (si vienen de user).

action, entity_type, entity_id.

metadata (JSON).

IP, user‑agent, request_id (desde requestMeta).

logAuth({ userId, run, action, metadata, req }):

Inserta en auth_log:

user_id o run (cuando no hay usuario persistido).

action (login_success, login_failed, password_change, etc.).

metadata, IP, user‑agent, request_id.

3. Frontend (frontend/)
3.1 App principal (frontend/src/App.jsx)
App.jsx es el “orquestador” actual del frontend:

Estado global del cliente:

Sesión: token, user, rehidratados desde localStorage si existen.

Vista actual: view (list, upload, detail, users, dashboard, companies, status, pricing, etc.).

Documentos: lista, filtros (statusFilter, search), orden (sort), paginación (page), documento seleccionado (selectedDoc + pdfUrl).

Portales públicos: estado de firma pública y verificación (publicSignDoc, publicSignToken, publicSignPdfUrl, publicSignMode).

Onboarding: showOnboarding, runProductTour, checkingOnboarding.

Determinación de modo según dominio y ruta:

Usa getSubdomain() y window.location.pathname:

App normal (dashboard y panel).

Portal de verificación (subdominio verificar o ruta /verificar).

Portal de firma pública (subdominio firmar y rutas /public/sign, /firma-publica, /consulta-publica).

Conexión con API (api/client.js):

Autenticación: POST /auth/login.

Onboarding: GET /onboarding/status.

Documentos: GET /docs, /docs/:id/pdf, /documents/:id/preview, /documents/:id/timeline.

Acciones de negocio: POST /docs/:id/firmar|visar|rechazar.

WebSockets:

Usa useSocket(token) para escuchar eventos:

"document:sent"

"document:signed"

En cada evento recarga la lista (cargarDocs) y actualmente muestra un alert() al usuario (pendiente de migrar a sistema de notificaciones más amable).

Vistas y navegación interna:

Renderiza LoginView si no hay token (y maneja rutas especiales /forgot-password, /reset-password, /register).

Una vez logueado, muestra layout principal:

Sidebar (navegación).

ProductTour y OnboardingWizard.

Vistas según view: listado, detalle, creación de documento, panel de usuarios, empresas, status, analytics, pricing, perfil, plantillas, etc.

3.2 API client (frontend/src/api/client.js)
frontend/src/api/client.js
Base URL:

getApiBaseUrl():

Usa import.meta.env.VITE_API_URL si está definido.

Normaliza eliminando slashes finales.

Fallback: http://localhost:4000/api.

Exporta API_BASE_URL para uso en otras partes del frontend.

Instancia Axios (api):

baseURL: API_BASE_URL.

timeout: 30000.

withCredentials: true (permite cookies httpOnly cuando existan).

Gestión de token:

getAccessToken() lee accessToken desde localStorage (mientras se evalúa una futura migración a un modelo más centrado en cookies/refresh).

Interceptor de request:

Añade Authorization: Bearer <token> si hay token.

Loggea en desarrollo información de la petición.

Gestión de errores:

Interceptor de response:

Loggea errores en desarrollo.

Para 401 con mensajes "Token expirado" o "Token inválido":

Limpia sesión (accessToken, user) y redirige a /login.

Helpers expuestos:

getDocumentTimeline(id) – GET /documents/:id/timeline y devuelve data.

default export – instancia api para uso general en el frontend.

3.3 WebSockets (frontend/src/hooks/useSocket.js)
frontend/src/hooks/useSocket.js
Construcción de URL de socket:

buildSocketUrl():

Intenta VITE_SOCKET_URL.

Si no, deriva desde VITE_API_URL removiendo /api o /api/.

Fallback: http://localhost:4000.

Resultado cacheado en SOCKET_URL.

Hook useSocket(accessToken):

Si no hay accessToken:

Se asegura de desconectar cualquier socket previo y limpiar listeners.

Si hay accessToken:

Crea una conexión io(SOCKET_URL, { auth: { token: accessToken }, transports, withCredentials: true }).

Registra logs en connect, disconnect y connect_error.

Mantiene referencia en socketRef.

Cleanup:

En el return del useEffect se desregistran todos los listeners almacenados en listenersRef y se desconecta el socket.

API expuesta:

on(event, callback) – registra listeners y los almacena en listenersRef.

off(event, callback) – desregistra el listener y limpia referencias internas.

El hook devuelve siempre { on, off }, de forma que el componente que lo usa no accede directamente al objeto socket crudo.

3.4 Componentes de layout (frontend/src/components/)
Sidebar.jsx
Menú lateral de navegación y overview rápido de la bandeja:

Muestra información de sesión:

Nombre, correo, rol del usuario actual.

Secciones típicas:

Bandeja:

“Mis trámites”.

“Crear nuevo trámite”.

Atajos:

Filtros rápidos: pendientes, firmados, rechazados.

Verificar documento:

Acceso a vista de verificación pública/interna.

Reportes / Estado:

“Analytics”.

“Dashboard” (para admins).

“Estado” (abre StatusAdminView).

Administración (según rol):

“Usuarios”.

“Empresas” (para OWNER y ADMIN_GLOBAL).

Al hacer clic sobre cada ítem actualiza view en App.jsx y resetea paginación/filtros donde aplica.

Otros componentes relevantes
ListHeader.jsx:

Encabezado de la lista de documentos:

Selector de orden (sort).

Selector de estado (statusFilter).

Búsqueda por texto (search).

Botón “Sincronizar” (onSync → cargarDocs).

DocumentRow.jsx:

Representa una fila en la tabla de documentos.

Permite abrir el detalle (setSelectedDoc + view="detail").

DetailView.jsx:

Muestra PDF (pdfUrl), estado del documento y botones de acción:

Firmar, visar, rechazar (según permisos y estado).

Usa manejarAccionDocumento para llamar a los endpoints /docs/:id/firmar|visar|rechazar.

OnboardingWizard y ProductTour:

Experiences de onboarding y tour guiado, controlados desde App.jsx mediante showOnboarding y runProductTour.

3.5 Vistas (frontend/src/views/)
LoginView.jsx
Pantalla de login por RUN (formateado) o correo + contraseña. Consume POST /auth/login vía api.

NewDocumentForm.jsx
Formulario de creación de nuevo flujo de firma. Sube PDF y llama a POST /docs. Integra validaciones de RUT/RUN en frontend y soporta firmantes adicionales/visador.

PublicSignView.jsx
Portal público de firma/visado por token:

Recibe token por query (?token=) y modo (mode=visado, etc.).

Llama a endpoints públicos bajo /api/public/docs/....

VerificationView.jsx
Portal de verificación de documentos:

Usa APIs públicas de verificación para validar hash, estado y datos estructurados del documento.

UsersAdminView.jsx
Panel de administración de usuarios conectado a /api/users. Permite CRUD, reset de contraseña y ofrece filtros por estado/rol.

CompaniesAdminView.jsx
Administración de empresas (/api/companies), solo para roles con permisos globales.

DashboardView.jsx
Dashboard admin con métricas y gráficas a partir de /api/docs/stats, /api/docs/analytics y endpoints relacionados.

StatusAdminView.jsx
Panel de estado interno:

Usa /api/health.

Muestra estado de API, uptime, base de datos y almacenamiento.

Base para futuras métricas de fiabilidad (fallos de login, acciones por día, colas, etc.).

Otras vistas:

RemindersConfigView, EmailMetricsView, CompanyAnalyticsView, PricingView, ProfileView, TemplatesView, AuditLogsView, AuthLogsView, ForgotPasswordView, ResetPasswordView, RegisterView, etc., todas montadas desde App.jsx según view y permisos.

4. Convenciones y próximos pasos
4.1 Convenciones actuales
Rutas backend:

Todo endpoint REST va bajo /api/....

Rutas públicas concentradas en /api/public.

Documentos:

Controladores agrupados en backend/controllers/documents/*.

Modelo antiguo (auditoria_documentos) en transición a modelo nuevo con documentos, firmantes y document_events, más audit_log.

Auditoría:

Acciones de negocio importantes deben llamar a logAudit.

Eventos de autenticación deben llamar a logAuth.

Multi‑tenant:

Tablas clave incluyen company_id.

Endpoints sensibles verifican scope de empresa vía checkDocumentCompanyScope o roles globales.

Frontend:

API HTTP centralizada en frontend/src/api/client.js.

WebSockets encapsulados en frontend/src/hooks/useSocket.js.

Estado global todavía concentrado en App.jsx, con vistas desacopladas en views/ y components/.

4.2 Mejoras planeadas / recomendadas
Estas son líneas claras de evolución del sistema:

Métricas y observabilidad:

Nuevo endpoint, por ejemplo /api/status/metrics, que exponga:

Número de login_failed últimos X minutos (desde auth_log).

Resumen de acciones de audit_log agrupadas por tipo y rango de tiempo.

Complementar StatusAdminView con estas métricas.

Migración de auditoría:

Completar migración desde auditoria_documentos a audit_log en todos los controladores de documentos.

Unificar formato de metadata y entity_type para reporting.

Vistas admin de auditoría:

Exponer /api/audit y /api/auth-log para:

Historial de acciones de negocio (filtrable por usuario, empresa, tipo, fecha).

Historial de login (intentos fallidos, reintentos, cambios de contraseña).

Conectarlo a AuditLogsView y AuthLogsView en frontend.

Arquitectura frontend:

Extraer la lógica de sesión a un AuthProvider / useAuth, reduciendo la responsabilidad de App.jsx.

Extraer la lógica de documentos a un hook dedicado (useDocuments) o a un pequeño store.

Sustituir el sistema actual de “views” por un router más explícito (React Router) manteniendo las rutas públicas/privadas y soportando deep‑links limpios.

Reemplazar alert() por un sistema de notificaciones/ toasts desacoplado.

Seguridad del frontend:

Reducir dependencia de localStorage para tokens y acercar la sesión a cookies httpOnly + refresh tokens gestionados desde backend.

Mantener api/client.js como única fuente de verdad para HTTP (evitar fetch sueltos con API_BASE_URL concatenado a mano).

5. Cómo usar este documento
Para debug:

Localiza primero la ruta en backend/server.js y el archivo en backend/routes/*.

Sigue hacia el controlador correspondiente en backend/controllers/*.

Si hay efectos de auditoría o jobs, revisa también backend/utils/audit.js y backend/jobs/*.

Para añadir funcionalidad:

Decide si es lógica de negocio (usa logAudit) o autenticación (usa logAuth).

Ubica el módulo adecuado (routes, controllers/documents, views, components).

Respeta convenciones de multi‑tenant (company_id, roles) y de auditoría.

Para onboarding de una persona nueva**:

Recomendado:

Leer este archivo completo.

Abrir backend/server.js, backend/routes/documents.js, backend/controllers/documents/create.js.

Revisar frontend/src/App.jsx, frontend/src/api/client.js y frontend/src/hooks/useSocket.js.
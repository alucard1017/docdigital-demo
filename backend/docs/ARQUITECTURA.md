# Arquitectura VeriFirma – Backend & Frontend

Este documento resume cómo está organizada la aplicación VeriFirma a nivel de módulos de código, qué hace cada archivo y cómo se conectan entre sí.  
La idea es que cualquier persona nueva en el proyecto pueda ubicarse en menos de 10 minutos.

---

## 1. Visión general

VeriFirma es una aplicación multi‑tenant de firma electrónica con:

- **Backend Node.js/Express**: API REST, autenticación, auditoría, PDFs, S3/R2, jobs.
- **Frontend React SPA**: panel de usuario, panel admin, portales de firma y verificación.
- **Auditoría centralizada**:
  - `audit_log`: acciones de negocio (documentos, usuarios, etc.).
  - `auth_log`: eventos de autenticación (login, fallos, cambios de contraseña).
- **Seguridad**:
  - JWT + roles (USER, ADMIN, ADMIN_GLOBAL, SUPER_ADMIN, OWNER).
  - Verificación de integridad de PDFs por hash (`sha256`) al descargar/visualizar.

---

## 2. Backend (`backend/`)

### 2.1 Entrypoint y configuración

#### `backend/server.js`

Responsable de levantar toda la API:

- Carga de variables de entorno (`.env` / `.env.development`) y Sentry.
- Inicializa **Express**, Helmet, CORS manual, rate limiting general y por tipo de ruta.
- Middleware global `requestMeta` (agrega `requestId`, IP y user‑agent al `req`).
- Registra rutas principales:
  - `/api/auth` – autenticación.
  - `/api/users` – administración de usuarios.
  - `/api/docs` – documentos y flujos de firma.
  - `/api/public` – endpoints públicos (firma, verificación).
  - `/api/companies` – gestión de empresas.
  - `/api/health` – health‑check de API + DB + storage.
  - `/api/info` – info estática de la API.
- Sirve el **frontend** compilado (React) en producción.
- Maneja:
  - Errores globales (middleware `errorHandler` + Sentry).
  - Ruta 404 JSON.
  - Tareas programadas (`backend/jobs/reminderScheduler`).

---

### 2.2 Rutas principales (`backend/routes`)

#### `backend/routes/auth.js`

- Endpoints:
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- Middleware:
  - `requireAuth` – valida JWT y expone `req.user`.
  - `requireRole` – comprueba permisos por rol.
- Auditoría de autenticación:
  - Usa `logAuth` para registrar:
    - `login_failed` (usuario no encontrado, inactivo, contraseña incorrecta).
    - `login_success` (usuario, rol, `company_id`).

#### `backend/routes/users.js`

- Endpoints:
  - CRUD de usuarios:  
    - `GET /api/users`  
    - `POST /api/users`  
    - `PUT /api/users/:id`  
    - `DELETE /api/users/:id`
  - Reset de contraseña por admin:  
    - `POST /api/users/:id/reset-password`
- Reglas de negocio:
  - OWNER (RUN configurado) no se puede borrar ni modificar salvo por sí mismo.
  - ADMIN_GLOBAL y SUPER_ADMIN tienen privilegios más amplios.
  - ADMIN solo puede operar dentro de su `company_id`.
- Auditoría:
  - `logAudit`:
    - `user_registered_public`
    - `user_created`
    - `user_updated`
    - `user_deleted`
    - `password_reset_by_admin`
  - `logAuth`:
    - `password_change` (cuando un admin resetea contraseña de un usuario).

#### `backend/routes/documents.js`

- Endpoints bajo `/api/docs`:
  - Listado: `GET /api/docs`
  - Estadísticas: `GET /api/docs/stats`
  - Analytics: `GET /api/docs/analytics`
  - Crear flujo/documento: `POST /api/docs` y `POST /api/docs/crear-flujo`
  - Firmar/visar/rechazar: `POST /api/docs/:id/firmar|visar|rechazar`
  - Recordatorios: automáticos y manuales.
  - Timeline, PDF, descarga, reporte: `GET /api/docs/:id/*`
- Seguridad multi‑tenant:
  - `checkDocumentCompanyScope`: verifica que el documento pertenezca a la `company_id` del usuario, salvo admins globales.
  - `isGlobalAdmin`: detecta `SUPER_ADMIN` / `ADMIN_GLOBAL`.
- Auditoría:
  - `logAuditAction` envuelve `res.json` en acciones clave para registrar la operación en `auditoria_documentos` (en transición a `audit_log` global).

---

### 2.3 Controladores de documentos (`backend/controllers/documents`)

#### `common.js`

Utilidades compartidas:

- Dependencias base: `db`, `axios`, `fs`, `path`, `crypto`.
- Servicios:
  - Email: `sendSigningInvitation`, `sendVisadoInvitation`.
  - Storage: `uploadPdfToS3`, `getSignedUrl` (R2/S3).
  - PDF: `PDFDocument`, `rgb`, `degrees`, marca de agua `aplicarMarcaAguaLocal`.
  - Sellado: `sellarPdfConQr` (QR + firma visual).
  - Números internos: `generarNumeroContratoInterno`.
- Hash:
  - `computeHash(buffer)` – calcula `sha256` de un PDF.
- Otros:
  - `generarCodigoVerificacion` – código alfanumérico para verificación de documentos.
  - `registrarAuditoria` – logger antiguo contra `auditoria_documentos` (en proceso de migración).

#### `create.js`

- `getUserDocuments(req, res)`:
  - Lista documentos del owner logueado.
  - Respeta ordenamiento por fecha, número interno, etc.
- `createDocument(req, res)`:
  - Valida PDF:
    - Requerido.
    - `mimetype === application/pdf`.
    - Tamaño máximo (10 MB).
  - Calcula `pdf_hash` (sha256) del archivo original.
  - Sube a S3:
    - Original.
    - PDF con marca de agua “VERIFIRMA”.
  - Inserta en `documents`:
    - Datos de negocio (título, destinatario, firmante, visador...).
    - `company_id` del usuario.
    - `pdf_hash`, URLs original/final.
  - Genera correlativo interno (`numero_contrato_interno`) y lo persiste.
  - Crea fila en nueva tabla `documentos` + `firmantes` para el modelo de flujo modernizado.
  - Envía correos:
    - Invitación a firmante principal y firmante adicional (si existe).
    - Invitación a visador (si aplica).
    - Notificación informativa al destinatario.
  - Auditoría:
    - Llama a `logAudit` con `action: "document_created"`.

#### `signing.js`

- `signDocument(req, res)`:
  - Verifica que el owner pueda firmar (estado, visado, etc.).
  - Actualiza estado del documento a `FIRMADO`.
  - Registra evento en `document_events`.
  - Si hay `nuevo_documento_id`:
    - Obtiene datos de `documentos`.
    - Sella PDF con QR y actualiza `pdf_final_url`.
  - `logAudit` con `action: "document_signed"`.

- `visarDocument(req, res)`:
  - Cambia estado de `PENDIENTE_VISADO` a `PENDIENTE_FIRMA`.
  - Registra evento `VISADO`.
  - `logAudit` con `action: "document_visado"`.

- `rejectDocument(req, res)`:
  - Cambia estado a `RECHAZADO` con motivo.
  - Registra evento `RECHAZADO`.
  - `logAudit` con `action: "document_rejected"`.

#### `timeline.js`

- `getDocumentPdf(req, res)`:
  - Recupera `file_path`, URLs de PDF y `pdf_hash`.
  - Elige:
    - PDF final si está firmado.
    - PDF original en caso contrario.
  - Descarga el PDF desde S3, recalcula `sha256` y compara con `pdf_hash`.
  - Si el hash no coincide:
    - Devuelve error 409.
    - Registra `public_document_hash_mismatch` en `audit_log`.
  - Si es consistente:
    - Genera URL firmada y la devuelve al frontend.

- `getTimeline(req, res)`:
  - Devuelve datos básicos del documento y lista ordenada de `document_events`.
  - Calcula paso actual, siguiente y progreso estimado.

- `getSigners(req, res)`:
  - Valida que el documento pertenece al owner autenticado.
  - Devuelve la lista de `document_signers`.

#### `report.js`

- `downloadDocument(req, res)`:
  - Descarga el PDF (autenticado) usando `getSignedUrl`.
  - Calcula hash actual y lo compara con `pdf_hash`.
  - Si hay mismatch, registra `document_hash_mismatch` en `audit_log` y devuelve 409.
  - Si todo ok, envía el buffer al cliente.

- `getDocumentAnalytics(req, res)`:
  - Métricas por usuario:
    - totales, firmados, rechazados, pendientes.
    - tasa de firma/rechazo.
    - tiempo medio de firma.
  - Devuelve timeline agregado de eventos por día.

- `downloadReportPdf(req, res)`:
  - Construye un PDF con:
    - resumen del documento.
    - lista de firmantes (estados y fechas).
    - primeros eventos relevantes.

---

### 2.4 Auditoría (`backend/utils/audit.js`)

- `logAudit({ user, action, entityType, entityId, metadata, req })`:
  - Inserta en `audit_log`:
    - `user_id`, `company_id` (si hay usuario).
    - `action`, `entity_type`, `entity_id`.
    - `metadata` (JSON).
    - IP, user‑agent, `request_id`.
- `logAuth({ userId, run, action, metadata, req })`:
  - Inserta en `auth_log`:
    - `user_id` o `run` (cuando no existe).
    - `action` (login_success, login_failed, password_change...).
    - `metadata`, IP, user‑agent, `request_id`.

---

## 3. Frontend (`frontend/`)

### 3.1 App principal

#### `frontend/src/App.jsx`

- Mantiene el **estado global** del cliente:
  - Sesión (`token`, `user`).
  - Vista actual (`view`: list, upload, detail, users, dashboard, companies, status, etc.).
  - Documentos, filtros, paginación, selección.
  - Estado del portal público de firma/verificación.
- Determina el **modo** según dominio y ruta:
  - App normal.
  - Portal de verificación (subdominio `verificar` o `/verificar`).
  - Portal de firma (subdominio `firmar` o rutas públicas).
- Conecta con la API:
  - `/api/docs`, `/api/docs/:id/pdf`, `/api/docs/:id/timeline`.
  - `/api/auth/login`.
  - `/api/health` (para StatusAdmin).
- Pasa props clave a:
  - `Sidebar` (navegación, contadores).
  - `ListHeader` (filtros, ordenamiento).
  - `DetailView`, `NewDocumentForm`, vistas admin, etc.

---

### 3.2 Componentes de layout (`frontend/src/components`)

#### `Sidebar.jsx`

- Menú lateral de navegación.
- Muestra:
  - Información de sesión (nombre, email, rol).
  - Secciones:
    - **Bandeja**: “Mis trámites”, “Crear nuevo trámite”.
    - **Atajos**: filtros rápidos (pendientes, firmados, rechazados).
    - **Verificar documento**: navegación a vista de verificación.
    - **Reportes**:
      - “Analytics”.
      - “Dashboard” (solo admins).
      - “Estado” (solo admins; abre `StatusAdminView`).
    - **Administración** (solo OWNER y admins):
      - “Usuarios”.
      - “Empresas” (solo OWNER y ADMIN_GLOBAL).
- Al hacer clic en cada item, actualiza `view` en `App.jsx`.

#### Otros componentes

- `ListHeader.jsx`:
  - Encabezado de la lista de documentos: orden, filtro, búsqueda, botón “Sincronizar”.
- `DocumentRow.jsx`:
  - Fila de documento en la tabla principal.
  - Permite abrir detalle (`view="detail"`).
- `DetailView.jsx`:
  - Muestra PDF, timeline y acciones de firmar/visar/rechazar.

---

### 3.3 Vistas (`frontend/src/views`)

- `LoginView.jsx`  
  Pantalla de login (RUN o correo + password). Consume `POST /api/auth/login`.

- `NewDocumentForm.jsx`  
  Formulario para crear un nuevo flujo de firma. Sube PDF y llama a `POST /api/docs`.

- `PublicSignView.jsx`  
  Portal público de firma / visado por token. Usa `/api/public/docs/...`.

- `VerificationView.jsx`  
  Portal de verificación de documentos. Consume endpoints públicos de verificación.

- `UsersAdminView.jsx`  
  Panel de administración de usuarios (`/api/users`).

- `CompaniesAdminView.jsx`  
  Administración de empresas (`/api/companies`).

- `DashboardView.jsx`  
  Dashboard admin (métricas, gráficas) usando `/api/stats` y endpoints de analytics.

- `StatusAdminView.jsx`  
  Panel de **estado interno**:
  - Llama a `/api/health`.
  - Muestra estado de API, uptime, estado de DB y storage.
  - Base para futuras métricas (fallos de login, acciones por día, etc.).

---

## 4. Convenciones y próximos pasos

### 4.1 Convenciones

- **Rutas backend**: siempre bajo `/api/...`.
- **Controladores de documentos** agrupados en `backend/controllers/documents`.
- **Auditoría**:
  - Todas las acciones de negocio importantes deben usar `logAudit`.
  - Todos los eventos de autenticación deben usar `logAuth`.
- **Multi‑tenant**:
  - Tablas clave tienen `company_id`.
  - Endpoints sensibles filtran por `company_id` o usan `checkDocumentCompanyScope`.

### 4.2 Ideas de mejora futura

- Endpoint específico de métricas:
  - `/api/status/metrics` con:
    - número de `login_failed` últimos X minutos (`auth_log`).
    - acciones recientes por tipo (`audit_log`).
- Migrar completamente de `auditoria_documentos` a `audit_log` en todos los controladores.
- Exponer vistas admin para:
  - Historial de auditoría (`/api/audit`).
  - Historial de login (`/api/auth-log`).

---

## 5. Cómo usar este documento

- Para **debug**: localiza primero la ruta en `backend/server.js` y en `backend/routes/*`, luego baja al controlador correspondiente.
- Para **añadir funcionalidad**:
  1. Decide si es negocio (usa `logAudit`) o autenticación (usa `logAuth`).
  2. Ubica el módulo donde encaja (`routes`, `controllers/documents`, `views`).
  3. Respeta las convenciones descritas aquí.
- Para **onboarding** de un dev nuevo**:  
  recomiéndale leer este archivo antes de abrir el código.

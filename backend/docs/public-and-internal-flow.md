# QA – Flujo interno y público (firma / visado / rechazo)

Guía rápida para probar los 6 casos críticos del sprint:  
- 3 internos (`signFlow` + rechazo interno)  
- 3 públicos (`publicDocuments.js`)

---

## 1. Firma interna – firmante (no visador)

### Contexto

- Controller: `backend/controllers/documents/signFlow.js`
- Endpoint típico: `POST /api/documents/flow/:firmanteId/sign`
- Actor: firmante interno (propietario u otro) con `rol != VISADOR`

### Precondiciones

- `firmantes.id = :firmanteId`
- `firmantes.estado = 'PENDIENTE'`
- `firmantes.rol IN ('FIRMANTE', 'FIRMANTE_FINAL')`
- `documentos.id = firmantes.documento_id`
- `documentos.estado` en estado que permita firma (`PENDIENTE_FIRMA` / `EN_PROCESO` según tu mapping)
- `documents.nuevo_documento_id = documentos.id`
- Fila correspondiente en `document_participants` con:
  - `document_id = documents.id`
  - `email = firmantes.email`
  - `status = 'PENDIENTE'`

### Pasos

1. Hacer `POST /api/documents/flow/:firmanteId/sign` autenticado (con `req.user` válido).
2. Verificar respuesta JSON con:
   - `allSigned` (boolean)
   - `documentoId`, `documentsId`
   - `actorType = "SIGNER"`
3. Revisar DB.

### Estado esperado en DB

| Tabla                   | Campo/condición                         | Valor esperado                                          |
|-------------------------|-----------------------------------------|--------------------------------------------------------|
| `firmantes`            | `estado`                                | `'FIRMADO'`                                            |
|                         | `fecha_firma`                           | `NOT NULL`                                             |
|                         | `tipo_firma`                            | `'SIMPLE'` (si no es visador)                          |
| `document_participants` | `status`                                | `'FIRMADO'` para `(document_id, email, flow_order)`    |
| `documentos`            | `estado`                                | Si todos firmados → `'FIRMADO'`, si no → estado “en curso” |
| `documents`             | `status`                                | Mapping consistente con `documentos.estado`            |

### Eventos esperados

| Tabla            | Detalle                                                                 |
|------------------|-------------------------------------------------------------------------|
| `eventos_firma`  | Insert de `tipo_evento = 'FIRMADO'` para ese `firmante_id`             |
|                  | Si todos firmados: `tipo_evento = 'DOCUMENTO_FIRMADO_COMPLETO'`        |
| `document_events`| Evento `SIGNED_INTERNAL` con `event_type = 'SIGNED_INTERNAL'`          |
|                  | Evento `STATUS_CHANGED` por avance del flujo                           |
|                  | Si se completa: `DOCUMENT_COMPLETED` (`event_type = 'DOCUMENT_COMPLETED'`) |

### PDF esperado

- Si `allSigned = false`:  
  - `documents.pdf_final_url` vacío o sin cambios  
  - `preview_file_url` sigue siendo el PDF con marca de agua
- Si `allSigned = true`:  
  - `sellarPdfConQr` ejecutado por `signFlow` o por firma pública posterior  
  - `documents.pdf_final_url` y `final_storage_key` actualizados a PDF sellado  
  - `preview_file_url` sigue apuntando a versión con marca (preview)[cite:9][cite:10]

---

## 2. Visado interno – visador

### Contexto

- Controller: `signFlow.js` (mismo endpoint)
- Actor: `firmantes.rol = 'VISADOR'`

### Precondiciones

Iguales al caso 1, pero:

- `firmantes.rol = 'VISADOR'`
- No debe existir otro `firmantes` en ese `documento_id` con:
  - `email = firmantes.email`
  - `rol = 'VISADOR'`
  - `estado = 'FIRMADO'` (regla anti doble visado)

### Pasos

1. `POST /api/documents/flow/:firmanteId/sign` con un visador.
2. Confirmar que no hay error `REVIEWER_ALREADY_SIGNED` ni `SEQUENTIAL_BLOCKED`.

### Estado esperado en DB

| Tabla                   | Campo/condición                         | Valor esperado                                          |
|-------------------------|-----------------------------------------|--------------------------------------------------------|
| `firmantes`            | `estado`                                | `'FIRMADO'`                                            |
|                         | `tipo_firma`                            | `'VISADO'`                                             |
| `document_participants` | `status`                                | `'FIRMADO'` para el visador correspondiente           |
| `documentos`            | `estado`                                | Sigue en estado intermedio (`PENDIENTE_FIRMA` / `EN_PROCESO`) |
| `documents`             | `status`                                | Mapping consistente                                    |

### Eventos esperados

| Tabla            | Detalle                                                                 |
|------------------|-------------------------------------------------------------------------|
| `eventos_firma`  | `tipo_evento = 'VISADO'`                                                |
| `document_events`| `event_type = 'VISADO_INTERNAL'`                                       |
|                  | `STATUS_CHANGED` con `details = 'Cambio de estado por visado interno'` |

---

## 3. Rechazo interno – firmante/visador

> Nota: este caso depende de tu controller de rechazo interno (no lo vimos aquí). La matriz asume que sigue el mismo patrón que `signFlow` pero con rechazo.

### Contexto

- Controller: `rejectFlow.js` o similar
- Endpoint típico: `POST /api/documents/flow/:firmanteId/reject`
- Actor: firmante interno o visador

### Precondiciones

- `firmantes.estado = 'PENDIENTE'`
- `documentos.estado` en estado pendiente / en curso
- `document_participants.status = 'PENDIENTE'` para ese participante

### Pasos

1. `POST /api/documents/flow/:firmanteId/reject` con body `{ motivo }`.
2. Ver respuesta de éxito.

### Estado esperado en DB

| Tabla                   | Campo/condición                         | Valor esperado                         |
|-------------------------|-----------------------------------------|---------------------------------------|
| `firmantes`            | `estado`                                | `'RECHAZADO'`                         |
|                         | `motivo_rechazo` / metadata             | guardado (según tu esquema)          |
| `document_participants` | `status`                                | `'RECHAZADO'`                         |
| `documentos`            | `estado`                                | `'RECHAZADO'`                         |
| `documents`             | `status`                                | `'REJECTED'` (o mapping equivalente) |

### Eventos esperados

| Tabla            | Detalle                                                  |
|------------------|----------------------------------------------------------|
| `eventos_firma`  | evento de rechazo interno                               |
| `document_events`| `event_type = 'REJECTED_INTERNAL'` + `STATUS_CHANGED`   |

---

## 4. Firma pública – sign_token (`publicSignDocument`)

### Contexto

- Controller: `backend/controllers/documents/publicDocuments.js`
- Endpoint: `POST /api/public/docs/:token/firmar`
- Actor: firmante externo (enlace público de firma, `sign_token`)

### Precondiciones

- `sign_token` válido (en tu tabla de tokens)
- `documentos.estado` pendiente o en curso
- `signer` vinculado al token con `estado = 'PENDIENTE'`
- `document_participants.status = 'PENDIENTE'` para ese email

### Pasos

1. `GET /api/public/docs/:token`  
   - Esperar respuesta con:
     - `public_mode = "firma"`
     - `public_token_kind = "sign_token"`
     - `pdfUrl` resolviendo a `preview_file_url` (marca de agua)
2. `POST /api/public/docs/:token/firmar`.
3. Inspeccionar respuesta de `publicSignDocument`:
   - `documentStatus` (`FIRMADO` o `PENDIENTE_FIRMA`)
   - `message`
   - `file_url` / `pdfUrl`

### Estado esperado en DB

| Tabla                   | Campo/condición                         | Valor esperado                                          |
|-------------------------|-----------------------------------------|--------------------------------------------------------|
| `firmantes`            | `estado`                                | `'FIRMADO'`                                            |
| `document_participants` | `status`                                | `'FIRMADO'` para `(document_id, email)`               |
| `documentos`            | `estado`                                | Si todos firmantes → `'FIRMADO'`; si no → `'PENDIENTE_FIRMA'` |
| `documents`             | `status`                                | Mapping consistente (`SIGNED` / `PENDING_SIGNATURE`)   |

### Eventos esperados

| Tabla            | Detalle                                                                 |
|------------------|-------------------------------------------------------------------------|
| `document_events`| `SIGNED_PUBLIC` con `actor_type = 'PUBLIC_SIGNER'`                      |
|                  | Si cambia estado: `STATUS_CHANGED` (`reason = 'public_sign'`)          |
| Legacy           | Sync vía `syncLegacySigned` actualizando `firmantes` y `eventos_firma` |

### PDF esperado

- `allSigned = false`:
  - `buildSignedPdfUrlOrFail(mode: 'preview')` → debe devolver preview (marca)
- `allSigned = true`:
  - `sellarPdfConQr` ejecutado y `refreshPdfFields` actualiza:
    - `documents.pdf_final_url` / `final_storage_key`
    - `preview_file_url` para enlaces públicos sigue con marca  

---

## 5. Rechazo público – sign_token (`publicRejectDocument`)

### Contexto

- Controller: `publicDocuments.js`
- Endpoint: `POST /api/public/docs/:token/rechazar`
- Actor: firmante público

### Precondiciones

- Token válido
- Firmante no haya firmado ni rechazado aún
- Documento no está ya rechazado

### Pasos

1. `POST /api/public/docs/:token/rechazar` con `{ motivo: "motivo de prueba" }`.
2. Revisar respuesta:
   - `documentStatus = "RECHAZADO"`
   - `message = "Documento rechazado correctamente"`

### Estado esperado en DB

| Tabla                   | Campo/condición                         | Valor esperado                         |
|-------------------------|-----------------------------------------|---------------------------------------|
| `firmantes`            | `estado`                                | `'RECHAZADO'`                         |
| `document_participants` | `status`                                | `'RECHAZADO'`                         |
| `documentos`            | `estado`                                | `'RECHAZADO'`                         |
| `documents`             | `status`                                | `'REJECTED'`                          |

### Eventos esperados

| Tabla            | Detalle                                                                 |
|------------------|-------------------------------------------------------------------------|
| `document_events`| `REJECTED_PUBLIC` + `STATUS_CHANGED` (`reason = 'public_reject'`)       |
| Legacy           | `syncLegacyRejected` actualizando `firmantes` / `eventos_firma`        |

### PDF esperado

- `buildSignedPdfUrlOrFail(mode: 'preview')` debe devolver un PDF (preview)  
- No hay sellado final nuevo (el documento se considera rechazado, no firmado)

---

## 6. Visado público – signature_token (`publicVisarDocument`)

### Contexto

- Controller: `publicDocuments.js`
- Endpoint: `POST /api/public/docs/document/:token/visar`
- Actor: visador público (enlace de `signature_token` con `requires_visado = true`)

### Precondiciones

- Token válido para `getPublicVisadoContextByToken`
- Documento en estado previo a visado (`PENDIENTE_VISADO` o equivalente)
- `doc.requires_visado` indicando que hay visador público

### Pasos

1. `GET /api/public/docs/document/:token`  
   - Esperar:
     - `public_mode = "visado"`
     - `public_token_kind = "signature_token"`
2. `POST /api/public/docs/document/:token/visar`.
3. Ver respuesta:
   - `documentStatus = "PENDIENTE_FIRMA"`
   - `public_mode = "visado"`

### Estado esperado en DB

| Tabla                   | Campo/condición                         | Valor esperado                         |
|-------------------------|-----------------------------------------|---------------------------------------|
| `documentos`            | `estado`                                | `'PENDIENTE_FIRMA'`                   |
| `documents`             | `status`                                | Mapping a `PENDING_SIGNATURE`         |
| `firmantes`/participants| (opcional) si existe visador como participante, marcado como completado |

### Eventos esperados

| Tabla            | Detalle                                                                 |
|------------------|-------------------------------------------------------------------------|
| `document_events`| `VISADO_PUBLIC` + `STATUS_CHANGED` (`reason = 'public_visado'`)         |

### PDF esperado

- `buildSignedPdfUrlOrFail(mode: 'preview')` → preview con marca de agua  
- Aún no hay PDF final sellado, porque faltan firmas

---

## Sugerencia de uso práctico

1. Crear 1 documento de prueba por caso (o reciclar el mismo en orden controlado).
2. Para cada caso, seguir la tabla:  
   - Hacer la llamada HTTP indicada.  
   - Ver respuesta.  
   - Validar filas en: `firmantes`, `documentos`, `documents`, `document_participants`, `eventos_firma`, `document_events`.  
3. Registrar cualquier desalineación (por ejemplo: firma pública marca `FIRMADO` en legacy pero no en `document_participants`).

Con este archivo en `docs/qa/public-and-internal-flow.md` tienes un guion replicable para ti y para cualquiera que entre al proyecto.[cite:5]
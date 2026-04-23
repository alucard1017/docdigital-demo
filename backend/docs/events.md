# Catálogo de eventos de documentos

Este documento describe los `event_type` usados en la plataforma, quién los genera y en qué contexto.  
El mapa de constantes vive en:

- Backend: `backend/controllers/documents/documentEventTypes.js`
- Frontend: `frontend/src/utils/documentEventTypes.js`

## Tabla de eventos

| event_type                       | Generado por        | Controlador / lugar principal                                  | Contexto / cuándo ocurre                                                                 |
| -------------------------------- | ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| DOCUMENT_CREATED                 | Backend (owner)     | `documentsController` / creación de doc                         | Cuando se crea un nuevo documento en el sistema.                                         |
| DOCUMENT_SENT                    | Backend (owner)     | `documentsController` / envío a firmantes                       | Cuando el propietario envía el documento a firmantes/visadores.                          |
| DOCUMENT_SIGNED_OWNER            | Backend (owner)     | `signing.js` → `signDocument`                                   | El propietario firma el documento internamente.                                          |
| DOCUMENT_VISADO_OWNER            | Backend (owner)     | `signing.js` → `viserDocumentInternalUpdate` / `visarDocument`  | El propietario realiza visado interno del documento.                                     |
| DOCUMENT_REJECTED_OWNER          | Backend (owner)     | `signing.js` → `rejectDocument`                                 | El propietario rechaza el documento (con motivo).                                        |
| SIGNED_PUBLIC                    | Backend (public)    | `publicDocuments.js` → `publicSignDocument`                     | Un firmante externo firma desde un enlace público (`sign_token`).                        |
| VISADO_PUBLIC                    | Backend (public)    | `publicDocuments.js` → `publicVisarDocument`                    | Un visador externo realiza visado desde enlace público (`signature_token`).              |
| REJECTED_PUBLIC                  | Backend (public)    | `publicDocuments.js` → `publicRejectDocument`                   | Un firmante externo rechaza el documento desde enlace público (`sign_token`).           |
| STATUS_CHANGED                   | Backend (owner/public) | `documentEventInserts` (helpers)                             | Cambio de `status` del documento (ej: PENDIENTE_FIRMA → FIRMADO, → RECHAZADO).          |
| PUBLIC_LINK_OPENED_SIGNER        | Backend (public)    | `publicDocuments.js` → `getPublicDocBySignerToken`              | Un firmante abre el enlace público de firma (`sign_token`).                              |
| INVITATION_OPENED                | Backend (public)    | `publicDocuments.js` → `getPublicDocByDocumentToken`            | Apertura de invitación pública del documento (`signature_token`).                        |
| VERIFY_PUBLIC_CODE               | Backend (public)    | `publicDocuments.js` → `verifyByCode`                           | Un usuario verifica un documento usando el código de verificación público.              |

## Notas de implementación

- **Siempre** usar `DOCUMENT_EVENT_TYPES.X` en backend y frontend, no strings a mano.
- Cada evento debe tener:
  - `event_type`: valor del catálogo.
  - `action`: por ahora igual al `event_type` (puede servir si quieres agrupar por acción lógico-funcional).
  - `fromStatus` y `toStatus`: ayudan a construir el timeline de estados.
  - `extraMetadata`: información adicional útil para auditoría (actor, email, motivo, etc.).

## Convenciones de naming

- Eventos de propietario interno: prefijo `DOCUMENT_` + verbo + `_OWNER`.
- Eventos públicos: sufijo `_PUBLIC` o prefijo `PUBLIC_` según sea acción o apertura de enlace:
  - Acción de firma/visado/rechazo: `SIGNED_PUBLIC`, `VISADO_PUBLIC`, `REJECTED_PUBLIC`.
  - Apertura de enlace: `PUBLIC_LINK_OPENED_SIGNER`, `INVITATION_OPENED`.
- Eventos de verificación: `VERIFY_PUBLIC_CODE`.

## Cómo agregar un nuevo event_type

1. Agregar la constante en:
   - `backend/controllers/documents/documentEventTypes.js`
   - `frontend/src/utils/documentEventTypes.js`
2. Usarlo en el controlador correspondiente (`signing.js`, `publicDocuments.js`, etc.) vía:
   - `eventType: DOCUMENT_EVENT_TYPES.NUEVO_EVENTO`
   - `action: DOCUMENT_EVENT_TYPES.NUEVO_EVENTO`
3. Agregar su definición visual en:
   - `frontend/src/utils/documentEvents.js` (icono, label, category).
4. Si aplica, documentarlo en esta tabla (`docs/events.md`).

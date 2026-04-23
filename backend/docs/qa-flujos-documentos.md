# QA E2E – flujos documentos

## Caso 1 – Firma como propietario

**Objetivo**  
Validar que un propietario puede firmar un documento con flujo simple (sin visado) y que estado, eventos y timeline quedan coherentes.

**Pasos**

1. Iniciar sesión como propietario en la app.
2. Crear un documento nuevo:
   - Subir un PDF válido.
   - Configurar flujo sin visado (firmante único = propietario, o flujo más simple disponible).
   - Guardar/enviar el documento según el flujo definido.
3. Desde la vista de detalle del documento (DetailView), ejecutar la acción **Firmar** como propietario.
4. Esperar confirmación de firma en la UI.

**Verificaciones**

- Base de datos – `documents`:
  - El registro del documento tiene estado final equivalente a “firmado” (el que use tu esquema).  
- Base de datos – `document_events`:
  - Existe un evento con:
    - `event_type` de firma (según `documentEventTypes.js`).
    - `actor` o `user_id` correspondiente al propietario.
    - `fromStatus` y `toStatus` coherentes (por ejemplo, de “pendiente” a “firmado”).
    - `ip_address`, `user_agent` y `metadata` poblados según el contrato.  
- Frontend – Timeline:
  - Timeline muestra un evento de firma con icono correcto.
  - El texto es legible (ej. “Documento firmado por [propietario]” o equivalente).
  - No se ofrecen acciones de firma adicionales que no tengan sentido tras la firma.

---

## Caso 2 – Visado como propietario

**Objetivo**  
Validar que el flujo con visado previo funciona, que el visador solo puede realizar la acción una vez y que se desbloquea correctamente el siguiente paso.

**Pasos**

1. Iniciar sesión como propietario.
2. Crear un documento con flujo que requiera visado antes de la firma:
   - Definir al menos un **visador** (puede ser el propio propietario o un usuario distinto, según cómo lo tengas modelado).
   - Definir firmante final si aplica.
3. Ir a la vista de detalle del documento y, como visador, ejecutar la acción **Visar**.
4. Intentar repetir la acción de visado o firmar como visador si la app lo permite (para verificar que no se puede visado/firmar indebidamente).
5. Continuar el flujo hasta el siguiente rol (si hay firmante final).

**Verificaciones**

- Base de datos – `documents`:
  - Tras el visado, el estado del documento cambia a algo equivalente a “visado” o “listo para firma”, según tu modelo.
- Base de datos – `document_events`:
  - Existe un evento con:
    - `event_type` de visado.
    - `actor` / `user_id` = visador.
    - `fromStatus` → `toStatus` coherentes (por ejemplo, de “pendiente_visado” a “visado”).
- Restricciones de acciones:
  - El visador no puede volver a **visar** el mismo documento.
  - El visador no puede firmar en lugar del firmante final, salvo que así esté definido explícitamente en el flujo.
- Frontend – Timeline:
  - Aparece el evento de visado con icono y label correctos.
  - El siguiente estado/acción en UI es coherente (por ejemplo, ahora le toca al firmante).

---

## Caso 3 – Rechazo como propietario

**Objetivo**  
Validar que el propietario puede rechazar un documento desde su panel, que el flujo se cierra y que no quedan acciones inconsistentes abiertas.

**Pasos**

1. Iniciar sesión como propietario.
2. Crear un documento con flujo estándar (puede incluir visador/firmante o no, según tu caso habitual).
3. Ir a la vista de detalle del documento.
4. Ejecutar la acción **Rechazar** desde la UI del propietario (no usar enlace público).
5. Confirmar el rechazo si existe un modal de confirmación.

**Verificaciones**

- Base de datos – `documents`:
  - El documento queda en estado final equivalente a “rechazado”.
- Base de datos – `document_events`:
  - Existe un evento con:
    - `event_type` de rechazo.
    - `actor` / `user_id` = propietario.
    - `fromStatus` = estado anterior (pendiente, en visado, etc.), `toStatus` = rechazado.
- Frontend – Timeline:
  - Se ve claramente un evento de rechazo indicando que el propietario rechazó el documento.
- Frontend – Acciones:
  - En DetailActions.jsx (o equivalente), ya no se muestran acciones de firma/visado/rechazo adicionales para ese documento.
  - Si se intenta acceder a acciones por URL directa, idealmente se bloquea (mensaje de flujo cerrado).

---

## Caso 4 – Rechazo público

**Objetivo**  
Validar que un destinatario que accede por enlace público puede rechazar el documento y que esto cierra correctamente el flujo, diferenciándolo del rechazo del propietario.

**Pasos**

1. Crear un documento que genere un enlace público para firma/visado/rechazo (según tu configuración estándar).
2. Copiar el enlace público (con `sign_token` o `signature_token`, según corresponda).
3. Abrir ese enlace en una ventana de navegador donde **no** haya sesión iniciada (modo incógnito recomendado).
4. En la vista PublicSignView, elegir la opción de **Rechazar** (si está disponible para ese rol).
5. Confirmar el rechazo si hay modal.

**Verificaciones**

- Base de datos – `documents`:
  - El estado del documento pasa a “rechazado”.
- Base de datos – `document_events`:
  - Existe un evento de rechazo público, con:
    - `event_type` de rechazo (o un tipo específico para rechazo público si lo implementaste).
    - `actor` correspondiente al participante público (según tu modelo).
    - fromStatus/toStatus coherentes.
- Frontend – Timeline:
  - El timeline indica que el rechazo vino **por enlace público**, no del propietario (texto o metadata diferenciada).
- Enlaces:
  - Si intentas volver a abrir el mismo token tras el rechazo, PublicSignView muestra estado de documento rechazado / acción ya registrada y no permite firmar.

---

## Caso 5 – Firma pública (sign_token / signature_token)

**Objetivo**  
Validar que un participante público puede firmar desde un enlace sin login, y que el documento, los eventos y el timeline reflejan correctamente esta firma.

**Pasos**

1. Crear un documento que genere firma pública mediante `sign_token` o `signature_token` (según flujo).
2. Copiar el enlace público que se envía al firmante público.
3. Abrir el enlace en una ventana sin sesión iniciada (modo incógnito).
4. En PublicSignView:
   - Revisar el documento (preview).
   - Ejecutar la acción **Firmar** (o Visar/Firmar según rol público).
5. Esperar confirmación de firma en la UI pública.

**Verificaciones**

- Autenticación:
  - Durante todo el flujo, **no se requiere login**; el token es suficiente para acceder y firmar.
- Base de datos – `documents`:
  - El estado del documento cambia a “firmado” (o al estado correspondiente según si es el último firmante o no).
- Base de datos – `document_events`:
  - Existe un evento de firma pública con:
    - `event_type` de firma pública (según tu mapa de eventos).
    - `actor` = firmante público (según tu modelo de participantes).
    - `fromStatus` y `toStatus` coherentes.
    - ip, user_agent, metadata poblados.
- Frontend – Timeline:
  - El timeline muestra que la firma fue realizada por un firmante público (no propietario).
  - Icono y texto correctos (ej. “Firma pública completada”).
- Reutilización de token:
  - Si intentas reutilizar el mismo token después de firmar:
    - PublicSignView muestra estado de “acción ya registrada” o equivalente.
    - No permite firmar de nuevo.

---

## Notas generales de ejecución

- Cada vez que ejecutes un caso, toma nota de:
  - ID del documento usado.
  - Usuarios/roles involucrados.
  - Capturas de pantalla si encuentras un bug.  
- Cualquier bug que aparezca:
  - Regístralo como issue separado en GitHub.
  - Enlaza el issue al issue maestro del sprint para mantener la trazabilidad.
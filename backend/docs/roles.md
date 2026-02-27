# Roles y permisos – VeriFirma

Roles definidos:

- `SUPER_ADMIN`
- `ADMIN_GLOBAL`
- `ADMIN`
- `USER`

## Tabla de permisos principales

| Acción / Feature                                 | SUPER_ADMIN | ADMIN_GLOBAL        | ADMIN (empresa)           | USER                  |
|--------------------------------------------------|-------------|---------------------|---------------------------|-----------------------|
| Login                                            | Sí          | Sí                  | Sí                        | Sí                    |
| Ver sus propios documentos                       | Sí          | Sí                  | Sí                        | Sí                    |
| Ver documentos de su empresa                     | Sí          | Sí                  | Sí                        | No                    |
| Ver documentos de todas las empresas             | Sí          | Sí                  | No                        | No                    |
| Crear documentos                                 | Sí          | Sí                  | Sí                        | Opcional (según UI)  |
| Firmar / visar documentos asignados              | Sí          | Sí                  | Sí                        | Sí                    |
| Ver `/api/stats` globales (todas las empresas)   | Sí          | Sí                  | No                        | No                    |
| Ver `/api/stats` solo de su empresa              | Sí          | Sí                  | Sí                        | No                    |
| Ver listado de usuarios (`/api/users`)           | Sí          | Sí                  | Solo su empresa           | No                    |
| Crear usuarios en VeriFirma (company_id = 1)     | Sí          | Sí                  | No                        | No                    |
| Crear usuarios en su empresa                     | Sí          | Sí (cualquier emp.) | Sí (solo su empresa)      | No                    |
| Asignar rol `SUPER_ADMIN`                        | Sí          | No                  | No                        | No                    |
| Asignar rol `ADMIN_GLOBAL`                       | Sí          | No                  | No                        | No                    |
| Asignar rol `ADMIN` dentro de su empresa         | Sí          | Sí                  | Sí (solo su empresa)      | No                    |
| Asignar rol `USER`                               | Sí          | Sí                  | Sí                        | No                    |
| Desactivar usuarios                              | Sí          | Sí                  | Sí (solo su empresa)      | No                    |
| Cambiar `company_id` de un usuario               | Sí          | No                  | No                        | No                    |
| Borrar usuarios ADMIN / ADMIN_GLOBAL / SUPER     | Sí          | No                  | No                        | No                    |
| Borrar usuarios USER de su empresa               | Sí          | Sí                  | Sí (solo su empresa)      | No                    |

Notas rápidas:

- El **OWNER** (tu RUN fijo) es un `SUPER_ADMIN` especial que nunca se puede borrar y sólo él puede tocar roles globales.
- En cada empresa, el **primer usuario** creado queda con rol `ADMIN`.
- Un `ADMIN` de empresa puede subir/bajar a otros usuarios de su empresa entre `USER` y `ADMIN`, pero nunca a roles globales.

---

## `/api/stats` – qué archivo pasar

Según tu estructura backend, normalmente el endpoint está en uno de estos:

- `backend/routes/stats.js`  
- o dentro de `backend/routes/index.js` con algo tipo `router.get('/stats', ...)`  
- o un controller dedicado: `backend/controllers/stats.js`.

Pásame:

1) El archivo de **ruta** donde se define `/api/stats` (por ejemplo `backend/routes/stats.js` o `backend/routes/index.js` si ahí está el handler).  
2) Si la ruta delega en un controller (por ejemplo `statsController.getStats`), pásame también ese controller.  

Con eso te lo reescribo para que:  
- `ADMIN` vea sólo stats de su `company_id`.  
- `SUPER_ADMIN` y `ADMIN_GLOBAL` puedan ver globales o por empresa (via `?company_id=`).

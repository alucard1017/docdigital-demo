// src/views/CompaniesAdminView.jsx
import { useEffect, useState } from "react";
import api from "../api/client";

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-CL", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function getPlanLabel(plan) {
  if (!plan) return "BASIC";
  const v = String(plan).toUpperCase();
  if (v === "PRO" || v === "BASIC" || v === "ENTERPRISE") return v;
  return v;
}

function getPlanClassName(plan) {
  const v = String(plan || "").toUpperCase();
  if (v === "PRO") return "badge-plan badge-plan-pro";
  if (v === "ENTERPRISE") return "badge-plan badge-plan-enterprise";
  return "badge-plan badge-plan-basic";
}

export function CompaniesAdminView() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function cargarCompanies() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/companies");
      const data = res.data;
      setCompanies(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudieron cargar las empresas";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarCompanies();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      const res = await api.post("/companies", { name });
      if (!res || !res.data) {
        throw new Error("No se pudo crear la empresa");
      }
      setName("");
      await cargarCompanies();
      window.alert("Empresa creada correctamente");
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Error al crear empresa";
      window.alert(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(id, currentName) {
    const nuevoNombre = window.prompt(
      "Nuevo nombre para la empresa:",
      currentName || ""
    );
    if (!nuevoNombre || !nuevoNombre.trim()) return;

    try {
      const res = await api.put(`/companies/${id}`, {
        name: nuevoNombre.trim(),
      });
      if (!res || !res.data) {
        throw new Error("No se pudo actualizar la empresa");
      }
      await cargarCompanies();
      window.alert("Empresa actualizada correctamente");
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Error al actualizar empresa";
      window.alert(msg);
    }
  }

  async function handleDelete(id, companyName) {
    const ok = window.confirm(
      `¿Seguro que deseas eliminar la empresa "${companyName}"?\nSolo se puede si no tiene usuarios asociados.`
    );
    if (!ok) return;

    try {
      const res = await api.delete(`/companies/${id}`);
      if (!res || !res.data) {
        throw new Error("No se pudo eliminar la empresa");
      }
      await cargarCompanies();
      window.alert("Empresa eliminada correctamente");
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Error al eliminar empresa";
      window.alert(msg);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          padding: 24,
          minHeight: "100%",
          background: "#020617",
          color: "#e5e7eb",
        }}
      >
        <p style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
          Cargando empresas...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 24,
          minHeight: "100%",
          background: "#020617",
          color: "#e5e7eb",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: 8,
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "#fecaca",
          }}
        >
          Error al cargar empresas
        </h2>
        <p
          style={{
            marginBottom: 16,
            fontSize: "0.9rem",
            color: "#fecaca",
          }}
        >
          {error}
        </p>
        <button
          className="btn-main btn-primary"
          onClick={cargarCompanies}
          style={{ minWidth: 140 }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  const muestraPlan = companies.some((c) => c.plan);
  const muestraUsers = companies.some(
    (c) => typeof c.users_count === "number"
  );
  const muestraFecha = companies.some((c) => c.created_at);
  const muestraDomain = companies.some((c) => c.domain);

  return (
    <div
      style={{
        minHeight: "100%",
        padding: 24,
        background: "#020617",
        color: "#e5e7eb",
      }}
    >
      <div
        className="card-premium"
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          borderRadius: 18,
          padding: 20,
          border: "1px solid #1f2937",
          background:
            "radial-gradient(circle at top left, rgba(56,189,248,0.16), rgba(15,23,42,0.98))",
          boxShadow: "0 24px 70px rgba(15,23,42,0.8)",
        }}
      >
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                marginTop: 0,
                marginBottom: 4,
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "#f9fafb",
              }}
            >
              Empresas
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: "0.85rem",
                color: "#9ca3af",
              }}
            >
              Administra las empresas que pueden usar la plataforma y asigna
              usuarios y planes.
            </p>
          </div>

          <form
            onSubmit={handleCreate}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              className="form-input"
              placeholder="Nombre de la nueva empresa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                minWidth: 220,
                padding: "8px 10px",
                borderRadius: 999,
                border: "1px solid #1f2937",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: "0.85rem",
              }}
            />
            <button
              type="submit"
              className="btn-main btn-primary"
              disabled={saving || !name.trim()}
              style={{
                paddingInline: 16,
                borderRadius: 999,
                fontSize: "0.85rem",
              }}
            >
              {saving ? "Creando..." : "Crear empresa"}
            </button>
          </form>
        </div>

        {companies.length === 0 ? (
          <div
            style={{
              padding: 24,
              borderRadius: 12,
              border: "1px dashed #334155",
              background:
                "linear-gradient(135deg, rgba(15,23,42,0.8), rgba(30,64,175,0.4))",
            }}
          >
            <p
              style={{
                marginTop: 0,
                marginBottom: 4,
                fontSize: "0.95rem",
                fontWeight: 500,
                color: "#e5e7eb",
              }}
            >
              Todavía no hay empresas registradas.
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "0.85rem",
                color: "#9ca3af",
              }}
            >
              Crea tu primera empresa para asignar usuarios y comenzar a
              gestionar documentos.
            </p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ marginTop: 4 }}>
            <div
              style={{
                maxHeight: "60vh",
                overflow: "auto",
                borderRadius: 12,
                border: "1px solid #1f2937",
                background:
                  "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,0.96))",
              }}
            >
              <table
                className="doc-table"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.86rem",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(15,23,42,1), rgba(30,64,175,0.2))",
                    }}
                  >
                    <th
                      style={{
                        width: 70,
                        padding: "10px 10px",
                        textAlign: "left",
                        fontWeight: 500,
                        fontSize: "0.75rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#9ca3af",
                        borderBottom: "1px solid #1f2937",
                      }}
                    >
                      ID
                    </th>
                    <th
                      style={{
                        padding: "10px 10px",
                        textAlign: "left",
                        fontWeight: 500,
                        fontSize: "0.75rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#9ca3af",
                        borderBottom: "1px solid #1f2937",
                      }}
                    >
                      Nombre
                    </th>
                    {muestraUsers && (
                      <th
                        style={{
                          textAlign: "center",
                          width: 120,
                          padding: "10px 10px",
                          fontWeight: 500,
                          fontSize: "0.75rem",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#9ca3af",
                          borderBottom: "1px solid #1f2937",
                        }}
                      >
                        Usuarios
                      </th>
                    )}
                    {muestraPlan && (
                      <th
                        className="col-plan"
                        style={{
                          textAlign: "center",
                          width: 120,
                          padding: "10px 10px",
                          fontWeight: 500,
                          fontSize: "0.75rem",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#9ca3af",
                          borderBottom: "1px solid #1f2937",
                        }}
                      >
                        Plan
                      </th>
                    )}
                    {muestraFecha && (
                      <th
                        style={{
                          textAlign: "center",
                          width: 140,
                          padding: "10px 10px",
                          fontWeight: 500,
                          fontSize: "0.75rem",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: "#9ca3af",
                          borderBottom: "1px solid #1f2937",
                        }}
                      >
                        Creada
                      </th>
                    )}
                    <th
                      style={{
                        textAlign: "right",
                        width: 160,
                        padding: "10px 10px",
                        fontWeight: 500,
                        fontSize: "0.75rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#9ca3af",
                        borderBottom: "1px solid #1f2937",
                      }}
                    >
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c, idx) => {
                    const planLabel = getPlanLabel(c.plan);
                    const planClass = getPlanClassName(c.plan);
                    const usersCount =
                      typeof c.users_count === "number" ? c.users_count : 0;

                    const rowBg =
                      idx % 2 === 0 ? "rgba(15,23,42,1)" : "rgba(15,23,42,0.96)";

                    return (
                      <tr
                        key={c.id}
                        style={{
                          background: rowBg,
                          borderBottom: "1px solid #020617",
                        }}
                      >
                        <td
                          style={{
                            padding: "10px 10px",
                            color: "#cbd5f5",
                          }}
                        >
                          {c.id}
                        </td>
                        <td
                          style={{
                            padding: "10px 10px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 500,
                                color: "#e5e7eb",
                              }}
                            >
                              {c.name}
                            </span>
                            {muestraDomain && c.domain && (
                              <span
                                style={{
                                  fontSize: "0.78rem",
                                  color: "#9ca3af",
                                }}
                              >
                                {c.domain}
                              </span>
                            )}
                          </div>
                        </td>
                        {muestraUsers && (
                          <td
                            style={{
                              textAlign: "center",
                              padding: "10px 10px",
                              color: "#e5e7eb",
                            }}
                          >
                            {usersCount}
                          </td>
                        )}
                        {muestraPlan && (
                          <td
                            style={{
                              textAlign: "center",
                              padding: "10px 10px",
                            }}
                          >
                            <span className={planClass}>{planLabel}</span>
                          </td>
                        )}
                        {muestraFecha && (
                          <td
                            style={{
                              textAlign: "center",
                              padding: "10px 10px",
                              color: "#cbd5f5",
                            }}
                          >
                            {formatDate(c.created_at)}
                          </td>
                        )}
                        <td
                          style={{
                            textAlign: "right",
                            padding: "10px 10px",
                          }}
                        >
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => handleRename(c.id, c.name)}
                            style={{
                              marginRight: 8,
                              fontSize: "0.8rem",
                              color: "#93c5fd",
                            }}
                          >
                            Renombrar
                          </button>
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => handleDelete(c.id, c.name)}
                            style={{
                              fontSize: "0.8rem",
                              color: "#fecaca",
                            }}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
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
  if (v === "PRO" || v === "BASIC") return v;
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
      <div style={{ padding: 24 }}>
        <p style={{ fontSize: "0.9rem", color: "#64748b" }}>
          Cargando empresas...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <h2
          style={{
            marginTop: 0,
            marginBottom: 8,
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "#b91c1c",
          }}
        >
          Error al cargar empresas
        </h2>
        <p style={{ marginBottom: 16, fontSize: "0.9rem", color: "#7f1d1d" }}>
          {error}
        </p>
        <button className="btn-main btn-primary" onClick={cargarCompanies}>
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
    <div className="card-premium">
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
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            Empresas
          </h2>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
            Administra las empresas que pueden usar la plataforma.
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
            style={{ minWidth: 220 }}
          />
          <button
            type="submit"
            className="btn-main btn-primary"
            disabled={saving || !name.trim()}
          >
            {saving ? "Creando..." : "Crear empresa"}
          </button>
        </form>
      </div>

      {companies.length === 0 ? (
        <div
          style={{
            padding: 24,
            borderRadius: 8,
            border: "1px dashed #cbd5f5",
            backgroundColor: "#f9fafb",
          }}
        >
          <p
            style={{
              marginTop: 0,
              marginBottom: 4,
              fontSize: "0.95rem",
              fontWeight: 500,
              color: "#0f172a",
            }}
          >
            Todavía no hay empresas registradas.
          </p>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
            Crea tu primera empresa para asignar usuarios y comenzar a gestionar
            documentos.
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="doc-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>ID</th>
                <th>Nombre</th>
                {muestraUsers && (
                  <th style={{ textAlign: "center", width: 120 }}>Usuarios</th>
                )}
                {muestraPlan && (
                  <th
                    className="col-plan"
                    style={{ textAlign: "center", width: 120 }}
                  >
                    Plan
                  </th>
                )}
                {muestraFecha && (
                  <th style={{ textAlign: "center", width: 140 }}>Creada</th>
                )}
                <th style={{ textAlign: "right", width: 160 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const planLabel = getPlanLabel(c.plan);
                const planClass = getPlanClassName(c.plan);
                const usersCount =
                  typeof c.users_count === "number" ? c.users_count : 0;

                return (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>
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
                            color: "#0f172a",
                          }}
                        >
                          {c.name}
                        </span>
                        {muestraDomain && c.domain && (
                          <span
                            style={{
                              fontSize: "0.78rem",
                              color: "#64748b",
                            }}
                          >
                            {c.domain}
                          </span>
                        )}
                      </div>
                    </td>
                    {muestraUsers && (
                      <td style={{ textAlign: "center" }}>{usersCount}</td>
                    )}
                    {muestraPlan && (
                      <td style={{ textAlign: "center" }}>
                        <span className={planClass}>{planLabel}</span>
                      </td>
                    )}
                    {muestraFecha && (
                      <td style={{ textAlign: "center" }}>
                        {formatDate(c.created_at)}
                      </td>
                    )}
                    <td style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => handleRename(c.id, c.name)}
                        style={{ marginRight: 8 }}
                      >
                        Renombrar
                      </button>
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => handleDelete(c.id, c.name)}
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
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
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

function CompaniesAdminView() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const cargarCompanies = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.get("/companies");
      const data = res?.data;
      setCompanies(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No se pudieron cargar las empresas";
      setError(msg);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarCompanies();
  }, [cargarCompanies]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);

      const res = await api.post("/companies", {
        name: name.trim(),
      });

      if (!res?.data) {
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
      setSaving(true);

      const res = await api.put(`/companies/${id}`, {
        name: nuevoNombre.trim(),
      });

      if (!res?.data) {
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
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id, companyName) {
    const ok = window.confirm(
      `¿Seguro que deseas eliminar la empresa "${companyName}"?\nSolo se puede si no tiene usuarios asociados.`
    );

    if (!ok) return;

    try {
      setSaving(true);

      const res = await api.delete(`/companies/${id}`);

      if (!res?.data) {
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
    } finally {
      setSaving(false);
    }
  }

  const muestraPlan = useMemo(
    () => companies.some((c) => c.plan),
    [companies]
  );

  const muestraUsers = useMemo(
    () => companies.some((c) => typeof c.users_count === "number"),
    [companies]
  );

  const muestraFecha = useMemo(
    () => companies.some((c) => c.created_at),
    [companies]
  );

  const muestraDomain = useMemo(
    () => companies.some((c) => c.domain),
    [companies]
  );

  if (loading) {
    return (
      <div className="companies-admin-page">
        <div className="companies-admin-loading">
          <p className="companies-admin-loading-text">Cargando empresas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="companies-admin-page">
        <div className="companies-admin-error">
          <h2 className="companies-admin-error-title">
            Error al cargar empresas
          </h2>
          <p className="companies-admin-error-text">{error}</p>
          <button
            className="btn-main btn-primary companies-admin-retry-btn"
            onClick={cargarCompanies}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="companies-admin-page">
      <div className="card-premium companies-admin-card">
        <div className="companies-admin-header">
          <div className="companies-admin-header-copy">
            <h2 className="companies-admin-title">Empresas</h2>
            <p className="companies-admin-description">
              Administra las empresas que pueden usar la plataforma y asigna
              usuarios y planes con una vista clara y de alto contraste.
            </p>
          </div>

          <form
            onSubmit={handleCreate}
            className="companies-admin-create-form"
          >
            <input
              type="text"
              className="form-input companies-admin-input"
              placeholder="Nombre de la nueva empresa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
            <button
              type="submit"
              className="btn-main btn-primary companies-admin-create-btn"
              disabled={saving || !name.trim()}
            >
              {saving ? "Creando..." : "Crear empresa"}
            </button>
          </form>
        </div>

        {companies.length === 0 ? (
          <div className="companies-admin-empty">
            <p className="companies-admin-empty-title">
              Todavía no hay empresas registradas.
            </p>
            <p className="companies-admin-empty-text">
              Crea tu primera empresa para asignar usuarios y comenzar a
              gestionar documentos.
            </p>
          </div>
        ) : (
          <div className="table-wrapper companies-admin-table-wrapper">
            <div className="table-scroll-container companies-admin-table-scroll">
              <table className="doc-table doc-table-companies">
                <thead>
                  <tr className="companies-admin-head-row">
                    <th className="col-company-id">ID</th>
                    <th className="col-company-name">Nombre</th>
                    {muestraUsers && <th className="col-company-users">Usuarios</th>}
                    {muestraPlan && <th className="col-company-plan">Plan</th>}
                    {muestraFecha && <th className="col-company-date">Creada</th>}
                    <th className="col-company-actions">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {companies.map((c, idx) => {
                    const planLabel = getPlanLabel(c.plan);
                    const planClass = getPlanClassName(c.plan);
                    const usersCount =
                      typeof c.users_count === "number" ? c.users_count : 0;

                    const rowClass =
                      idx % 2 === 0
                        ? "company-row company-row-even"
                        : "company-row company-row-odd";

                    return (
                      <tr key={c.id} className={rowClass}>
                        <td className="company-cell-id">{c.id}</td>

                        <td className="company-cell-name">
                          <div className="company-name-stack">
                            <span className="company-name-text">{c.name}</span>

                            {muestraDomain && c.domain && (
                              <span className="company-domain-text">
                                {c.domain}
                              </span>
                            )}
                          </div>
                        </td>

                        {muestraUsers && (
                          <td className="company-cell-users">
                            <span className="doc-id-pill">{usersCount}</span>
                          </td>
                        )}

                        {muestraPlan && (
                          <td className="company-cell-plan">
                            <span className={planClass}>{planLabel}</span>
                          </td>
                        )}

                        {muestraFecha && (
                          <td className="company-cell-date">
                            {formatDate(c.created_at)}
                          </td>
                        )}

                        <td className="doc-cell-actions company-cell-actions">
                          <div className="doc-actions company-actions">
                            <button
                              type="button"
                              className="btn-main btn-primary btn-xs"
                              onClick={() => handleRename(c.id, c.name)}
                              disabled={saving}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              className="btn-main btn-secondary-danger btn-xs"
                              onClick={() => handleDelete(c.id, c.name)}
                              disabled={saving}
                            >
                              Eliminar
                            </button>
                          </div>
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

export default CompaniesAdminView;
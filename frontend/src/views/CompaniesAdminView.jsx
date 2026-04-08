// src/views/CompaniesAdminView.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client";
import "../styles/companiesAdmin.css";

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

  const normalized = String(plan).toUpperCase();
  if (normalized === "PRO") return "PRO";
  if (normalized === "ENTERPRISE") return "ENTERPRISE";
  return "BASIC";
}

function getPlanClassName(plan) {
  const normalized = String(plan || "").toUpperCase();

  if (normalized === "PRO") return "badge-plan badge-plan-pro";
  if (normalized === "ENTERPRISE") {
    return "badge-plan badge-plan-enterprise";
  }

  return "badge-plan badge-plan-basic";
}

function CompaniesAdminView() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const res = await api.get("/companies");
      const data = res?.data;
      setCompanies(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "No se pudieron cargar las empresas";

      setError(msg);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const handleCreate = useCallback(
    async (e) => {
      e.preventDefault();

      const trimmedName = name.trim();
      if (!trimmedName) return;

      try {
        setSaving(true);

        const res = await api.post("/companies", {
          name: trimmedName,
        });

        if (!res?.data) {
          throw new Error("No se pudo crear la empresa");
        }

        setName("");
        await loadCompanies();
        window.alert("Empresa creada correctamente");
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Error al crear empresa";

        window.alert(msg);
      } finally {
        setSaving(false);
      }
    },
    [name, loadCompanies]
  );

  const handleRename = useCallback(
    async (id, currentName) => {
      const nextName = window.prompt(
        "Nuevo nombre para la empresa:",
        currentName || ""
      );

      const trimmedName = nextName?.trim();
      if (!trimmedName) return;

      try {
        setSaving(true);

        const res = await api.put(`/companies/${id}`, {
          name: trimmedName,
        });

        if (!res?.data) {
          throw new Error("No se pudo actualizar la empresa");
        }

        await loadCompanies();
        window.alert("Empresa actualizada correctamente");
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Error al actualizar empresa";

        window.alert(msg);
      } finally {
        setSaving(false);
      }
    },
    [loadCompanies]
  );

  const handleDelete = useCallback(
    async (id, companyName) => {
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

        await loadCompanies();
        window.alert("Empresa eliminada correctamente");
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          "Error al eliminar empresa";

        window.alert(msg);
      } finally {
        setSaving(false);
      }
    },
    [loadCompanies]
  );

  const showPlan = useMemo(
    () => companies.some((company) => company.plan),
    [companies]
  );

  const showUsers = useMemo(
    () => companies.some((company) => typeof company.users_count === "number"),
    [companies]
  );

  const showDate = useMemo(
    () => companies.some((company) => company.created_at),
    [companies]
  );

  const showDomain = useMemo(
    () => companies.some((company) => company.domain),
    [companies]
  );

  if (loading) {
    return (
      <div className="companies-admin-page">
        <div className="companies-admin-loading">
          <p className="companies-admin-loading-text">
            Cargando empresas...
          </p>
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
            onClick={loadCompanies}
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
              className="input-field companies-admin-input"
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
                    {showUsers && (
                      <th className="col-company-users">Usuarios</th>
                    )}
                    {showPlan && (
                      <th className="col-company-plan">Plan</th>
                    )}
                    {showDate && (
                      <th className="col-company-date">Creada</th>
                    )}
                    <th className="col-company-actions">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {companies.map((company, idx) => {
                    const planLabel = getPlanLabel(company.plan);
                    const planClass = getPlanClassName(company.plan);
                    const usersCount =
                      typeof company.users_count === "number"
                        ? company.users_count
                        : 0;

                    const rowClass =
                      idx % 2 === 0
                        ? "company-row company-row-even"
                        : "company-row company-row-odd";

                    return (
                      <tr key={company.id} className={rowClass}>
                        <td className="company-cell-id">{company.id}</td>

                        <td className="company-cell-name">
                          <div className="company-name-stack">
                            <span className="company-name-text">
                              {company.name}
                            </span>

                            {showDomain && company.domain && (
                              <span className="company-domain-text">
                                {company.domain}
                              </span>
                            )}
                          </div>
                        </td>

                        {showUsers && (
                          <td className="company-cell-users">
                            <span className="doc-id-pill">{usersCount}</span>
                          </td>
                        )}

                        {showPlan && (
                          <td className="company-cell-plan">
                            <span className={planClass}>{planLabel}</span>
                          </td>
                        )}

                        {showDate && (
                          <td className="company-cell-date">
                            {formatDate(company.created_at)}
                          </td>
                        )}

                        <td className="doc-cell-actions company-cell-actions">
                          <div className="doc-actions company-actions">
                            <button
                              type="button"
                              className="btn-main btn-primary btn-xs"
                              onClick={() =>
                                handleRename(company.id, company.name)
                              }
                              disabled={saving}
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              className="btn-main btn-secondary-danger btn-xs"
                              onClick={() =>
                                handleDelete(company.id, company.name)
                              }
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
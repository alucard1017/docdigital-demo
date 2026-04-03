import { useCallback, useEffect, useState } from "react";
import api from "../api/client";

function normalizeConfigPayload(data) {
  return {
    interval_days: Number(data?.interval_days) || 1,
    max_attempts: Number(data?.max_attempts) || 1,
    enabled: Boolean(data?.enabled),
  };
}

function RemindersConfigView() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    interval_days: 1,
    max_attempts: 1,
    enabled: false,
  });

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/reminders/config");
      const normalized = normalizeConfigPayload(res?.data);

      setConfig(normalized);
      setFormData(normalized);
    } catch (err) {
      setError(
        err.response?.data?.message || "Error cargando configuración"
      );
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : value === ""
          ? ""
          : Number(value),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      const payload = {
        interval_days: Number(formData.interval_days) || 1,
        max_attempts: Number(formData.max_attempts) || 1,
        enabled: Boolean(formData.enabled),
      };

      const res = await api.put("/reminders/config", payload);
      const nextConfig = normalizeConfigPayload(res?.data?.config || payload);

      setConfig(nextConfig);
      setFormData(nextConfig);
      setEditing(false);
      window.alert("Configuración actualizada exitosamente");
    } catch (err) {
      setError(
        err.response?.data?.message || "Error actualizando configuración"
      );
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setEditing(false);
    setFormData(
      config || {
        interval_days: 1,
        max_attempts: 1,
        enabled: false,
      }
    );
    setError("");
  }

  if (loading) {
    return <div className="p-4">Cargando configuración...</div>;
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">
        Configuración de Recordatorios
      </h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {config && !editing && (
        <div className="bg-gray-50 p-4 rounded mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-semibold text-gray-600">
                Intervalo entre recordatorios (días)
              </label>
              <p className="text-lg font-bold text-gray-800">
                {config.interval_days} días
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-600">
                Máximo de intentos
              </label>
              <p className="text-lg font-bold text-gray-800">
                {config.max_attempts} intentos
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600">
              Estado
            </label>
            <p className="text-lg font-bold">
              {config.enabled ? (
                <span className="text-green-600">✓ Habilitados</span>
              ) : (
                <span className="text-red-600">✗ Deshabilitados</span>
              )}
            </p>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Editar Configuración
            </button>

            <button
              onClick={fetchConfig}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
            >
              Recargar
            </button>
          </div>
        </div>
      )}

      {editing && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Intervalo entre recordatorios (días)
            </label>
            <input
              type="number"
              name="interval_days"
              min="1"
              max="30"
              value={formData.interval_days}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              disabled={saving}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Máximo de intentos
            </label>
            <input
              type="number"
              name="max_attempts"
              min="1"
              max="10"
              value={formData.max_attempts}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              disabled={saving}
            />
          </div>

          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="enabled"
                checked={Boolean(formData.enabled)}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600"
                disabled={saving}
              />
              <span className="ml-2 text-sm font-semibold text-gray-700">
                Habilitar recordatorios automáticos
              </span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              disabled={saving}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default RemindersConfigView;
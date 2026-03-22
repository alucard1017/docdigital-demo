// frontend/src/views/RemindersConfigView.jsx
import { useState, useEffect } from "react";
import axios from "axios";

export default function RemindersConfigView() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("/api/reminders/config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConfig(res.data);
      setFormData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || "Error cargando configuración");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : parseInt(value) || value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const res = await axios.put("/api/reminders/config", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConfig(res.data.config);
      setEditing(false);
      alert("Configuración actualizada exitosamente");
    } catch (err) {
      setError(err.response?.data?.message || "Error actualizando configuración");
    }
  };

  if (loading) return <div className="p-4">Cargando configuración...</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">Configuración de Recordatorios</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {config && !editing && (
        <div className="bg-gray-50 p-4 rounded mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              abel className="text-sm font-semibold text-gray-600">
                Intervalo entre recordatorios (días)
              </label>
              <p className="text-lg font-bold text-gray-800">
                {config.interval_days} días
              </p>
            </div>
            <div>
              abel className="text-sm font-semibold text-gray-600">
                Máximo de intentos
              </label>
              <p className="text-lg font-bold text-gray-800">
                {config.max_attempts} intentos
              </p>
            </div>
          </div>
          <div>
            abel className="text-sm font-semibold text-gray-600">
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
          <button
            onClick={() => setEditing(true)}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Editar Configuración
          </button>
        </div>
      )}

      {editing && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded">
          <div className="mb-4">
            abel className="block text-sm font-semibold text-gray-700 mb-2">
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
            />
          </div>

          <div className="mb-4">
            abel className="block text-sm font-semibold text-gray-700 mb-2">
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
            />
          </div>

          <div className="mb-6">
            abel className="flex items-center">
              <input
                type="checkbox"
                name="enabled"
                checked={formData.enabled}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600"
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
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setFormData(config);
              }}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

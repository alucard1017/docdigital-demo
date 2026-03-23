// frontend/src/views/TemplatesView.jsx
import { useState, useEffect } from "react";
import axios from "axios";

export default function TemplatesView() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    tipo: "CONTRATO",
    categoria_firma: "SIMPLE",
    tipo_flujo: "SECUENCIAL",
    requires_visado: false,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("/api/templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplates(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || "Error cargando plantillas");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      await axios.post("/api/templates", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("✅ Plantilla creada exitosamente");
      setCreating(false);
      setFormData({
        name: "",
        description: "",
        tipo: "CONTRATO",
        categoria_firma: "SIMPLE",
        tipo_flujo: "SECUENCIAL",
        requires_visado: false,
      });
      fetchTemplates();
    } catch (err) {
      setError(err.response?.data?.message || "Error creando plantilla");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`/api/templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("✅ Plantilla eliminada");
      fetchTemplates();
    } catch (err) {
      alert(err.response?.data?.message || "Error eliminando plantilla");
    }
  };

  if (loading) {
    return <div className="p-4">Cargando plantillas...</div>;
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Plantillas de Documentos</h1>
        <button
          onClick={() => setCreating(!creating)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {creating ? "Cancelar" : "+ Nueva Plantilla"}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {creating && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre de la plantilla *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo
              </label>
              <select
                value={formData.tipo}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, tipo: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                <option value="CONTRATO">Contrato</option>
                <option value="ACTA">Acta</option>
                <option value="AUTORIZACION">Autorización</option>
                <option value="PODER">Poder</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded"
              rows="3"
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Categoría Firma
              </label>
              <select
                value={formData.categoria_firma}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    categoria_firma: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                <option value="SIMPLE">Simple</option>
                <option value="AVANZADA">Avanzada</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tipo de Flujo
              </label>
              <select
                value={formData.tipo_flujo}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    tipo_flujo: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                <option value="SECUENCIAL">Secuencial</option>
                <option value="PARALELO">Paralelo</option>
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requires_visado}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      requires_visado: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 text-blue-600 mr-2"
                />
                <span className="text-sm font-semibold text-gray-700">
                  Requiere Visado
                </span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
          >
            Crear Plantilla
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-lg">{template.name}</h3>
              <button
                onClick={() => handleDelete(template.id)}
                className="text-red-600 hover:text-red-800 text-sm"
              >
                ✕ Eliminar
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              {template.description}
            </p>
            <div className="flex gap-2 flex-wrap text-xs">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {template.tipo}
              </span>
              <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">
                {template.categoria_firma}
              </span>
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                {template.tipo_flujo}
              </span>
              {template.requires_visado && (
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  Visado
                </span>
              )}
            </div>
            <button
              className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-semibold"
              onClick={() => alert(`Usar plantilla: ${template.name}`)}
            >
              Usar Plantilla
            </button>
          </div>
        ))}
      </div>

      {templates.length === 0 && !creating && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No hay plantillas creadas</p>
          <p className="text-sm">
            Crea tu primera plantilla para agilizar la creación de documentos
          </p>
        </div>
      )}
    </div>
  );
}

// frontend/src/views/ProfileView.jsx
import { useState, useEffect } from "react";
import axios from "axios";

export default function ProfileView() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});

  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("/api/users/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(res.data);
      setFormData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || "Error cargando perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const res = await axios.put("/api/users/profile", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProfile(res.data.user);
      setEditing(false);
      alert("✅ Perfil actualizado exitosamente");
    } catch (err) {
      setError(err.response?.data?.message || "Error actualizando perfil");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("Las contraseñas no coinciden");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "/api/users/change-password",
        {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      alert("✅ Contraseña actualizada exitosamente");
      setChangingPassword(false);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setPasswordError(
        err.response?.data?.message || "Error cambiando contraseña"
      );
    }
  };

  if (loading) return <div className="p-4">Cargando perfil...</div>;

  return (
    <div className="p-6 bg-white rounded-lg shadow max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mi Perfil</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {profile && !editing && (
        <div className="bg-gray-50 p-6 rounded mb-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              abel className="text-sm font-semibold text-gray-600">Nombre</label>
              <p className="text-lg font-bold text-gray-800">{profile.name}</p>
            </div>
            <div>
              abel className="text-sm font-semibold text-gray-600">Email</label>
              <p className="text-lg font-bold text-gray-800">{profile.email}</p>
              {profile.email_verified ? (
                <span className="text-xs text-green-600">✓ Verificado</span>
              ) : (
                <span className="text-xs text-yellow-600">⚠ No verificado</span>
              )}
            </div>
            <div>
              abel className="text-sm font-semibold text-gray-600">RUN</label>
              <p className="text-lg font-bold text-gray-800">{profile.run}</p>
            </div>
            <div>
              abel className="text-sm font-semibold text-gray-600">Rol</label>
              <p className="text-lg font-bold text-gray-800">{profile.role}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setEditing(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Editar Perfil
            </button>
            <button
              onClick={() => setChangingPassword(true)}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Cambiar Contraseña
            </button>
          </div>
        </div>
      )}

      {editing && (
        <form onSubmit={handleSubmit} className="bg-gray-50 p-6 rounded">
          <div className="mb-4">
            abel className="block text-sm font-semibold text-gray-700 mb-2">
              Nombre
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
          </div>
          <div className="mb-4">
            abel className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded"
            />
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
                setFormData(profile);
              }}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {changingPassword && (
        <form onSubmit={handleChangePassword} className="bg-gray-50 p-6 rounded mt-6">
          <h3 className="text-lg font-bold mb-4">Cambiar Contraseña</h3>

          {passwordError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {passwordError}
            </div>
          )}

          <div className="mb-4">
            abel className="block text-sm font-semibold text-gray-700 mb-2">
              Contraseña Actual
            </label>
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) =>
                setPasswordData({ ...passwordData, currentPassword: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded"

// frontend/src/views/ResetPasswordView.jsx
import { useState, useEffect } from "react";
import axios from "axios";

export default function ResetPasswordView() {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post("/api/auth/reset-password", {
        token,
        newPassword,
      });
      setMessage(res.data.message);
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Error restableciendo contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg" style={{ minHeight: "100vh", padding: "20px 16px" }}>
      <div className="login-card" style={{ maxWidth: 480 }}>
        <h1 className="text-2xl font-bold mb-4 text-center">
          Restablecer Contraseña
        </h1>
        <p className="text-gray-600 text-center mb-6">
          Ingresa tu nueva contraseña
        </p>

        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {message}
            <p className="text-sm mt-2">Redirigiendo al login...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {!message && (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              abel className="block text-sm font-semibold text-gray-700 mb-2">
                Nueva Contraseña
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                required
                minLength={6}
              />
            </div>

            <div className="mb-4">
              abel className="block text-sm font-semibold text-gray-700 mb-2">
                Confirmar Contraseña
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Restableciendo..." : "Restablecer Contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

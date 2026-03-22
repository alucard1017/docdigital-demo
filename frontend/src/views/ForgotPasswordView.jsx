// frontend/src/views/ForgotPasswordView.jsx
import { useState } from "react";
import axios from "axios";

export default function ForgotPasswordView() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const res = await axios.post("/api/auth/forgot-password", { email });
      setMessage(res.data.message);
      setEmail("");
    } catch (err) {
      setError(err.response?.data?.message || "Error enviando solicitud");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg" style={{ minHeight: "100vh", padding: "20px 16px" }}>
      <div className="login-card" style={{ maxWidth: 480 }}>
        <h1 className="text-2xl font-bold mb-4 text-center">
          Recuperar Contraseña
        </h1>
        <p className="text-gray-600 text-center mb-6">
          Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña
        </p>

        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {message}
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            abel className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              required
              placeholder="tu@email.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar enlace de recuperación"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <a href="/" className="text-sm text-blue-600 hover:text-blue-800">
            ← Volver al login
          </a>
        </div>
      </div>
    </div>
  );
}

// src/views/ForgotPasswordView.jsx
import React, { useState } from "react";
import api from "../api/client";

const ForgotPasswordView = () => {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      await api.post("/auth/forgot-password", { email });
      setMessage(
        "Si el correo existe en nuestro sistema, te enviaremos un enlace para restablecer tu contraseña."
      );
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "No pudimos procesar tu solicitud. Intenta nuevamente.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-8 border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">
          Recuperar contraseña
        </h1>
        <p className="text-sm text-slate-600 mb-6 text-center">
          Ingresa tu correo electrónico y te enviaremos instrucciones para
          restablecer tu contraseña.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="tu@email.com"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? "Enviando..." : "Enviar enlace de recuperación"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <a
            href="/"
            className="text-xs text-indigo-600 hover:underline font-medium"
          >
            Volver al inicio de sesión
          </a>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordView;

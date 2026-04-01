// backend/socket/authSocketMiddleware.js
const jwt = require("jsonwebtoken");
const { query } = require("../db");

async function authSocketMiddleware(socket, next) {
  try {
    const rawToken = socket.handshake?.auth?.token;

    if (!rawToken || typeof rawToken !== "string") {
      console.warn("⚠️ Conexión WS sin token");
      const err = new Error("No autorizado");
      err.data = { code: "WS_AUTH_MISSING_TOKEN" };
      return next(err);
    }

    const token = rawToken.startsWith("Bearer ")
      ? rawToken.slice(7).trim()
      : rawToken.trim();

    const JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;

    if (!JWT_ACCESS_SECRET) {
      console.error("❌ JWT_ACCESS_SECRET / JWT_SECRET no definido para WS");
      const err = new Error("Error de configuración");
      err.data = { code: "WS_AUTH_CONFIG_ERROR" };
      return next(err);
    }

    const payload = jwt.verify(token, JWT_ACCESS_SECRET);

    const result = await query(
      `
      SELECT id, run, email, name, role, company_id
      FROM users
      WHERE id = $1
        AND deleted_at IS NULL
      LIMIT 1
      `,
      [payload.id]
    );

    const user = result.rows[0];

    if (!user) {
      console.warn("⚠️ Usuario WS no encontrado o eliminado:", payload.id);
      const err = new Error("Usuario no válido");
      err.data = { code: "WS_AUTH_INVALID_USER" };
      return next(err);
    }

    socket.user = {
      id: user.id,
      run: user.run,
      email: user.email,
      name: user.name,
      role: user.role,
      company_id: user.company_id ?? null,
    };

    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      console.error("❌ Error en autenticación WS: jwt expired");
      const authErr = new Error("jwt expired");
      authErr.data = { code: "WS_AUTH_TOKEN_EXPIRED" };
      return next(authErr);
    }

    console.error("❌ Error en autenticación WS:", err.message);
    const authErr = new Error("Token inválido");
    authErr.data = {
      code: "WS_AUTH_INVALID_TOKEN",
      detail: err.message,
    };
    return next(authErr);
  }
}

module.exports = authSocketMiddleware;
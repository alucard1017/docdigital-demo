// backend/socket/authSocketMiddleware.js
const jwt = require("jsonwebtoken");
const { query } = require("../db");

function buildAuthError(message, code, detail) {
  const err = new Error(message || "No autorizado");
  err.data = {
    code: code || "WS_AUTH_ERROR",
    detail: detail || null,
  };
  return err;
}

async function authSocketMiddleware(socket, next) {
  try {
    const rawToken = socket.handshake?.auth?.token;

    if (!rawToken || typeof rawToken !== "string") {
      console.warn("⚠️ Conexión WS sin token");
      return next(
        buildAuthError("No autorizado", "WS_AUTH_MISSING_TOKEN", "Missing token")
      );
    }

    const token = rawToken.startsWith("Bearer ")
      ? rawToken.slice(7).trim()
      : rawToken.trim();

    const JWT_ACCESS_SECRET =
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;

    if (!JWT_ACCESS_SECRET) {
      console.error("❌ JWT_ACCESS_SECRET / JWT_SECRET no definido para WS");
      return next(
        buildAuthError(
          "Error de configuración",
          "WS_AUTH_CONFIG_ERROR",
          "Missing JWT secret"
        )
      );
    }

    const payload = jwt.verify(token, JWT_ACCESS_SECRET);

    if (!payload || !payload.id) {
      console.warn("⚠️ Payload JWT inválido en WS:", payload);
      return next(
        buildAuthError(
          "Token inválido",
          "WS_AUTH_INVALID_PAYLOAD",
          "Missing id in token payload"
        )
      );
    }

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
      return next(
        buildAuthError(
          "Usuario no válido",
          "WS_AUTH_INVALID_USER",
          `User ${payload.id} not found or deleted`
        )
      );
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
      const authErr = buildAuthError(
        "jwt expired",
        "WS_AUTH_TOKEN_EXPIRED",
        err.message
      );
      return next(authErr);
    }

    console.error("❌ Error en autenticación WS:", err.message);
    const authErr = buildAuthError(
      "Token inválido",
      "WS_AUTH_INVALID_TOKEN",
      err.message
    );
    return next(authErr);
  }
}

module.exports = authSocketMiddleware;
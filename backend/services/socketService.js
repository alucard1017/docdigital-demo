// backend/services/socketService.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

/**
 * Inicializa Socket.IO sobre el servidor HTTP
 * @param {import("http").Server} server
 */
function initializeSocketIO(server) {
  if (!server) {
    throw new Error("Servidor HTTP no proporcionado para Socket.IO");
  }

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    "https://app.verifirma.cl",
    "https://docdigital.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
  ].filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  console.log("✅ Socket.IO inicializado con CORS:", allowedOrigins);

  const JWT_ACCESS_SECRET =
    process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;

  if (!JWT_ACCESS_SECRET) {
    console.error(
      "❌ JWT_ACCESS_SECRET (o JWT_SECRET) no definido para WebSocket"
    );
  }

  // Middleware de autenticación por JWT
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        console.warn("⚠️ Conexión WS sin token");
        return next(new Error("No autorizado"));
      }

      if (!JWT_ACCESS_SECRET) {
        console.error(
          "❌ Intento de conexión WS sin JWT_ACCESS_SECRET configurado"
        );
        return next(new Error("Error de configuración"));
      }

      const payload = jwt.verify(token, JWT_ACCESS_SECRET);

      socket.user = {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        company_id: payload.company_id ?? null,
      };

      return next();
    } catch (err) {
      console.error("❌ Error en autenticación WS:", err.message);
      return next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket) => {
    const userEmail = socket.user?.email || "desconocido";
    const companyId = socket.user?.company_id;

    console.log(`✅ Cliente WebSocket conectado: ${userEmail}`);

    if (companyId) {
      const room = `company:${companyId}`;
      socket.join(room);
      console.log(`👥 ${userEmail} unido a room ${room}`);
    } else {
      console.warn(`⚠️ Usuario sin company_id en WS: ${userEmail}`);
    }

    socket.on("disconnect", (reason) => {
      console.log(
        `❌ Cliente WebSocket desconectado (${reason}): ${userEmail}`
      );
    });
  });

  return io;
}

/**
 * Emitir notificación a todos los usuarios de una empresa
 * @param {number|string} companyId
 * @param {string} event
 * @param {any} data
 */
function emitToCompany(companyId, event, data) {
  if (!io) {
    console.warn("⚠️ Socket.IO no inicializado (emitToCompany)");
    return;
  }

  if (!companyId) {
    console.warn("⚠️ emitToCompany llamado sin companyId");
    return;
  }

  const room = `company:${companyId}`;
  io.to(room).emit(event, data);

  console.log(`📡 Evento emitido a ${room}: ${event}`);
}

/**
 * Emitir notificación global
 * @param {string} event
 * @param {any} data
 */
function emitGlobal(event, data) {
  if (!io) {
    console.warn("⚠️ Socket.IO no inicializado (emitGlobal)");
    return;
  }

  io.emit(event, data);
  console.log(`📡 Evento global emitido: ${event}`);
}

module.exports = {
  initializeSocketIO,
  emitToCompany,
  emitGlobal,
};
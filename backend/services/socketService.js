// backend/services/socketService.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

/**
 * Inicializar Socket.IO en el servidor HTTP
 */
function initializeSocketIO(server) {
  io = new Server(server, {
    cors: {
      origin: [
        process.env.FRONTEND_URL,
        "https://app.verifirma.cl",
        "https://docdigital.vercel.app",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
      ].filter(Boolean),
      credentials: true,
    },
  });

  // Middleware de autenticación
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("No autorizado"));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        company_id: payload.company_id,
      };
      next();
    } catch (err) {
      return next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`✅ Cliente WebSocket conectado: ${socket.user.email}`);

    // Unirse a room de su empresa
    if (socket.user.company_id) {
      socket.join(`company:${socket.user.company_id}`);
    }

    socket.on("disconnect", () => {
      console.log(`❌ Cliente WebSocket desconectado: ${socket.user.email}`);
    });
  });

  console.log("✅ Socket.IO inicializado");
  return io;
}

/**
 * Emitir notificación a usuarios de una empresa
 */
function emitToCompany(companyId, event, data) {
  if (!io) {
    console.warn("⚠️ Socket.IO no inicializado");
    return;
  }

  io.to(`company:${companyId}`).emit(event, data);
  console.log(`📡 Evento emitido a company ${companyId}: ${event}`);
}

/**
 * Emitir notificación global (solo para admins)
 */
function emitGlobal(event, data) {
  if (!io) {
    console.warn("⚠️ Socket.IO no inicializado");
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

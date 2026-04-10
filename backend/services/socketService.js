// backend/services/socketService.js
const { Server } = require("socket.io");
const authSocketMiddleware = require("../socket/authSocketMiddleware");

let io = null;

function buildAllowedOrigins(extraOrigins = []) {
  return [
    process.env.FRONTEND_URL,
    "https://www.verifirma.cl",
    "https://verifirma.cl",
    "https://app.verifirma.cl",
    "https://firmar.verifirma.cl",
    "https://verificar.verifirma.cl",
    "https://verifirma-frontend.onrender.com",
    "https://docdigital.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    ...extraOrigins,
  ].filter(Boolean);
}

function getCompanyRoom(companyId) {
  return `company:${companyId}`;
}

function getUserRoom(userId) {
  return `user:${userId}`;
}

function safeLog(...args) {
  console.log(...args);
}

function safeWarn(...args) {
  console.warn(...args);
}

function safeError(...args) {
  console.error(...args);
}

/**
 * Inicializa Socket.IO sobre el servidor HTTP
 * @param {import("http").Server} server
 * @param {{ allowedOrigins?: string[] }} options
 */
function initializeSocketIO(server, options = {}) {
  if (!server) {
    throw new Error("Servidor HTTP no proporcionado para Socket.IO");
  }

  if (io) {
    safeWarn("⚠️ Socket.IO ya estaba inicializado, reutilizando instancia existente");
    return io;
  }

  const allowedOrigins = buildAllowedOrigins(options.allowedOrigins || []);
  const allowedOriginSet = new Set(allowedOrigins);

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }

        if (allowedOriginSet.has(origin)) {
          return callback(null, true);
        }

        safeWarn(`⛔ Socket.IO CORS bloqueado para origin: ${origin}`);
        return callback(new Error(`Socket.IO CORS bloqueado para origin: ${origin}`));
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    allowEIO3: false,
  });

  safeLog("✅ Socket.IO inicializado con allowed origins:", [...allowedOriginSet]);

  io.use(authSocketMiddleware);

  io.on("connection", (socket) => {
    const user = socket.user || {};
    const userId = user.id ?? null;
    const userEmail = user.email || "desconocido";
    const companyId = user.company_id ?? null;
    const socketId = socket.id;
    const handshakeOrigin = socket.handshake.headers?.origin || "sin-origin";
    const transport = socket.conn?.transport?.name || "unknown";

    safeLog(
      `✅ Cliente WebSocket conectado: ${userEmail} (${socketId}) origin=${handshakeOrigin} transport=${transport}`
    );

    if (userId) {
      const userRoom = getUserRoom(userId);
      socket.join(userRoom);
      safeLog(`👤 ${userEmail} unido a room ${userRoom}`);
    } else {
      safeWarn(`⚠️ Usuario WS sin id válido: ${userEmail}`);
    }

    if (companyId) {
      const companyRoom = getCompanyRoom(companyId);
      socket.join(companyRoom);
      safeLog(`👥 ${userEmail} unido a room ${companyRoom}`);
    } else {
      safeWarn(`⚠️ Usuario sin company_id en WS: ${userEmail}`);
    }

    socket.on("disconnecting", (reason) => {
      try {
        safeLog(
          `ℹ️ Cliente WebSocket desconectándose (${reason}): ${userEmail} (${socketId})`,
          { rooms: Array.from(socket.rooms || []) }
        );
      } catch (err) {
        safeWarn("⚠️ Error leyendo rooms en disconnecting:", err.message);
      }
    });

    socket.on("disconnect", (reason) => {
      safeLog(
        `❌ Cliente WebSocket desconectado (${reason}): ${userEmail} (${socketId})`
      );
    });

    socket.on("error", (err) => {
      safeError(`❌ Error en socket ${socketId}:`, err?.message || err);
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
    safeWarn("⚠️ Socket.IO no inicializado (emitToCompany)");
    return false;
  }

  if (!companyId) {
    safeWarn("⚠️ emitToCompany llamado sin companyId");
    return false;
  }

  if (!event || typeof event !== "string") {
    safeWarn("⚠️ emitToCompany llamado sin event válido");
    return false;
  }

  const room = getCompanyRoom(companyId);
  io.to(room).emit(event.trim(), data);

  safeLog(`📡 Evento emitido a ${room}: ${event}`);
  return true;
}

/**
 * Emitir notificación a un usuario específico
 * @param {number|string} userId
 * @param {string} event
 * @param {any} data
 */
function emitToUser(userId, event, data) {
  if (!io) {
    safeWarn("⚠️ Socket.IO no inicializado (emitToUser)");
    return false;
  }

  if (!userId) {
    safeWarn("⚠️ emitToUser llamado sin userId");
    return false;
  }

  if (!event || typeof event !== "string") {
    safeWarn("⚠️ emitToUser llamado sin event válido");
    return false;
  }

  const room = getUserRoom(userId);
  io.to(room).emit(event.trim(), data);

  safeLog(`📡 Evento emitido a ${room}: ${event}`);
  return true;
}

/**
 * Emitir notificación global
 * @param {string} event
 * @param {any} data
 */
function emitGlobal(event, data) {
  if (!io) {
    safeWarn("⚠️ Socket.IO no inicializado (emitGlobal)");
    return false;
  }

  if (!event || typeof event !== "string") {
    safeWarn("⚠️ emitGlobal llamado sin event válido");
    return false;
  }

  io.emit(event.trim(), data);
  safeLog(`📡 Evento global emitido: ${event}`);
  return true;
}

function getIO() {
  return io;
}

module.exports = {
  initializeSocketIO,
  emitToCompany,
  emitToUser,
  emitGlobal,
  getIO,
};
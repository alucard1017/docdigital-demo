// backend/services/socketService.js
const { Server } = require("socket.io");
const authSocketMiddleware = require("../socket/authSocketMiddleware");

let io = null;

/**
 * Inicializa Socket.IO sobre el servidor HTTP
 * @param {import("http").Server} server
 */
function initializeSocketIO(server) {
  if (!server) {
    throw new Error("Servidor HTTP no proporcionado para Socket.IO");
  }

  if (io) {
    console.warn("⚠️ Socket.IO ya estaba inicializado, reutilizando instancia existente");
    return io;
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
    transports: ["websocket", "polling"],
  });

  console.log("✅ Socket.IO inicializado con CORS:", allowedOrigins);

  io.use(authSocketMiddleware);

  io.on("connection", (socket) => {
    const user = socket.user || {};
    const userEmail = user.email || "desconocido";
    const companyId = user.company_id ?? null;
    const socketId = socket.id;

    console.log(`✅ Cliente WebSocket conectado: ${userEmail} (${socketId})`);

    if (companyId) {
      const room = `company:${companyId}`;
      socket.join(room);
      console.log(`👥 ${userEmail} unido a room ${room}`);
    } else {
      console.warn(`⚠️ Usuario sin company_id en WS: ${userEmail}`);
    }

    socket.on("disconnect", (reason) => {
      console.log(
        `❌ Cliente WebSocket desconectado (${reason}): ${userEmail} (${socketId})`
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
    return false;
  }

  if (!companyId) {
    console.warn("⚠️ emitToCompany llamado sin companyId");
    return false;
  }

  if (!event || typeof event !== "string") {
    console.warn("⚠️ emitToCompany llamado sin event válido");
    return false;
  }

  const room = `company:${companyId}`;
  io.to(room).emit(event, data);

  console.log(`📡 Evento emitido a ${room}: ${event}`);
  return true;
}

/**
 * Emitir notificación global
 * @param {string} event
 * @param {any} data
 */
function emitGlobal(event, data) {
  if (!io) {
    console.warn("⚠️ Socket.IO no inicializado (emitGlobal)");
    return false;
  }

  if (!event || typeof event !== "string") {
    console.warn("⚠️ emitGlobal llamado sin event válido");
    return false;
  }

  io.emit(event, data);
  console.log(`📡 Evento global emitido: ${event}`);
  return true;
}

function getIO() {
  return io;
}

module.exports = {
  initializeSocketIO,
  emitToCompany,
  emitGlobal,
  getIO,
};
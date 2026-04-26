// backend/middlewares/sessionActivity.middleware.js

const AppError = require('../utils/AppError');
const ERROR_CODES = require('../constants/errorCodes');

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos rolling

function sessionActivity(req, res, next) {
  // Solo aplicar si el usuario está autenticado
  if (!req.user) {
    return next();
  }

  const now = Date.now();
  const lastActivity = req.session?.lastActivity || 0;
  const elapsed = now - lastActivity;

  if (lastActivity && elapsed > IDLE_TIMEOUT_MS) {
    // Marcar sesión expirada
    if (req.session) {
      req.session.destroy?.(() => {});
    }

    return next(
      new AppError({
        message: 'Session expired by inactivity',
        statusCode: 401,
        code: ERROR_CODES.SESSION_EXPIRED,
      })
    );
  }

  // Si no ha expirado, actualizamos lastActivity
  if (req.session) {
    req.session.lastActivity = now;
  }

  return next();
}

module.exports = sessionActivity;
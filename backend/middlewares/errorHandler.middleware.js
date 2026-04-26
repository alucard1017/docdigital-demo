// backend/middlewares/errorHandler.middleware.js

const AppError = require('../utils/AppError');
const ERROR_CODES = require('../constants/errorCodes');
const { buildError } = require('../utils/responseBuilder');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    return buildError(res, {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }

  // Fallback genérico
  console.error('Unhandled error:', err); // luego lo puedes mandar a Sentry / logger

  return buildError(res, {
    statusCode: 500,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
  });
}

module.exports = errorHandler;
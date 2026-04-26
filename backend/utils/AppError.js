// backend/utils/AppError.js

const ERROR_CODES = require('../constants/errorCodes');

class AppError extends Error {
  constructor({ message, statusCode = 500, code = ERROR_CODES.INTERNAL_SERVER_ERROR, details = null }) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static validation(message = 'Validation failed', details) {
    return new AppError({
      message,
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      details,
    });
  }

  static unauthorized(message = 'Unauthorized', code = ERROR_CODES.AUTH_UNAUTHORIZED) {
    return new AppError({
      message,
      statusCode: 401,
      code,
    });
  }

  static forbidden(message = 'Forbidden', code = ERROR_CODES.AUTH_FORBIDDEN) {
    return new AppError({
      message,
      statusCode: 403,
      code,
    });
  }

  static notFound(message = 'Not found', code = ERROR_CODES.DOCUMENT_NOT_FOUND) {
    return new AppError({
      message,
      statusCode: 404,
      code,
    });
  }
}

module.exports = AppError;
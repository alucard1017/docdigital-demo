// backend/utils/responseBuilder.js

function buildSuccess(res, data = null, statusCode = 200) {
  return res.status(statusCode).json({
    ok: true,
    data,
  });
}

function buildError(res, { statusCode = 500, code, message, details = null }) {
  return res.status(statusCode).json({
    ok: false,
    error: {
      code,
      message,
      details,
    },
  });
}

module.exports = {
  buildSuccess,
  buildError,
};
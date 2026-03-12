// backend/middleware/requestMeta.js
const { v4: uuidv4 } = require("uuid");

function requestMeta(req, res, next) {
  const incomingRequestId = req.headers["x-request-id"];

  req.requestId = incomingRequestId || uuidv4();
  req.ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    null;
  req.userAgent = req.headers["user-agent"] || "unknown";

  res.setHeader("X-Request-Id", req.requestId);

  return next();
}

module.exports = requestMeta;

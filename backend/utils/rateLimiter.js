// backend/utils/rateLimiter.js
const Redis = require("ioredis");

let redis;

// Inicializar Redis con URL o config
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL);
} else {
  redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    enableOfflineQueue: false,
  });
}

redis.on("connect", () => {
  console.log("✅ Conectado a Redis exitosamente");
});

redis.on("error", (err) => {
  console.error("⚠️ Error en Redis:", err.message);
});

/**
 * Rate‑limit genérico basado en Redis.
 * Usa clave rl:{key}, contador + TTL en segundos.
 */
async function checkRateLimitRedis(
  key,
  maxAttempts = 5,
  windowSeconds = 60
) {
  try {
    const ttlKey = `rl:${key}`;

    const tx = redis.multi();
    tx.incr(ttlKey);
    tx.ttl(ttlKey);

    const [countRaw, ttlRaw] = await tx.exec().then((res) =>
      res.map((r) => r[1])
    );

    const count = Number(countRaw || 0);
    const ttl = Number(ttlRaw || -1);

    if (ttl === -1) {
      await redis.expire(ttlKey, windowSeconds);
    }

    return count <= maxAttempts;
  } catch (err) {
    console.error("⚠️ Error en checkRateLimitRedis:", err);
    return true; // Falla abierta
  }
}

/**
 * Middleware factory para Express (usa Redis).
 */
function createRedisRateLimitMiddleware({
  keyPrefix,
  maxAttempts,
  windowSeconds,
  errorMessage,
}) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || "anon";
      const key = `${keyPrefix}:${userId}`;
      const ok = await checkRateLimitRedis(key, maxAttempts, windowSeconds);

      if (!ok) {
        return res.status(429).json({
          message:
            errorMessage ||
            "Demasiadas solicitudes, intenta nuevamente más tarde.",
        });
      }

      return next();
    } catch (err) {
      console.error("⚠️ Error en rate limiter Redis:", err);
      // Falla abierta para no tumbar request si Redis cae
      return next();
    }
  };
}

module.exports = {
  redis,
  checkRateLimitRedis,
  createRedisRateLimitMiddleware,
};

const { RateLimiterRedis, RateLimiterMemory } = require("rate-limiter-flexible");

// Redis-backed limiter that transparently falls back to process memory when
// Redis is unreachable (local dev, Redis restart). Without the insurance
// limiter every consume() rejects with a connection error instead.
function createLimiter(redis, opts) {
  const insuranceLimiter = new RateLimiterMemory(opts);
  if (!redis) return insuranceLimiter;
  return new RateLimiterRedis({ storeClient: redis, ...opts, insuranceLimiter });
}

// consume() rejects with a RateLimiterRes when the limit is hit and with an
// Error on infrastructure failure. Only the former should block the caller.
function isLimited(e) {
  return !!e && typeof e.msBeforeNext === "number";
}

exports.createLimiter = createLimiter;
exports.isLimited = isLimited;

exports.createHttpLimiter = (redis) =>
  createLimiter(redis, {
    keyPrefix: "http_limit",
    points: 60,
    duration: 60,
    blockDuration: 120,
  });

exports.createOtpLimiter = (redis) =>
  createLimiter(redis, {
    keyPrefix: "otp_limit",
    points: 3,
    duration: 300,
    blockDuration: 900,
  });

exports.createContactLimiter = (redis) =>
  createLimiter(redis, {
    keyPrefix: "contact_limit",
    points: 3,         // 3 submissions
    duration: 3600,    // per hour
    blockDuration: 7200,
  });

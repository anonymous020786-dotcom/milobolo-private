const { RateLimiterRedis, RateLimiterMemory } = require("rate-limiter-flexible");

function createLimiter(redis, opts) {
  if (!redis || redis.status === "end" || redis.status === "close") {
    return new RateLimiterMemory(opts);
  }
  try {
    return new RateLimiterRedis({ storeClient: redis, ...opts });
  } catch {
    return new RateLimiterMemory(opts);
  }
}

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

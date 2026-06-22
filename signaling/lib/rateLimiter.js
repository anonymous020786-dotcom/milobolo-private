const { RateLimiterRedis } = require("rate-limiter-flexible");

exports.createHttpLimiter = (redis) =>
  new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "http_limit",
    points: 60,
    duration: 60,
    blockDuration: 120,
  });

exports.createOtpLimiter = (redis) =>
  new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: "otp_limit",
    points: 3,
    duration: 300,
    blockDuration: 900,
  });

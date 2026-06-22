const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");
const { RateLimiterRedis } = require("rate-limiter-flexible");
const Redis = require("ioredis");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
const matchmaking = require("./lib/matchmaking");
const mailer = require("./lib/mailer");
const rateLimiter = require("./lib/rateLimiter");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.SITE_URL || "https://chat.videodownloaders.cloud",
  "http://localhost:3000",
];

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"], credentials: true },
  transports: ["websocket", "polling"],
  pingTimeout: 30000,
  pingInterval: 10000,
});

const redis = new Redis(process.env.REDIS_URL, {
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "10kb" }));

// ─── HTTP rate limiter (for OTP endpoints) ──────────────────
const httpLimiter = rateLimiter.createHttpLimiter(redis);

app.use((req, res, next) => {
  httpLimiter
    .consume(req.ip)
    .then(() => next())
    .catch(() => res.status(429).json({ error: "Too many requests" }));
});

// ─── OTP endpoint ───────────────────────────────────────────
app.post("/api/send-otp", async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email || !type) return res.status(400).json({ error: "Invalid request" });

    const validTypes = ["verify", "reset", "delete", "change_email"];
    if (!validTypes.includes(type)) return res.status(400).json({ error: "Invalid OTP type" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await supabase.from("otp_codes").upsert({
      email,
      otp_hash: otp,
      type,
      expires_at: expiresAt.toISOString(),
      used: false,
    });

    await mailer.sendOTP({ email, otp, type });
    res.json({ success: true });
  } catch (err) {
    console.error("OTP error:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

app.post("/api/verify-otp", async (req, res) => {
  try {
    const { email, otp, type } = req.body;
    const { data, error } = await supabase
      .from("otp_codes")
      .select("*")
      .eq("email", email)
      .eq("otp_hash", otp)
      .eq("type", type)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .single();

    if (error || !data) return res.status(400).json({ error: "Invalid or expired OTP" });

    await supabase.from("otp_codes").update({ used: true }).eq("id", data.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Verification failed" });
  }
});

app.get("/health", (_, res) => res.json({ status: "ok", timestamp: Date.now() }));

// ─── Socket.io ──────────────────────────────────────────────
const socketLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "socket_limit",
  points: 30,
  duration: 60,
});

io.use(async (socket, next) => {
  try {
    await socketLimiter.consume(socket.handshake.address);
    next();
  } catch {
    next(new Error("Rate limit exceeded"));
  }
});

io.on("connection", (socket) => {
  const socketId = socket.id;
  let pairedWith = null;
  let roomId = null;

  socket.on("find_match", async ({ mode = "video", userId = null }) => {
    const waitingKey = `waiting:${mode}`;
    const waitingId = await redis.lpop(waitingKey);

    if (waitingId && waitingId !== socketId) {
      roomId = uuidv4();
      pairedWith = waitingId;

      const initiator = { socketId, userId, isInitiator: true };
      const receiver = { socketId: waitingId, userId: null, isInitiator: false };

      await redis.set(`room:${roomId}`, JSON.stringify({ a: socketId, b: waitingId }), "EX", 3600);

      socket.join(roomId);
      io.sockets.sockets.get(waitingId)?.join(roomId);

      io.to(socketId).emit("match_found", { roomId, isInitiator: true, peer: waitingId });
      io.to(waitingId).emit("match_found", { roomId, isInitiator: false, peer: socketId });
    } else {
      await redis.rpush(waitingKey, socketId);
      await redis.expire(waitingKey, 300);
      socket.emit("waiting");
    }
  });

  socket.on("cancel_search", async ({ mode = "video" }) => {
    await redis.lrem(`waiting:${mode}`, 0, socketId);
    socket.emit("search_cancelled");
  });

  socket.on("signal", ({ to, signal }) => {
    io.to(to).emit("signal", { from: socketId, signal });
  });

  socket.on("message", ({ roomId: rid, text }) => {
    if (!rid || !text || text.length > 500) return;
    socket.to(rid).emit("message", { from: socketId, text: text.trim(), ts: Date.now() });
  });

  socket.on("next", async ({ mode = "video" }) => {
    if (pairedWith) {
      io.to(pairedWith).emit("peer_left");
      socket.leave(roomId);
      io.sockets.sockets.get(pairedWith)?.leave(roomId);
      if (roomId) await redis.del(`room:${roomId}`);
      pairedWith = null;
      roomId = null;
    }
    socket.emit("find_match_ack");
  });

  socket.on("report", async ({ reportedId, reason }) => {
    if (!reportedId || !reason) return;
    await supabase.from("reports").insert({
      reporter_socket: socketId,
      reported_socket: reportedId,
      reason,
      room_id: roomId,
    });
    socket.emit("report_received");
  });

  socket.on("disconnect", async () => {
    await redis.lrem("waiting:video", 0, socketId);
    await redis.lrem("waiting:text", 0, socketId);
    if (pairedWith) {
      io.to(pairedWith).emit("peer_left");
    }
    if (roomId) await redis.del(`room:${roomId}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`MiloBolo signaling on :${PORT}`));

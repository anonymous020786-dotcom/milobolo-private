const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");
const { RateLimiterRedis } = require("rate-limiter-flexible");
const Redis = require("ioredis");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
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

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 100, 3000),
});

const supabase = createClient(
  process.env.SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder"
);

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "10kb" }));

// ─── HTTP rate limiter ──────────────────────────────────────
const httpLimiter = rateLimiter.createHttpLimiter(redis);
const otpLimiter = rateLimiter.createOtpLimiter(redis);

app.use("/api/send-otp", (req, res, next) => {
  otpLimiter.consume(req.ip).then(() => next()).catch(() =>
    res.status(429).json({ error: "Too many OTP requests. Try again later." })
  );
});

app.use((req, res, next) => {
  if (req.path === "/api/send-otp") return next();
  httpLimiter.consume(req.ip).then(() => next()).catch(() =>
    res.status(429).json({ error: "Too many requests" })
  );
});

// ─── OTP endpoints ─────────────────────────────────────────
app.post("/api/send-otp", async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email || !type) return res.status(400).json({ error: "Invalid request" });
    const validTypes = ["verify", "reset", "delete", "change_email"];
    if (!validTypes.includes(type)) return res.status(400).json({ error: "Invalid OTP type" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await supabase.from("otp_codes").upsert({
      email, otp_hash: otp, type,
      expires_at: expiresAt.toISOString(), used: false,
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
      .from("otp_codes").select("*")
      .eq("email", email).eq("otp_hash", otp).eq("type", type)
      .eq("used", false).gte("expires_at", new Date().toISOString()).single();
    if (error || !data) return res.status(400).json({ error: "Invalid or expired OTP" });
    await supabase.from("otp_codes").update({ used: true }).eq("id", data.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Verification failed" });
  }
});

// ─── Online count ───────────────────────────────────────────
app.get("/api/online-count", async (req, res) => {
  const count = await redis.get("online:count") || "0";
  res.json({ count: parseInt(count) });
});

app.get("/health", (_, res) => res.json({ status: "ok", timestamp: Date.now() }));

// ─── Socket.io rate limiter ─────────────────────────────────
const socketLimiter = new RateLimiterRedis({
  storeClient: redis, keyPrefix: "socket_limit",
  points: 30, duration: 60,
});

const msgLimiter = new RateLimiterRedis({
  storeClient: redis, keyPrefix: "msg_limit",
  points: 20, duration: 10,
});

io.use(async (socket, next) => {
  try {
    await socketLimiter.consume(socket.handshake.address);
    next();
  } catch {
    next(new Error("Rate limit exceeded"));
  }
});

// ─── Online count tracker ──────────────────────────────────
async function updateOnlineCount(delta) {
  const count = await redis.incrby("online:count", delta);
  const safeCount = Math.max(0, count);
  if (safeCount !== count) await redis.set("online:count", 0);
  io.emit("online_count", { count: safeCount });
}

// ─── Interest matching helpers ─────────────────────────────
function buildQueueKeys(mode, interests = []) {
  const keys = [`waiting:${mode}:any`];
  interests.slice(0, 5).forEach((i) => {
    keys.push(`waiting:${mode}:interest:${i.toLowerCase().replace(/\s+/g, "_")}`);
  });
  return keys;
}

async function findMatch(socketId, mode, interests) {
  // Try interest queues first (best match)
  for (const interest of interests.slice(0, 5)) {
    const key = `waiting:${mode}:interest:${interest.toLowerCase().replace(/\s+/g, "_")}`;
    const waitingId = await redis.lpop(key);
    if (waitingId && waitingId !== socketId) return { waitingId, matchedInterest: interest };
  }
  // Fallback to general queue
  const waitingId = await redis.lpop(`waiting:${mode}:any`);
  if (waitingId && waitingId !== socketId) return { waitingId, matchedInterest: null };
  return null;
}

async function enqueue(socketId, mode, interests) {
  const ttl = 300;
  const generalKey = `waiting:${mode}:any`;
  await redis.rpush(generalKey, socketId);
  await redis.expire(generalKey, ttl);
  for (const interest of interests.slice(0, 5)) {
    const key = `waiting:${mode}:interest:${interest.toLowerCase().replace(/\s+/g, "_")}`;
    await redis.rpush(key, socketId);
    await redis.expire(key, ttl);
  }
}

async function dequeue(socketId, mode, interests) {
  await redis.lrem(`waiting:${mode}:any`, 0, socketId);
  for (const interest of (interests || [])) {
    const key = `waiting:${mode}:interest:${interest.toLowerCase().replace(/\s+/g, "_")}`;
    await redis.lrem(key, 0, socketId);
  }
}

// ─── Socket.io handlers ─────────────────────────────────────
io.on("connection", (socket) => {
  let pairedWith = null;
  let roomId = null;
  let myInterests = [];
  let myMode = "video";
  let fingerprintId = null;

  updateOnlineCount(1);

  // ── Fingerprint check for banned users ─────────────────
  socket.on("fingerprint", async ({ fpId }) => {
    if (!fpId) return;
    fingerprintId = fpId;
    const banned = await redis.get(`fp_ban:${fpId}`);
    if (banned) {
      socket.emit("banned", { reason: "You are banned from MiloBolo." });
      socket.disconnect(true);
    }
  });

  // ── Matchmaking ────────────────────────────────────────
  socket.on("find_match", async ({ mode = "video", userId = null, interests = [] }) => {
    myMode = mode;
    myInterests = interests;

    // Store socket metadata
    await redis.set(`socket:${socket.id}`, JSON.stringify({ userId, interests, mode }), "EX", 600);

    const match = await findMatch(socket.id, mode, interests);
    if (match) {
      const { waitingId, matchedInterest } = match;
      roomId = uuidv4();
      pairedWith = waitingId;

      await redis.set(`room:${roomId}`, JSON.stringify({ a: socket.id, b: waitingId }), "EX", 3600);

      // Get peer interests for display
      const peerMeta = await redis.get(`socket:${waitingId}`);
      const peerData = peerMeta ? JSON.parse(peerMeta) : {};

      socket.join(roomId);
      io.sockets.sockets.get(waitingId)?.join(roomId);

      io.to(socket.id).emit("match_found", {
        roomId, isInitiator: true, peer: waitingId,
        matchedInterest, peerInterests: peerData.interests || [],
      });
      io.to(waitingId).emit("match_found", {
        roomId, isInitiator: false, peer: socket.id,
        matchedInterest, peerInterests: interests,
      });
    } else {
      await enqueue(socket.id, mode, interests);
      socket.emit("waiting");
    }
  });

  socket.on("cancel_search", async () => {
    await dequeue(socket.id, myMode, myInterests);
    socket.emit("search_cancelled");
  });

  // ── WebRTC signaling ────────────────────────────────────
  socket.on("signal", ({ to, signal }) => {
    io.to(to).emit("signal", { from: socket.id, signal });
  });

  // ── E2E key exchange ────────────────────────────────────
  socket.on("e2e_pubkey", ({ to, publicKey }) => {
    io.to(to).emit("e2e_pubkey", { from: socket.id, publicKey });
  });

  // ── Encrypted message ───────────────────────────────────
  socket.on("message", async ({ roomId: rid, ciphertext, iv, plain }) => {
    try {
      await msgLimiter.consume(socket.id);
    } catch {
      socket.emit("error", { message: "Slow down! Message rate limit exceeded." });
      return;
    }
    if (!rid) return;
    // ciphertext = E2E encrypted; plain = fallback for text-only when E2E not established
    const payload = ciphertext
      ? { from: socket.id, ciphertext, iv, ts: Date.now(), encrypted: true }
      : { from: socket.id, text: (plain || "").slice(0, 500), ts: Date.now(), encrypted: false };
    socket.to(rid).emit("message", payload);
  });

  // ── Typing indicator ────────────────────────────────────
  socket.on("typing", ({ roomId: rid, typing }) => {
    if (rid) socket.to(rid).emit("typing", { from: socket.id, typing });
  });

  // ── Reactions ───────────────────────────────────────────
  socket.on("reaction", ({ roomId: rid, emoji }) => {
    const allowed = ["👍","❤️","😂","😮","😢","🔥","👏","💯"];
    if (rid && allowed.includes(emoji)) {
      socket.to(rid).emit("reaction", { from: socket.id, emoji });
    }
  });

  // ── Friend request ──────────────────────────────────────
  socket.on("friend_request", ({ to, fromUserId, fromName }) => {
    io.to(to).emit("friend_request", { from: socket.id, fromUserId, fromName });
  });

  socket.on("friend_response", ({ to, accepted, fromUserId, toUserId }) => {
    io.to(to).emit("friend_response", { accepted, fromUserId, toUserId });
  });

  // ── Screen share signal ─────────────────────────────────
  socket.on("screen_share_start", ({ roomId: rid }) => {
    socket.to(rid).emit("peer_screen_share", { active: true });
  });

  socket.on("screen_share_stop", ({ roomId: rid }) => {
    socket.to(rid).emit("peer_screen_share", { active: false });
  });

  // ── Next / skip ─────────────────────────────────────────
  socket.on("next", async () => {
    if (pairedWith) {
      io.to(pairedWith).emit("peer_left");
      socket.leave(roomId);
      io.sockets.sockets.get(pairedWith)?.leave(roomId);
      if (roomId) await redis.del(`room:${roomId}`);
      pairedWith = null;
      roomId = null;
    }
  });

  // ── Report ──────────────────────────────────────────────
  socket.on("report", async ({ reportedId, reason, screenshotB64 }) => {
    if (!reportedId || !reason) return;
    await supabase.from("reports").insert({
      reporter_socket: socket.id,
      reported_socket: reportedId,
      reason, room_id: roomId,
      screenshot_b64: screenshotB64 || null,
    });
    socket.emit("report_received");
  });

  // ── Disconnect ──────────────────────────────────────────
  socket.on("disconnect", async () => {
    updateOnlineCount(-1);
    await dequeue(socket.id, myMode, myInterests);
    await redis.del(`socket:${socket.id}`);
    if (pairedWith) io.to(pairedWith).emit("peer_left");
    if (roomId) await redis.del(`room:${roomId}`);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`MiloBolo signaling on :${PORT}`));

require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");
const { RateLimiterRedis } = require("rate-limiter-flexible");
const Redis = require("ioredis");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
const fetch = require("node-fetch");
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
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 3000)),
  lazyConnect: true,
  enableOfflineQueue: false,
});
redis.on("error", () => {});

const supabase = createClient(
  process.env.SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder"
);

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "10kb" }));

// ─── HTTP rate limiters ─────────────────────────────────────
const httpLimiter = rateLimiter.createHttpLimiter(redis);
const otpLimiter = rateLimiter.createOtpLimiter(redis);
const contactLimiter = rateLimiter.createContactLimiter(redis);

app.use("/api/send-otp", (req, res, next) => {
  otpLimiter.consume(req.ip)
    .then(() => next())
    .catch((e) => {
      if (e && e.msBeforeNext != null) return res.status(429).json({ error: "Too many OTP requests. Try again later." });
      next();
    });
});

app.use((req, res, next) => {
  if (req.path === "/api/send-otp") return next();
  httpLimiter.consume(req.ip)
    .then(() => next())
    .catch((e) => {
      if (e && e.msBeforeNext != null) return res.status(429).json({ error: "Too many requests" });
      next();
    });
});

// ─── OTP endpoints ─────────────────────────────────────────
app.post("/api/send-otp", async (req, res) => {
  try {
    const { email, type } = req.body;
    if (!email || !type) return res.status(400).json({ error: "Invalid request" });
    const validTypes = ["verify", "reset", "delete", "change_email", "college_verify"];
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
  try {
    const count = await redis.get("online:count") || "0";
    res.json({ count: parseInt(count) });
  } catch {
    res.json({ count: memOnlineCount });
  }
});

// ─── Contact form ────────────────────────────────────────────
app.post("/api/contact", async (req, res, next) => {
  contactLimiter.consume(req.ip)
    .then(() => next())
    .catch((e) => {
      if (e && e.msBeforeNext != null) {
        const retryAfter = Math.ceil(e.msBeforeNext / 1000 / 60);
        return res.status(429).json({ error: `Too many contact submissions. Try again in ${retryAfter} minute${retryAfter !== 1 ? "s" : ""}.` });
      }
      next();
    });
}, async (req, res) => {
  const { name, email, subject, message, recaptchaToken } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: "Missing required fields." });
  if (typeof email !== "string" || !email.includes("@")) return res.status(400).json({ error: "Invalid email." });

  // reCAPTCHA verification (skip in dev)
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
  const isDevKey = !siteKey || siteKey.includes("PLACEHOLDER") || siteKey === "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MmuKj8bi";
  if (!isDevKey && recaptchaToken && recaptchaToken !== "dev-skip") {
    try {
      const resp = await fetch(
        `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
        { method: "POST" }
      );
      const data = await resp.json();
      if (!data.success || data.score < 0.5) return res.status(403).json({ error: "reCAPTCHA verification failed." });
    } catch {}
  }

  const adminEmail = process.env.SMTP_USER;
  const contactEmail = process.env.CONTACT_EMAIL || adminEmail;
  if (!adminEmail) return res.status(503).json({ error: "Email service not configured." });

  try {
    const { createTransport } = require("nodemailer");
    const transporter = createTransport({
      host: process.env.SMTP_HOST || "smtp.hostinger.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"MiloBolo Contact" <${adminEmail}>`,
      to: contactEmail,
      replyTo: `"${name}" <${email}>`,
      subject: `[MiloBolo Contact] ${subject || "New message from " + name}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0f0f0f;color:#fff;border-radius:12px;">
          <h2 style="color:#6C63FF;">New Contact Message</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr><td style="padding:8px;color:#999;width:80px;">Name</td><td style="padding:8px;">${name}</td></tr>
            <tr><td style="padding:8px;color:#999;">Email</td><td style="padding:8px;"><a href="mailto:${email}" style="color:#6C63FF;">${email}</a></td></tr>
            <tr><td style="padding:8px;color:#999;">Subject</td><td style="padding:8px;">${subject || "(none)"}</td></tr>
          </table>
          <div style="background:#1a1a2e;border-radius:8px;padding:20px;">
            <p style="margin:0;line-height:1.7;white-space:pre-wrap;">${message.slice(0, 2000)}</p>
          </div>
          <p style="font-size:12px;color:#666;margin-top:16px;">Sent from MiloBolo contact form • ${new Date().toISOString()}</p>
        </div>
      `,
    });

    // Auto-reply to sender
    await transporter.sendMail({
      from: `"MiloBolo" <${adminEmail}>`,
      to: email,
      subject: "We received your message — MiloBolo",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0f0f0f;color:#fff;border-radius:12px;">
          <h2 style="color:#6C63FF;">Thanks, ${name}!</h2>
          <p style="line-height:1.7;">We received your message and will get back to you within 48 hours.</p>
          <p style="line-height:1.7;color:#999;">Your message: <em>${message.slice(0, 200)}${message.length > 200 ? "…" : ""}</em></p>
          <p style="font-size:12px;color:#666;margin-top:24px;">MiloBolo — Free Random Chat Forever</p>
        </div>
      `,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Contact send error:", err.message);
    res.status(500).json({ error: "Failed to send message. Please try again later." });
  }
});

app.get("/health", (_, res) => res.json({ status: "ok", timestamp: Date.now() }));

// ─── Socket.io rate limiters ────────────────────────────────
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

// ─── In-memory fallbacks ────────────────────────────────────
let memOnlineCount = 0;
const memQueues = {};
const memSocketMeta = {};

function memQueuePush(key, val) {
  if (!memQueues[key]) memQueues[key] = [];
  memQueues[key].push(val);
}
function memQueuePop(key) {
  if (!memQueues[key] || !memQueues[key].length) return null;
  return memQueues[key].shift();
}
function memQueueRemove(key, val) {
  if (memQueues[key]) memQueues[key] = memQueues[key].filter((v) => v !== val);
}

async function updateOnlineCount(delta) {
  try {
    const count = await redis.incrby("online:count", delta);
    const safeCount = Math.max(0, count);
    if (safeCount !== count) await redis.set("online:count", 0);
    memOnlineCount = safeCount;
    io.emit("online_count", { count: safeCount });
  } catch {
    memOnlineCount = Math.max(0, memOnlineCount + delta);
    io.emit("online_count", { count: memOnlineCount });
  }
}

// ─── IP country lookup ──────────────────────────────────────
const countryCache = new Map();
async function getCountry(ip) {
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("172.") || ip.startsWith("192.168.")) {
    return { country: "IN", countryName: "India", flag: "🇮🇳" };
  }
  if (countryCache.has(ip)) return countryCache.get(ip);
  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,country`, { signal: AbortSignal.timeout(2000) });
    const d = await r.json();
    const result = { country: d.countryCode || "?", countryName: d.country || "Unknown", flag: countryToFlag(d.countryCode) };
    countryCache.set(ip, result);
    setTimeout(() => countryCache.delete(ip), 3600000); // 1h TTL
    return result;
  } catch {
    return { country: "?", countryName: "Unknown", flag: "🌐" };
  }
}

function countryToFlag(code) {
  if (!code || code.length !== 2) return "🌐";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1F1E0 + c.charCodeAt(0) - 65));
}

// ─── Matchmaking helpers ────────────────────────────────────
// Gender queue key: waiting:<mode>:gender:<myGender>_want:<wantGender>
// Only gender-filtered users sit in gender queues; "any" users sit in the global queue only.
async function findMatch(socketId, mode, interests, country, myGender, wantGender, college) {
  const genderPrefix = (wantGender && wantGender !== "any") ? `gender:${wantGender}:` : "";
  const ns = college ? `college:${mode}` : `waiting:${mode}`;
  try {
    // College pool is isolated — only match within it
    if (college) {
      const waitingId = await redis.lpop(`${ns}:any`);
      if (waitingId && waitingId !== socketId) return { waitingId, matchedInterest: null };
      return null;
    }
    // If user wants a specific gender, check gender queue first
    if (genderPrefix) {
      const gKey = `waiting:${mode}:${genderPrefix}any`;
      const waitingId = await redis.lpop(gKey);
      if (waitingId && waitingId !== socketId) return { waitingId, matchedInterest: null };
    }
    // Same-country interest match first
    if (country && country !== "?") {
      for (const interest of interests.slice(0, 5)) {
        const key = `waiting:${mode}:${country}:interest:${interest.toLowerCase().replace(/\s+/g, "_")}`;
        const waitingId = await redis.lpop(key);
        if (waitingId && waitingId !== socketId) return { waitingId, matchedInterest: interest };
      }
      const countryKey = `waiting:${mode}:${country}:any`;
      const waitingId = await redis.lpop(countryKey);
      if (waitingId && waitingId !== socketId) return { waitingId, matchedInterest: null };
    }
    // Global interest match
    for (const interest of interests.slice(0, 5)) {
      const key = `waiting:${mode}:interest:${interest.toLowerCase().replace(/\s+/g, "_")}`;
      const waitingId = await redis.lpop(key);
      if (waitingId && waitingId !== socketId) return { waitingId, matchedInterest: interest };
    }
    // Global general queue
    const waitingId = await redis.lpop(`waiting:${mode}:any`);
    if (waitingId && waitingId !== socketId) return { waitingId, matchedInterest: null };
    return null;
  } catch {
    if (college) {
      const waitingId = memQueuePop(`${ns}:any`);
      if (waitingId && waitingId !== socketId) return { waitingId, matchedInterest: null };
      return null;
    }
    if (genderPrefix) {
      const gKey = `waiting:${mode}:${genderPrefix}any`;
      const waitingId = memQueuePop(gKey);
      if (waitingId && waitingId !== socketId) return { waitingId, matchedInterest: null };
    }
    for (const interest of interests.slice(0, 5)) {
      const key = `waiting:${mode}:interest:${interest.toLowerCase().replace(/\s+/g, "_")}`;
      const waitingId = memQueuePop(key);
      if (waitingId && waitingId !== socketId) return { waitingId, matchedInterest: interest };
    }
    const waitingId = memQueuePop(`waiting:${mode}:any`);
    if (waitingId && waitingId !== socketId) return { waitingId, matchedInterest: null };
    return null;
  }
}

async function enqueue(socketId, mode, interests, country, myGender, college) {
  const ttl = 300;
  try {
    if (college) {
      await redis.rpush(`college:${mode}:any`, socketId);
      await redis.expire(`college:${mode}:any`, ttl);
      return;
    }
    // Gender queue (so gender-seeking users can find them)
    if (myGender && myGender !== "any") {
      await redis.rpush(`waiting:${mode}:gender:${myGender}:any`, socketId);
      await redis.expire(`waiting:${mode}:gender:${myGender}:any`, ttl);
    }
    // Country queue
    if (country && country !== "?") {
      await redis.rpush(`waiting:${mode}:${country}:any`, socketId);
      await redis.expire(`waiting:${mode}:${country}:any`, ttl);
    }
    // Global queue
    await redis.rpush(`waiting:${mode}:any`, socketId);
    await redis.expire(`waiting:${mode}:any`, ttl);
    for (const interest of interests.slice(0, 5)) {
      const key = `waiting:${mode}:interest:${interest.toLowerCase().replace(/\s+/g, "_")}`;
      await redis.rpush(key, socketId);
      await redis.expire(key, ttl);
    }
  } catch {
    if (college) {
      memQueuePush(`college:${mode}:any`, socketId);
      return;
    }
    if (myGender && myGender !== "any") {
      memQueuePush(`waiting:${mode}:gender:${myGender}:any`, socketId);
    }
    memQueuePush(`waiting:${mode}:any`, socketId);
    for (const interest of interests.slice(0, 5)) {
      memQueuePush(`waiting:${mode}:interest:${interest.toLowerCase().replace(/\s+/g, "_")}`, socketId);
    }
  }
}

async function dequeue(socketId, mode, interests, country, myGender, college) {
  try {
    if (college) {
      await redis.lrem(`college:${mode}:any`, 0, socketId);
      return;
    }
    if (myGender && myGender !== "any") {
      await redis.lrem(`waiting:${mode}:gender:${myGender}:any`, 0, socketId);
    }
    if (country && country !== "?") {
      await redis.lrem(`waiting:${mode}:${country}:any`, 0, socketId);
    }
    await redis.lrem(`waiting:${mode}:any`, 0, socketId);
    for (const interest of (interests || [])) {
      await redis.lrem(`waiting:${mode}:interest:${interest.toLowerCase().replace(/\s+/g, "_")}`, 0, socketId);
    }
  } catch {
    if (college) {
      memQueueRemove(`college:${mode}:any`, socketId);
      return;
    }
    if (myGender && myGender !== "any") {
      memQueueRemove(`waiting:${mode}:gender:${myGender}:any`, socketId);
    }
    memQueueRemove(`waiting:${mode}:any`, socketId);
    for (const interest of (interests || [])) {
      memQueueRemove(`waiting:${mode}:interest:${interest.toLowerCase().replace(/\s+/g, "_")}`, socketId);
    }
  }
}

// ─── Spy mode queue ─────────────────────────────────────────
// spy queue: waiting for a question asker to join two chatters
const spyRooms = {}; // roomId → { a, b, question, spyId? }
const sdRatings = {}; // roomId → { socketId: "like"|"pass" }

async function findSpyMatch() {
  // Find two text-mode chatters
  try {
    const a = await redis.lpop("waiting:spy:any");
    const b = a ? await redis.lpop("waiting:spy:any") : null;
    if (a && b && a !== b) return { a, b };
    if (a) await redis.rpush("waiting:spy:any", a); // put back
    return null;
  } catch {
    const a = memQueuePop("waiting:spy:any");
    const b = a ? memQueuePop("waiting:spy:any") : null;
    if (a && b && a !== b) return { a, b };
    if (a) memQueuePush("waiting:spy:any", a);
    return null;
  }
}

// ─── Socket.io handlers ─────────────────────────────────────
io.on("connection", async (socket) => {
  let pairedWith = null;
  let roomId = null;
  let myInterests = [];
  let myMode = "video";
  let myCountry = null;
  let myGender = "any"; // "any" | "male" | "female"
  let wantGender = "any";
  let myCollege = false;
  let spyRole = null; // "spy" | "chatter_a" | "chatter_b" | null

  updateOnlineCount(1);

  // Resolve country from IP
  const ip = socket.handshake.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || socket.handshake.address;
  const geoInfo = await getCountry(ip);
  myCountry = geoInfo.country;

  // ── Fingerprint check ───────────────────────────────────
  socket.on("fingerprint", async ({ fpId }) => {
    if (!fpId) return;
    try {
      const banned = await redis.get(`fp_ban:${fpId}`);
      if (banned) {
        socket.emit("banned", { reason: "You are banned from MiloBolo." });
        socket.disconnect(true);
      }
    } catch {}
  });

  // ── Matchmaking ─────────────────────────────────────────
  socket.on("find_match", async ({ mode = "video", userId = null, interests = [], gender = "any", wantGender: wg = "any", college = false }) => {
    myMode = mode;
    myInterests = interests;
    myGender = (gender === "male" || gender === "female") ? gender : "any";
    wantGender = (wg === "male" || wg === "female") ? wg : "any";
    myCollege = !!college;

    const meta = { userId, interests, mode, country: geoInfo, gender: myGender, college: myCollege };
    memSocketMeta[socket.id] = meta;
    try { await redis.set(`socket:${socket.id}`, JSON.stringify(meta), "EX", 600); } catch {}

    const match = await findMatch(socket.id, mode, interests, myCountry, myGender, wantGender, myCollege);
    if (match) {
      const { waitingId, matchedInterest } = match;
      roomId = uuidv4();
      pairedWith = waitingId;

      try { await redis.set(`room:${roomId}`, JSON.stringify({ a: socket.id, b: waitingId }), "EX", 3600); } catch {}

      let peerData = memSocketMeta[waitingId] || {};
      try {
        const peerMeta = await redis.get(`socket:${waitingId}`);
        if (peerMeta) peerData = JSON.parse(peerMeta);
      } catch {}

      socket.join(roomId);
      io.sockets.sockets.get(waitingId)?.join(roomId);

      io.to(socket.id).emit("match_found", {
        roomId, isInitiator: true, peer: waitingId,
        matchedInterest, peerInterests: peerData.interests || [],
        peerCountry: peerData.country || null,
        myCountry: geoInfo,
        peerGender: peerData.gender || "any",
      });
      io.to(waitingId).emit("match_found", {
        roomId, isInitiator: false, peer: socket.id,
        matchedInterest, peerInterests: interests,
        peerCountry: geoInfo,
        myCountry: peerData.country || null,
        peerGender: myGender,
      });
    } else {
      await enqueue(socket.id, mode, interests, myCountry, myGender, myCollege);
      socket.emit("waiting", { country: geoInfo });
    }
  });

  // ── Spy / Question mode ─────────────────────────────────
  // Role: "spy" — asks a question, watches two strangers discuss it
  // Role: "chatter" — gets paired with another chatter, spy watches
  socket.on("find_spy_match", async ({ role = "chatter", question = "" }) => {
    myMode = "spy";

    if (role === "spy") {
      spyRole = "spy";
      // Spy waits for two chatters to be available
      const pair = await findSpyMatch();
      if (pair) {
        const { a, b } = pair;
        roomId = uuidv4();
        spyRooms[roomId] = { a, b, spyId: socket.id, question };

        socket.join(roomId);
        io.sockets.sockets.get(a)?.join(roomId);
        io.sockets.sockets.get(b)?.join(roomId);

        const aData = memSocketMeta[a] || {};
        const bData = memSocketMeta[b] || {};

        io.to(socket.id).emit("spy_match_found", { roomId, question, role: "spy" });
        io.to(a).emit("spy_match_found", { roomId, question, role: "chatter_a", peer: b, peerCountry: bData.country });
        io.to(b).emit("spy_match_found", { roomId, question, role: "chatter_b", peer: a, peerCountry: aData.country });

        memSocketMeta[a] = { ...aData, spyRoom: roomId };
        memSocketMeta[b] = { ...bData, spyRoom: roomId };
      } else {
        // Store question and wait
        memSocketMeta[socket.id] = { ...memSocketMeta[socket.id], pendingSpyQuestion: question };
        socket.emit("waiting", { role: "spy" });
        // Try again when chatters arrive
        try { await redis.set(`spy_waiting:${socket.id}`, question, "EX", 300); } catch {}
      }
    } else {
      spyRole = "chatter";
      memSocketMeta[socket.id] = { ...memSocketMeta[socket.id], mode: "spy" };
      // Check if a spy is waiting
      let spySocketId = null;
      let spyQuestion = "";
      try {
        const keys = await redis.keys("spy_waiting:*");
        if (keys.length) {
          spySocketId = keys[0].replace("spy_waiting:", "");
          spyQuestion = await redis.get(keys[0]) || "";
          await redis.del(keys[0]);
        }
      } catch {
        // Check memSocketMeta for pending spy
        for (const [sid, meta] of Object.entries(memSocketMeta)) {
          if (meta.pendingSpyQuestion !== undefined) {
            spySocketId = sid;
            spyQuestion = meta.pendingSpyQuestion;
            delete memSocketMeta[sid].pendingSpyQuestion;
            break;
          }
        }
      }

      // Queue as chatter
      try { await redis.rpush("waiting:spy:any", socket.id); await redis.expire("waiting:spy:any", 300); }
      catch { memQueuePush("waiting:spy:any", socket.id); }

      const pair = await findSpyMatch();
      if (pair) {
        const { a, b } = pair;
        roomId = uuidv4();
        const question = spyQuestion || "Discuss anything!";
        spyRooms[roomId] = { a, b, spyId: spySocketId, question };

        const aData = memSocketMeta[a] || {};
        const bData = memSocketMeta[b] || {};

        io.sockets.sockets.get(a)?.join(roomId);
        io.sockets.sockets.get(b)?.join(roomId);

        io.to(a).emit("spy_match_found", { roomId, question, role: "chatter_a", peer: b, peerCountry: bData.country });
        io.to(b).emit("spy_match_found", { roomId, question, role: "chatter_b", peer: a, peerCountry: aData.country });

        if (spySocketId && io.sockets.sockets.get(spySocketId)) {
          io.sockets.sockets.get(spySocketId).join(roomId);
          io.to(spySocketId).emit("spy_match_found", { roomId, question, role: "spy" });
        }
      } else {
        socket.emit("waiting", { role: "chatter" });
      }
    }
  });

  socket.on("cancel_search", async () => {
    await dequeue(socket.id, myMode, myInterests, myCountry, myGender, myCollege);
    try { await redis.lrem("waiting:spy:any", 0, socket.id); } catch { memQueueRemove("waiting:spy:any", socket.id); }
    try { await redis.del(`spy_waiting:${socket.id}`); } catch {}
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

  // ── Message ─────────────────────────────────────────────
  socket.on("message", async ({ roomId: rid, ciphertext, iv, plain, senderRole }) => {
    try { await msgLimiter.consume(socket.id); }
    catch {
      socket.emit("error", { message: "Slow down! Message rate limit exceeded." });
      return;
    }
    if (!rid) return;
    const payload = ciphertext
      ? { from: socket.id, ciphertext, iv, ts: Date.now(), encrypted: true, senderRole: senderRole || null }
      : { from: socket.id, text: (plain || "").slice(0, 500), ts: Date.now(), encrypted: false, senderRole: senderRole || null };
    socket.to(rid).emit("message", payload);
  });

  // ── Typing ──────────────────────────────────────────────
  socket.on("typing", ({ roomId: rid, typing, senderRole }) => {
    if (rid) socket.to(rid).emit("typing", { from: socket.id, typing, senderRole: senderRole || null });
  });

  // ── Reactions ───────────────────────────────────────────
  socket.on("reaction", ({ roomId: rid, emoji }) => {
    const allowed = ["👍","❤️","😂","😮","😢","🔥","👏","💯"];
    if (rid && allowed.includes(emoji)) socket.to(rid).emit("reaction", { from: socket.id, emoji });
  });

  // ── Image message ───────────────────────────────────────
  socket.on("image_message", ({ roomId: rid, imageUrl, senderRole }) => {
    if (!rid || typeof imageUrl !== "string") return;
    // Only allow R2 public URLs to prevent SSRF/phishing via socket relay
    const allowed = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-";
    if (!imageUrl.startsWith(allowed) && !imageUrl.startsWith("https://pub-")) return;
    socket.to(rid).emit("image_message", { from: socket.id, imageUrl, ts: Date.now(), senderRole: senderRole || null });
  });

  // ── Speed dating rating ─────────────────────────────────
  socket.on("sd_rating", ({ roomId: rid, rating }) => {
    if (!rid || (rating !== "like" && rating !== "pass")) return;
    if (!sdRatings[rid]) sdRatings[rid] = {};
    sdRatings[rid][socket.id] = rating;
    // Check for mutual like
    const votes = Object.values(sdRatings[rid]);
    if (votes.length === 2 && votes.every((v) => v === "like")) {
      io.to(rid).emit("sd_mutual_like", { roomId: rid });
      delete sdRatings[rid];
    }
  });

  // ── Friend request ──────────────────────────────────────
  socket.on("friend_request", ({ to, fromUserId, fromName }) => {
    io.to(to).emit("friend_request", { from: socket.id, fromUserId, fromName });
  });

  socket.on("friend_response", ({ to, accepted, fromUserId, toUserId }) => {
    io.to(to).emit("friend_response", { accepted, fromUserId, toUserId });
  });

  // ── Screen share ────────────────────────────────────────
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
      try { if (roomId) await redis.del(`room:${roomId}`); } catch {}
      if (roomId) delete sdRatings[roomId];
      pairedWith = null;
    }
    // Clean spy room
    if (roomId && spyRooms[roomId]) {
      const room = spyRooms[roomId];
      io.to(room.a).emit("peer_left");
      io.to(room.b).emit("peer_left");
      if (room.spyId) io.to(room.spyId).emit("spy_ended");
      delete spyRooms[roomId];
    }
    roomId = null;
    spyRole = null;
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
    await dequeue(socket.id, myMode, myInterests, myCountry, myGender, myCollege);
    try { await redis.lrem("waiting:spy:any", 0, socket.id); } catch { memQueueRemove("waiting:spy:any", socket.id); }
    try { await redis.del(`spy_waiting:${socket.id}`); } catch {}
    delete memSocketMeta[socket.id];
    try { await redis.del(`socket:${socket.id}`); } catch {}

    if (pairedWith) io.to(pairedWith).emit("peer_left");

    // Clean spy room on disconnect
    if (roomId && spyRooms[roomId]) {
      const room = spyRooms[roomId];
      if (spyRole === "spy") {
        io.to(room.a).emit("spy_ended");
        io.to(room.b).emit("spy_ended");
      } else {
        const other = room.a === socket.id ? room.b : room.a;
        io.to(other).emit("peer_left");
        if (room.spyId) io.to(room.spyId).emit("spy_ended");
      }
      delete spyRooms[roomId];
    }

    try { if (roomId) await redis.del(`room:${roomId}`); } catch {}
    if (roomId) delete sdRatings[roomId];
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`MiloBolo signaling on :${PORT}`));

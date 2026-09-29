require("dotenv").config();
const ws = require("ws");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");
const Redis = require("ioredis");
const { createClient } = require("@supabase/supabase-js");
const { v4: uuidv4 } = require("uuid");
// Node v18+ has fetch built-in; no require needed
const mailer = require("./lib/mailer");
const rateLimiter = require("./lib/rateLimiter");
const { createAuth, STAFF_ROLES } = require("./lib/auth");
const { createOtpStore, VALID_TYPES: OTP_TYPES } = require("./lib/otp");
const mm = require("./lib/matchmaking");
const games = require("./lib/games");
const { escapeHtml, countryToFlag, isAcademicEmail, isEmail, str } = require("./lib/util");
const BadWordsFilter = require("bad-words");
const tf = require("@tensorflow/tfjs");
const nsfwjs = require("nsfwjs");
const Jimp = require("jimp");

const profanityFilter = new BadWordsFilter();

// ── nsfwjs model (loaded once at startup) ───────────────────
let nsfwModel = null;
(async () => {
  try {
    // nsfwjs v4: models are bundled in the npm package — no external URL needed
    nsfwModel = await nsfwjs.load("MobileNetV2");
    console.log("[nsfwjs] MobileNetV2 model loaded from bundled npm package");
  } catch (e) {
    console.warn("[nsfwjs] model failed to load — image NSFW check disabled:", e.message);
  }
})();

async function classifyBuffer(buffer) {
  if (!nsfwModel) return false;
  try {
    const image = await Jimp.read(buffer);
    image.resize(224, 224);
    const { data, width, height } = image.bitmap;
    // Jimp bitmap is RGBA; build an RGB tensor
    const pixels = new Int32Array(width * height * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      pixels[j] = data[i];
      pixels[j + 1] = data[i + 1];
      pixels[j + 2] = data[i + 2];
    }
    const tensor = tf.tensor3d(pixels, [height, width, 3], "int32");
    const predictions = await nsfwModel.classify(tensor);
    tensor.dispose();

    const get = (cls) => predictions.find((p) => p.className === cls)?.probability ?? 0;
    // Flag if Porn > 60% or Hentai > 70%
    return get("Porn") > 0.6 || get("Hentai") > 0.7;
  } catch (e) {
    console.warn("[nsfwjs] classify error:", e.message);
    return false; // fail open — don't block on decode errors
  }
}

const app = express();
const server = http.createServer(app);
const startedAt = Date.now();

const allowedOrigins = [
  process.env.SITE_URL || "https://chat.videodownloaders.cloud",
  "http://localhost:3000",
];

const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"], credentials: true },
  transports: ["websocket", "polling"],
  pingTimeout: 30000,
  pingInterval: 10000,
  maxHttpBufferSize: 1e6, // voice notes are capped at 400 KB below
});

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => (times > 3 ? null : Math.min(times * 500, 3000)),
  lazyConnect: true,
  enableOfflineQueue: false,
});
redis.on("error", () => {});
redis.connect().catch(() => console.warn("[redis] unavailable — using in-memory fallbacks"));

const supabaseEnabled = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_KEY || "placeholder",
  { realtime: { transport: ws }, auth: { persistSession: false, autoRefreshToken: false } }
);
if (!supabaseEnabled) console.warn("[supabase] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — accounts, history and reports disabled");

const auth = createAuth(supabase, { enabled: supabaseEnabled });
const otpStore = createOtpStore(supabase);

// Behind nginx-proxy: use X-Forwarded-For so per-IP limits aren't shared by everyone
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "10kb" }));

// ─── HTTP rate limiters ─────────────────────────────────────
const httpLimiter = rateLimiter.createHttpLimiter(redis);
const otpLimiter = rateLimiter.createOtpLimiter(redis);
const otpEmailLimiter = rateLimiter.createLimiter(redis, { keyPrefix: "otp_email", points: 3, duration: 600 });
const contactLimiter = rateLimiter.createContactLimiter(redis);
const socketLimiter = rateLimiter.createLimiter(redis, { keyPrefix: "socket_limit", points: 30, duration: 60 });
const msgLimiter = rateLimiter.createLimiter(redis, { keyPrefix: "msg_limit", points: 20, duration: 10 });
const dmLimiter = rateLimiter.createLimiter(redis, { keyPrefix: "dm_limit", points: 30, duration: 60 });

function limit(limiter, keyFn, message) {
  return (req, res, next) => {
    limiter.consume(keyFn(req))
      .then(() => next())
      .catch((e) => {
        if (rateLimiter.isLimited(e)) return res.status(429).json({ error: message });
        next();
      });
  };
}

app.use((req, res, next) => {
  if (req.path === "/api/send-otp") return next();
  limit(httpLimiter, (r) => r.ip, "Too many requests")(req, res, next);
});

// ─── OTP endpoints ─────────────────────────────────────────
app.post("/api/send-otp", limit(otpLimiter, (r) => r.ip, "Too many OTP requests. Try again later."), async (req, res) => {
  try {
    const { email, type } = req.body || {};
    if (!isEmail(email) || !OTP_TYPES.includes(type)) return res.status(400).json({ error: "Invalid request" });
    if (type === "college_verify" && !isAcademicEmail(email)) {
      return res.status(400).json({ error: "Use your institutional email (.edu, .ac.in, .edu.in …)." });
    }
    try { await otpEmailLimiter.consume(email.toLowerCase()); }
    catch (e) { if (rateLimiter.isLimited(e)) return res.status(429).json({ error: "Too many codes sent to this email. Try again in 10 minutes." }); }

    const otp = await otpStore.issue(email, type);
    await mailer.sendOTP({ email, otp, type });
    res.json({ success: true });
  } catch (err) {
    console.error("OTP error:", err.message);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

app.post("/api/verify-otp", async (req, res) => {
  try {
    const { email, otp, type } = req.body || {};
    if (!isEmail(email) || !OTP_TYPES.includes(type)) return res.status(400).json({ error: "Invalid request" });
    // College codes must go through /api/college/verify so the result is recorded server-side
    if (type === "college_verify") return res.status(400).json({ error: "Use /api/college/verify" });
    const result = await otpStore.verify(email, String(otp || ""), type);
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Verification failed" });
  }
});

// ─── College verification (server decides, not the client) ─
app.post("/api/college/verify", auth.requireUser(), async (req, res) => {
  const { email, otp } = req.body || {};
  if (!isAcademicEmail(email)) return res.status(400).json({ error: "Not an institutional email address." });
  const result = await otpStore.verify(email, String(otp || ""), "college_verify");
  if (!result.ok) return res.status(400).json({ error: result.error });
  const { error } = await supabase.from("profiles")
    .update({ college_verified: true, college_email: email.toLowerCase() })
    .eq("id", req.auth.userId);
  if (error) return res.status(500).json({ error: "Could not save verification." });
  for (const sid of userSockets.get(req.auth.userId) || []) {
    const p = participants.get(sid);
    if (p?.profile) p.profile.college_verified = true;
  }
  res.json({ success: true });
});

// ─── Online count ───────────────────────────────────────────
app.get("/api/online-count", (req, res) => {
  res.json({ count: onlineCount() });
});

// ─── Contact form ────────────────────────────────────────────
app.post("/api/contact", limit(contactLimiter, (r) => r.ip, "Too many contact submissions. Try again later."), async (req, res) => {
  const { name, email, subject, message, recaptchaToken } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ error: "Missing required fields." });
  if (!isEmail(email)) return res.status(400).json({ error: "Invalid email." });
  if (String(name).length > 100 || String(subject || "").length > 200) return res.status(400).json({ error: "Field too long." });

  // reCAPTCHA verification (skip in dev)
  const secret = process.env.RECAPTCHA_SECRET_KEY || process.env.RECAPTCHA_SECRET;
  if (secret && recaptchaToken && recaptchaToken !== "dev-skip") {
    try {
      const resp = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret, response: recaptchaToken }),
      });
      const data = await resp.json();
      if (!data.success || data.score < 0.5) return res.status(403).json({ error: "reCAPTCHA verification failed." });
    } catch {}
  }

  const adminEmail = process.env.SMTP_USER;
  const contactEmail = process.env.CONTACT_EMAIL || adminEmail;
  if (!adminEmail) return res.status(503).json({ error: "Email service not configured." });

  // Everything user-supplied is escaped before it goes into HTML mail
  const n = escapeHtml(name);
  const e = escapeHtml(email);
  const s = escapeHtml(subject || "(none)");
  const body = escapeHtml(String(message).slice(0, 2000));
  const preview = escapeHtml(String(message).slice(0, 200)) + (String(message).length > 200 ? "…" : "");

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
      replyTo: { name: String(name).slice(0, 100), address: email },
      subject: `[MiloBolo Contact] ${String(subject || "New message from " + name).replace(/[\r\n]/g, " ").slice(0, 200)}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0f0f0f;color:#fff;border-radius:12px;">
          <h2 style="color:#6C63FF;">New Contact Message</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr><td style="padding:8px;color:#999;width:80px;">Name</td><td style="padding:8px;">${n}</td></tr>
            <tr><td style="padding:8px;color:#999;">Email</td><td style="padding:8px;"><a href="mailto:${e}" style="color:#6C63FF;">${e}</a></td></tr>
            <tr><td style="padding:8px;color:#999;">Subject</td><td style="padding:8px;">${s}</td></tr>
          </table>
          <div style="background:#1a1a2e;border-radius:8px;padding:20px;">
            <p style="margin:0;line-height:1.7;white-space:pre-wrap;">${body}</p>
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
          <h2 style="color:#6C63FF;">Thanks, ${n}!</h2>
          <p style="line-height:1.7;">We received your message and will get back to you within 48 hours.</p>
          <p style="line-height:1.7;color:#999;">Your message: <em>${preview}</em></p>
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

app.get("/health", async (_, res) => {
  let db = supabaseEnabled ? "unknown" : "disabled";
  if (supabaseEnabled) {
    try {
      const { error } = await supabase.from("feature_flags").select("key", { head: true, count: "exact" });
      db = error ? "error" : "ok";
    } catch { db = "error"; }
  }
  res.json({
    status: "ok",
    timestamp: Date.now(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    redis: redis.status === "ready" ? "ok" : "unavailable",
    database: db,
    nsfwModel: nsfwModel ? "loaded" : "unavailable",
    online: onlineCount(),
  });
});

// ── Invite token pre-registration (server-to-server from Next.js) ──
app.post("/api/invite", express.json({ limit: "1kb" }), (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== "string" || token.length < 10 || token.length > 64) {
    return res.status(400).json({ error: "Invalid token" });
  }
  invites.set(token, { waiting: null, exp: Date.now() + 10 * 60_000 });
  res.json({ ok: true });
});

// ── NSFW image check ─────────────────────────────────────────
// Called by the Next.js upload-chat-image API before storing to R2.
// Accepts raw image bytes as application/octet-stream (max 6 MB).
app.post("/api/check-nsfw",
  express.raw({ type: "application/octet-stream", limit: "6mb" }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: "No image data" });
    }
    // Accept calls from the frontend container (no Origin header on server-to-server)
    // or from allowed browser origins during local dev
    const origin = req.headers.origin || "";
    const allowed = process.env.SITE_URL || "https://chat.videodownloaders.cloud";
    if (origin && !origin.startsWith(allowed) && !origin.startsWith("http://localhost")) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const flagged = await classifyBuffer(req.body);
    res.json({ nsfw: flagged });
  }
);

// ═══════════════════════════════════════════════════════════
// In-memory state (one Socket.IO instance owns every connection)
// ═══════════════════════════════════════════════════════════
const participants = new Map(); // socketId → participant
const waiting = new Map();      // mode → Set<socketId> (insertion order = wait order)
const rooms = new Map();        // roomId → room
const endedRooms = new Map();   // roomId → { members: {socketId: userId}, mode, endedAt } — for ratings/reports after a chat
const userSockets = new Map();  // userId → Set<socketId>
const fpByUser = new Map();     // userId → Set<fpId> (for fingerprint bans)
const invites = new Map();      // token → { waiting: socketId|null, exp }
const avoidStore = new Map();   // identityKey → { keys: Set, exp }
const reportPairs = new Set();  // `${reporterKey}>${reportedKey}` — one counted report per pair
const bannedFps = new Set();
const spyChatters = new Set();  // socketIds waiting as spy-mode chatters
const spyWaiters = new Map();   // spy socketId → question
const stats = { matches: [], waitTimes: {}, pending: { total: 0, video: 0, text: 0, voice: 0, duration: 0 } };

const MODES = ["video", "text", "voice", "speed_dating"];
const AVOID_TTL = 24 * 3600_000;
const ENDED_ROOM_TTL = 10 * 60_000;
const AUTO_BAN_THRESHOLD = 10;

function onlineCount() {
  let n = 0;
  for (const p of participants.values()) if (!p.presenceOnly) n++;
  return n;
}

let onlineDirty = false;
function markOnlineChanged() { onlineDirty = true; }
setInterval(() => {
  if (!onlineDirty) return;
  onlineDirty = false;
  const count = onlineCount();
  io.emit("online_count", { count });
  redis.set("online:count", count).catch(() => {});
}, 2000);

// Load persisted fingerprint bans
(async () => {
  if (!supabaseEnabled) return;
  try {
    const { data } = await supabase.from("banned_fingerprints").select("fingerprint");
    (data || []).forEach((r) => bannedFps.add(r.fingerprint));
    if (bannedFps.size) console.log(`[bans] loaded ${bannedFps.size} fingerprint bans`);
  } catch {}
})();

async function isFpBanned(fpId) {
  if (bannedFps.has(fpId)) return true;
  try { return !!(await redis.get(`fp_ban:${fpId}`)); } catch { return false; }
}

async function banFingerprints(userId, reason, adminId = null) {
  const fps = [...(fpByUser.get(userId) || [])];
  for (const fp of fps) {
    bannedFps.add(fp);
    redis.set(`fp_ban:${fp}`, "1").catch(() => {});
    if (supabaseEnabled) {
      await supabase.from("banned_fingerprints").upsert({ fingerprint: fp, reason, banned_by: adminId }).then(() => {}, () => {});
    }
  }
  return fps.length;
}

function kickUser(userId, reason) {
  let n = 0;
  for (const sid of [...(userSockets.get(userId) || [])]) {
    const s = io.sockets.sockets.get(sid);
    if (s) { s.emit("banned", { reason }); s.disconnect(true); n++; }
  }
  return n;
}

// ── IP country lookup ──────────────────────────────────────
const countryCache = new Map();
async function getCountry(ip) {
  if (!ip || ip === "::1" || ip.startsWith("127.") || ip.startsWith("::ffff:127.") || ip.startsWith("172.") || ip.startsWith("192.168.") || ip.startsWith("10.")) {
    return { country: "IN", countryName: "India", flag: "🇮🇳" };
  }
  if (countryCache.has(ip)) return countryCache.get(ip);
  try {
    const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=countryCode,country`, { signal: AbortSignal.timeout(2000) });
    const d = await r.json();
    const result = { country: d.countryCode || "?", countryName: d.country || "Unknown", flag: countryToFlag(d.countryCode) };
    countryCache.set(ip, result);
    setTimeout(() => countryCache.delete(ip), 3600000); // 1h TTL
    return result;
  } catch {
    return { country: "?", countryName: "Unknown", flag: "🌐" };
  }
}

// ── Avoid lists ("don't match me with this person again") ──
function myIdentityKeys(p) {
  const keys = mm.identityKeys(p);
  return keys.length ? keys : [`s:${p.id}`];
}

function collectAvoid(p) {
  const out = new Set();
  const now = Date.now();
  for (const k of myIdentityKeys(p)) {
    const entry = avoidStore.get(k);
    if (!entry) continue;
    if (entry.exp < now) { avoidStore.delete(k); continue; }
    entry.keys.forEach((x) => out.add(x));
  }
  return out;
}

function addAvoid(p, other) {
  const targetKeys = mm.identityKeys(other);
  if (!targetKeys.length) return;
  for (const k of myIdentityKeys(p)) {
    const entry = avoidStore.get(k) || { keys: new Set(), exp: 0 };
    targetKeys.forEach((t) => entry.keys.add(t));
    entry.exp = Date.now() + AVOID_TTL;
    avoidStore.set(k, entry);
  }
  p.avoid = collectAvoid(p);
}

// ── Badges shown to the stranger (no identity revealed) ────
function badgesFor(p) {
  const b = [];
  if (!p.userId) return b;
  b.push("member");
  if (p.profile?.is_verified) b.push("verified");
  if (p.profile?.college_verified) b.push("college");
  if ((p.profile?.karma || 0) >= 10) b.push("trusted");
  return b;
}

// ── Waiting queues ─────────────────────────────────────────
function queueFor(mode) {
  if (!waiting.has(mode)) waiting.set(mode, new Set());
  return waiting.get(mode);
}

function removeFromWaiting(p) {
  for (const q of waiting.values()) q.delete(p.id);
  spyChatters.delete(p.id);
  spyWaiters.delete(p.id);
  if (p.state === "waiting") p.state = "idle";
}

function waitingCandidates(mode) {
  const out = [];
  for (const sid of queueFor(mode)) {
    const c = participants.get(sid);
    if (c && c.state === "waiting" && io.sockets.sockets.has(sid)) out.push(c);
    else queueFor(mode).delete(sid); // stale entry
  }
  return out;
}

function recordWait(p) {
  if (!p.waitingSince) return;
  const list = stats.waitTimes[p.mode] || (stats.waitTimes[p.mode] = []);
  list.push(Date.now() - p.waitingSince);
  if (list.length > 50) list.shift();
  p.waitingSince = null;
}

function avgWait(mode) {
  const list = stats.waitTimes[mode.replace(/^college:/, "")] || [];
  if (!list.length) return null;
  return Math.round(list.reduce((a, b) => a + b, 0) / list.length / 1000);
}

// Tell every waiting socket how busy its queue is (every 4 s)
setInterval(() => {
  for (const mode of [...waiting.keys()]) {
    const list = waitingCandidates(mode);
    list.forEach((p, i) => {
      p.socket.emit("queue_status", {
        position: i + 1,
        waiting: list.length,
        avgWaitSeconds: avgWait(mode),
        waitedSeconds: p.waitingSince ? Math.round((Date.now() - p.waitingSince) / 1000) : 0,
      });
    });
  }
}, 4000);

// ── Rooms ──────────────────────────────────────────────────
function peerInfo(me, other, room) {
  return {
    roomId: room.id,
    peer: other.id,
    matchedInterest: room.matchedInterest,
    sharedInterests: room.shared,
    peerInterests: other.interests || [],
    peerCountry: other.geo || null,
    myCountry: me.geo || null,
    peerGender: other.gender || "any",
    peerBadges: badgesFor(other),
    peerIsMember: !!other.userId,
    invited: !!room.invited,
  };
}

function createPairRoom(initiator, other, { shared = [], invited = false, roomId = uuidv4() } = {}) {
  const room = {
    id: roomId, kind: "pair", mode: initiator.mode,
    members: [initiator.id, other.id],
    startedAt: Date.now(), msgCount: 0,
    matchedInterest: shared[0] || null, shared, invited,
    game: null, sd: {},
  };
  rooms.set(room.id, room);
  for (const p of [initiator, other]) {
    removeFromWaiting(p);
    recordWait(p);
    p.state = "paired";
    p.roomId = room.id;
    p.socket.join(room.id);
  }
  stats.matches.push(Date.now());
  initiator.socket.emit("match_found", { ...peerInfo(initiator, other, room), isInitiator: true });
  other.socket.emit("match_found", { ...peerInfo(other, initiator, room), isInitiator: false });
  return room;
}

function createSpyRoom(aId, bId, spyId, question) {
  const room = {
    id: uuidv4(), kind: "spy", mode: "spy",
    members: [aId, bId], spyId, question,
    roles: { [aId]: "chatter_a", [bId]: "chatter_b" },
    startedAt: Date.now(), msgCount: 0,
  };
  if (spyId) room.roles[spyId] = "spy";
  rooms.set(room.id, room);
  const all = spyId ? [aId, bId, spyId] : [aId, bId];
  for (const sid of all) {
    const p = participants.get(sid);
    if (!p) continue;
    removeFromWaiting(p);
    p.state = "paired";
    p.roomId = room.id;
    p.socket.join(room.id);
  }
  const a = participants.get(aId);
  const b = participants.get(bId);
  a?.socket.emit("spy_match_found", { roomId: room.id, question, role: "chatter_a", peer: bId, peerCountry: b?.geo });
  b?.socket.emit("spy_match_found", { roomId: room.id, question, role: "chatter_b", peer: aId, peerCountry: a?.geo });
  if (spyId) participants.get(spyId)?.socket.emit("spy_match_found", { roomId: room.id, question, role: "spy" });
  return room;
}

function roomOf(socket, rid) {
  if (typeof rid !== "string") return null;
  const room = rooms.get(rid);
  if (!room) return null;
  const isMember = room.members.includes(socket.id) || room.spyId === socket.id;
  return isMember ? room : null;
}

function otherMember(room, sid) {
  return room.members.find((m) => m !== sid) || null;
}

function endRoom(roomId, leaverId) {
  const room = rooms.get(roomId);
  if (!room) return;
  rooms.delete(roomId);

  const everyone = room.spyId ? [...room.members, room.spyId] : [...room.members];
  const memberUsers = {};
  for (const sid of everyone) {
    const p = participants.get(sid);
    if (p) memberUsers[sid] = p.userId || null;
    if (sid === leaverId) continue;
    if (room.kind === "spy") {
      // Spy leaving ends the discussion; a chatter leaving ends it for everyone
      io.to(sid).emit(leaverId === room.spyId ? "spy_ended" : "peer_left");
    } else {
      io.to(sid).emit("peer_left");
    }
  }
  for (const sid of everyone) {
    const p = participants.get(sid);
    io.sockets.sockets.get(sid)?.leave(roomId);
    if (p && p.roomId === roomId) { p.state = "idle"; p.roomId = null; }
  }

  endedRooms.set(roomId, { members: memberUsers, mode: room.mode, endedAt: Date.now(), sd: room.sd || {} });
  persistRoom(room, memberUsers).catch(() => {});
}

setInterval(() => {
  const now = Date.now();
  for (const [id, r] of endedRooms) if (now - r.endedAt > ENDED_ROOM_TTL) endedRooms.delete(id);
  for (const [t, inv] of invites) if (inv.exp < now) invites.delete(t);
  stats.matches = stats.matches.filter((t) => now - t < 3600_000);
}, 60_000);

// Chat history + daily stats are written by the server so users can't fake them
async function persistRoom(room, memberUsers) {
  const duration = Math.round((Date.now() - room.startedAt) / 1000);
  stats.pending.total += 1;
  stats.pending.duration += duration;
  if (room.mode === "video" || room.mode === "speed_dating") stats.pending.video += 1;
  else if (room.mode === "voice") stats.pending.voice += 1;
  else stats.pending.text += 1;

  if (!supabaseEnabled || duration < 5) return;
  const rows = [];
  for (const sid of room.members) {
    const userId = memberUsers[sid];
    if (!userId) continue;
    const p = participants.get(sid);
    if (p?.profile?.settings && p.profile.settings.saveHistory === false) continue;
    rows.push({
      user_id: userId, mode: room.mode, room_id: room.id,
      duration_seconds: duration, message_count: room.msgCount,
      matched_interest: room.matchedInterest || null,
      started_at: new Date(room.startedAt).toISOString(),
      ended_at: new Date().toISOString(),
    });
  }
  if (rows.length) {
    const { error } = await supabase.from("chat_history").insert(rows);
    if (error) console.warn("[history] insert failed:", error.message);
  }
}

setInterval(async () => {
  const p = stats.pending;
  if (!supabaseEnabled || p.total === 0) return;
  stats.pending = { total: 0, video: 0, text: 0, voice: 0, duration: 0 };
  const date = new Date().toISOString().slice(0, 10);
  try {
    const { data } = await supabase.from("chat_stats").select("*").eq("date", date).maybeSingle();
    await supabase.from("chat_stats").upsert({
      date,
      total_sessions: (data?.total_sessions || 0) + p.total,
      video_sessions: (data?.video_sessions || 0) + p.video,
      text_sessions: (data?.text_sessions || 0) + p.text,
      voice_sessions: (data?.voice_sessions || 0) + p.voice,
      total_duration_seconds: (data?.total_duration_seconds || 0) + p.duration,
      unique_users: Math.max(data?.unique_users || 0, userSockets.size),
      reports_filed: data?.reports_filed || 0,
    });
  } catch (e) {
    console.warn("[stats] flush failed:", e.message);
  }
}, 60_000);

// ── Friends / presence ─────────────────────────────────────
async function loadFriendIds(userId) {
  if (!supabaseEnabled || !userId) return new Set();
  const { data } = await supabase.from("connections").select("requester_id, receiver_id")
    .eq("status", "accepted").or(`requester_id.eq.${userId},receiver_id.eq.${userId}`);
  return new Set((data || []).map((c) => (c.requester_id === userId ? c.receiver_id : c.requester_id)));
}

async function loadBlocks(userId) {
  if (!supabaseEnabled || !userId) return new Set();
  const { data } = await supabase.from("user_blocks").select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  return new Set((data || []).map((b) => (b.blocker_id === userId ? b.blocked_id : b.blocker_id)));
}

function isOnline(userId) {
  return (userSockets.get(userId)?.size || 0) > 0;
}

function emitToUser(userId, event, payload) {
  for (const sid of userSockets.get(userId) || []) io.to(sid).emit(event, payload);
}

async function friendsOf(p, refresh = false) {
  if (!p.userId) return new Set();
  if (!p.friends || refresh) p.friends = await loadFriendIds(p.userId);
  return p.friends;
}

async function announcePresence(p, online) {
  const friends = await friendsOf(p);
  for (const fid of friends) emitToUser(fid, "presence_update", { userId: p.userId, online });
}

function publicUser(p) {
  return {
    id: p.userId,
    name: p.profile?.display_name || p.profile?.username || "A friend",
    avatar: p.profile?.avatar_url || null,
  };
}

// ── Reports ────────────────────────────────────────────────
async function fileReport(reporter, reportedSid, reportedUserId, roomId, { reason, details, screenshotB64 }) {
  const reporterKey = myIdentityKeys(reporter)[0];
  const reportedKey = reportedUserId ? `u:${reportedUserId}` : `s:${reportedSid}`;
  const pairKey = `${reporterKey}>${reportedKey}`;
  const firstTime = !reportPairs.has(pairKey);
  reportPairs.add(pairKey);

  if (supabaseEnabled) {
    await supabase.from("reports").insert({
      reporter_id: reporter.userId || null,
      reporter_key: reporterKey,
      reporter_socket: reporter.id,
      reported_socket: reportedSid,
      reported_user_id: reportedUserId,
      reason, details, room_id: roomId,
      screenshot_b64: screenshotB64,
    }).then(({ error }) => error && console.warn("[report] insert failed:", error.message));
  }

  // Only the first report per reporter→reported pair counts toward auto-ban
  if (!firstTime || !reportedUserId || !supabaseEnabled) return;
  const { data: profile } = await supabase.from("profiles").select("report_count, is_banned").eq("id", reportedUserId).single();
  if (!profile || profile.is_banned) return;
  const newCount = (profile.report_count || 0) + 1;
  const shouldBan = newCount >= AUTO_BAN_THRESHOLD;
  await supabase.from("profiles").update({
    report_count: newCount,
    ...(shouldBan ? { is_banned: true, ban_reason: `Auto-banned: reported by ${AUTO_BAN_THRESHOLD}+ different people` } : {}),
  }).eq("id", reportedUserId);
  if (shouldBan) {
    await banFingerprints(reportedUserId, "auto-ban");
    kickUser(reportedUserId, "You have been banned following multiple reports.");
  }
}

// ═══════════════════════════════════════════════════════════
// Admin API (Supabase JWT with moderator/admin/superadmin role)
// ═══════════════════════════════════════════════════════════
async function adminLog(adminId, action, targetType, targetId, metadata) {
  if (!supabaseEnabled) return;
  await supabase.from("admin_logs").insert({ admin_id: adminId, action, target_type: targetType, target_id: targetId, metadata }).then(() => {}, () => {});
}

app.get("/api/admin/live", auth.requireStaff(), (req, res) => {
  const waitingByMode = {};
  for (const mode of [...MODES, "college"]) waitingByMode[mode] = 0;
  for (const p of participants.values()) {
    if (p.state === "waiting") {
      const k = p.college ? "college" : p.mode;
      waitingByMode[k] = (waitingByMode[k] || 0) + 1;
    }
  }
  waitingByMode.spy = spyChatters.size + spyWaiters.size;
  const roomsByMode = {};
  for (const r of rooms.values()) roomsByMode[r.mode] = (roomsByMode[r.mode] || 0) + 1;
  const avgWaitByMode = {};
  for (const mode of MODES) avgWaitByMode[mode] = avgWait(mode);
  const now = Date.now();
  res.json({
    online: onlineCount(),
    signedIn: userSockets.size,
    connections: participants.size,
    waitingByMode,
    activeRooms: rooms.size,
    roomsByMode,
    matchesLastHour: stats.matches.length,
    matchesLast5Min: stats.matches.filter((t) => now - t < 300_000).length,
    avgWaitByMode,
    bannedFingerprints: bannedFps.size,
    uptimeSeconds: Math.round((now - startedAt) / 1000),
    redis: redis.status === "ready" ? "ok" : "unavailable",
  });
});

app.post("/api/admin/broadcast", auth.requireStaff(["admin", "superadmin"]), async (req, res) => {
  const message = str(req.body?.message, 300);
  const level = ["info", "warning", "success"].includes(req.body?.level) ? req.body.level : "info";
  if (!message) return res.status(400).json({ error: "Message required (max 300 chars)" });
  io.emit("announcement", { message, level, ts: Date.now() });
  await adminLog(req.auth.userId, "broadcast", "all", null, { message, level });
  res.json({ ok: true, delivered: participants.size });
});

app.post("/api/admin/kick", auth.requireStaff(), async (req, res) => {
  const userId = str(req.body?.userId, 64);
  if (!userId) return res.status(400).json({ error: "userId required" });
  const reason = str(req.body?.reason, 200) || "You have been removed by a moderator.";
  let fingerprints = 0;
  if (req.body?.banFingerprint) fingerprints = await banFingerprints(userId, reason, req.auth.userId);
  const kicked = kickUser(userId, reason);
  await adminLog(req.auth.userId, "kick", "user", userId, { reason, kicked, fingerprints });
  res.json({ ok: true, kicked, fingerprints });
});

// ═══════════════════════════════════════════════════════════
// Socket.IO
// ═══════════════════════════════════════════════════════════
// X-Real-IP is set by our nginx from the TCP peer; the first X-Forwarded-For entry is
// client-controlled, so only the last hop (appended by nginx) is trusted as a fallback.
function clientIp(socket) {
  const h = socket.handshake.headers;
  if (typeof h["x-real-ip"] === "string" && h["x-real-ip"]) return h["x-real-ip"].trim();
  const xff = typeof h["x-forwarded-for"] === "string" ? h["x-forwarded-for"].split(",") : [];
  return xff.length ? xff[xff.length - 1].trim() : socket.handshake.address;
}

io.use(async (socket, next) => {
  try {
    await socketLimiter.consume(clientIp(socket));
  } catch (e) {
    if (rateLimiter.isLimited(e)) return next(new Error("Rate limit exceeded"));
  }
  // Optional auth: guests connect without a token
  const a = await auth.authenticate(socket.handshake.auth?.token);
  if (a?.profile?.is_banned) return next(new Error("banned"));
  socket.data.auth = a;
  next();
});

io.on("connection", (socket) => {
  const a = socket.data.auth;
  const ip = clientIp(socket);

  const p = {
    id: socket.id, socket,
    userId: a?.userId || null,
    profile: a?.profile || null,
    presenceOnly: socket.handshake.auth?.presence === true,
    fpId: null, ip, geo: null, country: null,
    browserId: /^[a-zA-Z0-9-]{16,64}$/.test(socket.handshake.auth?.browserId || "") ? socket.handshake.auth.browserId : null,
    mode: "video", interests: [], gender: "any", wantGender: "any",
    college: false, language: null, sameCountry: false,
    state: "idle", roomId: null, waitingSince: null,
    avoid: new Set(), blocked: new Set(), friends: null,
    pendingFriendFrom: null,
  };
  participants.set(socket.id, p);
  markOnlineChanged();

  if (p.userId) {
    const first = !isOnline(p.userId);
    if (!userSockets.has(p.userId)) userSockets.set(p.userId, new Set());
    userSockets.get(p.userId).add(socket.id);
    if (first) announcePresence(p, true).catch(() => {});
  }
  socket.emit("session", { userId: p.userId, badges: badgesFor(p) });

  // Slow lookups run in the background; handlers are registered synchronously so
  // an early find_match isn't dropped. Matchmaking handlers await this first.
  const ready = (async () => {
    if (p.userId) p.blocked = await loadBlocks(p.userId).catch(() => new Set());
    p.geo = await getCountry(ip);
    p.country = p.geo.country;
  })().catch(() => {});

  // ── Fingerprint check ───────────────────────────────────
  socket.on("fingerprint", async ({ fpId } = {}) => {
    if (!str(fpId, 128)) return;
    p.fpId = fpId;
    if (p.userId) {
      if (!fpByUser.has(p.userId)) fpByUser.set(p.userId, new Set());
      fpByUser.get(p.userId).add(fpId);
    }
    if (await isFpBanned(fpId)) {
      socket.emit("banned", { reason: "You are banned from MiloBolo." });
      socket.disconnect(true);
    }
  });

  // ── Matchmaking ─────────────────────────────────────────
  socket.on("find_match", async (opts = {}) => {
    await ready;
    if (!participants.has(socket.id)) return;
    if (p.roomId) endRoom(p.roomId, socket.id);
    removeFromWaiting(p);

    p.mode = MODES.includes(opts.mode) ? opts.mode : "video";
    p.interests = Array.isArray(opts.interests)
      ? opts.interests.filter((i) => typeof i === "string" && i.length <= 30).slice(0, 10)
      : [];
    p.gender = opts.gender === "male" || opts.gender === "female" ? opts.gender : "any";
    p.wantGender = opts.wantGender === "male" || opts.wantGender === "female" ? opts.wantGender : "any";
    p.language = typeof opts.language === "string" && opts.language.length === 2 ? opts.language : null;
    p.sameCountry = !!opts.sameCountry;
    p.college = !!opts.college;

    if (p.college && !p.profile?.college_verified) {
      socket.emit("college_required", { message: "Verify your college email to use College mode." });
      return;
    }

    // ── Invite room: bypass normal matchmaking ──────────────
    const token = str(opts.invite, 64);
    if (token && token.length > 10) {
      const inv = invites.get(token) || { waiting: null, exp: Date.now() + 10 * 60_000 };
      const other = inv.waiting && participants.get(inv.waiting);
      if (other && other.id !== socket.id && other.state === "waiting") {
        invites.delete(token);
        createPairRoom(p, other, { invited: true, roomId: token });
        return;
      }
      inv.waiting = socket.id;
      invites.set(token, inv);
      p.state = "waiting";
      p.waitingSince = Date.now();
      socket.emit("waiting", { invite: true, country: p.geo });
      return;
    }

    p.avoid = collectAvoid(p);
    const mode = p.college ? `college:${p.mode}` : p.mode;
    const match = mm.pickBest(p, waitingCandidates(mode));
    if (match) {
      createPairRoom(p, match.peer, { shared: match.shared });
      return;
    }
    p.state = "waiting";
    p.waitingSince = Date.now();
    queueFor(mode).add(socket.id);
    socket.emit("waiting", { country: p.geo });
  });

  // ── Spy / Question mode ─────────────────────────────────
  // Role "spy" asks a question and watches; two "chatter"s discuss it.
  socket.on("find_spy_match", async ({ role = "chatter", question = "" } = {}) => {
    await ready;
    if (!participants.has(socket.id)) return;
    if (p.roomId) endRoom(p.roomId, socket.id);
    removeFromWaiting(p);
    p.mode = "spy";
    p.avoid = collectAvoid(p);

    const takeChatterPair = () => {
      const list = [...spyChatters].map((sid) => participants.get(sid)).filter((c) => c && io.sockets.sockets.has(c.id));
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const x = list[i], y = list[j];
          if (!(x.avoid?.size && mm.identityKeys(y).some((k) => x.avoid.has(k))) &&
              !(y.avoid?.size && mm.identityKeys(x).some((k) => y.avoid.has(k)))) return [x.id, y.id];
        }
      }
      return null;
    };

    if (role === "spy") {
      const q = (typeof question === "string" ? question.trim() : "").slice(0, 200) || "Discuss anything!";
      const pair = takeChatterPair();
      if (pair) { createSpyRoom(pair[0], pair[1], socket.id, q); return; }
      spyWaiters.set(socket.id, q);
      p.state = "waiting";
      socket.emit("waiting", { role: "spy" });
      return;
    }

    spyChatters.add(socket.id);
    p.state = "waiting";
    const pair = takeChatterPair();
    if (pair) {
      const [spyId, q] = spyWaiters.entries().next().value || [null, "Discuss anything!"];
      if (spyId) spyWaiters.delete(spyId);
      createSpyRoom(pair[0], pair[1], spyId, q);
    } else {
      socket.emit("waiting", { role: "chatter" });
    }
  });

  socket.on("cancel_search", () => {
    removeFromWaiting(p);
    for (const [t, inv] of invites) if (inv.waiting === socket.id) inv.waiting = null;
    socket.emit("search_cancelled");
  });

  // ── WebRTC signaling: only to your current peer ─────────
  socket.on("signal", ({ to, signal } = {}) => {
    const room = p.roomId && rooms.get(p.roomId);
    if (!room || !room.members.includes(to) || to === socket.id) return;
    io.to(to).emit("signal", { from: socket.id, signal });
  });

  socket.on("e2e_pubkey", ({ to, publicKey } = {}) => {
    const room = p.roomId && rooms.get(p.roomId);
    if (!room || !room.members.includes(to) || !str(publicKey, 1024)) return;
    io.to(to).emit("e2e_pubkey", { from: socket.id, publicKey });
  });

  // ── Message ─────────────────────────────────────────────
  socket.on("message", async ({ roomId: rid, id, ciphertext, iv, plain } = {}) => {
    const room = roomOf(socket, rid);
    if (!room) return;
    if (room.kind === "spy" && room.spyId === socket.id) return; // spies only watch
    try { await msgLimiter.consume(socket.id); }
    catch (e) {
      if (rateLimiter.isLimited(e)) { socket.emit("error", { message: "Slow down! Message rate limit exceeded." }); return; }
    }
    const msgId = str(id, 64) || uuidv4();
    const senderRole = room.roles?.[socket.id] || null;
    let payload;
    if (ciphertext) {
      if (!str(ciphertext, 8000)) return;
      payload = { from: socket.id, id: msgId, ciphertext, iv, ts: Date.now(), encrypted: true, senderRole };
    } else {
      let cleanText = (typeof plain === "string" ? plain : "").slice(0, 2000);
      if (!cleanText.trim()) return;
      try { cleanText = profanityFilter.clean(cleanText); } catch {}
      payload = { from: socket.id, id: msgId, text: cleanText, ts: Date.now(), encrypted: false, senderRole };
    }
    room.msgCount += 1;
    socket.to(rid).emit("message", payload);
  });

  // ── Typing ──────────────────────────────────────────────
  socket.on("typing", ({ roomId: rid, typing } = {}) => {
    const room = roomOf(socket, rid);
    if (room) socket.to(rid).emit("typing", { from: socket.id, typing: !!typing, senderRole: room.roles?.[socket.id] || null });
  });

  // ── Message-level actions: seen / unsend / react ────────
  socket.on("msg_seen", ({ roomId: rid, ids } = {}) => {
    if (!roomOf(socket, rid) || !Array.isArray(ids)) return;
    const clean = ids.filter((x) => str(x, 64)).slice(0, 100);
    if (clean.length) socket.to(rid).emit("msg_seen", { ids: clean });
  });

  socket.on("msg_unsend", ({ roomId: rid, id } = {}) => {
    if (roomOf(socket, rid) && str(id, 64)) socket.to(rid).emit("msg_unsend", { id });
  });

  const MSG_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
  socket.on("msg_react", ({ roomId: rid, id, emoji } = {}) => {
    if (!roomOf(socket, rid) || !str(id, 64)) return;
    if (emoji !== null && !MSG_REACTIONS.includes(emoji)) return;
    socket.to(rid).emit("msg_react", { id, emoji });
  });

  // ── Reactions (floating) ────────────────────────────────
  socket.on("reaction", ({ roomId: rid, emoji } = {}) => {
    const allowed = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "💯"];
    if (roomOf(socket, rid) && allowed.includes(emoji)) socket.to(rid).emit("reaction", { from: socket.id, emoji });
  });

  // ── Image message ───────────────────────────────────────
  socket.on("image_message", ({ roomId: rid, imageUrl, id } = {}) => {
    const room = roomOf(socket, rid);
    if (!room || typeof imageUrl !== "string" || imageUrl.length > 500) return;
    // Only allow R2 public URLs to prevent SSRF/phishing via socket relay
    const allowed = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://pub-";
    if (!imageUrl.startsWith(allowed) && !imageUrl.startsWith("https://pub-")) return;
    room.msgCount += 1;
    socket.to(rid).emit("image_message", { from: socket.id, id: str(id, 64) || uuidv4(), imageUrl, ts: Date.now(), senderRole: room.roles?.[socket.id] || null });
  });

  // ── Voice note (≤ 60 s, ≤ 400 KB) ───────────────────────
  socket.on("voice_note", async ({ roomId: rid, id, audio, mime, duration } = {}) => {
    const room = roomOf(socket, rid);
    if (!room || room.kind !== "pair") return;
    if (!Buffer.isBuffer(audio) || audio.length === 0 || audio.length > 400_000) {
      socket.emit("error", { message: "Voice note too large (max ~60 seconds)." });
      return;
    }
    try { await msgLimiter.consume(socket.id); }
    catch (e) { if (rateLimiter.isLimited(e)) return; }
    const safeMime = /^audio\/(webm|ogg|mp4|mpeg)(;.*)?$/.test(mime || "") ? mime : "audio/webm";
    const secs = Math.min(60, Math.max(0, Number(duration) || 0));
    room.msgCount += 1;
    socket.to(rid).emit("voice_note", { from: socket.id, id: str(id, 64) || uuidv4(), audio, mime: safeMime, duration: secs, ts: Date.now() });
  });

  // ── Tic-tac-toe ─────────────────────────────────────────
  socket.on("game_action", ({ roomId: rid, action, cell } = {}) => {
    const room = roomOf(socket, rid);
    if (!room || room.kind !== "pair") return;
    const other = otherMember(room, socket.id);
    const emitState = () => io.to(rid).emit("game_state", games.publicState(room.game));

    switch (action) {
      case "invite":
        if (room.game && room.game.status === "playing") return;
        room.game = { ...games.newGame(socket.id), score: room.game?.score || {}, lastFirst: room.game?.lastFirst };
        emitState();
        break;
      case "accept":
        if (!room.game || room.game.status !== "invited" || room.game.inviter === socket.id) return;
        games.start(room.game, room.game.inviter, socket.id);
        emitState();
        break;
      case "decline":
      case "quit":
        if (!room.game) return;
        room.game = null;
        io.to(rid).emit("game_state", null);
        if (action === "decline") io.to(other).emit("game_declined");
        break;
      case "move": {
        if (!room.game) return;
        const err = games.move(room.game, socket.id, cell);
        if (err) socket.emit("game_error", { message: err });
        else emitState();
        break;
      }
      case "rematch":
        if (!room.game || room.game.status !== "over") return;
        games.start(room.game, socket.id, other);
        emitState();
        break;
      default:
    }
  });

  // ── Speed dating rating ─────────────────────────────────
  // Accepts { rating: "like"|"pass" } or { liked: boolean }; works after the room ended.
  socket.on("sd_rating", ({ roomId: rid, rating, liked } = {}) => {
    const value = rating === "like" || liked === true ? "like" : rating === "pass" || liked === false ? "pass" : null;
    if (!value || typeof rid !== "string") return;
    const live = rooms.get(rid);
    const ended = endedRooms.get(rid);
    const members = live ? live.members : ended ? Object.keys(ended.members) : [];
    if (!members.includes(socket.id)) return;
    const sd = live ? live.sd : ended.sd;
    sd[socket.id] = value;
    const votes = members.map((m) => sd[m]);
    if (votes.length === 2 && votes.every((v) => v === "like")) {
      members.forEach((m) => io.to(m).emit("sd_mutual_like", { roomId: rid }));
    }
  });

  // ── Friend requests (server fills in identities) ────────
  socket.on("friend_request", async () => {
    const room = p.roomId && rooms.get(p.roomId);
    if (!room || room.kind !== "pair") return;
    const other = participants.get(otherMember(room, socket.id));
    if (!p.userId) { socket.emit("error", { message: "Sign in to send connection requests." }); return; }
    if (!other?.userId) { socket.emit("error", { message: "This stranger is a guest and can't receive requests." }); return; }
    if (other.profile?.allow_friend_requests === false) { socket.emit("error", { message: "This stranger isn't accepting requests." }); return; }
    if ((await friendsOf(p)).has(other.userId)) { socket.emit("error", { message: "You're already friends." }); return; }
    other.pendingFriendFrom = socket.id;
    io.to(other.id).emit("friend_request", { from: socket.id, fromName: publicUser(p).name });
    socket.emit("friend_request_sent");
  });

  socket.on("friend_response", async ({ accepted } = {}) => {
    const fromSid = p.pendingFriendFrom;
    p.pendingFriendFrom = null;
    const requester = fromSid && participants.get(fromSid);
    if (!requester?.userId || !p.userId) return;
    if (accepted && supabaseEnabled) {
      // A row may already exist in either direction (e.g. a pending request from the Friends page)
      const { data: existing } = await supabase.from("connections").select("id, status")
        .or(`and(requester_id.eq.${requester.userId},receiver_id.eq.${p.userId}),and(requester_id.eq.${p.userId},receiver_id.eq.${requester.userId})`)
        .maybeSingle();
      if (existing?.status === "blocked") return;
      const { error } = existing
        ? await supabase.from("connections").update({ status: "accepted" }).eq("id", existing.id)
        : await supabase.from("connections").insert({ requester_id: requester.userId, receiver_id: p.userId, status: "accepted" });
      if (error) {
        console.warn("[friends] upsert failed:", error.message);
        socket.emit("error", { message: "Couldn't save the connection. Try again from the Friends page." });
        return;
      }
      requester.friends?.add(p.userId);
      p.friends?.add(requester.userId);
    }
    io.to(requester.id).emit("friend_response", { accepted: !!accepted });
    if (accepted) socket.emit("friend_response", { accepted: true });
  });

  // ── Presence (friends online) ───────────────────────────
  socket.on("presence_query", async (_, ack) => {
    if (typeof ack !== "function") return;
    if (!p.userId) return ack({ online: [] });
    const friends = await friendsOf(p, true);
    ack({ online: [...friends].filter(isOnline) });
  });

  // ── Direct messages between friends ─────────────────────
  socket.on("dm_send", async ({ to, body, clientId } = {}, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    if (!p.userId || !supabaseEnabled) return reply({ error: "Sign in required" });
    const text = typeof body === "string" ? body.trim().slice(0, 1000) : "";
    if (!str(to, 64) || !text) return reply({ error: "Invalid message" });
    try { await dmLimiter.consume(p.userId); }
    catch (e) { if (rateLimiter.isLimited(e)) return reply({ error: "You're sending messages too fast." }); }
    let friends = await friendsOf(p);
    if (!friends.has(to)) friends = await friendsOf(p, true);
    if (!friends.has(to)) return reply({ error: "You can only message friends." });

    const { data, error } = await supabase.from("direct_messages")
      .insert({ sender_id: p.userId, receiver_id: to, body: text })
      .select("id, sender_id, receiver_id, body, read_at, created_at").single();
    if (error) return reply({ error: "Message failed to send." });
    emitToUser(to, "dm", { message: data, from: publicUser(p) });
    // Echo to the sender's other tabs
    for (const sid of userSockets.get(p.userId) || []) if (sid !== socket.id) io.to(sid).emit("dm", { message: data, from: publicUser(p), clientId });
    reply({ message: data, clientId });
  });

  socket.on("dm_read", async ({ from } = {}) => {
    if (!p.userId || !str(from, 64) || !supabaseEnabled) return;
    await supabase.from("direct_messages").update({ read_at: new Date().toISOString() })
      .eq("sender_id", from).eq("receiver_id", p.userId).is("read_at", null);
    await supabase.from("notifications").update({ read: true })
      .eq("user_id", p.userId).eq("type", "dm").eq("actor_id", from).eq("read", false);
    emitToUser(from, "dm_read", { by: p.userId, at: Date.now() });
  });

  socket.on("dm_typing", async ({ to, typing } = {}) => {
    if (!p.userId || !str(to, 64)) return;
    if ((await friendsOf(p)).has(to)) emitToUser(to, "dm_typing", { from: p.userId, typing: !!typing });
  });

  // ── Friend video/voice call via private invite room ─────
  socket.on("friend_call", async ({ to, mode = "video" } = {}, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    if (!p.userId || !str(to, 64)) return reply({ error: "Sign in required" });
    if (!(await friendsOf(p, true)).has(to)) return reply({ error: "You can only call friends." });
    if (!isOnline(to)) return reply({ error: "Your friend is offline." });
    const callMode = mode === "voice" ? "voice" : "video";
    const token = uuidv4();
    invites.set(token, { waiting: null, exp: Date.now() + 2 * 60_000 });
    emitToUser(to, "incoming_call", { token, mode: callMode, from: publicUser(p) });
    reply({ token, mode: callMode });
  });

  socket.on("call_response", async ({ to, token, accepted } = {}) => {
    if (!p.userId || !str(to, 64) || !str(token, 64)) return;
    if (!(await friendsOf(p)).has(to)) return;
    emitToUser(to, "call_response", { token, accepted: !!accepted, by: publicUser(p) });
    if (!accepted) invites.delete(token);
  });

  // ── Screen share ────────────────────────────────────────
  socket.on("screen_share_start", ({ roomId: rid } = {}) => {
    if (roomOf(socket, rid)) socket.to(rid).emit("peer_screen_share", { active: true });
  });
  socket.on("screen_share_stop", ({ roomId: rid } = {}) => {
    if (roomOf(socket, rid)) socket.to(rid).emit("peer_screen_share", { active: false });
  });

  // ── Next / skip ─────────────────────────────────────────
  socket.on("next", () => {
    if (p.roomId) endRoom(p.roomId, socket.id);
    removeFromWaiting(p);
  });

  // ── Post-chat: rate / block the stranger ────────────────
  function peerFromRecentRoom(rid) {
    const live = rooms.get(rid);
    if (live && live.members.includes(socket.id)) {
      const sid = otherMember(live, socket.id);
      return { sid, userId: participants.get(sid)?.userId || null };
    }
    const ended = endedRooms.get(rid);
    if (ended && socket.id in ended.members) {
      const sid = Object.keys(ended.members).find((m) => m !== socket.id);
      return sid ? { sid, userId: ended.members[sid] } : null;
    }
    return null;
  }

  socket.on("rate_peer", async ({ roomId: rid, score } = {}, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    if (score !== 1 && score !== -1) return reply({ error: "Invalid rating" });
    const peer = typeof rid === "string" && peerFromRecentRoom(rid);
    if (!peer) return reply({ error: "Chat not found" });
    if (!p.userId || !peer.userId || !supabaseEnabled) return reply({ ok: true, counted: false });
    const { error } = await supabase.from("chat_ratings").insert({ rater_id: p.userId, rated_id: peer.userId, room_id: rid, score });
    reply({ ok: true, counted: !error });
  });

  socket.on("block_peer", async ({ roomId: rid } = {}, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    const peer = typeof rid === "string" && peerFromRecentRoom(rid);
    if (!peer) return reply({ error: "Chat not found" });
    const other = participants.get(peer.sid);
    addAvoid(p, { userId: peer.userId, browserId: other?.browserId || null });
    if (p.userId && peer.userId) {
      p.blocked.add(peer.userId);
      if (other) other.blocked.add(p.userId);
      if (supabaseEnabled) {
        await supabase.from("user_blocks").upsert({ blocker_id: p.userId, blocked_id: peer.userId }).then(() => {}, () => {});
      }
    }
    if (p.roomId === rid) endRoom(rid, socket.id);
    reply({ ok: true });
  });

  // ── Report ──────────────────────────────────────────────
  socket.on("report", async ({ roomId: rid, reason, details, screenshotB64 } = {}) => {
    const targetRoom = (typeof rid === "string" && rid) || p.roomId;
    const peer = targetRoom && peerFromRecentRoom(targetRoom);
    if (!peer || !str(reason, 50)) return;
    const shot = typeof screenshotB64 === "string" && screenshotB64.startsWith("data:image/") && screenshotB64.length < 300_000 ? screenshotB64 : null;
    const other = participants.get(peer.sid);
    // Remember this person so we don't match them again today
    addAvoid(p, { userId: peer.userId, browserId: other?.browserId || null });
    await fileReport(p, peer.sid, peer.userId, targetRoom, {
      reason,
      details: typeof details === "string" ? details.slice(0, 500) : null,
      screenshotB64: shot,
    }).catch((e) => console.warn("[report]", e.message));
    socket.emit("report_received");
  });

  // ── Disconnect ──────────────────────────────────────────
  socket.on("disconnect", () => {
    removeFromWaiting(p);
    if (p.roomId) endRoom(p.roomId, socket.id);
    for (const inv of invites.values()) if (inv.waiting === socket.id) inv.waiting = null;
    participants.delete(socket.id);
    markOnlineChanged();
    if (p.userId) {
      const set = userSockets.get(p.userId);
      set?.delete(socket.id);
      if (set && set.size === 0) {
        userSockets.delete(p.userId);
        announcePresence(p, false).catch(() => {});
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`MiloBolo signaling on :${PORT}`));

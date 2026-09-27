// Boots the real server on a spare port and drives it with Socket.IO clients.
// Supabase and Redis are intentionally absent, so this also covers the fallbacks.
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { spawn } = require("child_process");
const { io } = require("socket.io-client");

const PORT = 4900 + Math.floor(Math.random() * 90);
const URL = `http://localhost:${PORT}`;
let proc;
const clients = [];

function connect() {
  const s = io(URL, { transports: ["websocket"], forceNew: true, reconnection: false });
  clients.push(s);
  return s;
}

function once(socket, event, ms = 4000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

function waitFor(socket, event, pred, ms = 4000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { socket.off(event, h); reject(new Error(`timeout waiting for ${event}`)); }, ms);
    const h = (data) => { if (pred(data)) { clearTimeout(t); socket.off(event, h); resolve(data); } };
    socket.on(event, h);
  });
}

function never(socket, event, ms = 400) {
  return new Promise((resolve, reject) => {
    const handler = () => reject(new Error(`unexpected ${event}`));
    socket.once(event, handler);
    setTimeout(() => { socket.off(event, handler); resolve(); }, ms);
  });
}

async function pair(mode = "text", extra = {}) {
  const a = connect();
  const b = connect();
  await Promise.all([once(a, "connect"), once(b, "connect")]);
  const aMatch = once(a, "match_found");
  const bMatch = once(b, "match_found");
  a.emit("find_match", { mode, ...extra });
  await once(a, "waiting");
  b.emit("find_match", { mode, ...extra });
  const [ma, mb] = await Promise.all([aMatch, bMatch]);
  return { a, b, ma, mb };
}

test.before(async () => {
  proc = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, PORT: String(PORT), SUPABASE_URL: "", SUPABASE_SERVICE_KEY: "", REDIS_URL: "redis://127.0.0.1:1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("server did not start")), 20000);
    proc.stdout.on("data", (d) => { if (String(d).includes("signaling on")) { clearTimeout(t); resolve(); } });
  });
});

test.after(() => {
  clients.forEach((c) => c.disconnect());
  proc?.kill();
});

test("health endpoint reports fallbacks", async () => {
  const res = await fetch(`${URL}/health`);
  const body = await res.json();
  assert.strictEqual(body.status, "ok");
  assert.strictEqual(body.database, "disabled");
});

test("two strangers are matched and exchange messages with ids", async () => {
  const { a, b, ma, mb } = await pair();
  assert.strictEqual(ma.roomId, mb.roomId);
  // The second arrival finds the match and makes the WebRTC offer
  assert.strictEqual(ma.isInitiator, false);
  assert.strictEqual(mb.isInitiator, true);
  const got = once(b, "message");
  a.emit("message", { roomId: ma.roomId, id: "m1", plain: "hello there" });
  const msg = await got;
  assert.strictEqual(msg.text, "hello there");
  assert.strictEqual(msg.id, "m1");
  a.disconnect(); b.disconnect();
});

test("an outsider cannot inject into someone else's room or signal them", async () => {
  const { a, b, ma } = await pair();
  const outsider = connect();
  await once(outsider, "connect");
  const quiet = Promise.all([never(b, "message"), never(b, "signal"), never(b, "msg_unsend")]);
  outsider.emit("message", { roomId: ma.roomId, plain: "spam" });
  outsider.emit("signal", { to: b.id, signal: { type: "offer" } });
  outsider.emit("msg_unsend", { roomId: ma.roomId, id: "m1" });
  await quiet;
  a.disconnect(); b.disconnect(); outsider.disconnect();
});

test("seen, unsend and per-message reactions are relayed to the peer", async () => {
  const { a, b, ma } = await pair();
  const seen = once(a, "msg_seen");
  b.emit("msg_seen", { roomId: ma.roomId, ids: ["m1", "m2"] });
  assert.deepStrictEqual((await seen).ids, ["m1", "m2"]);

  const unsend = once(b, "msg_unsend");
  a.emit("msg_unsend", { roomId: ma.roomId, id: "m1" });
  assert.strictEqual((await unsend).id, "m1");

  const react = once(a, "msg_react");
  b.emit("msg_react", { roomId: ma.roomId, id: "m2", emoji: "🔥" });
  assert.deepStrictEqual(await react, { id: "m2", emoji: "🔥" });
  a.disconnect(); b.disconnect();
});

test("tic-tac-toe is played server-side", async () => {
  const { a, b, ma } = await pair();
  const rid = ma.roomId;
  const invited = once(b, "game_state");
  a.emit("game_action", { roomId: rid, action: "invite" });
  assert.strictEqual((await invited).status, "invited");

  const started = waitFor(a, "game_state", (g) => g?.status === "playing");
  b.emit("game_action", { roomId: rid, action: "accept" });
  const st = await started;
  assert.strictEqual(st.status, "playing");
  assert.strictEqual(st.turn, a.id);

  const err = once(b, "game_error");
  b.emit("game_action", { roomId: rid, action: "move", cell: 0 });
  assert.strictEqual((await err).message, "Not your turn");

  const moves = [[a, 0], [b, 3], [a, 1], [b, 4], [a, 2]];
  let last;
  for (const [who, cell] of moves) {
    const n = moves.indexOf(moves.find(([w, c]) => w === who && c === cell)) + 1;
    const next = waitFor(a, "game_state", (g) => g.board.filter(Boolean).length === n);
    who.emit("game_action", { roomId: rid, action: "move", cell });
    last = await next;
  }
  assert.strictEqual(last.status, "over");
  assert.strictEqual(last.winner, a.id);
  a.disconnect(); b.disconnect();
});

test("next ends the chat for the peer and queues status is reported", async () => {
  const { a, b } = await pair();
  const left = once(b, "peer_left");
  a.emit("next");
  await left;

  const c = connect();
  await once(c, "connect");
  c.emit("find_match", { mode: "voice" });
  const status = await once(c, "queue_status", 6000);
  assert.strictEqual(status.position, 1);
  a.disconnect(); b.disconnect(); c.disconnect();
});

test("speed dating mutual like works after the call ended", async () => {
  const { a, b, ma } = await pair("speed_dating");
  const left = once(b, "peer_left");
  a.emit("next");
  await left;
  const mutual = once(a, "sd_mutual_like");
  a.emit("sd_rating", { roomId: ma.roomId, liked: true });
  b.emit("sd_rating", { roomId: ma.roomId, rating: "like" });
  assert.strictEqual((await mutual).roomId, ma.roomId);
  a.disconnect(); b.disconnect();
});

test("blocking a stranger prevents rematching them", async () => {
  const { a, b, ma } = await pair("text");
  a.emit("fingerprint", { fpId: "fp-a" });
  b.emit("fingerprint", { fpId: "fp-b" });
  await new Promise((r) => setTimeout(r, 100));
  const ack = await new Promise((resolve) => a.emit("block_peer", { roomId: ma.roomId }, resolve));
  assert.deepStrictEqual(ack, { ok: true });

  a.emit("find_match", { mode: "text" });
  await once(a, "waiting");
  b.emit("find_match", { mode: "text" });
  await once(b, "waiting");
  await never(a, "match_found", 500);
  a.disconnect(); b.disconnect();
});

test("college mode requires verification", async () => {
  const a = connect();
  await once(a, "connect");
  const req = once(a, "college_required");
  a.emit("find_match", { mode: "text", college: true });
  await req;
  a.disconnect();
});

test("rating a guest is acknowledged but not counted", async () => {
  const { a, b, ma } = await pair();
  const ack = await new Promise((resolve) => a.emit("rate_peer", { roomId: ma.roomId, score: 1 }, resolve));
  assert.deepStrictEqual(ack, { ok: true, counted: false });
  a.disconnect(); b.disconnect();
});

test("admin API rejects anonymous callers", async () => {
  const res = await fetch(`${URL}/api/admin/live`);
  assert.strictEqual(res.status, 401);
});

test("college verify requires sign-in and OTP types are validated", async () => {
  const res = await fetch(`${URL}/api/college/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  assert.strictEqual(res.status, 401);
  const bad = await fetch(`${URL}/api/send-otp`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "someone@gmail.com", type: "college_verify" }),
  });
  assert.strictEqual(bad.status, 400);
});

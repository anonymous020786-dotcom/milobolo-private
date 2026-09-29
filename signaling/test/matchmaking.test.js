const test = require("node:test");
const assert = require("node:assert");
const mm = require("../lib/matchmaking");

const base = (id, extra = {}) => ({
  id, mode: "text", college: false, interests: [], gender: "any", wantGender: "any",
  country: "IN", avoid: new Set(), blocked: new Set(), ...extra,
});

test("same mode strangers are compatible", () => {
  assert.ok(mm.compatible(base("a"), base("b")));
});

test("different modes never match", () => {
  assert.ok(!mm.compatible(base("a"), base("b", { mode: "video" })));
});

test("college pool is isolated", () => {
  assert.ok(!mm.compatible(base("a", { college: true }), base("b")));
});

test("gender preference is enforced both ways", () => {
  const wantsFemale = base("a", { gender: "male", wantGender: "female" });
  assert.ok(!mm.compatible(wantsFemale, base("b", { gender: "male" })));
  assert.ok(!mm.compatible(wantsFemale, base("b", { gender: "any" })));
  assert.ok(mm.compatible(wantsFemale, base("b", { gender: "female" })));
  // The other side's preference counts too
  assert.ok(!mm.compatible(wantsFemale, base("b", { gender: "female", wantGender: "female" })));
});

test("same-country filter", () => {
  const local = base("a", { sameCountry: true, country: "IN" });
  assert.ok(!mm.compatible(local, base("b", { country: "US" })));
  assert.ok(mm.compatible(local, base("b", { country: "IN" })));
  assert.ok(!mm.compatible(base("a", { sameCountry: true, country: "?" }), base("b", { country: "?" })));
});

test("avoid list and blocks prevent rematching", () => {
  const a = base("a", { avoid: new Set(["b:browser-b"]) });
  const b = base("b", { browserId: "browser-b" });
  assert.ok(!mm.compatible(a, b));
  assert.ok(!mm.compatible(b, a), "avoidance is checked in both directions");

  const c = base("c", { userId: "u1", blocked: new Set(["u2"]) });
  const d = base("d", { userId: "u2" });
  assert.ok(!mm.compatible(c, d));
});

test("same account in two tabs is not matched with itself", () => {
  assert.ok(!mm.compatible(base("a", { userId: "u1" }), base("b", { userId: "u1" })));
});

test("pickBest prefers shared interests, then falls back to anyone compatible", () => {
  const me = base("me", { interests: ["Music", "anime"] });
  const plain = base("plain");
  const fan = base("fan", { interests: ["music"] });
  const res = mm.pickBest(me, [plain, fan]);
  assert.strictEqual(res.peer.id, "fan");
  assert.deepStrictEqual(res.shared, ["Music"]);

  const fallback = mm.pickBest(me, [plain]);
  assert.strictEqual(fallback.peer.id, "plain");
  assert.deepStrictEqual(fallback.shared, []);
});

test("pickBest returns null when nobody is compatible", () => {
  assert.strictEqual(mm.pickBest(base("me", { mode: "video" }), [base("x")]), null);
});

test("long waiters get priority over an equal candidate", () => {
  const now = Date.now();
  const me = base("me");
  const fresh = base("fresh", { waitingSince: now - 1000 });
  const old = base("old", { waitingSince: now - 60_000 });
  assert.strictEqual(mm.pickBest(me, [fresh, old], now).peer.id, "old");
});

// Pure matchmaking rules. The server keeps waiting sockets in memory (a single
// Socket.IO instance owns every connection, so a shared Redis queue adds nothing
// but the double-match race it used to have).

// Identity keys used for "never match me with this person again".
function identityKeys(p) {
  const keys = [];
  if (p.userId) keys.push(`u:${p.userId}`);
  if (p.fpId) keys.push(`f:${p.fpId}`);
  return keys;
}

function avoids(a, b) {
  if (!a.avoid || a.avoid.size === 0) return false;
  return identityKeys(b).some((k) => a.avoid.has(k));
}

function blocks(a, b) {
  return !!(a.blocked && b.userId && a.blocked.has(b.userId));
}

function genderOk(seeker, other) {
  return !seeker.wantGender || seeker.wantGender === "any" || other.gender === seeker.wantGender;
}

function countryOk(a, b) {
  if (!a.sameCountry && !b.sameCountry) return true;
  return !!a.country && a.country !== "?" && a.country === b.country;
}

function compatible(a, b) {
  if (!a || !b || a.id === b.id) return false;
  if (a.mode !== b.mode) return false;
  if (!!a.college !== !!b.college) return false;
  if (a.userId && b.userId && a.userId === b.userId) return false; // same account, two tabs
  if (avoids(a, b) || avoids(b, a)) return false;
  if (blocks(a, b) || blocks(b, a)) return false;
  if (!genderOk(a, b) || !genderOk(b, a)) return false;
  if (!countryOk(a, b)) return false;
  return true;
}

function sharedInterests(a, b) {
  const theirs = new Set((b.interests || []).map((i) => i.toLowerCase()));
  return (a.interests || []).filter((i) => theirs.has(i.toLowerCase()));
}

// Higher is better. Shared interests dominate, then language, then country.
function score(a, b) {
  let s = sharedInterests(a, b).length * 10;
  if (a.language && a.language === b.language) s += 5;
  if (a.country && a.country !== "?" && a.country === b.country) s += 3;
  return s;
}

// candidates: iterable of waiting participants in wait order (oldest first).
// Returns { peer, shared } or null.
function pickBest(me, candidates, now = Date.now()) {
  let best = null;
  let bestScore = -1;
  for (const c of candidates) {
    if (!compatible(me, c)) continue;
    // Someone who has waited 20s+ gets priority over a marginally better match
    const waitedBonus = c.waitingSince && now - c.waitingSince > 20_000 ? 4 : 0;
    const s = score(me, c) + waitedBonus;
    if (s > bestScore) { best = c; bestScore = s; }
  }
  if (!best) return null;
  return { peer: best, shared: sharedInterests(me, best) };
}

module.exports = { identityKeys, compatible, sharedInterests, score, pickBest };

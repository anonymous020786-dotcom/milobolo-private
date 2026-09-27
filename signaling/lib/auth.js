// Verifies Supabase access tokens so the server never trusts a client-supplied userId.

const PROFILE_COLUMNS =
  "id, username, display_name, avatar_url, role, is_banned, ban_reason, karma, college_verified, is_verified, settings, allow_friend_requests";

const STAFF_ROLES = ["moderator", "admin", "superadmin"];

function createAuth(supabase, { enabled }) {
  const tokenCache = new Map(); // token → { userId, exp }

  async function verifyToken(token) {
    if (!enabled || typeof token !== "string" || token.length < 20 || token.length > 4096) return null;
    const cached = tokenCache.get(token);
    if (cached && cached.exp > Date.now()) return cached.userId;
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) return null;
      tokenCache.set(token, { userId: data.user.id, exp: Date.now() + 5 * 60_000 });
      if (tokenCache.size > 5000) tokenCache.delete(tokenCache.keys().next().value);
      return data.user.id;
    } catch {
      return null;
    }
  }

  async function loadProfile(userId) {
    if (!enabled || !userId) return null;
    try {
      const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).single();
      return data || null;
    } catch {
      return null;
    }
  }

  // → { userId, profile } or null for guests / invalid tokens
  async function authenticate(token) {
    const userId = await verifyToken(token);
    if (!userId) return null;
    const profile = await loadProfile(userId);
    return { userId, profile };
  }

  function bearer(req) {
    const h = req.headers.authorization || "";
    return h.startsWith("Bearer ") ? h.slice(7) : null;
  }

  // Express middleware: attaches req.auth = { userId, profile } or responds 401
  function requireUser() {
    return async (req, res, next) => {
      const auth = await authenticate(bearer(req));
      if (!auth) return res.status(401).json({ error: "Sign in required" });
      req.auth = auth;
      next();
    };
  }

  function requireStaff(roles = STAFF_ROLES) {
    return async (req, res, next) => {
      const auth = await authenticate(bearer(req));
      if (!auth) return res.status(401).json({ error: "Sign in required" });
      if (!auth.profile || !roles.includes(auth.profile.role)) return res.status(403).json({ error: "Forbidden" });
      req.auth = auth;
      next();
    };
  }

  return { authenticate, loadProfile, requireUser, requireStaff };
}

module.exports = { createAuth, STAFF_ROLES };

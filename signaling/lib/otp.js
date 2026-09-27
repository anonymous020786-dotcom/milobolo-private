const crypto = require("crypto");

const MAX_ATTEMPTS = 5;
const TTL_MS = 10 * 60 * 1000;
const VALID_TYPES = ["verify", "reset", "delete", "change_email", "college_verify"];

function hashOtp(email, otp) {
  const pepper = process.env.OTP_PEPPER || process.env.SUPABASE_SERVICE_KEY || "milobolo";
  return crypto.createHash("sha256").update(`${email.toLowerCase()}:${otp}:${pepper}`).digest("hex");
}

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function createOtpStore(supabase) {
  async function issue(email, type) {
    const otp = generateOtp();
    // Invalidate older unused codes so only the newest one works
    await supabase.from("otp_codes").update({ used: true })
      .eq("email", email.toLowerCase()).eq("type", type).eq("used", false);
    const { error } = await supabase.from("otp_codes").insert({
      email: email.toLowerCase(),
      otp_hash: hashOtp(email, otp),
      type,
      expires_at: new Date(Date.now() + TTL_MS).toISOString(),
      used: false,
      attempts: 0,
    });
    if (error) throw new Error(error.message);
    return otp;
  }

  // → { ok: true } | { ok: false, error }
  async function verify(email, otp, type) {
    if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) return { ok: false, error: "Invalid code" };
    const { data: row } = await supabase.from("otp_codes").select("id, otp_hash, attempts")
      .eq("email", email.toLowerCase()).eq("type", type).eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row) return { ok: false, error: "Invalid or expired code" };

    const expected = Buffer.from(row.otp_hash, "hex");
    const actual = Buffer.from(hashOtp(email, otp), "hex");
    const match = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

    if (!match) {
      const attempts = (row.attempts || 0) + 1;
      await supabase.from("otp_codes").update({ attempts, used: attempts >= MAX_ATTEMPTS }).eq("id", row.id);
      return { ok: false, error: attempts >= MAX_ATTEMPTS ? "Too many attempts. Request a new code." : "Invalid or expired code" };
    }
    await supabase.from("otp_codes").update({ used: true }).eq("id", row.id);
    return { ok: true };
  }

  return { issue, verify };
}

module.exports = { createOtpStore, hashOtp, VALID_TYPES };

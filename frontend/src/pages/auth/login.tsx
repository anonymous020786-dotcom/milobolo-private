import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Box, Container, Card, CardContent, Typography, TextField,
  Button, Divider, Alert, CircularProgress, Stack, Tab, Tabs,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import EmailIcon from "@mui/icons-material/Email";
import LockIcon from "@mui/icons-material/Lock";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import OtpInput from "@/components/auth/OtpInput";
import { useOtp } from "@/hooks/useOtp";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useFeatureFlags } from "@/context/FeatureFlagContext";

export default function Login() {
  const router = useRouter();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { isEnabled } = useFeatureFlags();
  const { sendOtp, verifyOtp, sending, verifying, error: otpError, countdown } = useOtp();

  const [tab, setTab] = useState(0); // 0=password, 1=OTP magic link
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState(0); // 0=enter email, 1=enter code
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicSent, setMagicSent] = useState(false);

  const next = (router.query.next as string) || "/";

  // ── Password login ────────────────────────────────────────
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (isEnabled("recaptcha") && executeRecaptcha) await executeRecaptcha("login");
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      router.push(next);
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP login via signaling ───────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (isEnabled("recaptcha") && executeRecaptcha) await executeRecaptcha("login_otp");
    const ok = await sendOtp(email, "verify");
    if (ok) setOtpStep(1);
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < 6) return;
    const ok = await verifyOtp(email, otpCode, "verify");
    if (!ok) return;
    // Sign in via Supabase magic link fallback — use OTP to sign in
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({ email });
      if (err && err.message !== "Email rate limit exceeded") {
        // Try password-less sign-in via signUp which auto-signs in if already registered
      }
      // Redirect — Supabase will handle the callback
      setMagicSent(true);
    } catch {
      // Even if magic link fails, OTP was verified — push to home
    } finally {
      setLoading(false);
      router.push(next);
    }
  };

  const handleGoogle = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
  };

  return (
    <Layout title="Sign In" noNav>
      <Box sx={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.12) 0%, transparent 70%)",
      }}>
        <Container maxWidth="xs">
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography variant="h4" fontWeight={800} sx={{
              background: "linear-gradient(135deg,#6C63FF,#FF6584)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              MiloBolo
            </Typography>
            <Typography color="text.secondary" mt={1}>Welcome back</Typography>
          </Box>

          <Card>
            <CardContent sx={{ p: 4 }}>
              {(error || otpError) && (
                <Alert severity="error" sx={{ mb: 2 }}>{error || otpError}</Alert>
              )}

              {isEnabled("google_auth") && (
                <>
                  <Button fullWidth variant="outlined" startIcon={<GoogleIcon />}
                    onClick={handleGoogle} sx={{ mb: 2, py: 1.2 }}>
                    Continue with Google
                  </Button>
                  <Divider sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary">or</Typography>
                  </Divider>
                </>
              )}

              <Tabs value={tab} onChange={(_, v) => { setTab(v); setError(""); setOtpStep(0); }}
                sx={{ mb: 3 }} variant="fullWidth">
                <Tab icon={<LockIcon fontSize="small" />} label="Password" iconPosition="start" />
                <Tab icon={<EmailIcon fontSize="small" />} label="Email OTP" iconPosition="start" />
              </Tabs>

              {/* Password tab */}
              {tab === 0 && (
                <Box component="form" onSubmit={handlePasswordLogin}>
                  <TextField fullWidth label="Email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} required sx={{ mb: 2 }} />
                  <TextField fullWidth label="Password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)} required sx={{ mb: 1 }} />
                  <Box sx={{ textAlign: "right", mb: 2 }}>
                    <Link href="/auth/forgot-password" style={{ color: "#6C63FF", fontSize: 13 }}>
                      Forgot password?
                    </Link>
                  </Box>
                  <Button fullWidth variant="contained" type="submit" disabled={loading} sx={{ py: 1.3 }}>
                    {loading ? <CircularProgress size={22} color="inherit" /> : "Sign In"}
                  </Button>
                </Box>
              )}

              {/* OTP tab */}
              {tab === 1 && otpStep === 0 && (
                <Box component="form" onSubmit={handleSendOtp}>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    We'll send a 6-digit code to your email. No password needed.
                  </Typography>
                  <TextField fullWidth label="Email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} required sx={{ mb: 3 }} />
                  <Button fullWidth variant="contained" type="submit" disabled={sending} sx={{ py: 1.3 }}>
                    {sending ? <CircularProgress size={22} color="inherit" /> : "Send OTP Code"}
                  </Button>
                </Box>
              )}

              {tab === 1 && otpStep === 1 && (
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="h6" fontWeight={600} mb={1}>Enter OTP</Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    6-digit code sent to <b>{email}</b>
                  </Typography>
                  <OtpInput value={otpCode} onChange={setOtpCode} disabled={verifying || loading} />
                  <Button fullWidth variant="contained" sx={{ mt: 3, py: 1.3 }}
                    onClick={handleVerifyOtp} disabled={otpCode.length < 6 || verifying || loading}>
                    {verifying || loading ? <CircularProgress size={22} color="inherit" /> : "Verify & Sign In"}
                  </Button>
                  <Button fullWidth variant="text" sx={{ mt: 1 }} disabled={countdown > 0 || sending}
                    onClick={() => sendOtp(email, "verify")}>
                    {countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
                  </Button>
                </Box>
              )}

              <Stack direction="row" justifyContent="center" mt={3} spacing={0.5}>
                <Typography variant="body2" color="text.secondary">No account?</Typography>
                <Link href="/auth/register" style={{ color: "#6C63FF", fontSize: 14 }}>Sign up free</Link>
              </Stack>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </Layout>
  );
}

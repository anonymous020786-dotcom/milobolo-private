import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Box, Container, Card, CardContent, Typography, TextField,
  Button, Divider, Alert, CircularProgress, Stack, Tab, Tabs,
  InputAdornment, IconButton, Checkbox, FormControlLabel, Chip,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import EmailIcon from "@mui/icons-material/Email";
import LockIcon from "@mui/icons-material/Lock";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import ShieldIcon from "@mui/icons-material/Shield";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PublicIcon from "@mui/icons-material/Public";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import { supabase } from "@/lib/supabase";
import OtpInput from "@/components/auth/OtpInput";
import { useOtp } from "@/hooks/useOtp";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useFeatureFlags } from "@/context/FeatureFlagContext";

const FEATURES = [
  { icon: <LockOutlinedIcon />, text: "End-to-end encrypted chats" },
  { icon: <ChatBubbleOutlineIcon />, text: "Anonymous by default — no tracking" },
  { icon: <PublicIcon />, text: "Connect with people worldwide, free forever" },
];

export default function Login() {
  const router = useRouter();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { isEnabled } = useFeatureFlags();
  const { sendOtp, verifyOtp, sending, verifying, error: otpError, countdown } = useOtp();

  const [tab, setTab] = useState(0); // 0=password, 1=OTP
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState(0);
  const [totpCode, setTotpCode] = useState("");
  const [totpStep, setTotpStep] = useState(false); // true = MFA challenge required
  const [totpFactorId, setTotpFactorId] = useState("");
  const [totpChallengeId, setTotpChallengeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(true);

  const next = (router.query.next as string) || "/";

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (isEnabled("recaptcha") && executeRecaptcha) await executeRecaptcha("login");
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;

      // Check if MFA is required
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
        // Get enrolled TOTP factors
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (totp) {
          const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: totp.id });
          if (challenge) {
            setTotpFactorId(totp.id);
            setTotpChallengeId(challenge.id);
            setTotpStep(true);
            setLoading(false);
            return;
          }
        }
      }
      router.push(next);
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTotpVerify = async () => {
    if (totpCode.length < 6) return;
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.mfa.verify({
        factorId: totpFactorId,
        challengeId: totpChallengeId,
        code: totpCode,
      });
      if (err) throw err;
      router.push(next);
    } catch (e: any) {
      setError(e.message || "Invalid authenticator code");
    } finally {
      setLoading(false);
    }
  };

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
    setLoading(true);
    try {
      await supabase.auth.signInWithOtp({ email });
    } catch { /* intentional */ } finally {
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
      <SeoHead title="Sign In — MiloBolo" description="Sign in to your MiloBolo account." path="/auth/login" noIndex />
      <Box sx={{
        minHeight: "100vh", display: "flex",
        background: "radial-gradient(ellipse at 30% 50%, rgba(108,99,255,0.10) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(255,101,132,0.07) 0%, transparent 50%)",
      }}>
        {/* Left branding panel — hidden on small */}
        <Box sx={{
          display: { xs: "none", md: "flex" },
          width: 420, flexShrink: 0,
          flexDirection: "column", justifyContent: "center",
          px: 6,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          background: "linear-gradient(160deg, rgba(108,99,255,0.08) 0%, transparent 100%)",
        }}>
          <Typography variant="h3" fontWeight={900} sx={{
            background: "linear-gradient(135deg,#6C63FF,#FF6584)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", mb: 1,
          }}>
            MiloBolo
          </Typography>
          <Typography color="text.secondary" mb={5} fontSize={15}>
            Meet strangers. Have real conversations.
          </Typography>
          <Stack spacing={3}>
            {FEATURES.map((f) => (
              <Stack key={f.text} direction="row" spacing={2} alignItems="center">
                <Box sx={{
                  width: 40, height: 40, borderRadius: 2, flexShrink: 0,
                  bgcolor: "rgba(108,99,255,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "primary.main",
                }}>
                  {f.icon}
                </Box>
                <Typography variant="body2" color="text.secondary">{f.text}</Typography>
              </Stack>
            ))}
          </Stack>
          <Box sx={{ mt: 6, p: 2.5, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 3, border: "1px solid rgba(255,255,255,0.06)" }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={0.75}>
              <ShieldIcon sx={{ fontSize: 16, color: "success.main" }} />
              <Typography variant="caption" color="success.main" fontWeight={600}>Your privacy matters</Typography>
            </Stack>
            <Typography variant="caption" color="text.disabled" lineHeight={1.6}>
              Chats are never stored. Your identity stays anonymous unless you share it.
            </Typography>
          </Box>
        </Box>

        {/* Right form panel */}
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", p: 3 }}>
          <Container maxWidth="xs" disableGutters>
            <Box sx={{ textAlign: "center", mb: 4, display: { md: "none" } }}>
              <Typography variant="h4" fontWeight={800} sx={{
                background: "linear-gradient(135deg,#6C63FF,#FF6584)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>MiloBolo</Typography>
            </Box>

            <Typography variant="h5" fontWeight={700} mb={0.5}>Welcome back</Typography>
            <Typography color="text.secondary" mb={3} fontSize={14}>Sign in to continue chatting</Typography>

            {(error || otpError) && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error || otpError}</Alert>
            )}

            {/* TOTP 2FA challenge */}
            {totpStep ? (
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 4, textAlign: "center" }}>
                  <Box sx={{
                    width: 56, height: 56, borderRadius: "50%", bgcolor: "rgba(108,99,255,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center", mx: "auto", mb: 2,
                  }}>
                    <ShieldIcon sx={{ color: "primary.main", fontSize: 28 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={700} mb={0.5}>Two-factor authentication</Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Enter the 6-digit code from your authenticator app.
                  </Typography>
                  <OtpInput value={totpCode} onChange={setTotpCode} disabled={loading} />
                  <Button fullWidth variant="contained" sx={{ mt: 3, py: 1.3, borderRadius: 2 }}
                    onClick={handleTotpVerify} disabled={totpCode.length < 6 || loading}>
                    {loading ? <CircularProgress size={22} color="inherit" /> : "Verify Code"}
                  </Button>
                  <Button fullWidth variant="text" sx={{ mt: 1 }} onClick={() => setTotpStep(false)}>
                    Back to login
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 4 }}>
                  {isEnabled("google_auth") && (
                    <>
                      <Button fullWidth variant="outlined" startIcon={<GoogleIcon />}
                        onClick={handleGoogle} sx={{ mb: 2, py: 1.2, borderRadius: 2 }}>
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
                        onChange={(e) => setEmail(e.target.value)} required sx={{ mb: 2 }}
                        InputProps={{ sx: { borderRadius: 2 } }} />
                      <TextField fullWidth label="Password" type={showPw ? "text" : "password"} value={password}
                        onChange={(e) => setPassword(e.target.value)} required sx={{ mb: 1 }}
                        InputProps={{
                          sx: { borderRadius: 2 },
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton onClick={() => setShowPw(!showPw)} edge="end" size="small">
                                {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                              </IconButton>
                            </InputAdornment>
                          ),
                        }}
                      />
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2.5}>
                        <FormControlLabel
                          control={<Checkbox size="small" checked={remember} onChange={(e) => setRemember(e.target.checked)} />}
                          label={<Typography variant="caption">Remember me</Typography>}
                          sx={{ m: 0 }}
                        />
                        <Link href="/auth/forgot-password" style={{ color: "#6C63FF", fontSize: 13 }}>
                          Forgot password?
                        </Link>
                      </Stack>
                      <Button fullWidth variant="contained" type="submit" disabled={loading} sx={{ py: 1.3, borderRadius: 2 }}>
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
                        onChange={(e) => setEmail(e.target.value)} required sx={{ mb: 3 }}
                        InputProps={{ sx: { borderRadius: 2 } }} />
                      <Button fullWidth variant="contained" type="submit" disabled={sending} sx={{ py: 1.3, borderRadius: 2 }}>
                        {sending ? <CircularProgress size={22} color="inherit" /> : "Send OTP Code"}
                      </Button>
                    </Box>
                  )}
                  {tab === 1 && otpStep === 1 && (
                    <Box sx={{ textAlign: "center" }}>
                      <Typography variant="h6" fontWeight={600} mb={0.5}>Check your inbox</Typography>
                      <Typography variant="body2" color="text.secondary" mb={3}>
                        6-digit code sent to <b>{email}</b>
                      </Typography>
                      <OtpInput value={otpCode} onChange={setOtpCode} disabled={verifying || loading} />
                      <Button fullWidth variant="contained" sx={{ mt: 3, py: 1.3, borderRadius: 2 }}
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
            )}
          </Container>
        </Box>
      </Box>
    </Layout>
  );
}

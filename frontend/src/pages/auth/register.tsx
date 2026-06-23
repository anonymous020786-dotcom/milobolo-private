import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Box, Container, Card, CardContent, Typography, TextField,
  Button, Alert, CircularProgress, Stack, Divider, Stepper, Step, StepLabel,
  InputAdornment, IconButton, Checkbox, FormControlLabel, LinearProgress,
  Chip,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import { supabase } from "@/lib/supabase";
import { useOtp } from "@/hooks/useOtp";
import OtpInput from "@/components/auth/OtpInput";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useFeatureFlags } from "@/context/FeatureFlagContext";

interface PwRule { label: string; test: (pw: string) => boolean; }
const PW_RULES: PwRule[] = [
  { label: "8+ characters", test: (p) => p.length >= 8 },
  { label: "Uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "Number", test: (p) => /[0-9]/.test(p) },
  { label: "Special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function getPwStrength(pw: string) {
  return PW_RULES.filter((r) => r.test(pw)).length;
}

const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
const STRENGTH_COLORS = ["", "#f44336", "#ff9800", "#ffc107", "#4caf50", "#2e7d32"];

export default function Register() {
  const router = useRouter();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { isEnabled } = useFeatureFlags();
  const { sendOtp, verifyOtp, sending, verifying, error: otpError, countdown } = useOtp();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setFormError] = useState("");
  const [nameStatus, setNameStatus] = useState<"idle" | "checking" | "taken" | "available">("idle");

  const nameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pwStrength = getPwStrength(password);

  // Debounced display-name availability check
  useEffect(() => {
    if (nameTimer.current) clearTimeout(nameTimer.current);
    if (!name || name.length < 3) { setNameStatus("idle"); return; }
    setNameStatus("checking");
    nameTimer.current = setTimeout(async () => {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .ilike("display_name", name);
      setNameStatus((count || 0) > 0 ? "taken" : "available");
    }, 500);
    return () => { if (nameTimer.current) clearTimeout(nameTimer.current); };
  }, [name]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (password.length < 8) return setFormError("Password must be at least 8 characters");
    if (!agreeTerms) return setFormError("Please accept the Terms of Service to continue");
    if (nameStatus === "taken") return setFormError("That display name is already taken");
    if (isEnabled("recaptcha") && executeRecaptcha) await executeRecaptcha("register");
    const ok = await sendOtp(email, "verify");
    if (ok) setStep(1);
  };

  const handleVerify = async () => {
    if (otp.length < 6) return;
    const ok = await verifyOtp(email, otp, "verify");
    if (!ok) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name }, emailRedirectTo: undefined },
      });
      if (error) throw error;
      // Set display name on profile
      if (name) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
        }
      }
      setStep(2);
      setTimeout(() => router.push("/"), 2500);
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Sign Up" noNav>
      <SeoHead title="Sign Up — MiloBolo" description="Create your free MiloBolo account." path="/auth/register" noIndex />
      <Box sx={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.12) 0%, transparent 70%)",
        py: 4,
      }}>
        <Container maxWidth="xs">
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Typography variant="h4" fontWeight={800} sx={{
              background: "linear-gradient(135deg,#6C63FF,#FF6584)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>MiloBolo</Typography>
            <Typography color="text.secondary" mt={0.5} fontSize={14}>Free forever — no credit card needed</Typography>
          </Box>

          <Stepper activeStep={step} sx={{ mb: 3 }} alternativeLabel>
            {["Details", "Verify Email", "Done"].map((l) => (
              <Step key={l}><StepLabel>{l}</StepLabel></Step>
            ))}
          </Stepper>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 4 }}>
              {(error || otpError) && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError("")}>{error || otpError}</Alert>}

              {step === 0 && (
                <>
                  {isEnabled("google_auth") && (
                    <>
                      <Button fullWidth variant="outlined" startIcon={<GoogleIcon />}
                        onClick={() => supabase.auth.signInWithOAuth({ provider: "google",
                          options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` } })}
                        sx={{ mb: 2, py: 1.2, borderRadius: 2 }}>
                        Sign up with Google
                      </Button>
                      <Divider sx={{ mb: 2 }}><Typography variant="caption" color="text.secondary">or</Typography></Divider>
                    </>
                  )}
                  <Box component="form" onSubmit={handleSendOtp}>
                    {/* Display name with availability check */}
                    <TextField
                      fullWidth label="Display Name" value={name}
                      onChange={(e) => setName(e.target.value)}
                      required sx={{ mb: 2 }}
                      inputProps={{ maxLength: 30 }}
                      InputProps={{
                        sx: { borderRadius: 2 },
                        endAdornment: nameStatus !== "idle" && (
                          <InputAdornment position="end">
                            {nameStatus === "checking" && <CircularProgress size={16} />}
                            {nameStatus === "available" && <CheckCircleIcon sx={{ color: "success.main", fontSize: 18 }} />}
                            {nameStatus === "taken" && <RadioButtonUncheckedIcon sx={{ color: "error.main", fontSize: 18 }} />}
                          </InputAdornment>
                        ),
                      }}
                      helperText={
                        nameStatus === "taken" ? "Name already taken" :
                        nameStatus === "available" ? "Name available!" : " "
                      }
                      FormHelperTextProps={{
                        sx: { color: nameStatus === "taken" ? "error.main" : nameStatus === "available" ? "success.main" : undefined },
                      }}
                    />
                    <TextField fullWidth label="Email" type="email" value={email}
                      onChange={(e) => setEmail(e.target.value)} required sx={{ mb: 2 }}
                      InputProps={{ sx: { borderRadius: 2 } }} />
                    <TextField fullWidth label="Password" type={showPw ? "text" : "password"} value={password}
                      onChange={(e) => setPassword(e.target.value)} required sx={{ mb: password ? 1 : 2 }}
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

                    {/* Password strength */}
                    {password.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Stack direction="row" justifyContent="space-between" mb={0.5}>
                          <Typography variant="caption" color="text.secondary">Password strength</Typography>
                          <Typography variant="caption" sx={{ color: STRENGTH_COLORS[pwStrength], fontWeight: 600 }}>
                            {STRENGTH_LABELS[pwStrength]}
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate" value={(pwStrength / 5) * 100}
                          sx={{
                            height: 5, borderRadius: 3, mb: 1.5,
                            bgcolor: "rgba(255,255,255,0.07)",
                            "& .MuiLinearProgress-bar": {
                              bgcolor: STRENGTH_COLORS[pwStrength],
                              borderRadius: 3,
                              transition: "background-color 0.3s, width 0.3s",
                            },
                          }}
                        />
                        <Stack direction="row" flexWrap="wrap" gap={0.5}>
                          {PW_RULES.map((r) => {
                            const met = r.test(password);
                            return (
                              <Chip
                                key={r.label}
                                label={r.label}
                                size="small"
                                icon={met ? <CheckCircleIcon /> : <RadioButtonUncheckedIcon />}
                                sx={{
                                  fontSize: 11,
                                  color: met ? "success.main" : "text.disabled",
                                  borderColor: met ? "success.main" : "rgba(255,255,255,0.1)",
                                  bgcolor: met ? "rgba(76,175,80,0.08)" : "transparent",
                                  "& .MuiChip-icon": { fontSize: 14, color: "inherit" },
                                }}
                                variant="outlined"
                              />
                            );
                          })}
                        </Stack>
                      </Box>
                    )}

                    <FormControlLabel
                      control={<Checkbox size="small" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />}
                      label={
                        <Typography variant="caption" color="text.secondary">
                          I agree to the{" "}
                          <Link href="/terms" target="_blank" style={{ color: "#6C63FF" }}>Terms of Service</Link>
                          {" "}and{" "}
                          <Link href="/privacy" target="_blank" style={{ color: "#6C63FF" }}>Privacy Policy</Link>
                        </Typography>
                      }
                      sx={{ mb: 2.5, alignItems: "flex-start", "& .MuiFormControlLabel-label": { mt: 0.25 } }}
                    />

                    <Button fullWidth variant="contained" type="submit"
                      disabled={sending || nameStatus === "taken"}
                      sx={{ py: 1.3, borderRadius: 2 }}>
                      {sending ? <CircularProgress size={22} color="inherit" /> : "Continue"}
                    </Button>
                  </Box>
                  <Stack direction="row" justifyContent="center" mt={3} spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">Already have an account?</Typography>
                    <Link href="/auth/login" style={{ color: "#6C63FF", fontSize: 14 }}>Sign in</Link>
                  </Stack>
                </>
              )}

              {step === 1 && (
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="h6" fontWeight={600} mb={0.5}>Check your inbox</Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    We sent a 6-digit code to <b>{email}</b>
                  </Typography>
                  <OtpInput value={otp} onChange={setOtp} disabled={verifying || loading} />
                  <Button fullWidth variant="contained" sx={{ mt: 3, py: 1.3, borderRadius: 2 }}
                    onClick={handleVerify} disabled={otp.length < 6 || verifying || loading}>
                    {verifying || loading ? <CircularProgress size={22} color="inherit" /> : "Verify & Create Account"}
                  </Button>
                  <Button fullWidth variant="text" sx={{ mt: 1 }} disabled={countdown > 0 || sending}
                    onClick={() => sendOtp(email, "verify")}>
                    {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
                  </Button>
                </Box>
              )}

              {step === 2 && (
                <Box sx={{ textAlign: "center", py: 2 }}>
                  <CheckCircleIcon sx={{ fontSize: 56, color: "success.main", mb: 1.5 }} />
                  <Typography variant="h5" fontWeight={700} mb={1}>Welcome to MiloBolo!</Typography>
                  <Typography color="text.secondary">Account created. Redirecting you now...</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Container>
      </Box>
    </Layout>
  );
}

import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Box, Container, Card, CardContent, Typography, TextField,
  Button, Alert, CircularProgress, Stack, Divider, Stepper, Step, StepLabel,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import { useOtp } from "@/hooks/useOtp";
import OtpInput from "@/components/auth/OtpInput";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useFeatureFlags } from "@/context/FeatureFlagContext";

export default function Register() {
  const router = useRouter();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { isEnabled } = useFeatureFlags();
  const { sendOtp, verifyOtp, sending, verifying, error: otpError, setError, countdown } = useOtp();

  const [step, setStep] = useState(0); // 0=form, 1=otp, 2=done
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setFormError] = useState("");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (password.length < 8) return setFormError("Password must be at least 8 characters");
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
      setStep(2);
      setTimeout(() => router.push("/"), 2000);
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Sign Up" noNav>
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.12) 0%, transparent 70%)" }}>
        <Container maxWidth="xs">
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography variant="h4" fontWeight={800}
              sx={{ background: "linear-gradient(135deg,#6C63FF,#FF6584)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              MiloBolo
            </Typography>
            <Typography color="text.secondary" mt={1}>Create your account</Typography>
          </Box>

          <Stepper activeStep={step} sx={{ mb: 3 }}>
            {["Details", "Verify Email", "Done"].map((l) => (
              <Step key={l}><StepLabel>{l}</StepLabel></Step>
            ))}
          </Stepper>

          <Card>
            <CardContent sx={{ p: 4 }}>
              {(error || otpError) && <Alert severity="error" sx={{ mb: 2 }}>{error || otpError}</Alert>}

              {step === 0 && (
                <>
                  {isEnabled("google_auth") && (
                    <>
                      <Button fullWidth variant="outlined" startIcon={<GoogleIcon />}
                        onClick={() => supabase.auth.signInWithOAuth({ provider: "google",
                          options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` } })}
                        sx={{ mb: 2, py: 1.2 }}>
                        Sign up with Google
                      </Button>
                      <Divider sx={{ mb: 2 }}><Typography variant="caption" color="text.secondary">or</Typography></Divider>
                    </>
                  )}
                  <Box component="form" onSubmit={handleSendOtp}>
                    <TextField fullWidth label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required sx={{ mb: 2 }} />
                    <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required sx={{ mb: 2 }} />
                    <TextField fullWidth label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required sx={{ mb: 3 }} helperText="Min 8 characters" />
                    <Button fullWidth variant="contained" type="submit" disabled={sending} sx={{ py: 1.3 }}>
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
                  <Typography variant="h6" fontWeight={600} mb={1}>Enter OTP</Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    We sent a 6-digit code to <b>{email}</b>
                  </Typography>
                  <OtpInput value={otp} onChange={setOtp} disabled={verifying || loading} />
                  <Button fullWidth variant="contained" sx={{ mt: 3, py: 1.3 }}
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
                  <Typography variant="h5" fontWeight={700} color="primary" mb={1}>🎉 Welcome to MiloBolo!</Typography>
                  <Typography color="text.secondary">Redirecting you now...</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Container>
      </Box>
    </Layout>
  );
}

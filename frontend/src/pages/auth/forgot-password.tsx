import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Box, Container, Card, CardContent, Typography, TextField,
  Button, Alert, CircularProgress, Stepper, Step, StepLabel,
} from "@mui/material";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import { useOtp } from "@/hooks/useOtp";
import OtpInput from "@/components/auth/OtpInput";

export default function ForgotPassword() {
  const router = useRouter();
  const { sendOtp, verifyOtp, sending, verifying, error: otpError, countdown } = useOtp();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await sendOtp(email, "reset");
    if (ok) setStep(1);
  };

  const handleVerify = async () => {
    const ok = await verifyOtp(email, otp, "reset");
    if (ok) setStep(2);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords do not match");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => router.push("/auth/login"), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Forgot Password" noNav>
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.12) 0%, transparent 70%)" }}>
        <Container maxWidth="xs">
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography variant="h4" fontWeight={800}
              sx={{ background: "linear-gradient(135deg,#6C63FF,#FF6584)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              MiloBolo
            </Typography>
            <Typography color="text.secondary" mt={1}>Reset your password</Typography>
          </Box>

          <Stepper activeStep={step} sx={{ mb: 3 }}>
            {["Email", "Verify OTP", "New Password"].map((l) => (
              <Step key={l}><StepLabel>{l}</StepLabel></Step>
            ))}
          </Stepper>

          <Card>
            <CardContent sx={{ p: 4 }}>
              {(error || otpError) && <Alert severity="error" sx={{ mb: 2 }}>{error || otpError}</Alert>}
              {done && <Alert severity="success" sx={{ mb: 2 }}>Password updated! Redirecting...</Alert>}

              {step === 0 && (
                <Box component="form" onSubmit={handleSend}>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Enter your email and we'll send you an OTP to reset your password.
                  </Typography>
                  <TextField fullWidth label="Email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} required sx={{ mb: 3 }} />
                  <Button fullWidth variant="contained" type="submit" disabled={sending} sx={{ py: 1.3 }}>
                    {sending ? <CircularProgress size={22} color="inherit" /> : "Send OTP"}
                  </Button>
                  <Box sx={{ textAlign: "center", mt: 2 }}>
                    <Link href="/auth/login" style={{ color: "#6C63FF", fontSize: 14 }}>Back to login</Link>
                  </Box>
                </Box>
              )}

              {step === 1 && (
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="h6" fontWeight={600} mb={1}>Enter OTP</Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    Code sent to <b>{email}</b>
                  </Typography>
                  <OtpInput value={otp} onChange={setOtp} disabled={verifying} />
                  <Button fullWidth variant="contained" sx={{ mt: 3, py: 1.3 }}
                    onClick={handleVerify} disabled={otp.length < 6 || verifying}>
                    {verifying ? <CircularProgress size={22} color="inherit" /> : "Verify OTP"}
                  </Button>
                  <Button fullWidth variant="text" sx={{ mt: 1 }} disabled={countdown > 0 || sending}
                    onClick={() => sendOtp(email, "reset")}>
                    {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
                  </Button>
                </Box>
              )}

              {step === 2 && (
                <Box component="form" onSubmit={handleReset}>
                  <TextField fullWidth label="New Password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)} required sx={{ mb: 2 }} helperText="Min 8 characters" />
                  <TextField fullWidth label="Confirm Password" type="password" value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} required sx={{ mb: 3 }} />
                  <Button fullWidth variant="contained" type="submit" disabled={loading} sx={{ py: 1.3 }}>
                    {loading ? <CircularProgress size={22} color="inherit" /> : "Reset Password"}
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Container>
      </Box>
    </Layout>
  );
}

import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Box, Container, Card, CardContent, Typography, TextField,
  Button, Alert, CircularProgress, Stepper, Step, StepLabel,
  InputAdornment, IconButton,
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
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
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
      setTimeout(() => router.push("/auth/login"), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Reset Password" noNav>
      <SeoHead title="Reset Password — MiloBolo" description="Reset your MiloBolo account password." path="/auth/forgot-password" noIndex />
      <Box sx={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.12) 0%, transparent 70%)",
        py: 4,
      }}>
        <Container maxWidth="xs">
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: "50%",
              bgcolor: "rgba(108,99,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              mx: "auto", mb: 2,
            }}>
              <LockResetIcon sx={{ color: "primary.main", fontSize: 28 }} />
            </Box>
            <Typography variant="h5" fontWeight={800}>Reset your password</Typography>
            <Typography color="text.secondary" mt={0.5} fontSize={14}>
              We&apos;ll send a code to verify it&apos;s you
            </Typography>
          </Box>

          <Stepper activeStep={step} sx={{ mb: 3 }} alternativeLabel>
            {["Email", "Verify OTP", "New Password"].map((l) => (
              <Step key={l}><StepLabel>{l}</StepLabel></Step>
            ))}
          </Stepper>

          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 4 }}>
              {(error || otpError) && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error || otpError}</Alert>
              )}
              {done && (
                <Alert severity="success" sx={{ mb: 2 }}>Password updated! Redirecting to login...</Alert>
              )}

              {step === 0 && (
                <Box component="form" onSubmit={handleSend}>
                  <Typography variant="body2" color="text.secondary" mb={2.5} lineHeight={1.7}>
                    Enter the email address associated with your account and we&apos;ll send a verification code.
                  </Typography>
                  <TextField fullWidth label="Email address" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} required sx={{ mb: 3 }}
                    InputProps={{ sx: { borderRadius: 2 } }} />
                  <Button fullWidth variant="contained" type="submit" disabled={sending}
                    sx={{ py: 1.3, borderRadius: 2 }}>
                    {sending ? <CircularProgress size={22} color="inherit" /> : "Send verification code"}
                  </Button>
                  <Box sx={{ textAlign: "center", mt: 2.5 }}>
                    <Link href="/auth/login" style={{ color: "#6C63FF", fontSize: 14 }}>
                      Back to sign in
                    </Link>
                  </Box>
                </Box>
              )}

              {step === 1 && (
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="h6" fontWeight={600} mb={0.5}>Check your inbox</Typography>
                  <Typography variant="body2" color="text.secondary" mb={3}>
                    6-digit code sent to <b>{email}</b>
                  </Typography>
                  <OtpInput value={otp} onChange={setOtp} disabled={verifying} />
                  <Button fullWidth variant="contained" sx={{ mt: 3, py: 1.3, borderRadius: 2 }}
                    onClick={handleVerify} disabled={otp.length < 6 || verifying}>
                    {verifying ? <CircularProgress size={22} color="inherit" /> : "Verify Code"}
                  </Button>
                  <Button fullWidth variant="text" sx={{ mt: 1 }} disabled={countdown > 0 || sending}
                    onClick={() => sendOtp(email, "reset")}>
                    {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
                  </Button>
                </Box>
              )}

              {step === 2 && (
                <Box component="form" onSubmit={handleReset}>
                  <Typography variant="body2" color="text.secondary" mb={2.5}>
                    Choose a strong new password for your account.
                  </Typography>
                  <TextField fullWidth label="New password" type={showPw ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)} required sx={{ mb: 2 }}
                    helperText="Minimum 8 characters"
                    InputProps={{
                      sx: { borderRadius: 2 },
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPw(!showPw)}>
                            {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }} />
                  <TextField fullWidth label="Confirm new password" type="password" value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} required sx={{ mb: 3 }}
                    error={!!confirm && confirm !== password}
                    helperText={confirm && confirm !== password ? "Passwords do not match" : " "}
                    InputProps={{ sx: { borderRadius: 2 } }} />
                  <Button fullWidth variant="contained" type="submit" disabled={loading || (!!confirm && confirm !== password)}
                    sx={{ py: 1.3, borderRadius: 2 }}>
                    {loading ? <CircularProgress size={22} color="inherit" /> : "Set new password"}
                  </Button>
                </Box>
              )}

              {done && step === 2 && (
                <Box sx={{ textAlign: "center", pt: 2 }}>
                  <CheckCircleIcon sx={{ fontSize: 48, color: "success.main", mb: 1 }} />
                  <Typography fontWeight={700}>Password updated!</Typography>
                  <Typography variant="body2" color="text.secondary">Redirecting to sign in...</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Container>
      </Box>
    </Layout>
  );
}

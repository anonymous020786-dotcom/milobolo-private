import { useState } from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Typography, Button, TextField, Stack, Chip,
  Paper, Stepper, Step, StepLabel, Alert, CircularProgress,
  Divider, List, ListItem, ListItemIcon, ListItemText,
} from "@mui/material";
import SchoolIcon from "@mui/icons-material/School";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import LockIcon from "@mui/icons-material/Lock";
import PeopleIcon from "@mui/icons-material/People";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const COLLEGE_DOMAINS = [
  ".edu", ".ac.in", ".ac.uk", ".ac.nz", ".ac.za",
  ".edu.au", ".edu.sg", ".edu.hk", ".edu.cn", ".edu.br",
  ".uni-", "university", "college", "institute", "iit", "nit",
];

function isCollegeEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return COLLEGE_DOMAINS.some((d) => lower.includes(d));
}

const STEPS = ["Enter college email", "Verify OTP", "Start chatting"];

const PERKS = [
  { icon: <PeopleIcon />, text: "Match only with verified students" },
  { icon: <LockIcon />, text: "College-only private chat pool" },
  { icon: <CheckCircleIcon color="success" />, text: "Verified student badge on profile" },
  { icon: <VideoCallIcon />, text: "All chat modes available" },
];

export default function CollegePage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState(user?.email || "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const alreadyVerified = !!(profile as { college_verified?: boolean })?.college_verified;

  const sendOtp = async () => {
    setError("");
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    if (!isCollegeEmail(email)) {
      setError("This doesn't look like a college or university email. Please use your institutional email (.edu, .ac.in, etc.).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000"}/api/send-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, type: "college_verify" }),
        }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send OTP."); return; }
      setSent(true);
      setStep(1);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError("");
    if (otp.length !== 6) { setError("Enter the 6-digit code."); return; }
    if (!user) { router.push("/auth/login"); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000"}/api/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp, type: "college_verify" }),
        }
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid OTP."); return; }

      // Mark profile as college-verified
      await supabase.from("profiles").update({
        college_verified: true,
        college_email: email,
      } as Record<string, unknown>).eq("id", user.id);

      setStep(2);
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startChat = (mode: string) => {
    router.push(`/chat?mode=${mode}&college=1`);
  };

  return (
    <>
      <SeoHead
        title="College Chat — MiloBolo"
        description="MiloBolo College Mode: chat exclusively with verified university and college students. Verify your .edu or institutional email to get started."
        path="/college"
      />
      <Layout title="College Chat">
        <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>

          {/* Hero */}
          <Box sx={{ textAlign: "center", mb: 6 }}>
            <Box sx={{
              width: 80, height: 80, borderRadius: "50%", bgcolor: "rgba(108,99,255,0.15)",
              border: "2px solid rgba(108,99,255,0.3)", display: "flex", alignItems: "center",
              justifyContent: "center", mx: "auto", mb: 2,
            }}>
              <SchoolIcon sx={{ fontSize: 40, color: "primary.main" }} />
            </Box>
            <Chip label="Students Only" color="primary" sx={{ mb: 2 }} />
            <Typography variant="h3" fontWeight={900} mb={1.5}>
              College Chat
            </Typography>
            <Typography color="text.secondary" fontSize={17} maxWidth={500} mx="auto">
              Chat exclusively with verified students from universities worldwide.
              Verify your institutional email to unlock a private, student-only matching pool.
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 4, flexDirection: { xs: "column", md: "row" } }}>

            {/* Perks */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={700} mb={2}>Why College Mode?</Typography>
              <List disablePadding>
                {PERKS.map((p, i) => (
                  <ListItem key={i} disableGutters sx={{ py: 0.75 }}>
                    <ListItemIcon sx={{ minWidth: 36, color: "primary.main" }}>{p.icon}</ListItemIcon>
                    <ListItemText primary={p.text} primaryTypographyProps={{ variant: "body2" }} />
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ my: 3, opacity: 0.1 }} />

              <Typography variant="subtitle2" color="text.secondary" mb={1}>Accepted email domains</Typography>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {[".edu", ".ac.in", ".ac.uk", ".ac.nz", ".edu.au", ".edu.sg", "university.*", "college.*"].map((d) => (
                  <Chip key={d} label={d} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                ))}
              </Stack>
            </Box>

            {/* Verification card */}
            <Box sx={{ width: { xs: "100%", md: 360 } }}>
              {alreadyVerified ? (
                <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid rgba(76,175,80,0.3)", bgcolor: "rgba(76,175,80,0.04)" }}>
                  <Stack alignItems="center" spacing={2} mb={3}>
                    <CheckCircleIcon sx={{ fontSize: 48, color: "success.main" }} />
                    <Typography fontWeight={700} fontSize={18}>You&apos;re verified!</Typography>
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      Your student status is confirmed. You have access to the college-only matching pool.
                    </Typography>
                  </Stack>
                  <Stack spacing={1.5}>
                    <Button fullWidth variant="contained" startIcon={<VideoCallIcon />}
                      onClick={() => startChat("video")}
                      sx={{ borderRadius: 2, background: "linear-gradient(135deg,#6C63FF,#8B5CF6)" }}>
                      Video Chat with Students
                    </Button>
                    <Button fullWidth variant="outlined" startIcon={<ChatBubbleOutlineIcon />}
                      onClick={() => startChat("text")} sx={{ borderRadius: 2 }}>
                      Text Chat with Students
                    </Button>
                  </Stack>
                </Paper>
              ) : (
                <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
                    {STEPS.map((label) => (
                      <Step key={label}>
                        <StepLabel sx={{ "& .MuiStepLabel-label": { fontSize: 12 } }}>{label}</StepLabel>
                      </Step>
                    ))}
                  </Stepper>

                  {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                  {step === 0 && (
                    <>
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        Enter your institutional email address. We&apos;ll send a one-time verification code.
                      </Typography>
                      {!user && (
                        <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
                          You need to be signed in to verify. <Button size="small" onClick={() => router.push("/auth/login")}>Sign in</Button>
                        </Alert>
                      )}
                      <TextField
                        fullWidth size="small"
                        label="College / University email"
                        placeholder="you@university.edu"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        disabled={!user}
                        sx={{ mb: 2 }}
                        onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                      />
                      <Button fullWidth variant="contained" onClick={sendOtp} disabled={loading || !user}
                        sx={{ borderRadius: 2, background: "linear-gradient(135deg,#6C63FF,#8B5CF6)" }}>
                        {loading ? <CircularProgress size={20} color="inherit" /> : "Send verification code"}
                      </Button>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <Typography variant="body2" color="text.secondary" mb={0.5}>
                        We sent a 6-digit code to:
                      </Typography>
                      <Typography variant="body2" fontWeight={700} mb={2}>{email}</Typography>
                      <TextField
                        fullWidth size="small"
                        label="6-digit code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        inputProps={{ inputMode: "numeric", style: { letterSpacing: 6, fontSize: 20, textAlign: "center" } }}
                        sx={{ mb: 2 }}
                        onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                        autoFocus
                      />
                      <Stack spacing={1}>
                        <Button fullWidth variant="contained" onClick={verifyOtp} disabled={loading || otp.length !== 6}
                          sx={{ borderRadius: 2, background: "linear-gradient(135deg,#6C63FF,#8B5CF6)" }}>
                          {loading ? <CircularProgress size={20} color="inherit" /> : "Verify"}
                        </Button>
                        <Button fullWidth variant="text" size="small" onClick={() => { setStep(0); setOtp(""); setError(""); }}>
                          Use a different email
                        </Button>
                      </Stack>
                    </>
                  )}

                  {step === 2 && (
                    <Box sx={{ textAlign: "center" }}>
                      <CheckCircleIcon sx={{ fontSize: 56, color: "success.main", mb: 1.5 }} />
                      <Typography fontWeight={700} fontSize={18} mb={0.5}>Verified!</Typography>
                      <Typography variant="body2" color="text.secondary" mb={3}>
                        Your student status is confirmed. You now have access to the college-only pool.
                      </Typography>
                      <Stack spacing={1.5}>
                        <Button fullWidth variant="contained" startIcon={<VideoCallIcon />}
                          onClick={() => startChat("video")}
                          sx={{ borderRadius: 2, background: "linear-gradient(135deg,#6C63FF,#8B5CF6)" }}>
                          Video Chat with Students
                        </Button>
                        <Button fullWidth variant="outlined" startIcon={<ChatBubbleOutlineIcon />}
                          onClick={() => startChat("text")} sx={{ borderRadius: 2 }}>
                          Text Chat with Students
                        </Button>
                      </Stack>
                    </Box>
                  )}
                </Paper>
              )}
            </Box>
          </Box>
        </Container>
      </Layout>
    </>
  );
}

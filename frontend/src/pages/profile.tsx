import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Grid, Card, CardContent, Typography, TextField, Button,
  Avatar, Alert, CircularProgress, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, Tab, Tabs, Chip, IconButton, Tooltip,
  LinearProgress, Stack, InputAdornment, Badge, Paper,
} from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import LockIcon from "@mui/icons-material/Lock";
import ChatIcon from "@mui/icons-material/Chat";
import VideocamIcon from "@mui/icons-material/Videocam";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ShieldIcon from "@mui/icons-material/Shield";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DevicesIcon from "@mui/icons-material/Devices";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import PersonIcon from "@mui/icons-material/Person";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import OtpInput from "@/components/auth/OtpInput";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useOtp } from "@/hooks/useOtp";
import axios from "axios";

// ── helpers ───────────────────────────────────────────────────
function fmtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ProfileCompletion({ profile, hasAvatar }: { profile: any; hasAvatar: boolean }) {
  const checks = [
    { label: "Display name", done: !!profile?.display_name },
    { label: "Bio", done: !!profile?.bio },
    { label: "Avatar photo", done: hasAvatar },
    { label: "Email verified", done: true },
  ];
  const pct = Math.round((checks.filter((c) => c.done).length / checks.length) * 100);
  const color = pct === 100 ? "success.main" : pct >= 50 ? "primary.main" : "warning.main";
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="body2" fontWeight={600}>Profile completeness</Typography>
          <Typography variant="body2" fontWeight={700} sx={{ color }}>{pct}%</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={pct} sx={{
          height: 6, borderRadius: 3, mb: 1.5,
          bgcolor: "rgba(255,255,255,0.07)",
          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 3 },
        }} />
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {checks.map((c) => (
            <Chip key={c.label} label={c.label} size="small"
              icon={c.done ? <CheckCircleIcon /> : undefined}
              sx={{
                fontSize: 11,
                color: c.done ? "success.main" : "text.disabled",
                borderColor: c.done ? "rgba(76,175,80,0.3)" : "rgba(255,255,255,0.08)",
                bgcolor: c.done ? "rgba(76,175,80,0.06)" : "transparent",
                "& .MuiChip-icon": { fontSize: 14, color: "inherit" },
              }}
              variant="outlined"
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

function ChatStatsCard({ userId }: { userId: string }) {
  const [stats, setStats] = useState<{
    total: number; video: number; text: number;
    totalSeconds: number;
  } | null>(null);

  useEffect(() => {
    supabase.from("chat_history").select("mode, duration_seconds").eq("user_id", userId)
      .then(({ data }) => {
        if (!data) return;
        const total = data.length;
        const video = data.filter((r) => r.mode === "video").length;
        const text = data.filter((r) => r.mode === "text").length;
        const totalSeconds = data.reduce((a, r) => a + (r.duration_seconds || 0), 0);
        setStats({ total, video, text, totalSeconds });
      });
  }, [userId]);

  if (!stats || stats.total === 0) return null;

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} mb={2.5} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AccessTimeIcon fontSize="small" /> Chat Stats
        </Typography>
        <Grid container spacing={2} mb={2}>
          {[
            { icon: <ChatIcon sx={{ fontSize: 18 }} />, label: "Total Chats", value: stats.total, color: "primary.main" },
            { icon: <VideocamIcon sx={{ fontSize: 18 }} />, label: "Video Chats", value: stats.video, color: "#6C63FF" },
            { icon: <ChatIcon sx={{ fontSize: 18 }} />, label: "Text Chats", value: stats.text, color: "#FF6584" },
            { icon: <AccessTimeIcon sx={{ fontSize: 18 }} />, label: "Total Time", value: fmtTime(stats.totalSeconds), color: "success.main" },
          ].map(({ icon, label, value, color }) => (
            <Grid item xs={6} key={label}>
              <Box sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 2, border: "1px solid rgba(255,255,255,0.06)" }}>
                <Stack direction="row" spacing={0.75} alignItems="center" mb={0.5}>
                  <Box sx={{ color }}>{icon}</Box>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                </Stack>
                <Typography fontWeight={700} fontSize={20}>{value}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
        {stats.total > 0 && (
          <Box>
            <Stack direction="row" justifyContent="space-between" mb={0.5}>
              <Typography variant="caption" color="text.secondary">Video vs Text split</Typography>
              <Typography variant="caption" color="text.disabled">{stats.video} / {stats.text}</Typography>
            </Stack>
            <LinearProgress variant="determinate"
              value={stats.total > 0 ? (stats.video / stats.total) * 100 : 0}
              sx={{
                height: 6, borderRadius: 3, bgcolor: "rgba(255,101,132,0.2)",
                "& .MuiLinearProgress-bar": { bgcolor: "#6C63FF", borderRadius: 3 },
              }}
            />
            <Stack direction="row" justifyContent="space-between" mt={0.5}>
              <Typography variant="caption" sx={{ color: "#6C63FF" }}>● Video</Typography>
              <Typography variant="caption" sx={{ color: "#FF6584" }}>● Text</Typography>
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ── TOTP Setup component ───────────────────────────────────────
function TotpSetup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"qr" | "verify">("qr");
  const [enrollData, setEnrollData] = useState<{ factorId: string; qrCode: string; secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp" });
        if (err) throw err;
        if (data?.totp) {
          setEnrollData({
            factorId: data.id,
            qrCode: data.totp.qr_code,
            secret: data.totp.secret,
            uri: data.totp.uri,
          });
        }
      } catch (e: any) {
        setError(e.message || "Failed to start 2FA setup");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleVerify = async () => {
    if (!enrollData || code.length < 6) return;
    setLoading(true); setError("");
    try {
      const { error: err } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollData.factorId,
        code,
      });
      if (err) throw err;
      onDone();
    } catch (e: any) {
      setError(e.message || "Invalid code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyUri = () => {
    if (enrollData?.uri) {
      navigator.clipboard.writeText(enrollData.uri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading && !enrollData) return <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {step === "qr" && enrollData && (
        <>
          <Typography variant="body2" color="text.secondary" mb={3} lineHeight={1.7}>
            Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc.).
            Then click <b>Next</b> to verify.
          </Typography>
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Box
              component="img"
              src={enrollData.qrCode}
              alt="TOTP QR Code"
              sx={{ width: 200, height: 200, borderRadius: "12px", background: "#fff", p: 1 }}
            />
          </Box>
          <Box sx={{ p: 2, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 2, mb: 2 }}>
            <Typography variant="caption" color="text.disabled" display="block" mb={0.5}>
              Can&apos;t scan? Use this secret key:
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: "break-all", flex: 1 }}>
                {enrollData.secret}
              </Typography>
              <Tooltip title={copied ? "Copied!" : "Copy URI"}>
                <IconButton size="small" onClick={copyUri}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
          <Button fullWidth variant="contained" onClick={() => setStep("verify")} sx={{ borderRadius: 2 }}>
            Next — Enter Code
          </Button>
        </>
      )}
      {step === "verify" && (
        <>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Enter the 6-digit code from your authenticator app to confirm setup.
          </Typography>
          <Box sx={{ textAlign: "center" }}>
            <OtpInput value={code} onChange={setCode} disabled={loading} />
          </Box>
          <Button fullWidth variant="contained" sx={{ mt: 3, borderRadius: 2 }}
            onClick={handleVerify} disabled={code.length < 6 || loading}>
            {loading ? <CircularProgress size={22} color="inherit" /> : "Enable 2FA"}
          </Button>
          <Button fullWidth variant="text" sx={{ mt: 1 }} onClick={() => setStep("qr")}>Back</Button>
        </>
      )}
    </Box>
  );
}

// ── main component ─────────────────────────────────────────────
export default function Profile() {
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { sendOtp, verifyOtp, sending, verifying, error: otpError, countdown } = useOtp();

  const [tab, setTab] = useState(0);
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // Password change
  const [pwOtp, setPwOtp] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwStep, setPwStep] = useState(0);
  const [showNewPw, setShowNewPw] = useState(false);

  // Delete account
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deleteStep, setDeleteStep] = useState(0);

  // Security / 2FA
  const [totpFactors, setTotpFactors] = useState<any[]>([]);
  const [totpSetupOpen, setTotpSetupOpen] = useState(false);
  const [totpUnenrolling, setTotpUnenrolling] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ lastSignIn: string; provider: string } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) router.push("/auth/login?next=/profile");
  }, [user]);

  useEffect(() => {
    if (profile) { setDisplayName(profile.display_name || ""); setBio(profile.bio || ""); }
  }, [profile]);

  // Load MFA factors + session info when Security tab opens
  useEffect(() => {
    if (tab !== 3 || !user) return;
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      setTotpFactors(data?.totp || []);
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) {
        setSessionInfo({
          lastSignIn: u.last_sign_in_at || "",
          provider: u.app_metadata?.provider || "email",
        });
      }
    })();
  }, [tab, user]);

  const showMsg = (type: string, text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: "", text: "" }), 4000);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName, bio }).eq("id", user!.id);
    setSaving(false);
    if (error) showMsg("error", error.message);
    else { await refreshProfile(); showMsg("success", "Profile updated!"); }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return showMsg("error", "Image must be under 2MB");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", user!.id);
    try {
      const { data } = await axios.post("/api/upload-avatar", formData);
      await supabase.from("profiles").update({ avatar_url: data.url }).eq("id", user!.id);
      await refreshProfile();
      showMsg("success", "Avatar updated!");
    } catch {
      showMsg("error", "Failed to upload avatar");
    }
  };

  const handleChangePassword = async () => {
    if (pwStep === 0) { const ok = await sendOtp(user!.email!, "reset"); if (ok) setPwStep(1); return; }
    if (pwStep === 1) { const ok = await verifyOtp(user!.email!, pwOtp, "reset"); if (ok) setPwStep(2); return; }
    if (newPw !== confirmPw) return showMsg("error", "Passwords do not match");
    if (newPw.length < 8) return showMsg("error", "Min 8 characters");
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) showMsg("error", error.message);
    else { showMsg("success", "Password changed!"); setPwStep(0); setNewPw(""); setConfirmPw(""); setPwOtp(""); }
  };

  const handleDeleteAccount = async () => {
    if (deleteStep === 0) { const ok = await sendOtp(user!.email!, "delete"); if (ok) setDeleteStep(1); return; }
    const ok = await verifyOtp(user!.email!, deleteOtp, "delete");
    if (!ok) return;
    await supabase.from("profiles").delete().eq("id", user!.id);
    await supabase.auth.admin?.deleteUser(user!.id);
    await signOut();
    router.push("/");
  };

  const handleUnenrollTotp = async (factorId: string) => {
    setTotpUnenrolling(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) showMsg("error", error.message);
    else {
      setTotpFactors((prev) => prev.filter((f) => f.id !== factorId));
      showMsg("success", "2FA removed");
    }
    setTotpUnenrolling(false);
  };

  if (!user) return null;

  const hasAvatar = !!(profile?.avatar_url);
  const enrolledTotp = totpFactors.filter((f) => f.status === "verified");

  return (
    <Layout title="My Profile">
      <SeoHead title="My Profile" description="Manage your MiloBolo profile, avatar, and account settings." path="/profile" noIndex />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {msg.text && <Alert severity={msg.type as any} sx={{ mb: 3 }}>{msg.text}</Alert>}
        {otpError && <Alert severity="error" sx={{ mb: 3 }}>{otpError}</Alert>}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }} variant="scrollable" scrollButtons="auto">
          <Tab icon={<PersonIcon fontSize="small" />} label="Profile" iconPosition="start" />
          <Tab icon={<LockIcon fontSize="small" />} label="Password" iconPosition="start" />
          <Tab icon={<ShieldIcon fontSize="small" />} label="Security & 2FA" iconPosition="start" />
          <Tab icon={<DeleteForeverIcon fontSize="small" />} label="Danger Zone" iconPosition="start" />
        </Tabs>

        {/* ── Profile tab ── */}
        {tab === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent sx={{ textAlign: "center", p: 4 }}>
                  <Box sx={{ position: "relative", display: "inline-block", mb: 2 }}>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                      badgeContent={
                        <Tooltip title="Change photo">
                          <IconButton onClick={() => fileRef.current?.click()}
                            size="small"
                            sx={{ bgcolor: "primary.main", "&:hover": { bgcolor: "primary.dark" }, width: 30, height: 30 }}>
                            <CameraAltIcon sx={{ fontSize: 15 }} />
                          </IconButton>
                        </Tooltip>
                      }
                    >
                      <Avatar src={profile?.avatar_url || undefined}
                        sx={{ width: 100, height: 100, fontSize: 40, bgcolor: "primary.main" }}>
                        {profile?.display_name?.[0]?.toUpperCase()}
                      </Avatar>
                    </Badge>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
                  </Box>
                  <Typography variant="h6" fontWeight={600}>{profile?.display_name}</Typography>
                  <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                  <Stack direction="row" spacing={0.5} justifyContent="center" mt={1} flexWrap="wrap">
                    <Chip label={profile?.role || "user"} size="small" color="primary" />
                    {profile?.is_verified && <Chip label="Verified" size="small" color="success" />}
                    {enrolledTotp.length > 0 && (
                      <Chip icon={<ShieldIcon />} label="2FA On" size="small" color="success" variant="outlined"
                        sx={{ "& .MuiChip-icon": { fontSize: 14 } }} />
                    )}
                  </Stack>
                  <Typography variant="caption" display="block" color="text.secondary" mt={2}>
                    {profile?.total_chats || 0} chats • Joined {new Date(profile?.created_at || "").toLocaleDateString("en-IN")}
                  </Typography>
                </CardContent>
              </Card>
              <ProfileCompletion profile={profile} hasAvatar={hasAvatar} />
            </Grid>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" fontWeight={600} mb={3}>Edit Profile</Typography>
                  <TextField fullWidth label="Display Name" value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)} sx={{ mb: 3 }}
                    inputProps={{ maxLength: 50 }}
                    InputProps={{ sx: { borderRadius: 2 } }} />
                  <TextField fullWidth multiline rows={3} label="Bio" value={bio}
                    onChange={(e) => setBio(e.target.value)} sx={{ mb: 3 }}
                    inputProps={{ maxLength: 300 }}
                    helperText={`${bio.length}/300`}
                    InputProps={{ sx: { borderRadius: 2 } }} />
                  <Button variant="contained" onClick={handleSaveProfile} disabled={saving} sx={{ borderRadius: 2 }}>
                    {saving ? <CircularProgress size={20} color="inherit" /> : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>
              <ChatStatsCard userId={user.id} />
            </Grid>
          </Grid>
        )}

        {/* ── Password tab ── */}
        {tab === 1 && (
          <Card sx={{ maxWidth: 480 }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" fontWeight={600} mb={0.5} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <LockIcon fontSize="small" /> Change Password
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                We&apos;ll send an OTP to {user.email} to confirm.
              </Typography>
              {pwStep === 0 && (
                <Button variant="contained" fullWidth onClick={handleChangePassword} disabled={sending}
                  sx={{ py: 1.3, borderRadius: 2 }}>
                  {sending ? <CircularProgress size={20} color="inherit" /> : "Send OTP to Email"}
                </Button>
              )}
              {pwStep === 1 && (
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary" mb={2}>Enter the 6-digit OTP</Typography>
                  <OtpInput value={pwOtp} onChange={setPwOtp} disabled={verifying} />
                  <Button fullWidth variant="contained" sx={{ mt: 3, borderRadius: 2 }}
                    onClick={handleChangePassword} disabled={pwOtp.length < 6 || verifying}>
                    {verifying ? <CircularProgress size={20} color="inherit" /> : "Verify"}
                  </Button>
                  <Button fullWidth variant="text" sx={{ mt: 1 }} disabled={countdown > 0 || sending}
                    onClick={() => sendOtp(user!.email!, "reset")}>
                    {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
                  </Button>
                </Box>
              )}
              {pwStep === 2 && (
                <>
                  <TextField fullWidth type={showNewPw ? "text" : "password"} label="New Password" value={newPw}
                    onChange={(e) => setNewPw(e.target.value)} sx={{ mb: 2 }} helperText="Min 8 characters"
                    InputProps={{
                      sx: { borderRadius: 2 },
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowNewPw(!showNewPw)}>
                            {showNewPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }} />
                  <TextField fullWidth type="password" label="Confirm Password" value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)} sx={{ mb: 3 }}
                    InputProps={{ sx: { borderRadius: 2 } }} />
                  <Button fullWidth variant="contained" onClick={handleChangePassword}
                    sx={{ py: 1.3, borderRadius: 2 }} disabled={!newPw || newPw !== confirmPw}>
                    Update Password
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Security & 2FA tab ── */}
        {tab === 2 && (
          <Grid container spacing={3}>
            {/* TOTP 2FA card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 4 }}>
                  <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                    <Box sx={{
                      width: 44, height: 44, borderRadius: 2,
                      bgcolor: enrolledTotp.length > 0 ? "rgba(76,175,80,0.12)" : "rgba(108,99,255,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <QrCode2Icon sx={{ color: enrolledTotp.length > 0 ? "success.main" : "primary.main" }} />
                    </Box>
                    <Box>
                      <Typography fontWeight={700}>Authenticator App (TOTP)</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {enrolledTotp.length > 0 ? "2FA is enabled" : "Use an app like Google Authenticator or Authy"}
                      </Typography>
                    </Box>
                    {enrolledTotp.length > 0 && (
                      <Chip label="Active" color="success" size="small" sx={{ ml: "auto" }} />
                    )}
                  </Stack>
                  <Divider sx={{ mb: 2.5, opacity: 0.08 }} />
                  {enrolledTotp.length > 0 ? (
                    <>
                      {enrolledTotp.map((f) => (
                        <Box key={f.id} sx={{ mb: 2 }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{f.friendly_name || "Authenticator"}</Typography>
                              <Typography variant="caption" color="text.disabled">
                                Added {new Date(f.created_at).toLocaleDateString("en-IN")}
                              </Typography>
                            </Box>
                            <Button variant="outlined" color="error" size="small" sx={{ borderRadius: 1.5 }}
                              disabled={totpUnenrolling} onClick={() => handleUnenrollTotp(f.id)}>
                              Remove
                            </Button>
                          </Stack>
                        </Box>
                      ))}
                      <Alert severity="success" sx={{ mt: 1 }}>
                        Your account is protected with two-factor authentication.
                      </Alert>
                    </>
                  ) : (
                    <>
                      <Typography variant="body2" color="text.secondary" mb={3} lineHeight={1.7}>
                        Adding a second factor makes your account significantly more secure.
                        Even if someone gets your password, they can&apos;t sign in without your phone.
                      </Typography>
                      <Button variant="contained" startIcon={<ShieldIcon />} onClick={() => setTotpSetupOpen(true)}
                        sx={{ borderRadius: 2 }}>
                        Set Up 2FA
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Session & account info */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 4 }}>
                  <Stack direction="row" alignItems="center" spacing={1.5} mb={2}>
                    <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <DevicesIcon sx={{ color: "text.secondary" }} />
                    </Box>
                    <Box>
                      <Typography fontWeight={700}>Account Info</Typography>
                      <Typography variant="caption" color="text.secondary">Current session &amp; sign-in method</Typography>
                    </Box>
                  </Stack>
                  <Divider sx={{ mb: 2.5, opacity: 0.08 }} />
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" color="text.disabled" display="block" mb={0.25}>Email</Typography>
                      <Typography variant="body2" fontWeight={600}>{user.email}</Typography>
                    </Box>
                    {sessionInfo && (
                      <>
                        <Box>
                          <Typography variant="caption" color="text.disabled" display="block" mb={0.25}>Sign-in method</Typography>
                          <Chip
                            label={sessionInfo.provider === "google" ? "Google" : "Email / Password"}
                            size="small"
                            color="default"
                            variant="outlined"
                          />
                        </Box>
                        {sessionInfo.lastSignIn && (
                          <Box>
                            <Typography variant="caption" color="text.disabled" display="block" mb={0.25}>Last sign-in</Typography>
                            <Typography variant="body2">
                              {new Date(sessionInfo.lastSignIn).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                            </Typography>
                          </Box>
                        )}
                      </>
                    )}
                    <Box>
                      <Typography variant="caption" color="text.disabled" display="block" mb={0.25}>Current browser</Typography>
                      <Typography variant="body2" color="text.secondary" fontSize={12} sx={{ wordBreak: "break-all" }}>
                        {typeof navigator !== "undefined" ? navigator.userAgent.split(")")[0].split("(")[1] : "—"}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.disabled" display="block" mb={0.25}>User ID</Typography>
                      <Typography variant="body2" fontFamily="monospace" fontSize={12} color="text.secondary">
                        {user.id}
                      </Typography>
                    </Box>
                  </Stack>
                  <Divider sx={{ my: 2.5, opacity: 0.08 }} />
                  <Button variant="outlined" color="error" size="small" onClick={signOut} sx={{ borderRadius: 1.5 }}>
                    Sign out of this device
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* ── Danger Zone tab ── */}
        {tab === 3 && (
          <Card sx={{ maxWidth: 480, border: "1px solid", borderColor: "error.dark" }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" fontWeight={600} color="error" mb={0.5}
                sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <DeleteForeverIcon /> Delete Account
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                This is permanent and cannot be undone. All your data — chats, profile, friends — will be erased.
              </Typography>
              <Button variant="outlined" color="error" fullWidth onClick={() => setDeleteDialog(true)}
                sx={{ py: 1.3, borderRadius: 2 }}>
                Delete My Account
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── TOTP Setup Dialog ── */}
        <Dialog open={totpSetupOpen} onClose={() => setTotpSetupOpen(false)} maxWidth="xs" fullWidth
          PaperProps={{ sx: { bgcolor: "background.paper", borderRadius: 3 } }}>
          <DialogTitle sx={{ pb: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ShieldIcon color="primary" />
              <Typography fontWeight={700}>Set Up Two-Factor Authentication</Typography>
            </Stack>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ pt: 2.5 }}>
            <TotpSetup onDone={() => {
              setTotpSetupOpen(false);
              showMsg("success", "2FA enabled! Your account is now protected.");
              // Reload factors
              supabase.auth.mfa.listFactors().then(({ data }) => setTotpFactors(data?.totp || []));
            }} />
          </DialogContent>
        </Dialog>

        {/* ── Delete Dialog ── */}
        <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="xs" fullWidth
          PaperProps={{ sx: { bgcolor: "background.paper" } }}>
          <DialogTitle>Confirm Account Deletion</DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mb: 2 }}>This action cannot be undone.</Alert>
            {otpError && <Alert severity="error" sx={{ mb: 2 }}>{otpError}</Alert>}
            {deleteStep === 0 && (
              <Typography variant="body2">We&apos;ll send an OTP to <b>{user.email}</b> to confirm deletion.</Typography>
            )}
            {deleteStep === 1 && (
              <Box sx={{ textAlign: "center", mt: 1 }}>
                <Typography variant="body2" color="text.secondary" mb={2}>Enter OTP sent to {user.email}</Typography>
                <OtpInput value={deleteOtp} onChange={setDeleteOtp} />
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setDeleteDialog(false); setDeleteStep(0); setDeleteOtp(""); }}>Cancel</Button>
            <Button color="error" variant="contained" onClick={handleDeleteAccount}
              disabled={deleteStep === 1 && deleteOtp.length < 6}>
              {deleteStep === 0 ? "Send OTP" : "Confirm Delete"}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
}

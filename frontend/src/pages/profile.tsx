import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Grid, Card, CardContent, Typography, TextField, Button,
  Avatar, Alert, CircularProgress, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, Tab, Tabs, Chip, IconButton, Tooltip,
  LinearProgress, Stack,
} from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import LockIcon from "@mui/icons-material/Lock";
import ChatIcon from "@mui/icons-material/Chat";
import VideocamIcon from "@mui/icons-material/Videocam";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import Layout from "@/components/Layout";
import OtpInput from "@/components/auth/OtpInput";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useOtp } from "@/hooks/useOtp";
import axios from "axios";

function fmtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ChatStatsCard({ userId }: { userId: string }) {
  const [stats, setStats] = useState<{
    total: number; video: number; text: number;
    totalSeconds: number; avgSeconds: number;
  } | null>(null);

  useEffect(() => {
    supabase
      .from("chat_history")
      .select("mode, duration_seconds")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (!data) return;
        const total = data.length;
        const video = data.filter((r) => r.mode === "video").length;
        const text = data.filter((r) => r.mode === "text").length;
        const totalSeconds = data.reduce((a, r) => a + (r.duration_seconds || 0), 0);
        setStats({ total, video, text, totalSeconds, avgSeconds: total ? Math.round(totalSeconds / total) : 0 });
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
            <LinearProgress
              variant="determinate"
              value={stats.total > 0 ? (stats.video / stats.total) * 100 : 0}
              sx={{
                height: 6, borderRadius: 3, bgcolor: "rgba(255,101,132,0.2)",
                "& .MuiLinearProgress-bar": { bgcolor: "#6C63FF", borderRadius: 3 },
              }}
            />
            <Stack direction="row" justifyContent="space-between" mt={0.5}>
              <Typography variant="caption" color="text.disabled" sx={{ color: "#6C63FF" }}>● Video</Typography>
              <Typography variant="caption" color="text.disabled" sx={{ color: "#FF6584" }}>● Text</Typography>
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  const router = useRouter();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { sendOtp, verifyOtp, sending, verifying, error: otpError, countdown } = useOtp();

  const [tab, setTab] = useState(0);
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  // Change password
  const [pwOtp, setPwOtp] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwStep, setPwStep] = useState(0);

  // Delete account
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deleteStep, setDeleteStep] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) router.push("/auth/login?next=/profile");
  }, [user]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
    }
  }, [profile]);

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
    if (pwStep === 0) {
      const ok = await sendOtp(user!.email!, "reset");
      if (ok) setPwStep(1);
      return;
    }
    if (pwStep === 1) {
      const ok = await verifyOtp(user!.email!, pwOtp, "reset");
      if (ok) setPwStep(2);
      return;
    }
    if (newPw !== confirmPw) return showMsg("error", "Passwords do not match");
    if (newPw.length < 8) return showMsg("error", "Min 8 characters");
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) showMsg("error", error.message);
    else { showMsg("success", "Password changed!"); setPwStep(0); setNewPw(""); setConfirmPw(""); setPwOtp(""); }
  };

  const handleDeleteAccount = async () => {
    if (deleteStep === 0) {
      const ok = await sendOtp(user!.email!, "delete");
      if (ok) setDeleteStep(1);
      return;
    }
    const ok = await verifyOtp(user!.email!, deleteOtp, "delete");
    if (!ok) return;
    await supabase.from("profiles").delete().eq("id", user!.id);
    await supabase.auth.admin?.deleteUser(user!.id);
    await signOut();
    router.push("/");
  };

  if (!user) return null;

  return (
    <Layout title="My Profile">
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {msg.text && <Alert severity={msg.type as any} sx={{ mb: 3 }}>{msg.text}</Alert>}
        {otpError && <Alert severity="error" sx={{ mb: 3 }}>{otpError}</Alert>}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label="Profile" />
          <Tab label="Change Password" />
          <Tab label="Danger Zone" />
        </Tabs>

        {tab === 0 && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent sx={{ textAlign: "center", p: 4 }}>
                  <Box sx={{ position: "relative", display: "inline-block", mb: 2 }}>
                    <Avatar src={profile?.avatar_url || undefined}
                      sx={{ width: 100, height: 100, fontSize: 40, bgcolor: "primary.main", mx: "auto" }}>
                      {profile?.display_name?.[0]?.toUpperCase()}
                    </Avatar>
                    <Tooltip title="Change photo">
                      <IconButton onClick={() => fileRef.current?.click()}
                        sx={{ position: "absolute", bottom: 0, right: 0, bgcolor: "primary.main",
                          "&:hover": { bgcolor: "primary.dark" }, width: 32, height: 32 }}>
                        <CameraAltIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
                  </Box>
                  <Typography variant="h6" fontWeight={600}>{profile?.display_name}</Typography>
                  <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                  <Chip label={profile?.role || "user"} size="small" color="primary" sx={{ mt: 1 }} />
                  {profile?.is_verified && <Chip label="Verified" size="small" color="success" sx={{ mt: 1, ml: 1 }} />}
                  <Typography variant="caption" display="block" color="text.secondary" mt={2}>
                    {profile?.total_chats || 0} chats • Joined {new Date(profile?.created_at || "").toLocaleDateString("en-IN")}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" fontWeight={600} mb={3}>Edit Profile</Typography>
                  <TextField fullWidth label="Display Name" value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)} sx={{ mb: 3 }} inputProps={{ maxLength: 50 }} />
                  <TextField fullWidth multiline rows={3} label="Bio" value={bio}
                    onChange={(e) => setBio(e.target.value)} sx={{ mb: 3 }}
                    inputProps={{ maxLength: 300 }}
                    helperText={`${bio.length}/300`} />
                  <Button variant="contained" onClick={handleSaveProfile} disabled={saving}>
                    {saving ? <CircularProgress size={20} color="inherit" /> : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>

              {/* Chat Stats */}
              <ChatStatsCard userId={user.id} />
            </Grid>
          </Grid>
        )}

        {tab === 1 && (
          <Card sx={{ maxWidth: 480 }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" fontWeight={600} mb={1}><LockIcon sx={{ mr: 1, verticalAlign: "middle" }} />Change Password</Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>We'll send an OTP to {user.email} to confirm.</Typography>
              {pwStep === 0 && (
                <Button variant="contained" fullWidth onClick={handleChangePassword} disabled={sending} sx={{ py: 1.3 }}>
                  {sending ? <CircularProgress size={20} color="inherit" /> : "Send OTP to Email"}
                </Button>
              )}
              {pwStep === 1 && (
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary" mb={2}>Enter the 6-digit OTP</Typography>
                  <OtpInput value={pwOtp} onChange={setPwOtp} disabled={verifying} />
                  <Button fullWidth variant="contained" sx={{ mt: 3 }} onClick={handleChangePassword}
                    disabled={pwOtp.length < 6 || verifying}>
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
                  <TextField fullWidth type="password" label="New Password" value={newPw}
                    onChange={(e) => setNewPw(e.target.value)} sx={{ mb: 2 }} helperText="Min 8 characters" />
                  <TextField fullWidth type="password" label="Confirm Password" value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)} sx={{ mb: 3 }} />
                  <Button fullWidth variant="contained" onClick={handleChangePassword} sx={{ py: 1.3 }}>
                    Update Password
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {tab === 2 && (
          <Card sx={{ maxWidth: 480, border: "1px solid", borderColor: "error.main" }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" fontWeight={600} color="error" mb={1}>
                <DeleteForeverIcon sx={{ mr: 1, verticalAlign: "middle" }} />Delete Account
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={3}>
                This is permanent. All your data will be deleted and cannot be recovered.
              </Typography>
              <Button variant="outlined" color="error" fullWidth onClick={() => setDeleteDialog(true)} sx={{ py: 1.3 }}>
                Delete My Account
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Delete Dialog */}
        <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} maxWidth="xs" fullWidth
          PaperProps={{ sx: { bgcolor: "background.paper" } }}>
          <DialogTitle>Confirm Account Deletion</DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mb: 2 }}>This action cannot be undone.</Alert>
            {otpError && <Alert severity="error" sx={{ mb: 2 }}>{otpError}</Alert>}
            {deleteStep === 0 && (
              <Typography variant="body2">We'll send an OTP to <b>{user.email}</b> to confirm deletion.</Typography>
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

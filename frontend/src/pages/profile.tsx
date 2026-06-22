import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Grid, Card, CardContent, Typography, TextField, Button,
  Avatar, Alert, CircularProgress, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, Tab, Tabs, Chip, IconButton, Tooltip,
} from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import LockIcon from "@mui/icons-material/Lock";
import Layout from "@/components/Layout";
import OtpInput from "@/components/auth/OtpInput";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useOtp } from "@/hooks/useOtp";
import axios from "axios";

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

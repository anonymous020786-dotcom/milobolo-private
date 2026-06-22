import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Grid, Card, CardContent, Typography, Tab, Tabs,
  Switch, FormControlLabel, Alert, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, CircularProgress, Tooltip, Divider, Stack,
} from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import PeopleIcon from "@mui/icons-material/People";
import FlagIcon from "@mui/icons-material/Flag";
import SettingsIcon from "@mui/icons-material/Settings";
import BarChartIcon from "@mui/icons-material/BarChart";
import Layout from "@/components/Layout";
import { supabase, Profile, FeatureFlag } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export default function AdminPanel() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const [tab, setTab] = useState(0);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [banDialog, setBanDialog] = useState<{ open: boolean; user: Profile | null }>({ open: false, user: null });
  const [banReason, setBanReason] = useState("");

  useEffect(() => {
    if (!authLoading && (!profile || !["admin", "superadmin"].includes(profile.role))) {
      router.push("/");
    }
  }, [profile, authLoading]);

  const showMsg = (type: string, text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: "", text: "" }), 4000);
  };

  const loadFlags = async () => {
    const { data } = await supabase.from("feature_flags").select("*").order("key");
    if (data) setFlags(data);
  };

  const loadUsers = async () => {
    setLoadingData(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) setUsers(data);
    setLoadingData(false);
  };

  const loadReports = async () => {
    setLoadingData(true);
    const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100);
    if (data) setReports(data);
    setLoadingData(false);
  };

  const loadStats = async () => {
    const [usersCount, reportsCount] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact" }),
      supabase.from("reports").select("id", { count: "exact" }).eq("status", "pending"),
    ]);
    setStats({
      totalUsers: usersCount.count || 0,
      pendingReports: reportsCount.count || 0,
    });
  };

  useEffect(() => {
    if (profile && ["admin", "superadmin"].includes(profile.role)) {
      loadFlags();
      loadStats();
    }
  }, [profile]);

  useEffect(() => {
    if (tab === 1) loadUsers();
    if (tab === 2) loadReports();
  }, [tab]);

  const toggleFlag = async (key: string, enabled: boolean) => {
    await supabase.from("feature_flags").update({ enabled, updated_by: profile?.id }).eq("key", key);
    setFlags((prev) => prev.map((f) => f.key === key ? { ...f, enabled } : f));
    showMsg("success", `${key} ${enabled ? "enabled" : "disabled"}`);
  };

  const banUser = async () => {
    if (!banDialog.user) return;
    const { error } = await supabase.from("profiles").update({ is_banned: true, ban_reason: banReason }).eq("id", banDialog.user.id);
    if (!error) {
      setUsers((prev) => prev.map((u) => u.id === banDialog.user!.id ? { ...u, is_banned: true } : u));
      showMsg("success", `User banned`);
    }
    setBanDialog({ open: false, user: null });
    setBanReason("");
  };

  const unbanUser = async (userId: string) => {
    await supabase.from("profiles").update({ is_banned: false, ban_reason: null }).eq("id", userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_banned: false } : u));
    showMsg("success", "User unbanned");
  };

  const updateReportStatus = async (id: string, status: string) => {
    await supabase.from("reports").update({ status, reviewed_by: profile?.id }).eq("id", id);
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  };

  const changeUserRole = async (userId: string, role: string) => {
    if (profile?.role !== "superadmin") return showMsg("error", "Only superadmin can change roles");
    await supabase.from("profiles").update({ role }).eq("id", userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: role as "user" | "moderator" | "admin" | "superadmin" } : u));
    showMsg("success", "Role updated");
  };

  if (authLoading) return null;
  if (!profile || !["admin", "superadmin"].includes(profile.role)) return null;

  return (
    <Layout title="Admin Panel">
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 4, gap: 2 }}>
          <Typography variant="h4" fontWeight={800}>Admin Panel</Typography>
          <Chip label={profile.role.toUpperCase()} color="primary" />
        </Box>

        {msg.text && <Alert severity={msg.type as any} sx={{ mb: 3 }}>{msg.text}</Alert>}

        {/* Stats */}
        {stats && (
          <Grid container spacing={2} sx={{ mb: 4 }}>
            {[
              { label: "Total Users", value: stats.totalUsers, color: "primary.main", icon: <PeopleIcon /> },
              { label: "Pending Reports", value: stats.pendingReports, color: "warning.main", icon: <FlagIcon /> },
            ].map((s) => (
              <Grid item xs={6} md={3} key={s.label}>
                <Card>
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ color: s.color }}>{s.icon}</Box>
                    <Box>
                      <Typography variant="h5" fontWeight={700}>{s.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab icon={<SettingsIcon />} label="Feature Flags" iconPosition="start" />
          <Tab icon={<PeopleIcon />} label="Users" iconPosition="start" />
          <Tab icon={<FlagIcon />} label="Reports" iconPosition="start" />
        </Tabs>

        {/* Feature Flags */}
        {tab === 0 && (
          <Grid container spacing={2}>
            {flags.map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f.key}>
                <Card>
                  <CardContent sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box>
                      <Typography fontWeight={600}>{f.label}</Typography>
                      <Typography variant="caption" color="text.secondary">{f.description}</Typography>
                    </Box>
                    <Switch
                      checked={f.enabled}
                      onChange={(e) => toggleFlag(f.key, e.target.checked)}
                      color="primary"
                      disabled={profile.role !== "superadmin" && ["registration", "google_auth", "email_auth"].includes(f.key)}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Users */}
        {tab === 1 && (
          <Box>
            <Stack direction="row" justifyContent="flex-end" mb={2}>
              <IconButton onClick={loadUsers}><RefreshIcon /></IconButton>
            </Stack>
            {loadingData ? <CircularProgress /> : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Joined</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id} hover>
                        <TableCell>{u.display_name || "—"}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{u.id.slice(0, 8)}...</TableCell>
                        <TableCell>
                          {profile.role === "superadmin" ? (
                            <Select size="small" value={u.role} onChange={(e) => changeUserRole(u.id, e.target.value)}
                              sx={{ fontSize: 12 }}>
                              {["user","moderator","admin","superadmin"].map((r) => (
                                <MenuItem key={r} value={r}>{r}</MenuItem>
                              ))}
                            </Select>
                          ) : (
                            <Chip label={u.role} size="small" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip label={u.is_banned ? "Banned" : "Active"}
                            color={u.is_banned ? "error" : "success"} size="small" />
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>
                          {new Date(u.created_at).toLocaleDateString("en-IN")}
                        </TableCell>
                        <TableCell>
                          {u.is_banned ? (
                            <Tooltip title="Unban">
                              <IconButton size="small" color="success" onClick={() => unbanUser(u.id)}>
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Ban">
                              <IconButton size="small" color="error"
                                onClick={() => setBanDialog({ open: true, user: u })}>
                                <BlockIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Reports */}
        {tab === 2 && (
          <Box>
            <Stack direction="row" justifyContent="flex-end" mb={2}>
              <IconButton onClick={loadReports}><RefreshIcon /></IconButton>
            </Stack>
            {loadingData ? <CircularProgress /> : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Reason</TableCell>
                      <TableCell>Room</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {reports.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell>{r.reason}</TableCell>
                        <TableCell sx={{ fontSize: 11 }}>{r.room_id?.slice(0, 8) || "—"}</TableCell>
                        <TableCell>
                          <Chip label={r.status} size="small"
                            color={r.status === "pending" ? "warning" : r.status === "actioned" ? "error" : "default"} />
                        </TableCell>
                        <TableCell sx={{ fontSize: 12 }}>
                          {new Date(r.created_at).toLocaleDateString("en-IN")}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            <Button size="small" onClick={() => updateReportStatus(r.id, "actioned")}
                              disabled={r.status !== "pending"} color="error">Action</Button>
                            <Button size="small" onClick={() => updateReportStatus(r.id, "dismissed")}
                              disabled={r.status !== "pending"}>Dismiss</Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}
      </Container>

      <Dialog open={banDialog.open} onClose={() => setBanDialog({ open: false, user: null })} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "background.paper" } }}>
        <DialogTitle>Ban User: {banDialog.user?.display_name}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Reason" multiline rows={2} value={banReason}
            onChange={(e) => setBanReason(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBanDialog({ open: false, user: null })}>Cancel</Button>
          <Button variant="contained" color="error" onClick={banUser}>Ban User</Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}

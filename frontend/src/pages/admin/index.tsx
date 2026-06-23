import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Grid, Card, CardContent, Typography, Tab, Tabs,
  Switch, Alert, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Button, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, CircularProgress, Tooltip, Divider, Stack,
  InputAdornment, LinearProgress,
} from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RefreshIcon from "@mui/icons-material/Refresh";
import PeopleIcon from "@mui/icons-material/People";
import FlagIcon from "@mui/icons-material/Flag";
import SettingsIcon from "@mui/icons-material/Settings";
import BarChartIcon from "@mui/icons-material/BarChart";
import SearchIcon from "@mui/icons-material/Search";
import ChatBubbleIcon from "@mui/icons-material/ChatBubble";
import VideocamIcon from "@mui/icons-material/Videocam";
import Layout from "@/components/Layout";
import { supabase, Profile, FeatureFlag } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface StatsData {
  totalUsers: number;
  bannedUsers: number;
  pendingReports: number;
  totalReports: number;
  actionedReports: number;
  dismissedReports: number;
  enabledFlags: number;
  totalFlags: number;
}

export default function AdminPanel() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const [tab, setTab] = useState(0);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [banDialog, setBanDialog] = useState<{ open: boolean; user: Profile | null }>({ open: false, user: null });
  const [banReason, setBanReason] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [chatLogs, setChatLogs] = useState<any[]>([]);
  const [chatLogSearch, setChatLogSearch] = useState("");

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
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
    if (data) setUsers(data);
    setLoadingData(false);
  };

  const loadReports = async () => {
    setLoadingData(true);
    const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(200);
    if (data) setReports(data);
    setLoadingData(false);
  };

  const loadStats = async () => {
    const [
      usersRes, bannedRes, pendingReportsRes, totalReportsRes,
      actionedRes, dismissedRes, flagsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_banned", true),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("reports").select("id", { count: "exact", head: true }),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "actioned"),
      supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "dismissed"),
      supabase.from("feature_flags").select("id, enabled"),
    ]);
    setStats({
      totalUsers: usersRes.count || 0,
      bannedUsers: bannedRes.count || 0,
      pendingReports: pendingReportsRes.count || 0,
      totalReports: totalReportsRes.count || 0,
      actionedReports: actionedRes.count || 0,
      dismissedReports: dismissedRes.count || 0,
      enabledFlags: flagsRes.data?.filter((f) => f.enabled).length || 0,
      totalFlags: flagsRes.data?.length || 0,
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
    if (tab === 4) loadChatLogs();
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
      showMsg("success", "User banned");
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

  const loadChatLogs = async () => {
    setLoadingData(true);
    const { data } = await supabase
      .from("chat_history")
      .select("id, user_id, mode, duration_seconds, message_count, matched_interest, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data) setChatLogs(data);
    setLoadingData(false);
  };

  const changeUserRole = async (userId: string, role: string) => {
    if (profile?.role !== "superadmin") return showMsg("error", "Only superadmin can change roles");
    await supabase.from("profiles").update({ role }).eq("id", userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: role as "user" | "moderator" | "admin" | "superadmin" } : u));
    showMsg("success", "Role updated");
  };

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.display_name || "").toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filteredChatLogs = useMemo(() => {
    const q = chatLogSearch.toLowerCase();
    if (!q) return chatLogs;
    return chatLogs.filter((r) =>
      (r.matched_interest || "").toLowerCase().includes(q) ||
      (r.mode || "").toLowerCase().includes(q) ||
      (r.user_id || "").toLowerCase().includes(q)
    );
  }, [chatLogs, chatLogSearch]);

  const filteredReports = useMemo(() => {
    const q = reportSearch.toLowerCase();
    if (!q) return reports;
    return reports.filter((r) =>
      (r.reason || "").toLowerCase().includes(q) ||
      (r.room_id || "").toLowerCase().includes(q) ||
      (r.status || "").toLowerCase().includes(q)
    );
  }, [reports, reportSearch]);

  if (authLoading) return null;
  if (!profile || !["admin", "superadmin"].includes(profile.role)) return null;

  return (
    <Layout title="Admin Panel">
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 4, gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h4" fontWeight={800}>Admin Panel</Typography>
          <Chip label={profile.role.toUpperCase()} color="primary" />
          <Box flex={1} />
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={() => { loadStats(); if (tab === 1) loadUsers(); if (tab === 2) loadReports(); if (tab === 4) loadChatLogs(); }}>
            Refresh
          </Button>
        </Box>

        {msg.text && <Alert severity={msg.type as any} sx={{ mb: 3 }}>{msg.text}</Alert>}

        {/* Stats cards */}
        {stats && (
          <Grid container spacing={2} sx={{ mb: 4 }}>
            {[
              { label: "Total Users", value: stats.totalUsers, color: "primary.main", icon: <PeopleIcon />, sub: `${stats.bannedUsers} banned` },
              { label: "Pending Reports", value: stats.pendingReports, color: "warning.main", icon: <FlagIcon />, sub: `${stats.totalReports} total` },
              { label: "Actioned Reports", value: stats.actionedReports, color: "error.main", icon: <FlagIcon />, sub: `${stats.dismissedReports} dismissed` },
              { label: "Active Features", value: stats.enabledFlags, color: "success.main", icon: <SettingsIcon />, sub: `of ${stats.totalFlags} flags` },
            ].map((s) => (
              <Grid item xs={6} md={3} key={s.label}>
                <Card>
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ color: s.color }}>{s.icon}</Box>
                    <Box>
                      <Typography variant="h5" fontWeight={700}>{s.value}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">{s.label}</Typography>
                      <Typography variant="caption" color="text.disabled">{s.sub}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }} variant="scrollable" scrollButtons="auto">
          <Tab icon={<SettingsIcon />} label="Feature Flags" iconPosition="start" />
          <Tab icon={<PeopleIcon />} label="Users" iconPosition="start" />
          <Tab icon={<FlagIcon />} label="Reports" iconPosition="start" />
          <Tab icon={<BarChartIcon />} label="Stats" iconPosition="start" />
          <Tab icon={<ChatBubbleIcon />} label="Chat Logs" iconPosition="start" />
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
            <Stack direction="row" justifyContent="space-between" mb={2} gap={1} flexWrap="wrap">
              <TextField
                size="small" placeholder="Search by name, ID, or role…"
                value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
                sx={{ minWidth: 260, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <IconButton onClick={loadUsers}><RefreshIcon /></IconButton>
            </Stack>
            {loadingData ? <CircularProgress /> : (
              <>
                <Typography variant="caption" color="text.disabled" mb={1} display="block">
                  {filteredUsers.length} of {users.length} users
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>ID</TableCell>
                        <TableCell>Role</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Joined</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id} hover>
                          <TableCell>{u.display_name || "—"}</TableCell>
                          <TableCell sx={{ fontSize: 11, fontFamily: "monospace" }}>{u.id.slice(0, 12)}…</TableCell>
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
              </>
            )}
          </Box>
        )}

        {/* Reports */}
        {tab === 2 && (
          <Box>
            <Stack direction="row" justifyContent="space-between" mb={2} gap={1} flexWrap="wrap">
              <TextField
                size="small" placeholder="Search by reason, room ID, or status…"
                value={reportSearch} onChange={(e) => setReportSearch(e.target.value)}
                sx={{ minWidth: 280, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <IconButton onClick={loadReports}><RefreshIcon /></IconButton>
            </Stack>
            {loadingData ? <CircularProgress /> : (
              <>
                <Typography variant="caption" color="text.disabled" mb={1} display="block">
                  {filteredReports.length} of {reports.length} reports
                </Typography>
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
                      {filteredReports.map((r) => (
                        <TableRow key={r.id} hover>
                          <TableCell>{r.reason}</TableCell>
                          <TableCell sx={{ fontSize: 11, fontFamily: "monospace" }}>{r.room_id?.slice(0, 10) || "—"}</TableCell>
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
              </>
            )}
          </Box>
        )}

        {/* Stats */}
        {tab === 3 && stats && (
          <Grid container spacing={3}>
            {/* User breakdown */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography fontWeight={700} mb={2}>User Breakdown</Typography>
                  {[
                    { label: "Active users", value: stats.totalUsers - stats.bannedUsers, total: stats.totalUsers, color: "success.main" },
                    { label: "Banned users", value: stats.bannedUsers, total: stats.totalUsers, color: "error.main" },
                  ].map(({ label, value, total, color }) => (
                    <Box key={label} mb={1.5}>
                      <Stack direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2">{label}</Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ color }}>{value}</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={total > 0 ? (value / total) * 100 : 0}
                        sx={{ height: 6, borderRadius: 3, bgcolor: "rgba(255,255,255,0.06)",
                          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 3 } }}
                      />
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>

            {/* Report breakdown */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography fontWeight={700} mb={2}>Report Breakdown</Typography>
                  {[
                    { label: "Pending", value: stats.pendingReports, color: "warning.main" },
                    { label: "Actioned", value: stats.actionedReports, color: "error.main" },
                    { label: "Dismissed", value: stats.dismissedReports, color: "text.disabled" },
                  ].map(({ label, value, color }) => (
                    <Box key={label} mb={1.5}>
                      <Stack direction="row" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2">{label}</Typography>
                        <Typography variant="body2" fontWeight={700} sx={{ color }}>{value}</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={stats.totalReports > 0 ? (value / stats.totalReports) * 100 : 0}
                        sx={{ height: 6, borderRadius: 3, bgcolor: "rgba(255,255,255,0.06)",
                          "& .MuiLinearProgress-bar": { bgcolor: color, borderRadius: 3 } }}
                      />
                    </Box>
                  ))}
                  <Divider sx={{ my: 1.5, opacity: 0.1 }} />
                  <Typography variant="caption" color="text.disabled">Total reports: {stats.totalReports}</Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Feature flags summary */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography fontWeight={700} mb={2}>Feature Flags</Typography>
                  <Stack direction="row" spacing={3} mb={2}>
                    <Box>
                      <Typography variant="h4" fontWeight={800} color="success.main">{stats.enabledFlags}</Typography>
                      <Typography variant="caption" color="text.secondary">Enabled</Typography>
                    </Box>
                    <Box>
                      <Typography variant="h4" fontWeight={800} color="text.disabled">{stats.totalFlags - stats.enabledFlags}</Typography>
                      <Typography variant="caption" color="text.secondary">Disabled</Typography>
                    </Box>
                    <Box>
                      <Typography variant="h4" fontWeight={800}>{stats.totalFlags}</Typography>
                      <Typography variant="caption" color="text.secondary">Total</Typography>
                    </Box>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={stats.totalFlags > 0 ? (stats.enabledFlags / stats.totalFlags) * 100 : 0}
                    sx={{ height: 8, borderRadius: 3, bgcolor: "rgba(255,255,255,0.06)",
                      "& .MuiLinearProgress-bar": { bgcolor: "success.main", borderRadius: 3 } }}
                  />
                </CardContent>
              </Card>
            </Grid>

            {/* Quick actions */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography fontWeight={700} mb={2}>Quick Actions</Typography>
                  <Stack spacing={1.5}>
                    <Button variant="outlined" fullWidth startIcon={<PeopleIcon />} onClick={() => setTab(1)}>
                      Manage Users ({stats.totalUsers})
                    </Button>
                    <Button variant="outlined" color="warning" fullWidth startIcon={<FlagIcon />} onClick={() => setTab(2)}>
                      Review Pending Reports ({stats.pendingReports})
                    </Button>
                    <Button variant="outlined" color="inherit" fullWidth startIcon={<SettingsIcon />} onClick={() => setTab(0)}>
                      Configure Feature Flags ({stats.enabledFlags}/{stats.totalFlags} on)
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
        {/* Chat Logs */}
        {tab === 4 && (
          <Box>
            <Stack direction="row" justifyContent="space-between" mb={2} gap={1} flexWrap="wrap">
              <TextField
                size="small" placeholder="Search by interest, mode, or user ID…"
                value={chatLogSearch} onChange={(e) => setChatLogSearch(e.target.value)}
                sx={{ minWidth: 280, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
              <IconButton onClick={loadChatLogs}><RefreshIcon /></IconButton>
            </Stack>
            {loadingData ? <CircularProgress /> : (
              <>
                <Typography variant="caption" color="text.disabled" mb={1} display="block">
                  {filteredChatLogs.length} of {chatLogs.length} sessions
                </Typography>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Mode</TableCell>
                        <TableCell>Interest</TableCell>
                        <TableCell>Duration</TableCell>
                        <TableCell>Messages</TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>Date</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredChatLogs.map((r) => {
                        const mins = Math.floor((r.duration_seconds || 0) / 60);
                        const secs = (r.duration_seconds || 0) % 60;
                        return (
                          <TableRow key={r.id} hover>
                            <TableCell>
                              <Chip
                                icon={r.mode === "video" ? <VideocamIcon /> : <ChatBubbleIcon />}
                                label={r.mode}
                                size="small"
                                color={r.mode === "video" ? "primary" : "default"}
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>{r.matched_interest || <Typography variant="caption" color="text.disabled">—</Typography>}</TableCell>
                            <TableCell sx={{ fontSize: 12 }}>
                              {mins > 0 ? `${mins}m ` : ""}{secs}s
                            </TableCell>
                            <TableCell>{r.message_count || 0}</TableCell>
                            <TableCell sx={{ fontSize: 11, fontFamily: "monospace" }}>
                              {r.user_id ? r.user_id.slice(0, 10) + "…" : <Typography variant="caption" color="text.disabled">anon</Typography>}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12 }}>
                              {new Date(r.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
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

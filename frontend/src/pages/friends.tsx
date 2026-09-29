import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import {
  Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Container, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, InputAdornment, Stack, Tab, Tabs, TextField,
  Tooltip, Typography,
} from "@mui/material";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import BlockIcon from "@mui/icons-material/Block";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import PeopleIcon from "@mui/icons-material/People";
import SearchIcon from "@mui/icons-material/Search";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import SendIcon from "@mui/icons-material/Send";
import { useAuth } from "@/context/AuthContext";
import { useRealtime } from "@/context/RealtimeContext";
import { Connection, loadConnections as fetchConnections, requestByUsername, blockUser } from "@/lib/friends";
import { supabase } from "@/lib/supabase";
import ChatIcon from "@mui/icons-material/Chat";
import VideocamIcon from "@mui/icons-material/Videocam";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import Alert from "@mui/material/Alert";
import Badge from "@mui/material/Badge";

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pending, setPending] = useState<Connection[]>([]); // received
  const [sent, setSent] = useState<Connection[]>([]); // sent outgoing
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Connection | null>(null);
  const [blockTarget, setBlockTarget] = useState<Connection | null>(null);
  const [addHandle, setAddHandle] = useState("");
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { onlineFriends, callFriend } = useRealtime();

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login?next=/friends");
  }, [user, authLoading]);

  useEffect(() => {
    if (!user) return;
    loadConnections();
  }, [user]);

  const loadConnections = async () => {
    setLoading(true);
    const all = await fetchConnections(user!.id);
    setConnections(all.filter((c) => c.status === "accepted"));
    setPending(all.filter((c) => c.status === "pending" && c.incoming));
    setSent(all.filter((c) => c.status === "pending" && !c.incoming));
    setLoading(false);
  };

  const addByUsername = async () => {
    if (!addHandle.trim()) return;
    const err = await requestByUsername(user!.id, addHandle);
    setAddMsg(err ? { ok: false, text: err } : { ok: true, text: `Request sent to @${addHandle.replace(/^@/, "")}.` });
    if (!err) { setAddHandle(""); loadConnections(); }
  };

  const startCall = async (c: Connection) => {
    try { await callFriend(c.other_id, "video"); }
    catch (e) { setAddMsg({ ok: false, text: e instanceof Error ? e.message : "Call failed" }); }
  };

  const acceptRequest = async (id: string) => {
    await supabase.from("connections").update({ status: "accepted" }).eq("id", id);
    loadConnections();
  };

  const declineRequest = async (id: string) => {
    await supabase.from("connections").delete().eq("id", id);
    loadConnections();
  };

  const cancelSent = async (id: string) => {
    await supabase.from("connections").delete().eq("id", id);
    loadConnections();
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    await supabase.from("connections").delete().eq("id", removeTarget.id);
    setRemoveTarget(null);
    loadConnections();
  };

  const confirmBlock = async () => {
    if (!blockTarget) return;
    await blockUser(user!.id, blockTarget);
    setBlockTarget(null);
    loadConnections();
  };

  const filteredConnections = useMemo(() => {
    const q = search.toLowerCase();
    const list = q
      ? connections.filter((c) => c.display_name.toLowerCase().includes(q) || (c.username || "").includes(q))
      : connections;
    // Online friends first
    return [...list].sort((a, b) => Number(onlineFriends.has(b.other_id)) - Number(onlineFriends.has(a.other_id)));
  }, [connections, search, onlineFriends]);

  if (authLoading || !user) return null;

  const tabCounts = [connections.length, pending.length, sent.length];

  return (
    <Layout title="Friends & Connections">
      <SeoHead title="Friends & Connections" description="Manage your MiloBolo friends and connection requests." path="/friends" noIndex />
      <Container maxWidth="md" sx={{ py: 5 }}>

        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={1.5} mb={4} flexWrap="wrap" gap={1}>
          <PeopleIcon sx={{ fontSize: 32, color: "primary.main" }} />
          <Typography variant="h4" fontWeight={800}>Connections</Typography>
          {pending.length > 0 && (
            <Chip label={`${pending.length} new`} color="warning" size="small" />
          )}
        </Stack>

        {/* Add by username */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mb={addMsg ? 1 : 3}>
          <TextField size="small" fullWidth placeholder="Add a friend by username, e.g. @priya_21"
            value={addHandle} onChange={(e) => { setAddHandle(e.target.value); setAddMsg(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") addByUsername(); }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><PersonAddIcon fontSize="small" /></InputAdornment> }} />
          <Button variant="contained" onClick={addByUsername} disabled={!addHandle.trim()} sx={{ borderRadius: 2, flexShrink: 0 }}>
            Send request
          </Button>
        </Stack>
        {addMsg && <Alert severity={addMsg.ok ? "success" : "warning"} sx={{ mb: 3 }} onClose={() => setAddMsg(null)}>{addMsg.text}</Alert>}

        {/* Tabs */}
        <Tabs value={tab} onChange={(_, v) => { setTab(v); setSearch(""); }} sx={{ mb: 3 }} variant="scrollable" scrollButtons="auto">
          <Tab
            icon={<PeopleIcon fontSize="small" />} iconPosition="start"
            label={`Friends (${connections.length})`}
          />
          <Tab
            icon={<HourglassTopIcon fontSize="small" />} iconPosition="start"
            label={
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <span>Received</span>
                {pending.length > 0 && (
                  <Chip label={pending.length} size="small" color="warning"
                    sx={{ height: 18, fontSize: 11, "& .MuiChip-label": { px: 0.75 } }} />
                )}
              </Stack>
            }
          />
          <Tab
            icon={<SendIcon fontSize="small" />} iconPosition="start"
            label={`Sent (${sent.length})`}
          />
        </Tabs>

        {loading ? (
          <Box sx={{ textAlign: "center", py: 8 }}><CircularProgress /></Box>
        ) : (
          <>
            {/* ── Friends tab ── */}
            {tab === 0 && (
              <>
                {connections.length > 0 && (
                  <TextField
                    fullWidth size="small" placeholder="Search friends…"
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    sx={{ mb: 3, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                  />
                )}
                {filteredConnections.length === 0 ? (
                  <Box sx={{ textAlign: "center", py: 8 }}>
                    <PeopleIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2, opacity: 0.3 }} />
                    <Typography color="text.secondary" gutterBottom>
                      {search ? "No friends match your search." : "No connections yet."}
                    </Typography>
                    {!search && (
                      <>
                        <Typography variant="body2" color="text.disabled" mb={3}>
                          Click the person-add icon during a chat, or add someone by username above.
                        </Typography>
                        <Button variant="contained" sx={{ borderRadius: 2 }} onClick={() => router.push("/chat?mode=text")}>
                          Start Chatting
                        </Button>
                      </>
                    )}
                  </Box>
                ) : (
                  <Stack spacing={1.5}>
                    {filteredConnections.map((c) => (
                      <Card key={c.id} sx={{ borderRadius: 3, transition: "box-shadow 0.2s", "&:hover": { boxShadow: "0 4px 20px rgba(108,99,255,0.12)" } }}>
                        <CardContent sx={{ py: 2 }}>
                          <Stack direction="row" alignItems="center" spacing={2}>
                            <Badge overlap="circular" variant="dot" color="success" invisible={!onlineFriends.has(c.other_id)}
                              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                              sx={{ "& .MuiBadge-dot": { width: 12, height: 12, borderRadius: "50%", border: "2px solid", borderColor: "background.paper" } }}>
                              <Avatar src={c.avatar_url || undefined}
                                sx={{ width: 48, height: 48, bgcolor: "primary.main", cursor: c.username ? "pointer" : "default" }}
                                onClick={() => c.username && router.push(`/u/${c.username}`)}>
                                {c.display_name?.[0]?.toUpperCase()}
                              </Avatar>
                            </Badge>
                            <Box flex={1} minWidth={0}>
                              <Typography fontWeight={700} noWrap>{c.display_name}</Typography>
                              <Typography variant="caption" color="text.disabled">
                                {c.username ? `@${c.username} · ` : ""}
                                {onlineFriends.has(c.other_id) ? "Online now" : `Connected ${new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
                              </Typography>
                            </Box>
                            <Tooltip title="Message">
                              <IconButton size="small" color="primary" onClick={() => router.push(`/messages?with=${c.other_id}`)}>
                                <ChatIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={onlineFriends.has(c.other_id) ? "Video call" : "Offline"}>
                              <span>
                                <IconButton size="small" color="success" disabled={!onlineFriends.has(c.other_id)} onClick={() => startCall(c)}>
                                  <VideocamIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Block user">
                              <IconButton size="small" color="warning" onClick={() => setBlockTarget(c)}>
                                <BlockIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove connection">
                              <IconButton size="small" color="error" onClick={() => setRemoveTarget(c)}>
                                <PersonRemoveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </>
            )}

            {/* ── Received requests tab ── */}
            {tab === 1 && (
              pending.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 8 }}>
                  <HourglassTopIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2, opacity: 0.3 }} />
                  <Typography color="text.secondary">No incoming requests.</Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {pending.map((c) => (
                    <Card key={c.id} sx={{
                      borderRadius: 3,
                      borderLeft: "3px solid",
                      borderLeftColor: "warning.main",
                    }}>
                      <CardContent sx={{ py: 2 }}>
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Avatar src={c.avatar_url || undefined}
                            sx={{ width: 48, height: 48, bgcolor: "warning.main" }}>
                            {c.display_name?.[0]?.toUpperCase()}
                          </Avatar>
                          <Box flex={1} minWidth={0}>
                            <Typography fontWeight={700} noWrap>{c.display_name}</Typography>
                            <Typography variant="caption" color="text.disabled">
                              Sent {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </Typography>
                          </Box>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="Accept">
                              <IconButton color="success" size="small"
                                sx={{ bgcolor: "rgba(76,175,80,0.1)", "&:hover": { bgcolor: "rgba(76,175,80,0.2)" } }}
                                onClick={() => acceptRequest(c.id)}>
                                <CheckIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Decline">
                              <IconButton color="error" size="small"
                                sx={{ bgcolor: "rgba(244,67,54,0.1)", "&:hover": { bgcolor: "rgba(244,67,54,0.2)" } }}
                                onClick={() => declineRequest(c.id)}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )
            )}

            {/* ── Sent requests tab ── */}
            {tab === 2 && (
              sent.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 8 }}>
                  <SendIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2, opacity: 0.3 }} />
                  <Typography color="text.secondary">No outgoing requests.</Typography>
                  <Typography variant="body2" color="text.disabled" mt={1}>
                    During a chat, click the person-add icon to send a friend request.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {sent.map((c) => (
                    <Card key={c.id} sx={{ borderRadius: 3, opacity: 0.85 }}>
                      <CardContent sx={{ py: 2 }}>
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Avatar src={c.avatar_url || undefined}
                            sx={{ width: 48, height: 48, bgcolor: "primary.main" }}>
                            {c.display_name?.[0]?.toUpperCase()}
                          </Avatar>
                          <Box flex={1} minWidth={0}>
                            <Typography fontWeight={700} noWrap>{c.display_name}</Typography>
                            <Chip label="Pending" size="small" color="default" variant="outlined"
                              sx={{ mt: 0.25, fontSize: 11 }} />
                          </Box>
                          <Tooltip title="Cancel request">
                            <Button size="small" variant="outlined" color="error"
                              sx={{ borderRadius: 1.5, fontSize: 12 }}
                              onClick={() => cancelSent(c.id)}>
                              Cancel
                            </Button>
                          </Tooltip>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )
            )}
          </>
        )}
      </Container>

      {/* Remove confirmation dialog */}
      <Dialog open={!!removeTarget} onClose={() => setRemoveTarget(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Remove connection?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Remove <b>{removeTarget?.display_name}</b> from your connections? They won&apos;t be notified.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setRemoveTarget(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={confirmRemove} sx={{ borderRadius: 2 }}>
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* Block confirmation dialog */}
      <Dialog open={!!blockTarget} onClose={() => setBlockTarget(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>Block user?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Block <b>{blockTarget?.display_name}</b>? They will no longer be able to send you friend requests or be matched with you.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setBlockTarget(null)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={confirmBlock} sx={{ borderRadius: 2 }}>
            Block
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}

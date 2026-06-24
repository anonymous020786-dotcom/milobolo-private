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
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface Connection {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
  display_name?: string;
  avatar_url?: string;
}

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

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login?next=/friends");
  }, [user, authLoading]);

  useEffect(() => {
    if (!user) return;
    loadConnections();
  }, [user]);

  const loadConnections = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("connections")
      .select(`
        id, user_id, friend_id, status, created_at,
        profile:profiles!connections_friend_id_fkey(display_name, avatar_url),
        sender:profiles!connections_user_id_fkey(display_name, avatar_url)
      `)
      .or(`user_id.eq.${user!.id},friend_id.eq.${user!.id}`)
      .order("created_at", { ascending: false });

    if (data) {
      const mapped = data.map((c: any) => {
        const isReceiver = c.friend_id === user!.id;
        return {
          ...c,
          display_name: isReceiver
            ? (c.sender?.display_name || "Anonymous")
            : (c.profile?.display_name || "Anonymous"),
          avatar_url: isReceiver
            ? (c.sender?.avatar_url || null)
            : (c.profile?.avatar_url || null),
        };
      });
      setConnections(mapped.filter((c: any) => c.status === "accepted"));
      setPending(mapped.filter((c: any) => c.status === "pending" && c.friend_id === user!.id));
      setSent(mapped.filter((c: any) => c.status === "pending" && c.user_id === user!.id));
    }
    setLoading(false);
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
    await supabase.from("connections").update({ status: "blocked" }).eq("id", blockTarget.id);
    setBlockTarget(null);
    loadConnections();
  };

  const filteredConnections = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return connections;
    return connections.filter((c) => (c.display_name || "").toLowerCase().includes(q));
  }, [connections, search]);

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
                          Click &ldquo;Add Friend&rdquo; during a chat to connect with someone.
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
                            <Avatar src={c.avatar_url || undefined}
                              sx={{ width: 48, height: 48, bgcolor: "primary.main" }}>
                              {c.display_name?.[0]?.toUpperCase()}
                            </Avatar>
                            <Box flex={1} minWidth={0}>
                              <Typography fontWeight={700} noWrap>{c.display_name}</Typography>
                              <Typography variant="caption" color="text.disabled">
                                Connected {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </Typography>
                            </Box>
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

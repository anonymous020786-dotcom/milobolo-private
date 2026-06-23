import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import {
  Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Container, Divider, IconButton, Stack, Tab, Tabs, Tooltip,
  Typography,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ChatIcon from "@mui/icons-material/Chat";
import PeopleIcon from "@mui/icons-material/People";
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
  const [pending, setPending] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

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
        profile:profiles!connections_friend_id_fkey(display_name, avatar_url)
      `)
      .or(`user_id.eq.${user!.id},friend_id.eq.${user!.id}`)
      .order("created_at", { ascending: false });

    if (data) {
      const mapped = data.map((c: any) => ({
        ...c,
        display_name: c.profile?.display_name || "Anonymous",
        avatar_url: c.profile?.avatar_url || null,
      }));
      setConnections(mapped.filter((c: any) => c.status === "accepted"));
      setPending(mapped.filter((c: any) => c.status === "pending" && c.friend_id === user!.id));
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

  const removeFriend = async (id: string) => {
    if (!confirm("Remove this connection?")) return;
    await supabase.from("connections").delete().eq("id", id);
    loadConnections();
  };

  if (authLoading || !user) return null;

  return (
    <Layout title="Friends & Connections">
      <SeoHead title="Friends & Connections" description="Manage your MiloBolo friends and incoming connection requests." path="/friends" noIndex />
      <Container maxWidth="md" sx={{ py: 5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={4}>
          <PeopleIcon sx={{ fontSize: 32, color: "primary.main" }} />
          <Typography variant="h4" fontWeight={800}>Connections</Typography>
          {pending.length > 0 && (
            <Chip label={`${pending.length} pending`} color="warning" size="small" />
          )}
        </Stack>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label={`Friends (${connections.length})`} />
          <Tab label={`Requests (${pending.length})`} />
        </Tabs>

        {loading ? (
          <Box sx={{ textAlign: "center", py: 8 }}><CircularProgress /></Box>
        ) : (
          <>
            {/* Friends list */}
            {tab === 0 && (
              connections.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 8 }}>
                  <PeopleIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2, opacity: 0.4 }} />
                  <Typography color="text.secondary" gutterBottom>No connections yet.</Typography>
                  <Typography variant="body2" color="text.disabled">
                    When you click "Add Friend" during a chat session, your connections appear here.
                  </Typography>
                  <Button variant="contained" sx={{ mt: 3 }} onClick={() => router.push("/chat?mode=text")}>
                    Start Chatting
                  </Button>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {connections.map((c) => (
                    <Card key={c.id} sx={{ borderRadius: 3 }}>
                      <CardContent>
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Avatar
                            src={c.avatar_url || undefined}
                            sx={{ width: 48, height: 48, bgcolor: "primary.main" }}
                          >
                            {c.display_name?.[0]?.toUpperCase()}
                          </Avatar>
                          <Box flex={1}>
                            <Typography fontWeight={700}>{c.display_name}</Typography>
                            <Typography variant="caption" color="text.disabled">
                              Connected {new Date(c.created_at).toLocaleDateString("en-IN", {
                                day: "numeric", month: "short", year: "numeric",
                              })}
                            </Typography>
                          </Box>
                          <Tooltip title="Remove connection">
                            <IconButton size="small" color="error" onClick={() => removeFriend(c.id)}>
                              <PersonRemoveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )
            )}

            {/* Pending requests */}
            {tab === 1 && (
              pending.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 8 }}>
                  <Typography color="text.secondary">No pending requests.</Typography>
                </Box>
              ) : (
                <Stack spacing={2}>
                  {pending.map((c) => (
                    <Card key={c.id} sx={{ borderRadius: 3, borderLeft: "4px solid", borderLeftColor: "warning.main" }}>
                      <CardContent>
                        <Stack direction="row" alignItems="center" spacing={2}>
                          <Avatar
                            src={c.avatar_url || undefined}
                            sx={{ width: 48, height: 48, bgcolor: "warning.main" }}
                          >
                            {c.display_name?.[0]?.toUpperCase()}
                          </Avatar>
                          <Box flex={1}>
                            <Typography fontWeight={700}>{c.display_name}</Typography>
                            <Typography variant="caption" color="text.disabled">
                              Wants to connect with you
                            </Typography>
                          </Box>
                          <Tooltip title="Accept">
                            <IconButton color="success" onClick={() => acceptRequest(c.id)}>
                              <CheckIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Decline">
                            <IconButton color="error" onClick={() => declineRequest(c.id)}>
                              <CloseIcon />
                            </IconButton>
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
    </Layout>
  );
}

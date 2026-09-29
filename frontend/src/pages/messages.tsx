import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  Avatar, Badge, Box, Button, CircularProgress, IconButton, List, ListItemAvatar, ListItemButton,
  ListItemText, Paper, Stack, TextField, Tooltip, Typography, useMediaQuery, useTheme,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import VideocamIcon from "@mui/icons-material/Videocam";
import CallIcon from "@mui/icons-material/Call";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import DoneIcon from "@mui/icons-material/Done";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import { useAuth } from "@/context/AuthContext";
import { useRealtime } from "@/context/RealtimeContext";
import { useFeatureFlags } from "@/context/FeatureFlagContext";
import { Connection, loadConnections } from "@/lib/friends";
import { supabase } from "@/lib/supabase";
import { renderRichText } from "@/lib/richText";

interface DM {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  pending?: boolean;
  failed?: boolean;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { socket, onlineFriends, callFriend, refreshNotifications } = useRealtime();
  const { isEnabled } = useFeatureFlags();

  const [friends, setFriends] = useState<Connection[]>([]);
  const [unreadBy, setUnreadBy] = useState<Record<string, number>>({});
  const [lastBy, setLastBy] = useState<Record<string, DM>>({});
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [thread, setThread] = useState<DM[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [text, setText] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const withId = typeof router.query.with === "string" ? router.query.with : null;
  const active = useMemo(() => friends.find((f) => f.other_id === withId) || null, [friends, withId]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login?next=/messages");
  }, [user, authLoading, router]);

  // Friends + last message + unread counts
  const loadSidebar = useCallback(async () => {
    if (!user) return;
    const all = await loadConnections(user.id);
    setFriends(all.filter((c) => c.status === "accepted"));
    const { data } = await supabase.from("direct_messages")
      .select("id, sender_id, receiver_id, body, read_at, created_at")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false }).limit(300);
    const last: Record<string, DM> = {};
    const unread: Record<string, number> = {};
    (data || []).forEach((m: DM) => {
      const other = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (!last[other]) last[other] = m;
      if (m.receiver_id === user.id && !m.read_at) unread[other] = (unread[other] || 0) + 1;
    });
    setLastBy(last);
    setUnreadBy(unread);
    setLoadingFriends(false);
  }, [user]);

  useEffect(() => { loadSidebar(); }, [loadSidebar]);

  // Thread
  useEffect(() => {
    if (!user || !withId) { setThread([]); return; }
    setLoadingThread(true);
    setPeerTyping(false);
    supabase.from("direct_messages")
      .select("id, sender_id, receiver_id, body, read_at, created_at")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${withId}),and(sender_id.eq.${withId},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true }).limit(200)
      .then(({ data }) => {
        setThread((data as DM[]) || []);
        setLoadingThread(false);
      });
  }, [user, withId]);

  // Mark as read when viewing
  useEffect(() => {
    if (!socket || !withId || !user) return;
    const hasUnread = thread.some((m) => m.sender_id === withId && !m.read_at);
    if (!hasUnread) return;
    socket.emit("dm_read", { from: withId });
    setUnreadBy((u) => ({ ...u, [withId]: 0 }));
    setThread((t) => t.map((m) => (m.sender_id === withId && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m)));
    setTimeout(refreshNotifications, 500);
  }, [socket, withId, user, thread, refreshNotifications]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread, peerTyping]);

  // Live events
  useEffect(() => {
    if (!socket || !user) return;
    const onDm = ({ message, clientId }: { message: DM; clientId?: string }) => {
      const other = message.sender_id === user.id ? message.receiver_id : message.sender_id;
      setLastBy((l) => ({ ...l, [other]: message }));
      if (other === withId) {
        setThread((t) => {
          if (t.some((m) => m.id === message.id)) return t;
          if (clientId) {
            const idx = t.findIndex((m) => m.id === clientId);
            if (idx >= 0) { const copy = [...t]; copy[idx] = message; return copy; }
          }
          return [...t, message];
        });
        if (message.sender_id === withId) setPeerTyping(false);
      } else if (message.sender_id !== user.id) {
        setUnreadBy((u) => ({ ...u, [other]: (u[other] || 0) + 1 }));
      }
    };
    const onRead = ({ by }: { by: string }) => {
      if (by !== withId) return;
      setThread((t) => t.map((m) => (m.sender_id === user.id && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m)));
    };
    const onTyping = ({ from, typing }: { from: string; typing: boolean }) => {
      if (from === withId) setPeerTyping(typing);
    };
    socket.on("dm", onDm);
    socket.on("dm_read", onRead);
    socket.on("dm_typing", onTyping);
    return () => { socket.off("dm", onDm); socket.off("dm_read", onRead); socket.off("dm_typing", onTyping); };
  }, [socket, user, withId]);

  const send = async () => {
    const body = text.trim();
    if (!body || !withId || !user || !socket) return;
    setText("");
    setError("");
    socket.emit("dm_typing", { to: withId, typing: false });
    const clientId = `pending-${Date.now()}`;
    const optimistic: DM = { id: clientId, sender_id: user.id, receiver_id: withId, body, read_at: null, created_at: new Date().toISOString(), pending: true };
    setThread((t) => [...t, optimistic]);
    const res: { message?: DM; error?: string } = await new Promise((resolve) =>
      socket.timeout(8000).emit("dm_send", { to: withId, body, clientId }, (err: Error | null, r: { message?: DM; error?: string }) =>
        resolve(err ? { error: "Message timed out. Check your connection." } : r)));
    if (res.message) {
      setThread((t) => t.map((m) => (m.id === clientId ? res.message! : m)));
      setLastBy((l) => ({ ...l, [withId]: res.message! }));
    } else {
      setThread((t) => t.map((m) => (m.id === clientId ? { ...m, pending: false, failed: true } : m)));
      setError(res.error || "Message failed to send.");
    }
  };

  const onType = (v: string) => {
    setText(v.slice(0, 1000));
    if (!socket || !withId) return;
    socket.emit("dm_typing", { to: withId, typing: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit("dm_typing", { to: withId, typing: false }), 1500);
  };

  const call = async (mode: "video" | "voice") => {
    if (!withId) return;
    try { await callFriend(withId, mode); }
    catch (e) { setError(e instanceof Error ? e.message : "Call failed"); }
  };

  if (authLoading || !user) return null;

  if (!isEnabled("direct_messages")) {
    return (
      <Layout title="Messages">
        <Box textAlign="center" py={10}><Typography color="text.secondary">Direct messages are currently disabled.</Typography></Box>
      </Layout>
    );
  }

  const sortedFriends = [...friends].sort((a, b) => {
    const la = lastBy[a.other_id]?.created_at || "";
    const lb = lastBy[b.other_id]?.created_at || "";
    return lb.localeCompare(la);
  });
  const online = active ? onlineFriends.has(active.other_id) : false;
  const showList = !isMobile || !withId;
  const showThread = !isMobile || !!withId;

  return (
    <Layout title="Messages">
      <SeoHead title="Messages — MiloBolo" description="Private messages with your MiloBolo friends." path="/messages" noIndex />
      <Box sx={{ maxWidth: 1100, mx: "auto", px: { xs: 0, md: 2 }, py: { xs: 0, md: 3 } }}>
        <Paper sx={{ display: "flex", height: { xs: "calc(100dvh - 64px)", md: "calc(100dvh - 140px)" }, minHeight: 420, borderRadius: { xs: 0, md: 3 }, overflow: "hidden" }}>
          {showList && (
            <Box sx={{ width: { xs: "100%", md: 320 }, borderRight: { md: "1px solid rgba(255,255,255,0.08)" }, display: "flex", flexDirection: "column" }}>
              <Typography fontWeight={800} fontSize={20} px={2} py={1.75}>Messages</Typography>
              {loadingFriends ? (
                <Box textAlign="center" py={4}><CircularProgress size={22} /></Box>
              ) : sortedFriends.length === 0 ? (
                <Box px={2} py={4} textAlign="center">
                  <Typography color="text.secondary" fontSize={14} mb={2}>
                    You can message people once you&apos;re friends. Add friends during a chat or by username.
                  </Typography>
                  <Button variant="outlined" onClick={() => router.push("/friends")}>Find friends</Button>
                </Box>
              ) : (
                <List disablePadding sx={{ overflowY: "auto", flex: 1 }}>
                  {sortedFriends.map((f) => {
                    const last = lastBy[f.other_id];
                    const unread = unreadBy[f.other_id] || 0;
                    return (
                      <ListItemButton key={f.other_id} selected={f.other_id === withId}
                        onClick={() => router.push(`/messages?with=${f.other_id}`, undefined, { shallow: true })}>
                        <ListItemAvatar>
                          <Badge overlap="circular" variant="dot" color="success" invisible={!onlineFriends.has(f.other_id)}
                            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                            <Avatar src={f.avatar_url || undefined}>{f.display_name[0]?.toUpperCase()}</Avatar>
                          </Badge>
                        </ListItemAvatar>
                        <ListItemText
                          primary={f.display_name}
                          secondary={last ? `${last.sender_id === user.id ? "You: " : ""}${last.body}` : onlineFriends.has(f.other_id) ? "Online" : "Say hi 👋"}
                          primaryTypographyProps={{ fontWeight: unread ? 700 : 500, noWrap: true }}
                          secondaryTypographyProps={{ noWrap: true, fontSize: 12.5, fontWeight: unread ? 600 : 400 }} />
                        {unread > 0 && <Badge badgeContent={unread} color="primary" sx={{ mr: 1 }} />}
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
            </Box>
          )}

          {showThread && (
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              {!active ? (
                <Box flex={1} display="flex" alignItems="center" justifyContent="center">
                  <Typography color="text.secondary">Select a friend to start chatting.</Typography>
                </Box>
              ) : (
                <>
                  <Stack direction="row" alignItems="center" spacing={1.5} px={2} py={1.25} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {isMobile && (
                      <IconButton size="small" onClick={() => router.push("/messages", undefined, { shallow: true })} aria-label="Back"><ArrowBackIcon /></IconButton>
                    )}
                    <Avatar src={active.avatar_url || undefined} sx={{ cursor: active.username ? "pointer" : "default" }}
                      onClick={() => active.username && router.push(`/u/${active.username}`)}>
                      {active.display_name[0]?.toUpperCase()}
                    </Avatar>
                    <Box flex={1} minWidth={0}>
                      <Typography fontWeight={700} noWrap>{active.display_name}</Typography>
                      <Typography fontSize={12} color={online ? "success.main" : "text.disabled"}>
                        {peerTyping ? "typing…" : online ? "Online" : "Offline"}
                      </Typography>
                    </Box>
                    <Tooltip title={online ? "Voice call" : "Offline"}>
                      <span><IconButton disabled={!online} onClick={() => call("voice")} aria-label="Voice call"><CallIcon /></IconButton></span>
                    </Tooltip>
                    <Tooltip title={online ? "Video call" : "Offline"}>
                      <span><IconButton disabled={!online} color="primary" onClick={() => call("video")} aria-label="Video call"><VideocamIcon /></IconButton></span>
                    </Tooltip>
                  </Stack>

                  <Box sx={{ flex: 1, overflowY: "auto", px: 2, py: 1.5 }}>
                    {loadingThread ? (
                      <Box textAlign="center" py={4}><CircularProgress size={22} /></Box>
                    ) : thread.length === 0 ? (
                      <Typography color="text.disabled" textAlign="center" mt={4} fontSize={14}>No messages yet. Say hi!</Typography>
                    ) : thread.map((m, i) => {
                      const mine = m.sender_id === user.id;
                      const prev = thread[i - 1];
                      const newDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);
                      const lastMine = mine && !thread.slice(i + 1).some((x) => x.sender_id === user.id);
                      return (
                        <Box key={m.id}>
                          {newDay && <Typography textAlign="center" fontSize={11} color="text.disabled" my={1.5}>{dayLabel(m.created_at)}</Typography>}
                          <Box sx={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", mb: 0.5 }}>
                            <Box sx={{
                              maxWidth: "75%", px: 1.5, py: 0.75, borderRadius: 2.5,
                              bgcolor: mine ? "primary.main" : "rgba(255,255,255,0.07)",
                              color: mine ? "#fff" : "text.primary",
                              opacity: m.pending ? 0.6 : 1,
                              border: m.failed ? "1px solid" : "none", borderColor: "error.main",
                            }}>
                              <Typography fontSize={14} sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{renderRichText(m.body)}</Typography>
                              <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                                <Typography fontSize={10} sx={{ opacity: 0.7 }}>
                                  {m.failed ? "Failed" : new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                </Typography>
                                {mine && !m.failed && (m.read_at ? <DoneAllIcon sx={{ fontSize: 13 }} /> : <DoneIcon sx={{ fontSize: 13, opacity: 0.7 }} />)}
                              </Stack>
                            </Box>
                          </Box>
                          {lastMine && m.read_at && <Typography textAlign="right" fontSize={10.5} color="text.disabled" mb={0.5}>Seen</Typography>}
                        </Box>
                      );
                    })}
                    {peerTyping && <Typography fontSize={12} color="text.disabled" fontStyle="italic">{active.display_name} is typing…</Typography>}
                    <div ref={endRef} />
                  </Box>

                  {error && <Typography color="error.main" fontSize={12.5} px={2}>{error}</Typography>}
                  <Stack direction="row" spacing={1} p={1.25} sx={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <TextField fullWidth size="small" multiline maxRows={4} placeholder={`Message ${active.display_name}…`}
                      value={text} onChange={(e) => onType(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }} />
                    <Button variant="contained" onClick={send} disabled={!text.trim() || !socket} sx={{ borderRadius: 3, minWidth: 52 }} aria-label="Send">
                      <SendIcon fontSize="small" />
                    </Button>
                  </Stack>
                </>
              )}
            </Box>
          )}
        </Paper>
      </Box>
    </Layout>
  );
}

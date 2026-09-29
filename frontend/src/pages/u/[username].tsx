import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Container, Stack, Typography,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import ChatIcon from "@mui/icons-material/Chat";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useRealtime } from "@/context/RealtimeContext";
import { sendRequest } from "@/lib/friends";

interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  total_chats: number;
  karma: number;
  college_verified: boolean;
  is_verified: boolean;
  allow_friend_requests: boolean;
  interests: string[] | null;
  created_at: string;
  is_banned: boolean;
}

const MILESTONES = [
  { at: 1, label: "👋 First Hello" },
  { at: 25, label: "💬 Regular" },
  { at: 100, label: "💯 Centurion" },
  { at: 500, label: "🏆 Legend" },
];

export default function PublicProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { onlineFriends } = useRealtime();
  const username = typeof router.query.username === "string" ? router.query.username.toLowerCase() : null;
  const [p, setP] = useState<PublicProfile | null>(null);
  const [status, setStatus] = useState<"loading" | "missing" | "ok">("loading");
  const [relation, setRelation] = useState<"none" | "pending" | "friends" | "self">("none");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!username) return;
    supabase.from("profiles")
      .select("id, username, display_name, bio, avatar_url, total_chats, karma, college_verified, is_verified, allow_friend_requests, interests, created_at, is_banned")
      .eq("username", username).maybeSingle()
      .then(({ data }) => {
        if (!data || data.is_banned) { setStatus("missing"); return; }
        setP(data as PublicProfile);
        setStatus("ok");
      });
  }, [username]);

  useEffect(() => {
    if (!user || !p) return;
    if (user.id === p.id) { setRelation("self"); return; }
    supabase.from("connections").select("status")
      .or(`and(requester_id.eq.${user.id},receiver_id.eq.${p.id}),and(requester_id.eq.${p.id},receiver_id.eq.${user.id})`)
      .maybeSingle()
      .then(({ data }) => setRelation(data?.status === "accepted" ? "friends" : data?.status === "pending" ? "pending" : "none"));
  }, [user, p]);

  const addFriend = async () => {
    if (!user) { router.push(`/auth/login?next=/u/${username}`); return; }
    const err = await sendRequest(user.id, p!.id, p!.allow_friend_requests);
    setMsg(err ? { ok: false, text: err } : { ok: true, text: "Friend request sent!" });
    if (!err) setRelation("pending");
  };

  if (status === "loading") {
    return <Layout title="Profile"><Box textAlign="center" py={10}><CircularProgress /></Box></Layout>;
  }
  if (status === "missing" || !p) {
    return (
      <Layout title="Profile not found">
        <SeoHead title="Profile not found — MiloBolo" description="This profile doesn't exist." path={`/u/${username}`} noIndex />
        <Box textAlign="center" py={10}>
          <Typography variant="h5" fontWeight={700} mb={1}>@{username} not found</Typography>
          <Typography color="text.secondary" mb={3}>This user doesn&apos;t exist or has been removed.</Typography>
          <Button variant="contained" onClick={() => router.push("/")}>Go home</Button>
        </Box>
      </Layout>
    );
  }

  const name = p.display_name || p.username;
  const earned = MILESTONES.filter((m) => p.total_chats >= m.at);

  return (
    <Layout title={name}>
      <SeoHead title={`${name} (@${p.username}) — MiloBolo`} description={p.bio || `${name} on MiloBolo`} path={`/u/${p.username}`} noIndex />
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Card sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 4, textAlign: "center" }}>
            <Avatar src={p.avatar_url || undefined} sx={{ width: 104, height: 104, fontSize: 42, mx: "auto", mb: 2, bgcolor: "primary.main" }}>
              {name[0]?.toUpperCase()}
            </Avatar>
            <Typography variant="h5" fontWeight={800}>{name}</Typography>
            <Typography color="text.secondary" mb={1}>
              @{p.username}{relation === "friends" && onlineFriends.has(p.id) ? " · 🟢 online" : ""}
            </Typography>
            <Stack direction="row" spacing={0.75} justifyContent="center" flexWrap="wrap" useFlexGap mb={2}>
              {p.is_verified && <Chip label="✔ Verified" size="small" color="info" variant="outlined" />}
              {p.college_verified && <Chip label="🎓 Student" size="small" color="warning" variant="outlined" />}
              {p.karma >= 10 && <Chip label="⭐ Trusted" size="small" color="success" variant="outlined" />}
            </Stack>
            {p.bio && <Typography sx={{ whiteSpace: "pre-wrap", mb: 2 }}>{p.bio}</Typography>}

            <Stack direction="row" justifyContent="center" spacing={4} my={3}>
              {[["Chats", p.total_chats], ["Karma", p.karma], ["Joined", new Date(p.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })]].map(([label, value]) => (
                <Box key={label as string}>
                  <Typography fontWeight={800} fontSize={20}>{value}</Typography>
                  <Typography fontSize={12} color="text.secondary">{label}</Typography>
                </Box>
              ))}
            </Stack>

            {(p.interests?.length || 0) > 0 && (
              <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap" useFlexGap mb={2}>
                {p.interests!.slice(0, 10).map((i) => <Chip key={i} label={i} size="small" />)}
              </Stack>
            )}
            {earned.length > 0 && (
              <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap" useFlexGap mb={3}>
                {earned.map((m) => <Chip key={m.at} label={m.label} size="small" variant="outlined" />)}
              </Stack>
            )}

            {msg && <Alert severity={msg.ok ? "success" : "warning"} sx={{ mb: 2, textAlign: "left" }}>{msg.text}</Alert>}

            {relation === "self" ? (
              <Button variant="outlined" onClick={() => router.push("/profile")}>Edit profile</Button>
            ) : relation === "friends" ? (
              <Button variant="contained" startIcon={<ChatIcon />} onClick={() => router.push(`/messages?with=${p.id}`)}>Message</Button>
            ) : relation === "pending" ? (
              <Button variant="outlined" disabled>Request pending</Button>
            ) : (
              <Button variant="contained" startIcon={<PersonAddIcon />} onClick={addFriend} disabled={!p.allow_friend_requests}>
                {p.allow_friend_requests ? "Add friend" : "Not accepting requests"}
              </Button>
            )}
          </CardContent>
        </Card>
      </Container>
    </Layout>
  );
}

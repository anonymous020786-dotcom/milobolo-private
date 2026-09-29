import { useEffect, useState } from "react";
import { Box, Card, CardContent, Grid, LinearProgress, Stack, Tooltip, Typography } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { supabase } from "@/lib/supabase";
import { Achievement, computeAchievements, currentStreak, HistoryRow } from "@/lib/achievements";

interface Props {
  userId: string;
  karma?: number;
  collegeVerified?: boolean;
  totalChats?: number;
}

export default function AchievementsCard({ userId, karma, collegeVerified, totalChats }: Props) {
  const [items, setItems] = useState<Achievement[] | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: rows }, { count: friends }] = await Promise.all([
        supabase.from("chat_history").select("mode, duration_seconds, message_count, started_at")
          .eq("user_id", userId).order("started_at", { ascending: false }).limit(2000),
        supabase.from("connections").select("id", { count: "exact", head: true })
          .eq("status", "accepted").or(`requester_id.eq.${userId},receiver_id.eq.${userId}`),
      ]);
      const history = (rows as HistoryRow[]) || [];
      setStreak(currentStreak(history));
      setItems(computeAchievements(history, { karma, collegeVerified, friends: friends || 0, totalChats }));
    })();
  }, [userId, karma, collegeVerified, totalChats]);

  if (!items) return null;
  const unlocked = items.filter((a) => a.unlocked).length;

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" fontWeight={600} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <EmojiEventsIcon fontSize="small" /> Achievements
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Tooltip title="Days in a row with at least one chat">
              <Typography fontSize={14} fontWeight={700} color={streak ? "warning.main" : "text.disabled"}>🔥 {streak}-day streak</Typography>
            </Tooltip>
            <Typography fontSize={13} color="text.secondary">{unlocked}/{items.length}</Typography>
          </Stack>
        </Stack>
        <Grid container spacing={1.5}>
          {items.map((a) => (
            <Grid item xs={6} sm={4} key={a.id}>
              <Tooltip title={a.description}>
                <Box sx={{
                  p: 1.25, borderRadius: 2, height: "100%",
                  border: "1px solid", borderColor: a.unlocked ? "rgba(255,193,7,0.4)" : "rgba(255,255,255,0.06)",
                  bgcolor: a.unlocked ? "rgba(255,193,7,0.06)" : "rgba(255,255,255,0.02)",
                  opacity: a.unlocked ? 1 : 0.55,
                }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography fontSize={22} sx={{ filter: a.unlocked ? "none" : "grayscale(1)" }}>{a.emoji}</Typography>
                    <Box minWidth={0}>
                      <Typography fontSize={13} fontWeight={700} noWrap>{a.title}</Typography>
                      <Typography fontSize={11} color="text.secondary" noWrap>{a.description}</Typography>
                    </Box>
                  </Stack>
                  {!a.unlocked && a.progress && (
                    <Box mt={0.75}>
                      <LinearProgress variant="determinate" value={(a.progress.current / a.progress.target) * 100}
                        sx={{ height: 4, borderRadius: 2 }} />
                      <Typography fontSize={10} color="text.disabled" mt={0.25}>{a.progress.current}/{a.progress.target}</Typography>
                    </Box>
                  )}
                </Box>
              </Tooltip>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}

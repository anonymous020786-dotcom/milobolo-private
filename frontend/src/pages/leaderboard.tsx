import { useState, useEffect } from "react";
import {
  Box, Container, Typography, Avatar, Chip, Stack, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Divider,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import { supabase } from "@/lib/supabase";

interface LeaderEntry {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  total_chats: number;
  created_at: string;
}

const MEDAL: Record<number, { emoji: string; color: string }> = {
  1: { emoji: "🥇", color: "#FFD700" },
  2: { emoji: "🥈", color: "#C0C0C0" },
  3: { emoji: "🥉", color: "#CD7F32" },
};

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, display_name, avatar_url, total_chats, created_at")
      .gt("total_chats", 0)
      .order("total_chats", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setLeaders(data as LeaderEntry[]);
        setLoading(false);
      });
  }, []);

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <Layout title="Leaderboard — MiloBolo">
      <SeoHead
        title="Leaderboard"
        description="See who's been chatting the most on MiloBolo. Top chatters, most connected users, and community champions."
        path="/leaderboard"
      />
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
        {/* Header */}
        <Box textAlign="center" mb={5}>
          <EmojiEventsIcon sx={{ fontSize: 48, color: "#FFD700", mb: 1 }} />
          <Typography variant="h3" fontWeight={900} mb={1} sx={{
            background: "linear-gradient(135deg,#FFD700,#FF6584,#6C63FF)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Leaderboard
          </Typography>
          <Typography color="text.secondary" maxWidth={480} mx="auto">
            Top chatters in the MiloBolo community — ranked by total chat sessions.
          </Typography>
        </Box>

        {loading ? (
          <Box textAlign="center" py={10}><CircularProgress /></Box>
        ) : leaders.length === 0 ? (
          <Box textAlign="center" py={10}>
            <Typography color="text.secondary">No leaderboard data yet — be the first to chat!</Typography>
          </Box>
        ) : (
          <>
            {/* Top 3 podium */}
            {top3.length > 0 && (
              <Box mb={5}>
                <Typography variant="overline" color="text.disabled" fontWeight={700} letterSpacing={1.5} display="block" mb={3} textAlign="center">
                  Top Chatters
                </Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="center"
                  alignItems={{ sm: "flex-end" }}
                  spacing={2}
                >
                  {/* Reorder: 2nd, 1st, 3rd for podium effect on desktop */}
                  {[
                    top3[1], top3[0], top3[2],
                  ].filter(Boolean).map((entry, podiumIdx) => {
                    const rank = entry === top3[0] ? 1 : entry === top3[1] ? 2 : 3;
                    const medal = MEDAL[rank];
                    const height = rank === 1 ? 140 : rank === 2 ? 110 : 90;
                    return (
                      <Box
                        key={entry.id}
                        sx={{
                          flex: 1, maxWidth: 200, mx: "auto",
                          textAlign: "center",
                          order: { xs: rank - 1, sm: podiumIdx },
                        }}
                      >
                        <Typography fontSize={28} mb={0.5}>{medal.emoji}</Typography>
                        <Avatar
                          src={entry.avatar_url || undefined}
                          sx={{
                            width: rank === 1 ? 72 : 56,
                            height: rank === 1 ? 72 : 56,
                            mx: "auto", mb: 1,
                            border: `2px solid ${medal.color}`,
                            fontSize: rank === 1 ? 28 : 22,
                            bgcolor: "primary.main",
                          }}
                        >
                          {(entry.display_name || "?")[0].toUpperCase()}
                        </Avatar>
                        <Typography fontWeight={700} fontSize={rank === 1 ? 15 : 13} noWrap>
                          {entry.display_name || "Anonymous"}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" display="block">
                          {entry.total_chats} chats
                        </Typography>
                        {/* Podium block */}
                        <Box sx={{
                          mt: 1.5, height, borderRadius: "6px 6px 0 0",
                          background: `linear-gradient(180deg, ${medal.color}30, ${medal.color}10)`,
                          border: `1px solid ${medal.color}40`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Typography fontWeight={900} fontSize={20} sx={{ color: medal.color }}>
                            #{rank}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            )}

            <Divider sx={{ opacity: 0.1, mb: 3 }} />

            {/* Ranks 4-50 */}
            {rest.length > 0 && (
              <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, width: 60 }}>Rank</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Chats</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Member since</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rest.map((entry, idx) => {
                      const rank = idx + 4;
                      return (
                        <TableRow key={entry.id} hover>
                          <TableCell>
                            <Typography variant="body2" color="text.disabled" fontWeight={600}>#{rank}</Typography>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Avatar src={entry.avatar_url || undefined}
                                sx={{ width: 32, height: 32, fontSize: 13, bgcolor: "primary.main" }}>
                                {(entry.display_name || "?")[0].toUpperCase()}
                              </Avatar>
                              <Typography variant="body2" fontWeight={500}>
                                {entry.display_name || "Anonymous"}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            <Chip label={entry.total_chats} size="small" color="primary" variant="outlined"
                              sx={{ fontWeight: 700, fontSize: 12 }} />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="caption" color="text.disabled">
                              {new Date(entry.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Box sx={{ mt: 3, p: 2, bgcolor: "rgba(255,255,255,0.02)", borderRadius: 2, border: "1px solid rgba(255,255,255,0.06)" }}>
              <Typography variant="caption" color="text.disabled">
                💡 Rankings update in real-time. Only registered users with public profiles appear here.
                Start chatting to earn your spot!
              </Typography>
            </Box>
          </>
        )}
      </Container>
    </Layout>
  );
}

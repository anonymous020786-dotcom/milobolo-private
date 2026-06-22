import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Box, Container, Typography, Button, Stack, Chip, Divider,
  TextField, Autocomplete, Paper, Grid, useMediaQuery, useTheme,
} from "@mui/material";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import ChatIcon from "@mui/icons-material/Chat";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Layout from "@/components/Layout";
import OnlineCounter from "@/components/OnlineCounter";
import AdSlot from "@/components/AdSlot";
import { useFeatureFlags } from "@/context/FeatureFlagContext";

const COMMON_INTERESTS = [
  "Music", "Gaming", "Movies", "Sports", "Travel", "Food", "Technology",
  "Art", "Books", "Fitness", "Photography", "Dance", "Comedy", "Science",
  "Fashion", "Anime", "Cricket", "Bollywood", "K-Pop", "Coding",
];

export default function Home() {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { isEnabled } = useFeatureFlags();
  const [interests, setInterests] = useState<string[]>([]);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    setAgreed(localStorage.getItem("mb_tos") === "1");
  }, []);

  const start = (mode: string) => {
    if (!agreed) {
      localStorage.setItem("mb_tos", "1");
      setAgreed(true);
    }
    const iStr = interests.length ? `&interests=${encodeURIComponent(interests.join(","))}` : "";
    if (mode === "video") {
      router.push(`/camera-test?mode=video${iStr}`);
    } else {
      router.push(`/chat?mode=${mode}${iStr}`);
    }
  };

  return (
    <Layout>
      <Box sx={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.12) 0%, transparent 65%)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Hero */}
        <Container maxWidth="sm" sx={{ pt: { xs: 6, md: 10 }, pb: 4, textAlign: "center" }}>
          <Box sx={{ mb: 2 }}>
            <OnlineCounter />
          </Box>

          <Typography variant={isMobile ? "h3" : "h2"} sx={{
            fontWeight: 900, mb: 1, letterSpacing: -1,
            background: "linear-gradient(135deg, #fff 0%, #6C63FF 60%, #FF6584 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            MiloBolo
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 1, fontWeight: 400 }}>
            Talk to strangers — free, anonymous, instant.
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 4 }}>
            You are <Box component="span" sx={{ color: "primary.main", fontWeight: 700 }}>never</Box> required to register.
          </Typography>

          {/* Interest input */}
          {isEnabled("interest_matching") && (
            <Autocomplete
              multiple freeSolo
              options={COMMON_INTERESTS}
              value={interests}
              onChange={(_, v) => setInterests(v as string[])}
              renderInput={(params) => (
                <TextField {...params} placeholder="Add interests (optional)" size="small"
                  sx={{ mb: 3, "& .MuiOutlinedInput-root": { borderRadius: 3 } }} />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip label={option} size="small" {...getTagProps({ index })} key={option}
                    sx={{ bgcolor: "rgba(108,99,255,0.2)", borderRadius: 2 }} />
                ))
              }
              ChipProps={{ size: "small" }}
              limitTags={4}
            />
          )}

          {/* Start buttons */}
          <Stack spacing={2} sx={{ mb: 2 }}>
            {isEnabled("video_chat") && (
              <Button
                fullWidth variant="contained" size="large"
                startIcon={<VideoCallIcon />}
                onClick={() => start("video")}
                sx={{ py: 1.8, fontSize: 17, borderRadius: 3, fontWeight: 700,
                  background: "linear-gradient(135deg, #6C63FF, #8B5CF6)",
                  boxShadow: "0 4px 24px rgba(108,99,255,0.4)",
                  "&:hover": { boxShadow: "0 6px 32px rgba(108,99,255,0.6)" },
                }}>
                Video Chat
              </Button>
            )}
            {isEnabled("text_chat") && (
              <Button
                fullWidth variant="outlined" size="large"
                startIcon={<ChatIcon />}
                onClick={() => start("text")}
                sx={{ py: 1.8, fontSize: 17, borderRadius: 3, fontWeight: 700,
                  borderColor: "rgba(108,99,255,0.5)",
                  "&:hover": { borderColor: "#6C63FF", bgcolor: "rgba(108,99,255,0.08)" },
                }}>
                Text Chat
              </Button>
            )}
            <Button
              fullWidth variant="text" size="large"
              startIcon={<VisibilityIcon />}
              onClick={() => router.push("/spy")}
              sx={{ py: 1.4, fontSize: 15, borderRadius: 3, color: "text.secondary",
                "&:hover": { color: "text.primary", bgcolor: "rgba(255,255,255,0.05)" },
              }}>
              Question / Spy Mode
            </Button>
          </Stack>

          <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 3 }}>
            By chatting you agree to our{" "}
            <Link href="/terms" style={{ color: "#6C63FF" }}>Terms of Service</Link>
            {" & "}
            <Link href="/privacy" style={{ color: "#6C63FF" }}>Privacy Policy</Link>.
            {" "}You must be 18+.
          </Typography>

          {/* Keyboard hints */}
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ opacity: 0.4 }}>
            {[["Esc", "Stop"], ["Ctrl+↵", "Next"]].map(([key, action]) => (
              <Stack key={key} direction="row" spacing={0.5} alignItems="center">
                <Box component="kbd" sx={{
                  px: 0.75, py: 0.25, borderRadius: 1, fontSize: 11, fontFamily: "monospace",
                  bgcolor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                }}>{key}</Box>
                <Typography variant="caption" fontSize={11}>{action}</Typography>
              </Stack>
            ))}
          </Stack>
        </Container>

        <Divider sx={{ opacity: 0.1, mx: 4 }} />

        {/* Ad slot */}
        {isEnabled("google_ads") && (
          <Container maxWidth="md" sx={{ py: 2 }}>
            <AdSlot slotId="homepage-banner" format="horizontal" />
          </Container>
        )}

        {/* Features grid */}
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Grid container spacing={3}>
            {[
              { emoji: "🔒", title: "End-to-End Encrypted", desc: "All messages encrypted with WebCrypto. The server cannot read your chats." },
              { emoji: "⚡", title: "Instant Matching", desc: "Matched in under 1 second. No waiting, no ads between chats." },
              { emoji: "🎭", title: "Truly Anonymous", desc: "No account required. No phone number. Just open and chat." },
              { emoji: "🌍", title: "Interest Matching", desc: "Add tags like Gaming or Music and get matched with someone similar." },
              { emoji: "🎥", title: "HD Video + Screen Share", desc: "Crystal clear WebRTC video with screen sharing built in." },
              { emoji: "🕵️", title: "Spy / Question Mode", desc: "Ask a question and watch two strangers debate it live." },
            ].map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f.title}>
                <Paper sx={{
                  p: 3, height: "100%", borderRadius: 3,
                  border: "1px solid rgba(108,99,255,0.1)",
                  transition: "all 0.2s",
                  "&:hover": { border: "1px solid rgba(108,99,255,0.35)", transform: "translateY(-2px)" },
                }}>
                  <Typography fontSize={28} mb={1}>{f.emoji}</Typography>
                  <Typography fontWeight={700} mb={0.5}>{f.title}</Typography>
                  <Typography variant="body2" color="text.secondary" lineHeight={1.6}>{f.desc}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>

        {/* Footer */}
        <Box component="footer" sx={{ borderTop: "1px solid rgba(255,255,255,0.06)", mt: 4, py: 4 }}>
          <Container maxWidth="md">
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems="center">
              <Typography variant="body2" fontWeight={800} sx={{
                background: "linear-gradient(135deg,#6C63FF,#FF6584)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                MiloBolo
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" justifyContent="center">
                {[
                  { label: "Terms", href: "/terms" },
                  { label: "Privacy", href: "/privacy" },
                  { label: "Spy Mode", href: "/spy" },
                  { label: "Camera Test", href: "/camera-test" },
                ].map((l) => (
                  <Link key={l.href} href={l.href} style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, textDecoration: "none" }}>
                    {l.label}
                  </Link>
                ))}
              </Stack>
              <Typography variant="caption" color="text.disabled">
                © {new Date().getFullYear()} MiloBolo — Always free
              </Typography>
            </Stack>
          </Container>
        </Box>
      </Box>
    </Layout>
  );
}

import { useRouter } from "next/router";
import {
  Box, Container, Typography, Button, Grid, Card, CardContent,
  Chip, Stack, useMediaQuery, useTheme,
} from "@mui/material";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import ChatIcon from "@mui/icons-material/Chat";
import SecurityIcon from "@mui/icons-material/Security";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import PublicIcon from "@mui/icons-material/Public";
import Layout from "@/components/Layout";
import { useFeatureFlags } from "@/context/FeatureFlagContext";
import AdSlot from "@/components/AdSlot";

export default function Home() {
  const router = useRouter();
  const { isEnabled } = useFeatureFlags();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const features = [
    { icon: <VideoCallIcon />, title: "HD Video Chat", desc: "Crystal clear video with strangers using WebRTC technology." },
    { icon: <ChatIcon />, title: "Text Mode", desc: "Prefer text? Switch to text-only mode anytime." },
    { icon: <SecurityIcon />, title: "Safe & Moderated", desc: "AI moderation + community reporting keeps chats safe." },
    { icon: <FlashOnIcon />, title: "Instant Match", desc: "Get paired in seconds. No waiting, no login required." },
    { icon: <PublicIcon />, title: "Meet India", desc: "Connect with people from across India and the world." },
  ];

  return (
    <Layout>
      {/* Hero */}
      <Box sx={{
        minHeight: "90vh", display: "flex", alignItems: "center",
        background: "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.15) 0%, transparent 70%)",
      }}>
        <Container maxWidth="md" sx={{ textAlign: "center", py: 8 }}>
          <Chip label="🇮🇳 Made for India" color="primary" variant="outlined" sx={{ mb: 3 }} />
          <Typography variant={isMobile ? "h3" : "h1"} sx={{
            fontWeight: 800, mb: 2,
            background: "linear-gradient(135deg, #FFFFFF 0%, #6C63FF 50%, #FF6584 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Milo. Bolo. Connect.
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ mb: 5, maxWidth: 500, mx: "auto", lineHeight: 1.7 }}>
            Video and text chat with random strangers from India and beyond. Anonymous, instant, free.
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
            {isEnabled("video_chat") && (
              <Button variant="contained" size="large" startIcon={<VideoCallIcon />}
                onClick={() => router.push("/chat?mode=video")}
                sx={{ py: 1.5, px: 4, fontSize: 16 }}>
                Start Video Chat
              </Button>
            )}
            {isEnabled("text_chat") && (
              <Button variant="outlined" size="large" startIcon={<ChatIcon />}
                onClick={() => router.push("/chat?mode=text")}
                sx={{ py: 1.5, px: 4, fontSize: 16 }}>
                Text Only
              </Button>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
            By continuing you agree to our Terms & Community Guidelines. 18+ only.
          </Typography>
        </Container>
      </Box>

      {/* Ad slot */}
      {isEnabled("google_ads") && (
        <Container maxWidth="lg" sx={{ py: 2 }}>
          <AdSlot slotId="homepage-banner" format="horizontal" />
        </Container>
      )}

      {/* Features */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h4" fontWeight={700} textAlign="center" mb={5}>
          Why MiloBolo?
        </Typography>
        <Grid container spacing={3}>
          {features.map((f) => (
            <Grid item xs={12} sm={6} md={4} key={f.title}>
              <Card sx={{ height: "100%", transition: "transform 0.2s", "&:hover": { transform: "translateY(-4px)" } }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ color: "primary.main", mb: 2 }}>{f.icon}</Box>
                  <Typography variant="h6" fontWeight={600} mb={1}>{f.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{f.desc}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Layout>
  );
}

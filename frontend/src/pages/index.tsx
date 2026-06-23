import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import {
  Box, Typography, Button, TextField, Stack, Chip,
  Autocomplete, Container, Divider, FormControl,
  InputLabel, Select, MenuItem, Collapse, Tooltip,
} from "@mui/material";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import OnlineCounter from "@/components/OnlineCounter";
import { useFeatureFlags } from "@/context/FeatureFlagContext";

const INTERESTS = [
  "Music", "Gaming", "Movies", "Sports", "Travel", "Food", "Technology",
  "Art", "Books", "Fitness", "Photography", "Dance", "Comedy", "Science",
  "Fashion", "Anime", "Cricket", "Bollywood", "K-Pop", "Coding",
  "Language Exchange", "Mental Health", "LGBTQ+", "Startup", "Philosophy",
  "History", "Cooking", "Yoga", "Meditation", "Drawing", "Writing",
];

const LANGUAGES = [
  { code: "", label: "Any Language" },
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "ar", label: "Arabic" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "ru", label: "Russian" },
  { code: "tr", label: "Turkish" },
  { code: "it", label: "Italian" },
];

export default function Home() {
  const router = useRouter();
  const { isEnabled } = useFeatureFlags();
  const [interests, setInterests] = useState<string[]>([]);
  const [language, setLanguage] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("mb_tos") !== "1") {
      localStorage.setItem("mb_tos", "1");
    }
  }, []);

  const start = (mode: string) => {
    const iStr = interests.length ? `&interests=${encodeURIComponent(interests.join(","))}` : "";
    const lStr = language ? `&lang=${language}` : "";
    if (mode === "video") router.push(`/camera-test?mode=video${iStr}${lStr}`);
    else router.push(`/chat?mode=${mode}${iStr}${lStr}`);
  };

  return (
    <>
      <Head>
        <title>MiloBolo — Talk to strangers!</title>
        <meta name="description" content="Video chat with strangers. Free, anonymous, no registration." />
      </Head>

      <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>

        {/* ── Header ── */}
        <Box component="header" sx={{
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          px: { xs: 2, md: 4 }, py: 1.5,
          display: "flex", alignItems: "center", gap: 2,
        }}>
          <Typography fontWeight={900} fontSize={22} sx={{
            background: "linear-gradient(135deg,#6C63FF,#FF6584)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            MiloBolo
          </Typography>
          <OnlineCounter />
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={2}>
            {[
              { label: "Video", href: "/camera-test?mode=video" },
              { label: "Text", href: "/chat?mode=text" },
              { label: "Spy Mode", href: "/spy" },
            ].map((l) => (
              <Typography key={l.href} component={Link} href={l.href}
                sx={{ fontSize: 14, color: "text.secondary", textDecoration: "none", "&:hover": { color: "text.primary" } }}>
                {l.label}
              </Typography>
            ))}
          </Stack>
        </Box>

        {/* ── Hero ── */}
        <Container maxWidth="sm" sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", py: 6, textAlign: "center" }}>

          <Typography variant="h2" fontWeight={900} sx={{
            mb: 0.5, letterSpacing: -1.5,
            background: "linear-gradient(135deg,#fff 0%,#6C63FF 55%,#FF6584 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            MiloBolo
          </Typography>
          <Typography variant="h5" color="text.secondary" fontWeight={400} sx={{ mb: 4 }}>
            Talk to strangers!
          </Typography>

          {/* Interest input */}
          {isEnabled("interest_matching") && (
            <Autocomplete
              multiple freeSolo
              options={INTERESTS}
              value={interests}
              onChange={(_, v) => setInterests(v as string[])}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder='What do you wanna talk about? (optional)'
                  size="small"
                  sx={{ mb: 2, "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)" } }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip label={option} size="small" {...getTagProps({ index })} key={option}
                    sx={{ bgcolor: "rgba(108,99,255,0.2)", borderRadius: 1.5 }} />
                ))
              }
              limitTags={5}
            />
          )}

          {/* Filters toggle */}
          <Stack direction="row" justifyContent="flex-end" mb={0.5}>
            <Button
              size="small"
              variant={showFilters ? "contained" : "text"}
              startIcon={<TuneIcon fontSize="small" />}
              onClick={() => setShowFilters((x) => !x)}
              sx={{ color: showFilters ? undefined : "text.disabled", fontSize: 12 }}
            >
              Filters
            </Button>
          </Stack>

          <Collapse in={showFilters}>
            <Box mb={1.5}>
              <FormControl fullWidth size="small" sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)" } }}>
                <InputLabel>Language Preference</InputLabel>
                <Select
                  value={language}
                  label="Language Preference"
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  {LANGUAGES.map((l) => (
                    <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Collapse>

          {/* Main buttons */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 1.5 }}>
            {isEnabled("video_chat") && (
              <Button
                fullWidth variant="contained" size="large"
                startIcon={<VideoCallIcon />}
                onClick={() => start("video")}
                sx={{
                  py: 1.6, fontSize: 16, fontWeight: 700, borderRadius: 2,
                  background: "linear-gradient(135deg,#6C63FF,#8B5CF6)",
                  boxShadow: "0 4px 20px rgba(108,99,255,0.35)",
                  "&:hover": { boxShadow: "0 6px 28px rgba(108,99,255,0.55)" },
                }}>
                Video
              </Button>
            )}
            {isEnabled("text_chat") && (
              <Button
                fullWidth variant="outlined" size="large"
                startIcon={<ChatBubbleOutlineIcon />}
                onClick={() => start("text")}
                sx={{
                  py: 1.6, fontSize: 16, fontWeight: 700, borderRadius: 2,
                  borderColor: "rgba(108,99,255,0.5)",
                  "&:hover": { borderColor: "#6C63FF", bgcolor: "rgba(108,99,255,0.07)" },
                }}>
                Text
              </Button>
            )}
          </Stack>

          <Button
            variant="text" size="small"
            startIcon={<VisibilityOutlinedIcon />}
            onClick={() => router.push("/spy")}
            sx={{ alignSelf: "center", color: "text.secondary", fontSize: 13,
              "&:hover": { color: "text.primary" } }}>
            Spy / Question Mode
          </Button>

          <Typography variant="caption" color="text.disabled" sx={{ mt: 3, lineHeight: 1.8 }}>
            By chatting you confirm you are{" "}
            <Box component="span" fontWeight={700} color="text.secondary">18+ years old</Box>
            {" "}and agree to our{" "}
            <Link href="/terms" style={{ color: "#6C63FF", textDecoration: "none" }}>Terms</Link>
            {" & "}
            <Link href="/privacy" style={{ color: "#6C63FF", textDecoration: "none" }}>Privacy Policy</Link>.
          </Typography>
        </Container>

        {/* ── What is MiloBolo ── */}
        <Divider sx={{ opacity: 0.07 }} />
        <Container maxWidth="md" sx={{ py: 5 }}>
          <Typography variant="h6" fontWeight={700} mb={2} textAlign="center">What is MiloBolo?</Typography>
          <Typography color="text.secondary" textAlign="center" maxWidth={600} mx="auto" lineHeight={1.8}>
            MiloBolo lets you video chat or text chat with a random stranger — no account, no phone number, nothing.
            Click <strong>Video</strong> or <strong>Text</strong> and you are instantly connected to someone new.
            Use <strong>Spy Mode</strong> to ask a question and watch two strangers discuss it.
            All video calls are peer-to-peer and end-to-end encrypted. Always free.
          </Typography>

          <Stack direction="row" flexWrap="wrap" justifyContent="center" gap={2} mt={4}>
            {[
              ["🔒", "E2E encrypted"],
              ["⚡", "Instant matching"],
              ["🎭", "Fully anonymous"],
              ["🌍", "Interest matching"],
              ["🕵️", "Spy Mode"],
              ["📱", "Mobile ready"],
              ["🎨", "70+ themes"],
              ["♿", "70+ a11y features"],
              ["🆓", "Always free"],
              ["🌐", "190+ countries"],
            ].map(([icon, label]) => (
              <Chip key={label} label={`${icon} ${label}`} variant="outlined"
                sx={{ borderColor: "rgba(255,255,255,0.1)", color: "text.secondary", fontSize: 13 }} />
            ))}
          </Stack>
        </Container>

        {/* ── Footer ── */}
        <Box component="footer" sx={{ borderTop: "1px solid rgba(255,255,255,0.06)", py: 3 }}>
          <Container maxWidth="lg">
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" spacing={1.5} flexWrap="wrap" gap={1}>
              <Typography variant="caption" color="text.disabled">© {new Date().getFullYear()} MiloBolo — Always free forever</Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" justifyContent="center" gap={1}>
                {[
                  { label: "About", href: "/about" },
                  { label: "Blog", href: "/blog" },
                  { label: "Contact", href: "/contact" },
                  { label: "Guidelines", href: "/guidelines" },
                  { label: "Privacy", href: "/privacy" },
                  { label: "Terms", href: "/terms" },
                  { label: "Cookies", href: "/cookies" },
                ].map((l) => (
                  <Link key={l.href} href={l.href}
                    style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, textDecoration: "none" }}>
                    {l.label}
                  </Link>
                ))}
              </Stack>
            </Stack>
          </Container>
        </Box>
      </Box>
    </>
  );
}

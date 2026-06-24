import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import {
  Box, Typography, Button, TextField, Stack, Chip,
  Autocomplete, Container, Divider, FormControl,
  InputLabel, Select, MenuItem, Collapse, Accordion,
  AccordionSummary, AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import VideoCallIcon from "@mui/icons-material/VideoCall";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import MicIcon from "@mui/icons-material/Mic";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import OnlineCounter from "@/components/OnlineCounter";
import { useFeatureFlags } from "@/context/FeatureFlagContext";
import { useSettings } from "@/hooks/useSettings";

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

function useCountUp(target: number, duration = 1800, trigger: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, trigger]);
  return count;
}

function StatCard({ value, suffix, label, color }: { value: number; suffix: string; label: string; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const count = useCountUp(value, 1600, visible);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <Box ref={ref} sx={{ textAlign: "center", px: 2, py: 1 }}>
      <Typography variant="h3" fontWeight={900} sx={{
        background: `linear-gradient(135deg, ${color}, #fff)`,
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        lineHeight: 1,
      }}>
        {count.toLocaleString()}{suffix}
      </Typography>
      <Typography variant="body2" color="text.secondary" mt={0.5}>{label}</Typography>
    </Box>
  );
}

export default function Home() {
  const router = useRouter();
  const { isEnabled } = useFeatureFlags();
  const appSettings = useSettings();
  const [interests, setInterests] = useState<string[]>([]);
  const [language, setLanguage] = useState(() =>
    typeof window !== "undefined"
      ? (JSON.parse(localStorage.getItem("mb_settings") || "{}").defaultLanguage || "")
      : ""
  );
  const [gender, setGender] = useState("any"); // "any" | "male" | "female"
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("mb_tos") !== "1") {
      localStorage.setItem("mb_tos", "1");
    }
  }, []);

  const start = (mode?: string) => {
    const m = mode || appSettings.defaultMode;
    const iStr = interests.length ? `&interests=${encodeURIComponent(interests.join(","))}` : "";
    const lStr = language ? `&lang=${language}` : "";
    const gStr = gender !== "any" ? `&gender=${gender}` : "";
    if (m === "video") router.push(`/camera-test?mode=video${iStr}${lStr}${gStr}`);
    else if (m === "voice") router.push(`/chat?mode=voice${iStr}${lStr}${gStr}`);
    else router.push(`/chat?mode=${m}${iStr}${lStr}${gStr}`);
  };

  return (
    <>
      <Head>
        <title>MiloBolo — Free Random Video Chat with Strangers</title>
        <meta name="description" content="MiloBolo — free, anonymous, end-to-end encrypted random video and text chat. Connect with strangers worldwide instantly. No registration required. Always free." />
        <meta name="keywords" content="random chat, video chat, stranger chat, omegle alternative, free chat, anonymous chat, milobolo" />
        <meta property="og:title" content="MiloBolo — Free Random Video Chat" />
        <meta property="og:description" content="Chat with random strangers via video or text. Free, anonymous, encrypted. No account needed." />
        <meta property="og:type" content="website" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                { "@type": "Question", name: "Is MiloBolo free?", acceptedAnswer: { "@type": "Answer", text: "Yes — MiloBolo is 100% free forever. No premium tier, no coins, no subscriptions." } },
                { "@type": "Question", name: "Do I need an account?", acceptedAnswer: { "@type": "Answer", text: "No account needed for video chat, text chat, or spy mode. Registration is optional for chat history and connections." } },
                { "@type": "Question", name: "Is MiloBolo safe?", acceptedAnswer: { "@type": "Answer", text: "All messages are end-to-end encrypted. No video or audio is stored. Comprehensive reporting and ban tools protect users." } },
                { "@type": "Question", name: "What age is required?", acceptedAnswer: { "@type": "Answer", text: "MiloBolo is strictly 18+. Age confirmation is required before accessing any chat feature." } },
              ],
            }),
          }}
        />
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
              { label: "Voice", href: "/chat?mode=voice" },
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
          <Typography variant="h5" color="text.secondary" fontWeight={400} sx={{ mb: 3 }}>
            Talk to strangers!
          </Typography>

          {/* Mood selector */}
          <Stack direction="row" spacing={1} justifyContent="center" mb={2} flexWrap="wrap" gap={1}>
            {[
              { emoji: "😊", label: "Just Chat" },
              { emoji: "🎓", label: "Learn" },
              { emoji: "🌍", label: "Travel" },
              { emoji: "🎮", label: "Gaming" },
              { emoji: "💬", label: "Language" },
            ].map(({ emoji, label }) => (
              <Chip
                key={label}
                label={`${emoji} ${label}`}
                size="small"
                onClick={() => {
                  if (!interests.includes(label)) setInterests((prev) => [...prev.slice(-4), label]);
                }}
                sx={{
                  cursor: "pointer",
                  bgcolor: interests.includes(label) ? "rgba(108,99,255,0.25)" : "rgba(255,255,255,0.06)",
                  border: "1px solid",
                  borderColor: interests.includes(label) ? "primary.main" : "rgba(255,255,255,0.1)",
                  color: interests.includes(label) ? "primary.main" : "text.secondary",
                  "&:hover": { bgcolor: "rgba(108,99,255,0.15)" },
                }}
              />
            ))}
          </Stack>

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
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 1.5 }}>
              <FormControl fullWidth size="small" sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)" } }}>
                <InputLabel>Language Preference</InputLabel>
                <Select value={language} label="Language Preference" onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, bgcolor: "rgba(255,255,255,0.04)" } }}>
                <InputLabel>Match with</InputLabel>
                <Select value={gender} label="Match with" onChange={(e) => setGender(e.target.value)}>
                  <MenuItem value="any">Anyone</MenuItem>
                  <MenuItem value="male">Males</MenuItem>
                  <MenuItem value="female">Females</MenuItem>
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
            <Button
              fullWidth variant="outlined" size="large"
              startIcon={<MicIcon />}
              onClick={() => start("voice")}
              sx={{
                py: 1.6, fontSize: 16, fontWeight: 700, borderRadius: 2,
                borderColor: "rgba(255,101,132,0.5)",
                color: "#FF6584",
                "&:hover": { borderColor: "#FF6584", bgcolor: "rgba(255,101,132,0.07)" },
              }}>
              Voice
            </Button>
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

        {/* ── How it works ── */}
        <Divider sx={{ opacity: 0.07 }} />
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Typography variant="h6" fontWeight={700} mb={1} textAlign="center">How it works</Typography>
          <Typography color="text.secondary" textAlign="center" mb={5} fontSize={14}>
            Three steps to your next great conversation
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 3 }}>
            {[
              {
                step: "1",
                title: "Pick your mode",
                body: "Choose Video for face-to-face, Text for anonymous messaging, or Spy Mode to watch a conversation unfold.",
                color: "#6C63FF",
              },
              {
                step: "2",
                title: "Get matched instantly",
                body: "Our interest-based algorithm connects you with someone sharing your topics in seconds — no waiting rooms.",
                color: "#FF6584",
              },
              {
                step: "3",
                title: "Chat freely",
                body: "Your session is end-to-end encrypted. Skip at any time, add friends, or just enjoy the conversation.",
                color: "#22c55e",
              },
            ].map(({ step, title, body, color }) => (
              <Box key={step} sx={{ textAlign: "center", px: 2 }}>
                <Box sx={{
                  width: 52, height: 52, borderRadius: "50%", mx: "auto", mb: 2,
                  background: `linear-gradient(135deg, ${color}33, ${color}11)`,
                  border: `2px solid ${color}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Typography fontWeight={900} fontSize={20} sx={{ color }}>{step}</Typography>
                </Box>
                <Typography fontWeight={700} mb={0.75}>{title}</Typography>
                <Typography variant="body2" color="text.secondary" lineHeight={1.7}>{body}</Typography>
              </Box>
            ))}
          </Box>
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

        {/* ── Animated Stats ── */}
        <Divider sx={{ opacity: 0.07 }} />
        <Box sx={{ py: 5, bgcolor: "rgba(108,99,255,0.04)" }}>
          <Container maxWidth="md">
            <Typography variant="h6" fontWeight={700} textAlign="center" mb={4}>MiloBolo by the numbers</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
              <StatCard value={190} suffix="+" label="Countries connected" color="#6C63FF" />
              <StatCard value={4} suffix="" label="Chat modes" color="#FF6584" />
              <StatCard value={70} suffix="+" label="Themes & a11y features" color="#22c55e" />
              <StatCard value={100} suffix="%" label="Free forever" color="#f59e0b" />
            </Box>
          </Container>
        </Box>

        {/* ── Testimonials ── */}
        <Divider sx={{ opacity: 0.07 }} />
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Typography variant="h6" fontWeight={700} mb={1} textAlign="center">What people are saying</Typography>
          <Typography color="text.secondary" textAlign="center" mb={5} fontSize={14}>
            Real experiences from the MiloBolo community
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2.5 }}>
            {[
              { quote: "I was sceptical at first, but within 5 minutes I was having a genuine conversation with someone from Japan. The E2E encryption made me feel safe too.", author: "Priya S.", location: "Mumbai" },
              { quote: "The interest matching is actually smart — I typed 'philosophy' and got matched with someone who wanted to debate free will. We talked for 2 hours!", author: "Alex K.", location: "Berlin" },
              { quote: "Finally an Omegle alternative that actually works on mobile and doesn't have constant bots. The report system removes bad actors quickly.", author: "Arjun M.", location: "Bangalore" },
            ].map(({ quote, author, location }) => (
              <Box key={author} sx={{
                p: 3, borderRadius: 3,
                bgcolor: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                display: "flex", flexDirection: "column",
              }}>
                <Typography sx={{ fontSize: "22px", color: "primary.main", lineHeight: 1, mb: 1.5 }}>&ldquo;</Typography>
                <Typography variant="body2" color="text.secondary" lineHeight={1.7} flex={1}>{quote}</Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" fontWeight={700}>{author}</Typography>
                  <Typography variant="caption" color="text.disabled">{location}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Container>

        {/* ── FAQ ── */}
        <Divider sx={{ opacity: 0.07 }} />
        <Container maxWidth="md" sx={{ py: 6 }}>
          <Typography variant="h6" fontWeight={700} mb={3} textAlign="center">
            Frequently Asked Questions
          </Typography>
          {[
            { q: "Is MiloBolo free?", a: "Yes — MiloBolo is 100% free, forever. No premium tier, no coins, no subscriptions. We sustain the platform through non-intrusive advertising." },
            { q: "Do I need to create an account?", a: "No account needed for any core feature. Video chat, text chat, spy mode, and interest matching all work instantly without registration. Create an optional account only if you want chat history or friend connections." },
            { q: "Is MiloBolo safe?", a: "MiloBolo encrypts all text messages end-to-end, stores no video or audio, and has comprehensive reporting and fingerprint-based ban tools. Use our safety tips and trust your instincts — click Next any time." },
            { q: "What is Spy Mode?", a: "Spy Mode lets you ask a question anonymously and watch two strangers discuss it live. You can also join as a stranger and answer someone else's question while a spy watches silently." },
            { q: "Can I use MiloBolo on my phone?", a: "Yes — MiloBolo is fully mobile-optimised and works on any modern smartphone browser. You can also install it as a PWA (Add to Home Screen) for an app-like experience." },
            { q: "What age do I need to be?", a: "MiloBolo is strictly for users 18 and older. You must confirm your age before accessing any chat feature." },
          ].map(({ q, a }) => (
            <Accordion key={q} elevation={0}
              sx={{ bgcolor: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", mb: 1, borderRadius: "8px !important", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2" fontWeight={600}>{q}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" lineHeight={1.8}>{a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
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

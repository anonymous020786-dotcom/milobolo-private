import {
  Box, Container, Typography, Accordion, AccordionSummary, AccordionDetails,
  Chip, Stack, TextField, InputAdornment,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import Link from "next/link";
import { useState, useMemo } from "react";

const FAQS = [
  {
    category: "Getting Started",
    items: [
      { q: "What is MiloBolo?", a: "MiloBolo is a free random video and text chat platform that connects you with strangers worldwide. No account needed — click Video or Text and you're instantly matched with someone new." },
      { q: "Do I need to create an account?", a: "No. All core features — video chat, text chat, spy mode, and interest matching — work without registration. An optional account lets you save chat history, build connections, and customise your profile." },
      { q: "How do I start a chat?", a: "Go to the homepage, optionally select interests or a language, then click Video or Text. You'll be matched with a random stranger in seconds. Click Next at any time to move to a new person." },
      { q: "Is MiloBolo available on mobile?", a: "Yes — MiloBolo is fully mobile-optimised and works on any modern smartphone or tablet browser (Chrome, Safari, Firefox). You can also install it as a PWA from your browser's 'Add to Home Screen' option." },
      { q: "Is MiloBolo free?", a: "MiloBolo is 100% free, forever. There are no premium tiers, no coins, and no subscriptions. The platform is sustained through non-intrusive advertising." },
    ],
  },
  {
    category: "Safety & Privacy",
    items: [
      { q: "Is MiloBolo safe to use?", a: "MiloBolo uses end-to-end encryption for all text messages, stores no video or audio, and has comprehensive reporting and fingerprint-based ban tools. You can click Next at any time to leave a conversation." },
      { q: "Are chats end-to-end encrypted?", a: "Yes — text messages use ECDH P-256 key exchange and AES-GCM-256 encryption via the Web Crypto API. Video and audio are peer-to-peer (WebRTC) and never routed through MiloBolo servers." },
      { q: "Does MiloBolo store my conversations?", a: "No. Message content is never stored on MiloBolo servers. If you have an account, only session metadata (duration, mode, interests) is saved to your chat history — never the messages themselves." },
      { q: "Who can see my video?", a: "Only the person you are matched with can see your video. The stream is peer-to-peer and never passes through MiloBolo servers." },
      { q: "What age is required to use MiloBolo?", a: "MiloBolo is strictly for users 18 and older. You must confirm your age before accessing any chat feature. We take this seriously — reports of underage users are actioned immediately." },
      { q: "How do I report someone?", a: "During a chat, click the flag icon in the toolbar. Select a reason (inappropriate content, harassment, nudity, etc.), add optional details, and submit. Our moderation team reviews all reports." },
    ],
  },
  {
    category: "Features",
    items: [
      { q: "What is Spy Mode?", a: "In Spy Mode you can ask a question and watch two strangers discuss it anonymously, or join as a stranger and answer a question while a spy observes silently. It's a great way to explore different perspectives." },
      { q: "What are Topics?", a: "Topics lets you join interest-based rooms (Gaming, Music, Travel, etc.) where you are matched specifically with people who share that topic. Visit /topics to browse all 24 rooms." },
      { q: "How does interest matching work?", a: "When you enter interests on the homepage, MiloBolo's matching algorithm pairs you with someone who shares at least one of those interests. If no match is found within a timeout, it falls back to random matching." },
      { q: "What are reactions?", a: "During a video or text chat you can send emoji reactions (👍 ❤️ 😂 etc.) that float on screen for your chat partner to see. Click the emoji icon in the toolbar." },
      { q: "Can I share my screen?", a: "Yes — during a video chat, click the screen-share icon in the video toolbar to share your screen. Your partner will see it in their video panel." },
      { q: "What is the Leaderboard?", a: "The Leaderboard shows the top 50 registered users ranked by total chats. You need a free account to appear on it." },
    ],
  },
  {
    category: "Account & Profile",
    items: [
      { q: "How do I reset my password?", a: "Go to Sign In and click 'Forgot password?' We'll send a 6-digit OTP to your email. Verify it, then set your new password." },
      { q: "Can I use Google to sign in?", a: "Yes — if the Google sign-in feature is enabled, you'll see a 'Continue with Google' button on the login and register pages." },
      { q: "How do I enable two-factor authentication (2FA)?", a: "Go to Profile → Security & 2FA tab → 'Set Up 2FA'. Scan the QR code with Google Authenticator, Authy, or any TOTP app, then verify the code. Future logins will require your authenticator code." },
      { q: "How do I delete my account?", a: "Go to Profile → Danger Zone → Delete Account. You'll need to verify via email OTP. Deletion is permanent and removes all your data." },
      { q: "What is chat history?", a: "Chat history stores metadata about each session you complete (duration, mode, matched interest) — not the messages. You can search, filter, export as CSV, or delete individual records from /history." },
    ],
  },
  {
    category: "Technical",
    items: [
      { q: "My camera/microphone isn't working. What do I do?", a: "Go to /camera-test to test your camera and microphone. Make sure you've allowed camera/microphone permissions in your browser. On Chrome: click the lock icon in the address bar → Site settings." },
      { q: "The video quality is poor. Can I improve it?", a: "On the Camera Test page, click 'Show advanced settings' and select a higher resolution (1080p, 4K). Video quality also depends on your internet connection and your partner's hardware." },
      { q: "Why can't I connect to a stranger?", a: "This can happen if no one with matching interests is online, or if your network blocks WebRTC. Try removing interests for random matching, or check if a VPN/firewall is blocking peer connections." },
      { q: "Does MiloBolo work offline?", a: "MiloBolo has a Progressive Web App (PWA) service worker that caches static assets for offline access. You'll see an offline page if connectivity is lost during a chat — reconnection is automatic." },
      { q: "What browsers are supported?", a: "Chrome 80+, Firefox 75+, Safari 14+, Edge 80+. WebRTC (required for video chat) is not available in Opera Mini or older browsers." },
    ],
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.flatMap((sec) =>
    sec.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    }))
  ),
};

export default function FAQ() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return FAQS;
    return FAQS.map((sec) => ({
      ...sec,
      items: sec.items.filter((i) => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q)),
    })).filter((sec) => sec.items.length > 0);
  }, [search]);

  const totalFiltered = filtered.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <Layout title="FAQ — Frequently Asked Questions">
      <SeoHead
        title="FAQ — Frequently Asked Questions"
        description="Find answers to common questions about MiloBolo — safety, privacy, features, accounts, and technical help."
        path="/faq"
        jsonLd={jsonLd}
      />

      {/* Hero */}
      <Box sx={{
        py: { xs: 6, md: 9 }, textAlign: "center",
        background: "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.1) 0%, transparent 65%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}>
        <Container maxWidth="sm">
          <Chip label="Help Centre" color="primary" sx={{ mb: 2 }} />
          <Typography variant="h3" fontWeight={900} mb={1.5}>
            How can we help?
          </Typography>
          <Typography color="text.secondary" mb={4} fontSize={16}>
            {FAQS.reduce((a, s) => a + s.items.length, 0)} answers across {FAQS.length} categories
          </Typography>
          <TextField
            fullWidth
            placeholder="Search for anything…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
              sx: { borderRadius: 3, bgcolor: "rgba(255,255,255,0.04)", fontSize: 16 },
            }}
          />
          {search && (
            <Typography variant="caption" color="text.disabled" display="block" mt={1.5}>
              {totalFiltered} result{totalFiltered !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
            </Typography>
          )}
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: 6 }}>
        {filtered.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography color="text.secondary" mb={2}>No results for &ldquo;{search}&rdquo;</Typography>
            <Typography variant="body2" color="text.disabled">
              Try a different search term or{" "}
              <Link href="/contact" style={{ color: "#6C63FF" }}>contact us</Link>.
            </Typography>
          </Box>
        ) : (
          filtered.map((section) => (
            <Box key={section.category} sx={{ mb: 5 }}>
              <Stack direction="row" spacing={1.5} alignItems="center" mb={2.5}>
                <Typography variant="h6" fontWeight={700}>{section.category}</Typography>
                <Chip label={section.items.length} size="small" color="default" variant="outlined" />
              </Stack>
              {section.items.map(({ q, a }) => (
                <Accordion key={q} elevation={0}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    mb: 1, borderRadius: "10px !important",
                    "&:before": { display: "none" },
                    "&.Mui-expanded": { borderColor: "rgba(108,99,255,0.25)" },
                  }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ py: 0.5 }}>
                    <Typography variant="body2" fontWeight={600}>{q}</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0, pb: 2.5 }}>
                    <Typography variant="body2" color="text.secondary" lineHeight={1.8}>{a}</Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          ))
        )}

        <Box sx={{
          mt: 4, p: 3.5, borderRadius: 3,
          bgcolor: "rgba(108,99,255,0.06)",
          border: "1px solid rgba(108,99,255,0.15)",
          textAlign: "center",
        }}>
          <Typography fontWeight={700} mb={0.75}>Still have questions?</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Can&apos;t find what you&apos;re looking for? Our team is here to help.
          </Typography>
          <Link href="/contact" style={{ color: "#6C63FF", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>
            Contact us →
          </Link>
        </Box>
      </Container>
    </Layout>
  );
}

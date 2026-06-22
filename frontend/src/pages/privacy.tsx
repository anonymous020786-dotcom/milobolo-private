import { useRouter } from "next/router";
import { Box, Container, Typography, Button, Paper, Stack, Divider } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Layout from "@/components/Layout";

export default function Privacy() {
  const router = useRouter();
  return (
    <Layout title="Privacy Policy">
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()} sx={{ mb: 3 }}>Back</Button>
        <Typography variant="h4" fontWeight={800} mb={1}>Privacy Policy</Typography>
        <Typography variant="body2" color="text.secondary" mb={4}>Last updated: June 2025</Typography>
        <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
          <Stack spacing={4}>
            {[
              {
                title: "1. What we collect",
                body: "We collect minimal data: IP address (for country matching and ban enforcement, discarded after session), browser fingerprint hash (for ban enforcement only), session metadata (duration, message count — no message content), and account info if you register (email, display name, avatar).",
              },
              {
                title: "2. What we do NOT collect",
                body: "We never store chat messages — all text chats are end-to-end encrypted and the server only relays ciphertext. We do not sell, share, or monetise your personal data. We do not track your browsing history outside MiloBolo.",
              },
              {
                title: "3. Cookies & Local Storage",
                body: "We use localStorage to remember your age confirmation and interests. We use session cookies for authentication if you sign in. We use Google Analytics cookies (if enabled) to understand aggregate usage patterns.",
              },
              {
                title: "4. Third-party services",
                body: "Google Analytics (aggregate analytics), Google AdSense (advertising), reCAPTCHA v3 (bot protection), Supabase (authentication and database — EU hosted), Cloudflare R2 (avatar storage). Each has its own privacy policy.",
              },
              {
                title: "5. Data retention",
                body: "Session metadata is retained for 90 days. Reports are retained for 1 year for moderation purposes. Account data is retained until you delete your account. IP address logs are not persistently stored.",
              },
              {
                title: "6. Your rights",
                body: "You can delete your account and all associated data at any time from your Profile settings. You can request a copy of your data by contacting us. You can opt out of analytics by using a browser extension.",
              },
              {
                title: "7. Contact",
                body: "Privacy questions: support@videodownloaders.cloud",
              },
            ].map((s, i) => (
              <Box key={i}>
                <Typography variant="h6" fontWeight={700} mb={1.5}>{s.title}</Typography>
                <Typography color="text.secondary" lineHeight={1.8}>{s.body}</Typography>
                {i < 6 && <Divider sx={{ mt: 3, opacity: 0.15 }} />}
              </Box>
            ))}
          </Stack>
        </Paper>
      </Container>
    </Layout>
  );
}

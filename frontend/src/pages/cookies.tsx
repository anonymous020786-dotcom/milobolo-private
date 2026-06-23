import Layout from "@/components/Layout";
import {
  Box, Chip, Container, Divider, Paper, Stack, Table,
  TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import CookieIcon from "@mui/icons-material/Cookie";

const LAST_UPDATED = "20 June 2025";

const COOKIES_TABLE = [
  { name: "mb_tos", type: "Essential", duration: "Session", purpose: "Records age gate confirmation (18+). Required to access chat features." },
  { name: "mb_theme", type: "Preferences", duration: "Persistent", purpose: "Stores your chosen colour theme. Never sent to servers." },
  { name: "mb_a11y", type: "Preferences", duration: "Persistent", purpose: "Stores accessibility feature settings. Never sent to servers." },
  { name: "mb_cookie_consent", type: "Essential", duration: "1 year", purpose: "Records your cookie consent choices." },
  { name: "mb_welcome_seen", type: "Preferences", duration: "Persistent", purpose: "Hides the welcome onboarding modal after first visit." },
  { name: "sb-*", type: "Essential", duration: "Session", purpose: "Supabase authentication session cookie (set only when logged in)." },
  { name: "_ga, _ga_*", type: "Analytics", duration: "2 years", purpose: "Google Analytics — helps us understand aggregate site usage. Set only if you accept analytics cookies." },
  { name: "NID, IDE, DSID", type: "Marketing", duration: "Varies", purpose: "Google AdSense advertising cookies. Set only if you accept marketing cookies." },
];

const TYPE_COLORS: Record<string, any> = {
  Essential: "success",
  Preferences: "info",
  Analytics: "warning",
  Marketing: "error",
};

export default function CookiesPage() {
  return (
    <Layout
      title="Cookie Policy"
      description="MiloBolo's complete cookie policy — what we store, why, and how to manage your cookie preferences."
    >
      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
          <CookieIcon color="warning" sx={{ fontSize: 32 }} />
          <Typography variant="h3" fontWeight={900}>
            Cookie Policy
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={4}>
          Last updated: {LAST_UPDATED}
        </Typography>

        <Typography variant="body1" color="text.secondary" mb={5} lineHeight={1.9}>
          This Cookie Policy explains what cookies and similar technologies MiloBolo ("we", "us") uses, why we use them, and how you can control them. By using MiloBolo, you agree to the use of essential cookies as described below.
        </Typography>

        <Section title="1. What Are Cookies?">
          Cookies are small text files or data items stored on your device by your browser when you visit a website. They allow the site to remember your preferences, keep you logged in, and gather analytics data. MiloBolo primarily uses browser localStorage rather than traditional cookies for preference storage — the effect is similar but localStorage data is never automatically transmitted to servers.
        </Section>

        <Section title="2. Categories of Cookies We Use">
          <Box mb={2}>
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} mb={2}>
              {["Essential", "Preferences", "Analytics", "Marketing"].map((t) => (
                <Chip key={t} label={t} color={TYPE_COLORS[t]} size="small" />
              ))}
            </Stack>
          </Box>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 550 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Duration</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Purpose</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {COOKIES_TABLE.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell><code>{row.name}</code></TableCell>
                    <TableCell>
                      <Chip label={row.type} color={TYPE_COLORS[row.type]} size="small" />
                    </TableCell>
                    <TableCell>{row.duration}</TableCell>
                    <TableCell>{row.purpose}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Section>

        <Section title="3. Essential Cookies">
          Essential cookies are required for the website to function. They enable core security features, session management, and remember your consent choices. You cannot opt out of essential cookies while using MiloBolo.
        </Section>

        <Section title="4. Preference Cookies">
          Preference cookies remember settings you have chosen, such as your colour theme and accessibility features. These are stored in localStorage and are never sent to MiloBolo's servers. You can clear these at any time by clearing your browser's local storage or via your Cookie Preferences settings.
        </Section>

        <Section title="5. Analytics Cookies">
          If you accept analytics cookies, Google Analytics will set cookies to help us understand how visitors use MiloBolo. All data is anonymised and aggregated — we cannot identify individual users from analytics data. You can opt out via your cookie preferences, by using a browser extension like uBlock Origin, or via Google's opt-out tool at tools.google.com/dlpage/gaoptout.
        </Section>

        <Section title="6. Marketing Cookies">
          If you accept marketing cookies, Google AdSense may set cookies to show you relevant advertisements. You can opt out via your cookie preferences. Note: opting out means you will still see advertisements, but they will not be personalised to your interests.
        </Section>

        <Section title="7. Managing Your Cookie Preferences">
          You can update your cookie preferences at any time by clicking the "Cookie Preferences" option in the footer, or by clearing your browser's localStorage. Browser-level controls are also available in your browser settings.
        </Section>

        <Section title="8. Third-Party Cookies">
          Some cookies are set by third-party services we use:
          {"\n\n"}• Google Analytics (analytics.google.com/analytics)
          {"\n"}• Google AdSense (google.com/adsense)
          {"\n"}• Google reCAPTCHA (google.com/recaptcha)
          {"\n\n"}Each of these services has its own privacy policy and cookie practices. We encourage you to review them.
        </Section>

        <Section title="9. Changes to This Policy">
          We may update this Cookie Policy from time to time. Material changes will be communicated via a notice on the website. The "Last updated" date at the top reflects the most recent revision.
        </Section>

        <Section title="10. Contact Us">
          Questions about this Cookie Policy? Email us via the Contact page or reach us on WhatsApp via the button on this page.
        </Section>
      </Container>
    </Layout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box mb={4}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" lineHeight={1.9} sx={{ whiteSpace: "pre-line" }}>
        {children}
      </Typography>
      <Divider sx={{ mt: 3 }} />
    </Box>
  );
}

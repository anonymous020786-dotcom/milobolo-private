import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import {
  Box, Chip, Container, Divider, Paper, Stack, Typography, useTheme,
} from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import WarningIcon from "@mui/icons-material/Warning";
import ShieldIcon from "@mui/icons-material/Shield";

const LAST_UPDATED = "20 June 2025";

const ALLOWED = [
  "Friendly conversation on any appropriate topic",
  "Language practice and cultural exchange",
  "Sharing opinions respectfully, including controversial topics",
  "Using reactions, emoji, and expressions freely",
  "Ending or skipping conversations at any time, for any reason",
  "Asking questions through Spy Mode",
  "Sharing hobbies, music, art, and creative work",
  "Discussion of news, politics, and social issues — respectfully",
];

const PROHIBITED = [
  "Nudity or sexual content of any kind (including partial nudity)",
  "Sexual content involving minors — immediately reported to authorities",
  "Harassment, threats, or intimidation of any kind",
  "Hate speech based on race, ethnicity, religion, gender, sexuality, disability, or nationality",
  "Soliciting personal information through pressure or manipulation",
  "Sending spam, running bots, or using automated connections",
  "Impersonating MiloBolo staff, moderators, or other users",
  "Sharing malware, phishing links, or malicious content",
  "Sextortion, blackmail, or coercive financial requests",
  "Any content that is illegal in the user's jurisdiction",
];

const CONSEQUENCES = [
  { level: "Minor Violations", result: "Warning and temporary session block (1-24 hours)" },
  { level: "Moderate Violations", result: "7-day ban from all MiloBolo features" },
  { level: "Serious Violations", result: "Permanent ban across all browsers and devices" },
  { level: "Illegal Content", result: "Permanent ban + report to relevant law enforcement authorities" },
];

export default function GuidelinesPage() {
  const theme = useTheme();
  return (
    <Layout
      title="Community Guidelines"
      description="MiloBolo's community standards — what is allowed, what is prohibited, and how we enforce our rules to keep everyone safe."
    >
      <SeoHead title="Community Guidelines" description="MiloBolo's community standards — what is allowed, what is prohibited, and how we enforce our rules to keep everyone safe." path="/guidelines" />
      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
          <GavelIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h3" fontWeight={900}>
            Community Guidelines
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={4}>
          Last updated: {LAST_UPDATED}
        </Typography>

        <Typography variant="body1" color="text.secondary" mb={2} lineHeight={1.9}>
          MiloBolo connects millions of strangers every day. Our community guidelines exist to ensure every user — regardless of background, language, or experience — can enjoy genuine, safe conversations.
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={5} lineHeight={1.9}>
          These guidelines apply to all users of MiloBolo in all chat modes: Video Chat, Text Chat, and Spy Mode. By using MiloBolo, you agree to follow these guidelines. Violations may result in temporary or permanent removal from the platform.
        </Typography>

        {/* The Golden Rule */}
        <Paper
          sx={{
            p: 3,
            mb: 5,
            borderRadius: 3,
            borderLeft: `4px solid ${theme.palette.primary.main}`,
            bgcolor: `${theme.palette.primary.main}08`,
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
            <ShieldIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              The Golden Rule
            </Typography>
          </Stack>
          <Typography variant="body1" color="text.secondary" lineHeight={1.9}>
            Treat every stranger with the same respect and dignity you would want to receive. If you would not want someone to say or do something to you, don't say or do it to them. This simple principle covers most situations not explicitly addressed below.
          </Typography>
        </Paper>

        {/* Allowed */}
        <Box mb={5}>
          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
            <CheckCircleIcon color="success" />
            <Typography variant="h6" fontWeight={700} color="success.main">
              What Is Allowed
            </Typography>
          </Stack>
          <Stack spacing={1}>
            {ALLOWED.map((item) => (
              <Stack key={item} direction="row" spacing={1.5} alignItems="flex-start">
                <CheckCircleIcon sx={{ fontSize: 18, color: "success.main", mt: 0.3, flexShrink: 0 }} />
                <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                  {item}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Divider sx={{ mb: 5 }} />

        {/* Prohibited */}
        <Box mb={5}>
          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
            <CancelIcon color="error" />
            <Typography variant="h6" fontWeight={700} color="error.main">
              What Is Never Allowed
            </Typography>
          </Stack>
          <Stack spacing={1}>
            {PROHIBITED.map((item) => (
              <Stack key={item} direction="row" spacing={1.5} alignItems="flex-start">
                <CancelIcon sx={{ fontSize: 18, color: "error.main", mt: 0.3, flexShrink: 0 }} />
                <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                  {item}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        <Divider sx={{ mb: 5 }} />

        {/* Consequences */}
        <Box mb={5}>
          <Stack direction="row" spacing={1} alignItems="center" mb={2}>
            <WarningIcon color="warning" />
            <Typography variant="h6" fontWeight={700}>
              Consequences of Violations
            </Typography>
          </Stack>
          <Stack spacing={2}>
            {CONSEQUENCES.map((c, i) => (
              <Box
                key={c.level}
                p={2}
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  borderLeft: `4px solid ${
                    i === 0 ? theme.palette.warning.main
                    : i === 1 ? theme.palette.error.light
                    : i === 2 ? theme.palette.error.main
                    : "#b71c1c"
                  }`,
                }}
              >
                <Typography variant="subtitle2" fontWeight={700}>
                  {c.level}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {c.result}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        <Divider sx={{ mb: 5 }} />

        <Section title="How to Report">
          During any chat, click the Flag icon (🚩) to report a user. Select the violation type — we offer categories including: Inappropriate content, Nudity, Harassment, Spam/Bot, Possible minor, and Other.{"\n\n"}Reports are reviewed by our moderation team. Verified violations result in the consequences described above. Thank you for helping keep MiloBolo safe.
        </Section>

        <Section title="Protection of Minors">
          MiloBolo is strictly 18+. Any content or behaviour that sexually exploits, solicits, or endangers minors will result in immediate permanent banning and referral to relevant law enforcement authorities including NCMEC (US), IWF (UK), and NCRB (India). We have zero tolerance for any form of child exploitation.
        </Section>

        <Section title="False Reporting">
          Deliberately filing false reports to get users banned is itself a violation. False reporting is taken seriously and may result in suspension of the reporting account.
        </Section>

        <Section title="Appeals">
          If you believe you were banned in error, contact us via the Contact page with your browser fingerprint hash (available in your profile if logged in) and a description of the situation. Appeals are reviewed within 5 business days.
        </Section>

        <Section title="Updates">
          These guidelines may be updated from time to time. Continued use of MiloBolo after updates constitutes acceptance of the revised guidelines.
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

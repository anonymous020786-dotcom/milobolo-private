import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import {
  Box, Card, CardContent, Chip, Container, Divider, Grid,
  Stack, Typography, useTheme,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import LockIcon from "@mui/icons-material/Lock";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import FavoriteIcon from "@mui/icons-material/Favorite";
import PublicIcon from "@mui/icons-material/Public";
import SecurityIcon from "@mui/icons-material/Security";

const STATS = [
  { label: "Countries Connected", value: "190+", icon: <PublicIcon fontSize="large" /> },
  { label: "Chat Modes", value: "3", icon: <FlashOnIcon fontSize="large" /> },
  { label: "Themes Available", value: "70+", icon: null },
  { label: "Always Free", value: "100%", icon: <FavoriteIcon fontSize="large" /> },
];

const VALUES = [
  {
    icon: <LockIcon sx={{ fontSize: 40 }} />,
    title: "Privacy by Default",
    desc: "No messages stored. No video recorded. No identity required. Your conversations belong to you and disappear when you leave.",
  },
  {
    icon: <FavoriteIcon sx={{ fontSize: 40 }} />,
    title: "Free Forever",
    desc: "We believe genuine human connection should never be paywalled. MiloBolo will always be free, sustained by non-intrusive advertising.",
  },
  {
    icon: <PeopleIcon sx={{ fontSize: 40 }} />,
    title: "Radical Inclusion",
    desc: "70+ accessibility features, 70+ themes, and a platform designed to be usable by everyone regardless of ability or device.",
  },
  {
    icon: <SecurityIcon sx={{ fontSize: 40 }} />,
    title: "Safety First",
    desc: "End-to-end encryption, fingerprint-based banning, proactive moderation, and extensive reporting tools protect every user.",
  },
  {
    icon: <PublicIcon sx={{ fontSize: 40 }} />,
    title: "Global by Design",
    desc: "Interest matching, country preferences, and language tags make MiloBolo the best place to have genuine cross-cultural conversations.",
  },
  {
    icon: <FlashOnIcon sx={{ fontSize: 40 }} />,
    title: "Built for Speed",
    desc: "WebRTC peer-to-peer video, Redis matchmaking, Turbopack builds, and a global CDN deliver the fastest possible experience.",
  },
];

export default function AboutPage() {
  const theme = useTheme();
  return (
    <Layout title="About MiloBolo" description="Learn about MiloBolo — the free, anonymous, encrypted random chat platform connecting people worldwide.">
      <SeoHead
        title="About"
        description="Learn about MiloBolo — the free, anonymous, encrypted random chat platform connecting people worldwide."
        path="/about"
      />
      {/* Hero */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main}18, ${theme.palette.secondary.main}10)`,
          py: { xs: 8, md: 12 },
          textAlign: "center",
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Container maxWidth="md">
          <Chip label="About Us" color="primary" sx={{ mb: 2 }} />
          <Typography variant="h2" fontWeight={900} gutterBottom sx={{ fontSize: { xs: "2rem", md: "3rem" } }}>
            Random Chat, Reinvented
          </Typography>
          <Typography variant="h6" color="text.secondary" maxWidth={600} mx="auto">
            MiloBolo is a privacy-first random chat platform where millions of strangers connect every day — via video, text, or voice — completely free, forever.
          </Typography>
        </Container>
      </Box>

      {/* Stats */}
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Grid container spacing={3} justifyContent="center">
          {STATS.map((s) => (
            <Grid item xs={6} md={3} key={s.label}>
              <Card sx={{ textAlign: "center", py: 3, borderRadius: 3 }}>
                <Typography variant="h3" fontWeight={900} color="primary.main">
                  {s.value}
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  {s.label}
                </Typography>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Divider />

      {/* Story */}
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Typography variant="h4" fontWeight={800} textAlign="center" gutterBottom>
          Our Story
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center" mb={5} lineHeight={1.9}>
          When Omegle — the original random chat platform — shut down in November 2023, millions of users were left without a good alternative. The platforms that emerged were either paywalled, privacy-hostile, or poorly built. We saw an opportunity to do it right.
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center" lineHeight={1.9}>
          MiloBolo was built from the ground up with three core commitments: permanent free access for everyone, genuine privacy with no message storage and end-to-end encryption, and a user experience that rivals any commercial product. We are not a startup chasing funding — we are builders who love the idea of genuine stranger connection and want to give the world a platform worthy of it.
        </Typography>
      </Container>

      <Divider />

      {/* Values */}
      <Box sx={{ bgcolor: "background.default", py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight={800} textAlign="center" gutterBottom>
            Our Values
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center" mb={6}>
            Everything we build is guided by these six principles.
          </Typography>
          <Grid container spacing={4}>
            {VALUES.map((v) => (
              <Grid item xs={12} sm={6} md={4} key={v.title}>
                <Card sx={{ height: "100%", p: 1, borderRadius: 3 }}>
                  <CardContent>
                    <Box sx={{ color: "primary.main", mb: 1.5 }}>{v.icon}</Box>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                      {v.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" lineHeight={1.8}>
                      {v.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Mission */}
      <Container maxWidth="md" sx={{ py: 8, textAlign: "center" }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Our Mission
        </Typography>
        <Typography variant="h6" color="text.secondary" fontStyle="italic" lineHeight={1.9} maxWidth={560} mx="auto">
          "To make genuine human connection accessible to every person on earth — anonymously, securely, and forever free."
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center" mt={4} flexWrap="wrap" gap={1}>
          <Chip label="End-to-End Encrypted" color="success" />
          <Chip label="No Message Storage" color="info" />
          <Chip label="No Account Required" />
          <Chip label="Always Free" color="warning" />
          <Chip label="190+ Countries" color="secondary" />
        </Stack>
      </Container>
    </Layout>
  );
}

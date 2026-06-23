import Link from "next/link";
import {
  Box, Container, Divider, Grid, IconButton, Stack, Tooltip, Typography,
} from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import SecurityIcon from "@mui/icons-material/Security";
import FavoriteIcon from "@mui/icons-material/Favorite";

const FOOTER_LINKS = [
  {
    heading: "Chat",
    links: [
      { label: "Video Chat", href: "/camera-test?mode=video" },
      { label: "Text Chat", href: "/chat?mode=text" },
      { label: "Spy Mode", href: "/spy" },
      { label: "Camera Test", href: "/camera-test" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Safety & Legal",
    links: [
      { label: "Community Guidelines", href: "/guidelines" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign In", href: "/auth/login" },
      { label: "Register", href: "/auth/register" },
      { label: "Profile", href: "/profile" },
      { label: "Chat History", href: "/history" },
    ],
  },
];

export default function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        borderTop: "1px solid rgba(255,255,255,0.07)",
        bgcolor: "background.default",
        pt: 5,
        pb: 3,
        mt: "auto",
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} mb={4}>
          {/* Brand */}
          <Grid item xs={12} md={3}>
            <Typography
              variant="h6"
              fontWeight={900}
              sx={{
                background: "linear-gradient(135deg,#6C63FF,#FF6584)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                mb: 1,
              }}
            >
              MiloBolo
            </Typography>
            <Typography variant="body2" color="text.disabled" lineHeight={1.7} mb={2}>
              Free, anonymous, end-to-end encrypted random chat. Connect with strangers worldwide — no account, no fees, forever.
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <SecurityIcon sx={{ fontSize: 14, color: "success.main" }} />
              <Typography variant="caption" color="text.disabled">
                E2E encrypted • No message storage
              </Typography>
            </Stack>
          </Grid>

          {/* Nav columns */}
          {FOOTER_LINKS.map((col) => (
            <Grid item xs={6} sm={3} md={2.25} key={col.heading}>
              <Typography variant="overline" color="text.disabled" fontWeight={700} display="block" mb={1.5}>
                {col.heading}
              </Typography>
              <Stack spacing={1}>
                {col.links.map((l) => (
                  <Typography
                    key={l.href}
                    component={Link}
                    href={l.href}
                    variant="body2"
                    sx={{
                      color: "text.secondary",
                      textDecoration: "none",
                      "&:hover": { color: "primary.main" },
                      transition: "color 0.15s",
                    }}
                  >
                    {l.label}
                  </Typography>
                ))}
              </Stack>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ opacity: 0.1, mb: 2.5 }} />

        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems="center"
          spacing={1}
        >
          <Typography variant="caption" color="text.disabled">
            © {new Date().getFullYear()} MiloBolo — Made with{" "}
            <FavoriteIcon sx={{ fontSize: 10, color: "error.main", verticalAlign: "middle" }} />{" "}
            for genuine human connection. Always free.
          </Typography>
          <Typography variant="caption" color="text.disabled">
            18+ only •{" "}
            <Link href="/cookies" style={{ color: "inherit" }}>
              Cookie Preferences
            </Link>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}

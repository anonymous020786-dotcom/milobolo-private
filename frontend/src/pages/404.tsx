import { useRouter } from "next/router";
import { Box, Container, Typography, Button, Stack } from "@mui/material";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";

export default function NotFound() {
  const router = useRouter();
  return (
    <Layout title="404 — Page Not Found">
      <SeoHead title="404 — Page Not Found" description="This page doesn't exist on MiloBolo." path="/404" noIndex />
      <Box sx={{ minHeight: "80vh", display: "flex", alignItems: "center" }}>
        <Container maxWidth="sm" sx={{ textAlign: "center" }}>
          <Typography variant="h1" fontWeight={900} sx={{
            fontSize: { xs: 80, md: 120 },
            background: "linear-gradient(135deg,#6C63FF,#FF6584)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>404</Typography>
          <Typography variant="h5" fontWeight={700} mb={1}>Page not found</Typography>
          <Typography color="text.secondary" mb={4}>
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="contained" onClick={() => router.push("/")} sx={{ borderRadius: 2, px: 3 }}>
              Go Home
            </Button>
            <Button variant="outlined" onClick={() => router.push("/chat?mode=text")} sx={{ borderRadius: 2, px: 3 }}>
              Start Chatting
            </Button>
          </Stack>
        </Container>
      </Box>
    </Layout>
  );
}

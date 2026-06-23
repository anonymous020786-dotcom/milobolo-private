import { useRouter } from "next/router";
import { Box, Container, Typography, Button, Stack } from "@mui/material";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";

export default function ServerError() {
  const router = useRouter();
  return (
    <Layout title="500 — Server Error">
      <SeoHead title="500 — Server Error" description="Something went wrong on MiloBolo. Please try again." path="/500" noIndex />
      <Box sx={{ minHeight: "80vh", display: "flex", alignItems: "center" }}>
        <Container maxWidth="sm" sx={{ textAlign: "center" }}>
          <Typography variant="h1" fontWeight={900} sx={{
            fontSize: { xs: 80, md: 120 },
            background: "linear-gradient(135deg,#FF6584,#6C63FF)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>500</Typography>
          <Typography variant="h5" fontWeight={700} mb={1}>Something went wrong</Typography>
          <Typography color="text.secondary" mb={4}>
            An unexpected error occurred on our server. We&apos;ve been notified and are looking into it.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center">
            <Button variant="contained" onClick={() => router.push("/")} sx={{ borderRadius: 2, px: 3 }}>
              Go Home
            </Button>
            <Button variant="outlined" onClick={() => router.reload()} sx={{ borderRadius: 2, px: 3 }}>
              Try Again
            </Button>
          </Stack>
        </Container>
      </Box>
    </Layout>
  );
}

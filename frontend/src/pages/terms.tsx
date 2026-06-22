import { useRouter } from "next/router";
import {
  Box, Container, Typography, Button, Divider, Paper, Stack,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Layout from "@/components/Layout";

export default function Terms() {
  const router = useRouter();

  return (
    <Layout title="Terms of Service">
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()} sx={{ mb: 3 }}>
          Back
        </Button>

        <Typography variant="h4" fontWeight={800} mb={1}>Terms of Service</Typography>
        <Typography variant="body2" color="text.secondary" mb={4}>
          Last updated: June 2025
        </Typography>

        <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 3 }}>
          <Stack spacing={4}>
            <Box>
              <Typography variant="h6" fontWeight={700} mb={1.5}>1. You must be 18 or older</Typography>
              <Typography color="text.secondary" lineHeight={1.8}>
                MiloBolo is strictly for users aged 18 and above. By using this service you confirm you are at least 18 years old.
                If you are under 18, please leave immediately.
              </Typography>
            </Box>

            <Divider sx={{ opacity: 0.15 }} />

            <Box id="guidelines">
              <Typography variant="h6" fontWeight={700} mb={1.5}>2. Community Guidelines</Typography>
              <Typography color="text.secondary" lineHeight={1.8} component="div">
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  <li style={{ marginBottom: 8 }}>Do not share sexual content involving minors — this is illegal and will be reported to authorities.</li>
                  <li style={{ marginBottom: 8 }}>Do not harass, threaten, or bully other users.</li>
                  <li style={{ marginBottom: 8 }}>Do not spam or use bots.</li>
                  <li style={{ marginBottom: 8 }}>Do not share personal information of others without consent.</li>
                  <li style={{ marginBottom: 8 }}>Treat strangers with basic respect.</li>
                </ul>
              </Typography>
            </Box>

            <Divider sx={{ opacity: 0.15 }} />

            <Box>
              <Typography variant="h6" fontWeight={700} mb={1.5}>3. Privacy & Anonymity</Typography>
              <Typography color="text.secondary" lineHeight={1.8}>
                Chats are end-to-end encrypted — we cannot read your messages. We do not store chat content.
                We collect minimal metadata (session duration, report counts) to improve safety. We do not sell your data.
                IP addresses are used only for country matching and ban enforcement.
              </Typography>
            </Box>

            <Divider sx={{ opacity: 0.15 }} />

            <Box>
              <Typography variant="h6" fontWeight={700} mb={1.5}>4. No Guarantee of Service</Typography>
              <Typography color="text.secondary" lineHeight={1.8}>
                MiloBolo is provided free of charge as-is. We make no guarantees about uptime, match quality,
                or the behaviour of other users. Use at your own risk.
              </Typography>
            </Box>

            <Divider sx={{ opacity: 0.15 }} />

            <Box>
              <Typography variant="h6" fontWeight={700} mb={1.5}>5. Bans & Enforcement</Typography>
              <Typography color="text.secondary" lineHeight={1.8}>
                We may ban users (by fingerprint or IP) who violate these terms without notice.
                Repeat offenders may be permanently banned. Reports from users are reviewed by our moderation team.
              </Typography>
            </Box>

            <Divider sx={{ opacity: 0.15 }} />

            <Box>
              <Typography variant="h6" fontWeight={700} mb={1.5}>6. No Liability</Typography>
              <Typography color="text.secondary" lineHeight={1.8}>
                MiloBolo is not responsible for the content exchanged between users. By using this platform,
                you accept full responsibility for your own conduct and any content you share.
              </Typography>
            </Box>

            <Box sx={{ bgcolor: "rgba(108,99,255,0.08)", borderRadius: 2, p: 2.5 }}>
              <Typography variant="body2" color="text.secondary">
                Questions? Contact us at{" "}
                <Box component="span" sx={{ color: "primary.main" }}>support@videodownloaders.cloud</Box>
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Layout>
  );
}

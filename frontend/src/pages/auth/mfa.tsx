import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Typography, TextField, Button, Alert,
  CircularProgress, Paper, Stack,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import SeoHead from "@/components/SeoHead";
import { supabase } from "@/lib/supabase";

export default function MFAChallenge() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp?.[0];
      if (!totp) { router.replace("/"); return; }
      setFactorId(totp.id);
      const { data: ch } = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (ch?.id) setChallengeId(ch.id);
    })();
  }, [router]);

  const verify = async () => {
    if (!factorId || !challengeId || code.length !== 6) return;
    setLoading(true);
    setError("");
    const { error: err } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
    setLoading(false);
    if (err) { setError(err.message); return; }
    router.replace("/");
  };

  return (
    <>
      <SeoHead title="Two-Factor Authentication — MiloBolo" description="" path="/auth/mfa" noIndex />
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        bgcolor: "background.default", p: 2 }}>
        <Container maxWidth="xs">
          <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)" }}>
            <Stack alignItems="center" spacing={2} mb={3}>
              <Box sx={{ width: 56, height: 56, borderRadius: "50%", bgcolor: "primary.main",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <LockIcon sx={{ color: "#fff" }} />
              </Box>
              <Typography variant="h6" fontWeight={700}>Two-Factor Authentication</Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Enter the 6-digit code from your authenticator app.
              </Typography>
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {!factorId ? (
              <Box textAlign="center"><CircularProgress size={24} /></Box>
            ) : (
              <>
                <TextField
                  fullWidth
                  label="Authentication code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputProps={{ inputMode: "numeric", style: { letterSpacing: 8, fontSize: 22, textAlign: "center" } }}
                  sx={{ mb: 2 }}
                  onKeyDown={(e) => e.key === "Enter" && verify()}
                  autoFocus
                />
                <Button fullWidth variant="contained" size="large" onClick={verify}
                  disabled={loading || code.length !== 6}>
                  {loading ? <CircularProgress size={22} color="inherit" /> : "Verify"}
                </Button>
              </>
            )}
          </Paper>
        </Container>
      </Box>
    </>
  );
}

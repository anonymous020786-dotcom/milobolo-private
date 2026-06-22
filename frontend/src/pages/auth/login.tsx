import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  Box, Container, Card, CardContent, Typography, TextField,
  Button, Divider, Alert, CircularProgress, Stack,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import Layout from "@/components/Layout";
import { supabase } from "@/lib/supabase";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { useFeatureFlags } from "@/context/FeatureFlagContext";

export default function Login() {
  const router = useRouter();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { isEnabled } = useFeatureFlags();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (isEnabled("recaptcha") && executeRecaptcha) {
        await executeRecaptcha("login");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push((router.query.next as string) || "/");
    } catch (e: any) {
      setError(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
    });
  };

  return (
    <Layout title="Sign In" noNav>
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.12) 0%, transparent 70%)" }}>
        <Container maxWidth="xs">
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography variant="h4" fontWeight={800}
              sx={{ background: "linear-gradient(135deg,#6C63FF,#FF6584)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              MiloBolo
            </Typography>
            <Typography color="text.secondary" mt={1}>Welcome back</Typography>
          </Box>
          <Card>
            <CardContent sx={{ p: 4 }}>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              {isEnabled("google_auth") && (
                <>
                  <Button fullWidth variant="outlined" startIcon={<GoogleIcon />}
                    onClick={handleGoogle} sx={{ mb: 2, py: 1.2 }}>
                    Continue with Google
                  </Button>
                  <Divider sx={{ mb: 2 }}><Typography variant="caption" color="text.secondary">or</Typography></Divider>
                </>
              )}

              {isEnabled("email_auth") && (
                <Box component="form" onSubmit={handleLogin}>
                  <TextField fullWidth label="Email" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)} required sx={{ mb: 2 }} />
                  <TextField fullWidth label="Password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)} required sx={{ mb: 1 }} />
                  <Box sx={{ textAlign: "right", mb: 2 }}>
                    <Link href="/auth/forgot-password" style={{ color: "#6C63FF", fontSize: 13 }}>
                      Forgot password?
                    </Link>
                  </Box>
                  <Button fullWidth variant="contained" type="submit" disabled={loading} sx={{ py: 1.3 }}>
                    {loading ? <CircularProgress size={22} color="inherit" /> : "Sign In"}
                  </Button>
                </Box>
              )}

              <Stack direction="row" justifyContent="center" mt={3} spacing={0.5}>
                <Typography variant="body2" color="text.secondary">Don't have an account?</Typography>
                <Link href="/auth/register" style={{ color: "#6C63FF", fontSize: 14 }}>Sign up</Link>
              </Stack>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </Layout>
  );
}

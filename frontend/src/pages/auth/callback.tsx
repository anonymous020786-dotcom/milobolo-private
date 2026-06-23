import { useEffect } from "react";
import { useRouter } from "next/router";
import { Box, CircularProgress, Typography } from "@mui/material";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push("/auth/login"); return; }

      // After OAuth redirect, check if MFA step-up is required
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
        // User has TOTP enrolled; redirect to TOTP challenge page
        router.push("/auth/mfa");
      } else {
        router.push("/");
      }
    });
  }, [router]);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
      <CircularProgress color="primary" />
      <Typography color="text.secondary" mt={2}>Signing you in...</Typography>
    </Box>
  );
}

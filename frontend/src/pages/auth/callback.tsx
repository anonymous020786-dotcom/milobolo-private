import { useEffect } from "react";
import { useRouter } from "next/router";
import { Box, CircularProgress, Typography } from "@mui/material";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push("/");
      else router.push("/auth/login");
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

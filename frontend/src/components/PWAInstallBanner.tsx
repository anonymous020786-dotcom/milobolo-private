import { useState, useEffect } from "react";
import { Box, Button, Typography, IconButton, Paper } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import GetAppIcon from "@mui/icons-material/GetApp";
import { useFeatureFlags } from "@/context/FeatureFlagContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallBanner() {
  const { isEnabled } = useFeatureFlags();
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isEnabled("pwa")) return;
    if (localStorage.getItem("pwa_dismissed")) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isEnabled]);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setPrompt(null);
  };

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem("pwa_dismissed", "1");
  };

  if (!visible) return null;

  return (
    <Paper sx={{
      position: "fixed", bottom: 16, left: 16, right: 16, zIndex: 1400,
      maxWidth: 420, mx: "auto",
      p: 2, borderRadius: 3,
      border: "1px solid rgba(108,99,255,0.3)",
      bgcolor: "background.paper",
      display: "flex", alignItems: "center", gap: 1.5,
      boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
    }}>
      <GetAppIcon sx={{ color: "primary.main", flexShrink: 0 }} />
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2" fontWeight={600}>Install MiloBolo</Typography>
        <Typography variant="caption" color="text.secondary">Add to home screen for quick access</Typography>
      </Box>
      <Button variant="contained" size="small" onClick={install} sx={{ borderRadius: 2, flexShrink: 0 }}>
        Install
      </Button>
      <IconButton size="small" onClick={dismiss}><CloseIcon fontSize="small" /></IconButton>
    </Paper>
  );
}

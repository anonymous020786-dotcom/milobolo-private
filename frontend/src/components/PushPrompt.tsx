import { useState, useEffect } from "react";
import { Box, Button, Typography, Slide, Paper, IconButton } from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import CloseIcon from "@mui/icons-material/Close";

const STORAGE_KEY = "mb_push_prompt_dismissed";

export default function PushPrompt() {
  const [show, setShow] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermission(Notification.permission);
    if (Notification.permission !== "default") return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Show after first chat session ends (triggered by custom event)
    const handler = () => {
      setTimeout(() => setShow(true), 1500);
    };
    window.addEventListener("milobolo:chat_ended", handler);
    return () => window.removeEventListener("milobolo:chat_ended", handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, "1");
  };

  const enable = async () => {
    if (typeof Notification === "undefined") { dismiss(); return; }
    const result = await Notification.requestPermission();
    setPermission(result);
    dismiss();
    if (result === "granted") {
      new Notification("MiloBolo", {
        body: "You'll be notified when a friend sends a request. Happy chatting! 🎉",
        icon: "/icons/icon-192.png",
      });
    }
  };

  if (!show || permission !== "default") return null;

  return (
    <Slide direction="up" in={show} mountOnEnter unmountOnExit>
      <Paper
        elevation={8}
        sx={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 1500, width: { xs: "calc(100vw - 32px)", sm: 400 },
          p: 2.5, borderRadius: 3,
          bgcolor: "rgba(19,19,26,0.97)",
          border: "1px solid rgba(108,99,255,0.3)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 40px rgba(108,99,255,0.25)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 2, flexShrink: 0,
            bgcolor: "rgba(108,99,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <NotificationsIcon sx={{ color: "primary.main", fontSize: 20 }} />
          </Box>
          <Box flex={1}>
            <Typography fontWeight={700} fontSize={14} mb={0.5}>
              Stay in the loop
            </Typography>
            <Typography variant="body2" color="text.secondary" lineHeight={1.6} mb={1.5}>
              Get notified when someone sends you a friend request or wants to chat.
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                size="small" variant="contained"
                onClick={enable}
                sx={{ borderRadius: 1.5, fontSize: 12, py: 0.5 }}
              >
                Enable notifications
              </Button>
              <Button
                size="small" variant="text" color="inherit"
                onClick={dismiss}
                sx={{ borderRadius: 1.5, fontSize: 12, color: "text.disabled" }}
              >
                Not now
              </Button>
            </Box>
          </Box>
          <IconButton size="small" onClick={dismiss} sx={{ p: 0.25, mt: -0.25, color: "text.disabled" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Paper>
    </Slide>
  );
}

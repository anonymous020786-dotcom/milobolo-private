import { useState, useEffect } from "react";
import {
  Box, Button, Dialog, DialogContent, MobileStepper,
  Stack, Typography, useTheme,
} from "@mui/material";
import KeyboardArrowLeftIcon from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import VideocamIcon from "@mui/icons-material/Videocam";
import ChatIcon from "@mui/icons-material/Chat";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ShieldIcon from "@mui/icons-material/Shield";
import PaletteIcon from "@mui/icons-material/Palette";
import FavoriteIcon from "@mui/icons-material/Favorite";

const STORAGE_KEY = "mb_welcome_seen";

const STEPS = [
  {
    icon: <FavoriteIcon sx={{ fontSize: 64 }} />,
    color: "#e91e63",
    title: "Welcome to MiloBolo!",
    body: "Connect with random strangers from around the world via video, voice, or text — completely free, always. No account needed, no fees, ever.",
  },
  {
    icon: <VideocamIcon sx={{ fontSize: 64 }} />,
    color: "#2196f3",
    title: "Three Chat Modes",
    body: "🎥 Video Chat — See and hear your stranger live.\n💬 Text Chat — Anonymous text, no camera required.\n🔍 Spy Mode — Watch two strangers discuss your question.",
  },
  {
    icon: <ChatIcon sx={{ fontSize: 64 }} />,
    color: "#4caf50",
    title: "How to Chat",
    body: "1. Choose a mode on the home page.\n2. Optionally add up to 5 interests for better matching.\n3. Click Start — you are matched in seconds.\n4. Press New to find the next stranger, or Stop to end.",
  },
  {
    icon: <ShieldIcon sx={{ fontSize: 64 }} />,
    color: "#ff9800",
    title: "Stay Safe",
    body: "🔒 All messages are end-to-end encrypted.\n🚩 Use the Flag button to report inappropriate users.\n🙅 Never share personal info — your safety comes first.\n✅ You must be 18+ to use MiloBolo.",
  },
  {
    icon: <VisibilityIcon sx={{ fontSize: 64 }} />,
    color: "#9c27b0",
    title: "Privacy First",
    body: "We store no messages, no video, no audio. Your chats disappear the moment you disconnect. MiloBolo works completely anonymously — no account needed for any core feature.",
  },
  {
    icon: <PaletteIcon sx={{ fontSize: 64 }} />,
    color: "#00bcd4",
    title: "Make It Yours",
    body: "Click the palette icon (right side) for 70+ professional themes. Click the accessibility icon for 70+ features including high contrast, dyslexia fonts, reduced motion, and much more.",
  },
];

export default function WelcomeModal() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  const current = STEPS[step];

  return (
    <Dialog
      open={open}
      onClose={close}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          background: theme.palette.background.paper,
          overflow: "hidden",
        },
      }}
    >
      <Box
        sx={{
          background: `linear-gradient(135deg, ${current.color}22, ${current.color}08)`,
          py: 4,
          px: 3,
          textAlign: "center",
          borderBottom: `1px solid ${theme.palette.divider}`,
          transition: "background 0.4s ease",
        }}
      >
        <Box sx={{ color: current.color, mb: 2, transition: "color 0.3s" }}>
          {current.icon}
        </Box>
        <Typography variant="h5" fontWeight={800} gutterBottom>
          {current.title}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ whiteSpace: "pre-line", lineHeight: 1.8 }}
        >
          {current.body}
        </Typography>
      </Box>

      <DialogContent sx={{ p: 2, pb: 1 }}>
        <MobileStepper
          variant="dots"
          steps={STEPS.length}
          position="static"
          activeStep={step}
          sx={{ background: "transparent", justifyContent: "center" }}
          nextButton={null}
          backButton={null}
        />
        <Stack direction="row" spacing={1} mt={1}>
          <Button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            startIcon={<KeyboardArrowLeftIcon />}
            variant="outlined"
            fullWidth
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              endIcon={<KeyboardArrowRightIcon />}
              variant="contained"
              fullWidth
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={close}
              variant="contained"
              color="success"
              fullWidth
              sx={{ fontWeight: 700 }}
            >
              Let's Chat!
            </Button>
          )}
        </Stack>
        <Button onClick={close} fullWidth sx={{ mt: 0.5, color: "text.disabled", fontSize: 12 }}>
          Skip intro
        </Button>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogTitle, DialogContent, Box, Typography, IconButton,
  Grid, Chip, Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardIcon from "@mui/icons-material/Keyboard";

const SECTIONS = [
  {
    heading: "Chat",
    shortcuts: [
      { keys: ["Enter"], desc: "Send message" },
      { keys: ["Shift", "Enter"], desc: "New line in message" },
      { keys: ["Esc"], desc: "Disconnect / Skip stranger" },
      { keys: ["N"], desc: "Skip to next stranger" },
      { keys: ["Space"], desc: "Toggle microphone (video mode)" },
      { keys: ["V"], desc: "Toggle camera (video mode)" },
    ],
  },
  {
    heading: "Navigation",
    shortcuts: [
      { keys: ["?"], desc: "Open this shortcuts panel" },
      { keys: ["G", "H"], desc: "Go to Home" },
      { keys: ["G", "T"], desc: "Go to Text Chat" },
      { keys: ["G", "V"], desc: "Go to Video Chat" },
      { keys: ["G", "B"], desc: "Go to Blog" },
    ],
  },
  {
    heading: "Accessibility",
    shortcuts: [
      { keys: ["Alt", "+"], desc: "Increase font size" },
      { keys: ["Alt", "−"], desc: "Decrease font size" },
      { keys: ["Alt", "C"], desc: "Toggle high contrast" },
      { keys: ["Alt", "M"], desc: "Toggle motion reduction" },
    ],
  },
];

function KeyBadge({ label }: { label: string }) {
  return (
    <Box component="kbd" sx={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      px: 0.75, py: 0.25, minWidth: 28,
      bgcolor: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.18)",
      borderBottomWidth: 2,
      borderRadius: 1,
      fontFamily: "monospace", fontSize: 11, fontWeight: 700,
      color: "text.primary",
      boxShadow: "0 1px 0 rgba(0,0,0,0.4)",
      userSelect: "none",
    }}>
      {label}
    </Box>
  );
}

export default function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
    if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
      e.preventDefault();
      setOpen((v) => !v);
    }
    if (e.key === "Escape") setOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: "background.paper", borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)" } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
        <KeyboardIcon sx={{ color: "primary.main" }} />
        <Typography fontWeight={700} flex={1}>Keyboard Shortcuts</Typography>
        <IconButton size="small" onClick={() => setOpen(false)}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 2 }}>
          Press <KeyBadge label="?" /> anywhere (outside a text field) to toggle this panel.
        </Typography>

        {SECTIONS.map((section, si) => (
          <Box key={section.heading} mb={si < SECTIONS.length - 1 ? 2.5 : 0}>
            <Typography variant="overline" color="text.disabled" fontWeight={700} fontSize={10} letterSpacing={1.5}>
              {section.heading}
            </Typography>
            <Divider sx={{ opacity: 0.1, mb: 1.5 }} />
            <Grid container spacing={0.5}>
              {section.shortcuts.map(({ keys, desc }) => (
                <Grid item xs={12} key={desc}>
                  <Box sx={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    px: 1, py: 0.75, borderRadius: 1.5,
                    "&:hover": { bgcolor: "rgba(255,255,255,0.03)" },
                  }}>
                    <Typography variant="body2" color="text.secondary" fontSize={13}>{desc}</Typography>
                    <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexShrink: 0, ml: 2 }}>
                      {keys.map((k, i) => (
                        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          {i > 0 && <Typography variant="caption" color="text.disabled">+</Typography>}
                          <KeyBadge label={k} />
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Box>
        ))}

        <Box sx={{ mt: 2, p: 1.5, bgcolor: "rgba(108,99,255,0.06)", borderRadius: 2, border: "1px solid rgba(108,99,255,0.15)" }}>
          <Typography variant="caption" color="text.disabled">
            💡 Tip: Navigation shortcuts (G then H, G then T, etc.) use sequential key presses within 1 second.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

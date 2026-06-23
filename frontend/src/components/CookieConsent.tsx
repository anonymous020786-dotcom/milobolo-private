"use client";
import { useState, useEffect } from "react";
import {
  Box, Button, Collapse, Dialog, DialogContent, DialogTitle,
  Divider, Fade, FormControlLabel, IconButton, Paper, Stack,
  Switch, Typography, useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CookieIcon from "@mui/icons-material/Cookie";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";

const STORAGE_KEY = "mb_cookie_consent";

interface ConsentState {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  decided: boolean;
}

const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
  decided: false,
};

const CATEGORIES = [
  {
    key: "necessary" as const,
    label: "Strictly Necessary",
    locked: true,
    description:
      "Required for the website to function. Cannot be disabled. Includes age gate confirmation, session cookies, and security tokens.",
  },
  {
    key: "preferences" as const,
    label: "Preferences",
    locked: false,
    description:
      "Remember your settings such as theme, accessibility features, and language preference.",
  },
  {
    key: "analytics" as const,
    label: "Analytics",
    locked: false,
    description:
      "Help us understand how visitors use the site using Google Analytics. All data is anonymised and aggregated.",
  },
  {
    key: "marketing" as const,
    label: "Marketing",
    locked: false,
    description:
      "Used to deliver relevant advertisements via Google AdSense. Opting out means you will still see ads, but they will be less relevant.",
  },
];

function loadConsent(): ConsentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONSENT, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_CONSENT;
}

function saveConsent(state: ConsentState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useConsent() {
  const [consent, setConsentState] = useState<ConsentState>(DEFAULT_CONSENT);
  useEffect(() => {
    setConsentState(loadConsent());
  }, []);
  return consent;
}

export default function CookieConsent() {
  const theme = useTheme();
  const [consent, setConsent] = useState<ConsentState>(DEFAULT_CONSENT);
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customConsent, setCustomConsent] = useState<ConsentState>(DEFAULT_CONSENT);

  useEffect(() => {
    const stored = loadConsent();
    setConsent(stored);
    setCustomConsent(stored);
    if (!stored.decided) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = (all: boolean) => {
    const next: ConsentState = all
      ? { necessary: true, analytics: true, marketing: true, preferences: true, decided: true }
      : { necessary: true, analytics: false, marketing: false, preferences: false, decided: true };
    saveConsent(next);
    setConsent(next);
    setVisible(false);
  };

  const saveCustom = () => {
    const next = { ...customConsent, decided: true };
    saveConsent(next);
    setConsent(next);
    setCustomOpen(false);
    setVisible(false);
  };

  if (!visible && consent.decided) return null;

  return (
    <>
      <Fade in={visible}>
        <Paper
          elevation={8}
          sx={{
            position: "fixed",
            bottom: { xs: 0, sm: 24 },
            left: { xs: 0, sm: 24 },
            right: { xs: 0, sm: "auto" },
            maxWidth: { sm: 480 },
            zIndex: 2000,
            borderRadius: { xs: "16px 16px 0 0", sm: 3 },
            p: 3,
            background: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Stack direction="row" alignItems="flex-start" spacing={1.5} mb={1.5}>
            <CookieIcon sx={{ color: "warning.main", mt: 0.3, flexShrink: 0 }} />
            <Box flex={1}>
              <Typography variant="subtitle1" fontWeight={700}>
                We use cookies
              </Typography>
              <Typography variant="body2" color="text.secondary" mt={0.5}>
                MiloBolo uses essential cookies for security and preferences.
                We also use optional analytics and advertising cookies to improve
                the experience and keep the service free.
              </Typography>
            </Box>
          </Stack>

          <Collapse in={expanded}>
            <Box mb={2} mt={1}>
              <Divider sx={{ mb: 1.5 }} />
              {CATEGORIES.map((cat) => (
                <Box key={cat.key} mb={1.5}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Typography variant="body2" fontWeight={600}>
                      {cat.label}
                      {cat.locked && (
                        <Typography component="span" variant="caption" color="text.disabled" ml={1}>
                          (Always On)
                        </Typography>
                      )}
                    </Typography>
                    <Switch
                      size="small"
                      checked={cat.locked ? true : customConsent[cat.key]}
                      disabled={cat.locked}
                      onChange={(e) =>
                        setCustomConsent((prev) => ({ ...prev, [cat.key]: e.target.checked }))
                      }
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {cat.description}
                  </Typography>
                </Box>
              ))}
              <Button
                size="small"
                variant="outlined"
                fullWidth
                onClick={saveCustom}
                sx={{ mt: 0.5 }}
              >
                Save My Preferences
              </Button>
            </Box>
          </Collapse>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mt={1}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => accept(true)}
              sx={{ flex: 1, fontWeight: 700 }}
            >
              Accept All
            </Button>
            <Button
              variant="outlined"
              onClick={() => accept(false)}
              sx={{ flex: 1 }}
            >
              Reject Optional
            </Button>
            <Button
              variant="text"
              endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setExpanded((x) => !x)}
              sx={{ flex: 1 }}
            >
              Customise
            </Button>
          </Stack>

          <Typography variant="caption" color="text.disabled" display="block" mt={1.5}>
            Read our{" "}
            <a href="/cookies" style={{ color: theme.palette.primary.main }}>
              Cookie Policy
            </a>{" "}
            and{" "}
            <a href="/privacy" style={{ color: theme.palette.primary.main }}>
              Privacy Policy
            </a>
            .
          </Typography>
        </Paper>
      </Fade>
    </>
  );
}

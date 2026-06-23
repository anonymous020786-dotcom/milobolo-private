import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Typography, Card, CardContent, Stack, Switch,
  FormControlLabel, Divider, Button, Alert, Select, MenuItem,
  FormControl, InputLabel, Chip, Grid,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import TuneIcon from "@mui/icons-material/Tune";
import PrivacyTipIcon from "@mui/icons-material/PrivacyTip";
import PaletteIcon from "@mui/icons-material/Palette";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "mb_settings";

interface Settings {
  defaultMode: "video" | "text";
  defaultLanguage: string;
  showTypingIndicator: boolean;
  playMessageSound: boolean;
  pushEnabled: boolean;
  allowFriendRequests: boolean;
  saveHistory: boolean;
  compactChat: boolean;
}

const DEFAULTS: Settings = {
  defaultMode: "video",
  defaultLanguage: "",
  showTypingIndicator: true,
  playMessageSound: false,
  pushEnabled: false,
  allowFriendRequests: true,
  saveHistory: true,
  compactChat: false,
};

function load(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

const LANGUAGES = [
  { code: "", label: "Any language" },
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "ar", label: "Arabic" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "ru", label: "Russian" },
];

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card sx={{ borderRadius: 3, mb: 2.5 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" mb={2.5}>
          <Box sx={{ color: "primary.main" }}>{icon}</Box>
          <Typography variant="h6" fontWeight={700} fontSize={16}>{title}</Typography>
        </Stack>
        <Divider sx={{ mb: 2.5, opacity: 0.08 }} />
        {children}
      </CardContent>
    </Card>
  );
}

function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" py={0.75}>
      <Box>
        <Typography variant="body2" fontWeight={500}>{label}</Typography>
        {sub && <Typography variant="caption" color="text.disabled">{sub}</Typography>}
      </Box>
      <Switch checked={value} onChange={(e) => onChange(e.target.checked)} size="small" />
    </Stack>
  );
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    setSettings(load());
    if (typeof Notification !== "undefined") setPushPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login?next=/settings");
  }, [user, authLoading]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    // Persist save-history preference to Supabase profile too
    if (user) {
      await supabase.from("profiles")
        .update({ allow_friend_requests: settings.allowFriendRequests })
        .eq("id", user.id)
        .catch(() => {});
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const requestPush = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setPushPermission(result);
    if (result === "granted") {
      set("pushEnabled", true);
      new Notification("MiloBolo", { body: "Push notifications enabled!", icon: "/icons/icon-192.png" });
    }
  };

  if (authLoading || !user) return null;

  return (
    <Layout title="Settings">
      <SeoHead title="Settings — MiloBolo" description="Manage your MiloBolo preferences." path="/settings" noIndex />
      <Container maxWidth="md" sx={{ py: 5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} mb={4}>
          <TuneIcon sx={{ fontSize: 30, color: "primary.main" }} />
          <Typography variant="h4" fontWeight={800}>Settings</Typography>
        </Stack>

        {saved && (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
            Settings saved!
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            {/* Chat defaults */}
            <SectionCard icon={<TuneIcon />} title="Chat Defaults">
              <FormControl fullWidth size="small" sx={{ mb: 2, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}>
                <InputLabel>Default chat mode</InputLabel>
                <Select value={settings.defaultMode} label="Default chat mode"
                  onChange={(e) => set("defaultMode", e.target.value as "video" | "text")}>
                  <MenuItem value="video">Video Chat</MenuItem>
                  <MenuItem value="text">Text Chat</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small" sx={{ mb: 2, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}>
                <InputLabel>Preferred language</InputLabel>
                <Select value={settings.defaultLanguage} label="Preferred language"
                  onChange={(e) => set("defaultLanguage", e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Divider sx={{ my: 1.5, opacity: 0.08 }} />
              <Toggle
                label="Show typing indicator"
                sub="See when your chat partner is typing"
                value={settings.showTypingIndicator}
                onChange={(v) => set("showTypingIndicator", v)}
              />
              <Toggle
                label="Message sound"
                sub="Play a sound when you receive a message"
                value={settings.playMessageSound}
                onChange={(v) => set("playMessageSound", v)}
              />
              <Toggle
                label="Compact chat view"
                sub="Reduce spacing between messages"
                value={settings.compactChat}
                onChange={(v) => set("compactChat", v)}
              />
            </SectionCard>

            {/* Privacy */}
            <SectionCard icon={<PrivacyTipIcon />} title="Privacy">
              <Toggle
                label="Accept friend requests"
                sub="Allow strangers to send you connection requests during chat"
                value={settings.allowFriendRequests}
                onChange={(v) => set("allowFriendRequests", v)}
              />
              <Toggle
                label="Save chat history"
                sub="Store session summaries to your account (no messages are stored)"
                value={settings.saveHistory}
                onChange={(v) => set("saveHistory", v)}
              />
            </SectionCard>
          </Grid>

          <Grid item xs={12} md={6}>
            {/* Notifications */}
            <SectionCard icon={<NotificationsIcon />} title="Notifications">
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" py={0.75}>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>Push notifications</Typography>
                    <Typography variant="caption" color="text.disabled">
                      Friend requests and chat alerts
                    </Typography>
                  </Box>
                  {pushPermission === "denied" ? (
                    <Chip label="Blocked" size="small" color="error" variant="outlined" />
                  ) : pushPermission === "granted" ? (
                    <Switch checked={settings.pushEnabled} onChange={(e) => set("pushEnabled", e.target.checked)} size="small" />
                  ) : (
                    <Button size="small" variant="outlined" sx={{ borderRadius: 1.5, fontSize: 12 }} onClick={requestPush}>
                      Enable
                    </Button>
                  )}
                </Stack>
                {pushPermission === "denied" && (
                  <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>
                    Push is blocked in your browser. Update your browser permissions to enable it.
                  </Typography>
                )}
              </Box>
            </SectionCard>

            {/* Theme & appearance */}
            <SectionCard icon={<PaletteIcon />} title="Appearance">
              <Typography variant="body2" color="text.secondary" lineHeight={1.7} mb={2}>
                MiloBolo has <strong>70+ themes</strong> and <strong>70+ accessibility features</strong>
                that you can customise at any time using the floating toolbar (bottom-right).
              </Typography>
              <Button
                variant="outlined" fullWidth sx={{ borderRadius: 2 }}
                onClick={() => {
                  // Trigger floating toolbar open
                  window.dispatchEvent(new CustomEvent("milobolo:open_toolbar"));
                }}
              >
                Open Theme Picker
              </Button>
            </SectionCard>

            {/* Data */}
            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight={700} fontSize={16} mb={1.5}>Your data</Typography>
                <Divider sx={{ mb: 2, opacity: 0.08 }} />
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight={500}>Chat history</Typography>
                      <Typography variant="caption" color="text.disabled">View and export your sessions</Typography>
                    </Box>
                    <Button size="small" variant="text" onClick={() => router.push("/history")} sx={{ fontSize: 12 }}>
                      View
                    </Button>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight={500}>Account</Typography>
                      <Typography variant="caption" color="text.disabled">Profile, password, 2FA</Typography>
                    </Box>
                    <Button size="small" variant="text" onClick={() => router.push("/profile")} sx={{ fontSize: 12 }}>
                      Manage
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
          <Button variant="contained" size="large" onClick={handleSave} sx={{ borderRadius: 2, px: 4 }}>
            Save Settings
          </Button>
        </Box>
      </Container>
    </Layout>
  );
}

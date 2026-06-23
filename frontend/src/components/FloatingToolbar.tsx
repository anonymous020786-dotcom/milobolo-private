import { useState, useEffect, useRef } from "react";
import {
  Box, Fab, Tooltip, Typography, IconButton, Slider, Select, MenuItem,
  Switch, FormControlLabel, Chip, InputBase, Collapse, Badge,
  ToggleButton, ToggleButtonGroup, Divider, Button,
} from "@mui/material";
import PaletteIcon from "@mui/icons-material/Palette";
import AccessibilityNewIcon from "@mui/icons-material/AccessibilityNew";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CheckIcon from "@mui/icons-material/Check";
import { useAppTheme, THEMES, ThemeDescriptor } from "@/context/ThemeContext";
import {
  useAccessibility, ACCESSIBILITY_FEATURES, AccessibilityFeature,
} from "@/context/AccessibilityContext";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
const CATEGORIES_ORDER_THEME = ["Brand", "Dark", "Purple", "Blue", "Green", "Red", "Warm", "Special", "Galaxy", "Light"];
const CATEGORIES_ORDER_A11Y = ["Vision", "Text", "Motion", "Audio", "Navigation", "Cognitive"];

// ── Small FAB wrapper ────────────────────────────────────────────────────────
function ToolFab({
  icon, label, onClick, color = "#13131A", badge, pulse,
}: {
  icon: React.ReactNode; label: string; onClick: () => void;
  color?: string; badge?: number; pulse?: boolean;
}) {
  return (
    <Tooltip title={label} placement="left" arrow>
      <Box sx={{ position: "relative" }}>
        {pulse && (
          <Box sx={{
            position: "absolute", inset: -4, borderRadius: "50%",
            border: "2px solid #25D366", animation: "fabPulse 1.8s ease-out infinite",
            "@keyframes fabPulse": {
              "0%": { transform: "scale(1)", opacity: 0.6 },
              "100%": { transform: "scale(1.7)", opacity: 0 },
            },
          }} />
        )}
        <Badge badgeContent={badge} color="primary" max={9}>
          <Fab
            size="small"
            onClick={onClick}
            aria-label={label}
            sx={{
              bgcolor: color, color: "#fff", boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
              width: 42, height: 42,
              "&:hover": { transform: "scale(1.1)", bgcolor: color },
              transition: "transform 0.18s, box-shadow 0.18s",
            }}
          >
            {icon}
          </Fab>
        </Badge>
      </Box>
    </Tooltip>
  );
}

// ── Theme Swatch ────────────────────────────────────────────────────────────
function ThemeSwatch({ d, active, onClick }: { d: ThemeDescriptor; active: boolean; onClick: () => void }) {
  return (
    <Tooltip title={`${d.emoji} ${d.name}`} placement="top" arrow>
      <Box
        onClick={onClick}
        sx={{
          width: 36, height: 36, borderRadius: 1.5, cursor: "pointer",
          background: `linear-gradient(135deg, ${d.primary}, ${d.secondary})`,
          border: active ? "2px solid #fff" : "2px solid transparent",
          boxShadow: active ? `0 0 0 2px ${d.primary}` : "0 2px 6px rgba(0,0,0,0.4)",
          position: "relative", flexShrink: 0,
          transition: "transform 0.15s, box-shadow 0.15s",
          "&:hover": { transform: "scale(1.12)", boxShadow: `0 4px 12px ${d.primary}77` },
        }}
      >
        {active && (
          <CheckIcon sx={{ position: "absolute", inset: 0, m: "auto", fontSize: 16, color: "#fff", filter: "drop-shadow(0 1px 2px #0007)" }} />
        )}
      </Box>
    </Tooltip>
  );
}

// ── Theme Panel ─────────────────────────────────────────────────────────────
function ThemePanel({ onClose }: { onClose: () => void }) {
  const { themeId, setThemeId } = useAppTheme();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");

  const filtered = THEMES.filter((t) => {
    const q = search.toLowerCase();
    const matchQ = !q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
    const matchC = cat === "All" || t.category === cat;
    return matchQ && matchC;
  });

  const grouped = CATEGORIES_ORDER_THEME.reduce<Record<string, ThemeDescriptor[]>>((acc, c) => {
    const items = filtered.filter((t) => t.category === c);
    if (items.length) acc[c] = items;
    return acc;
  }, {});

  return (
    <Box sx={{
      width: 320, bgcolor: "#13131A", borderRadius: 3,
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
      overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "75vh",
    }}>
      {/* Header */}
      <Box sx={{ px: 2, pt: 1.5, pb: 1, borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <PaletteIcon sx={{ fontSize: 16, color: "primary.main", mr: 0.75 }} />
          <Typography fontWeight={700} fontSize={14} flex={1}>Themes</Typography>
          <Typography variant="caption" color="text.disabled" mr={1}>{THEMES.length} themes</Typography>
          <IconButton size="small" onClick={onClose} sx={{ p: 0.25 }}><CloseIcon fontSize="small" /></IconButton>
        </Box>
        {/* Search */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, bgcolor: "rgba(255,255,255,0.05)", borderRadius: 1.5, px: 1, mb: 1 }}>
          <SearchIcon sx={{ fontSize: 14, color: "text.disabled" }} />
          <InputBase
            placeholder="Search themes…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ fontSize: 12, flex: 1, color: "text.primary", "& input": { py: 0.5 } }}
          />
        </Box>
        {/* Category filter */}
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {["All", ...CATEGORIES_ORDER_THEME].map((c) => (
            <Chip key={c} label={c} size="small" onClick={() => setCat(c)}
              variant={cat === c ? "filled" : "outlined"}
              color={cat === c ? "primary" : "default"}
              sx={{ height: 20, fontSize: 10, cursor: "pointer" }} />
          ))}
        </Box>
      </Box>

      {/* Swatches */}
      <Box sx={{ overflowY: "auto", px: 2, py: 1, flex: 1,
        "&::-webkit-scrollbar": { width: 4 },
        "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,0.12)", borderRadius: 2 },
      }}>
        {Object.entries(grouped).map(([category, themes]) => (
          <Box key={category} mb={1.5}>
            <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ textTransform: "uppercase", fontSize: 10, letterSpacing: 1 }}>
              {category}
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.5 }}>
              {themes.map((d) => (
                <Box key={d.id} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.25 }}>
                  <ThemeSwatch d={d} active={themeId === d.id} onClick={() => setThemeId(d.id)} />
                </Box>
              ))}
            </Box>
          </Box>
        ))}
        {filtered.length === 0 && (
          <Typography color="text.disabled" fontSize={12} textAlign="center" py={3}>No themes match</Typography>
        )}
      </Box>

      {/* Active theme name */}
      <Box sx={{ px: 2, py: 1, borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <Typography fontSize={11} color="text.disabled" textAlign="center">
          Active: <Box component="span" fontWeight={700} color="primary.main">
            {THEMES.find((t) => t.id === themeId)?.emoji} {THEMES.find((t) => t.id === themeId)?.name}
          </Box>
        </Typography>
      </Box>
    </Box>
  );
}

// ── Accessibility Panel ──────────────────────────────────────────────────────
function AccessibilityPanel({ onClose }: { onClose: () => void }) {
  const { values, set, reset } = useAccessibility();
  const [cat, setCat] = useState("Vision");
  const [search, setSearch] = useState("");

  const features = ACCESSIBILITY_FEATURES.filter((f) => {
    const q = search.toLowerCase();
    const matchQ = !q || f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q);
    const matchC = !search && f.category === cat;
    return search ? matchQ : matchC;
  });

  const activeCount = ACCESSIBILITY_FEATURES.filter((f) => {
    const v = values[f.id];
    return v !== false && v !== f.defaultValue;
  }).length;

  return (
    <Box sx={{
      width: 320, bgcolor: "#13131A", borderRadius: 3,
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
      overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "80vh",
    }}>
      {/* Header */}
      <Box sx={{ px: 2, pt: 1.5, pb: 1, borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <AccessibilityNewIcon sx={{ fontSize: 16, color: "primary.main", mr: 0.75 }} />
          <Typography fontWeight={700} fontSize={14} flex={1}>Accessibility</Typography>
          {activeCount > 0 && (
            <Chip label={`${activeCount} on`} size="small" color="primary" sx={{ height: 18, fontSize: 10, mr: 0.5 }} />
          )}
          <Tooltip title="Reset all"><IconButton size="small" onClick={reset} sx={{ p: 0.25, mr: 0.25 }}><RestartAltIcon fontSize="small" /></IconButton></Tooltip>
          <IconButton size="small" onClick={onClose} sx={{ p: 0.25 }}><CloseIcon fontSize="small" /></IconButton>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, bgcolor: "rgba(255,255,255,0.05)", borderRadius: 1.5, px: 1, mb: 1 }}>
          <SearchIcon sx={{ fontSize: 14, color: "text.disabled" }} />
          <InputBase placeholder="Search features…" value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ fontSize: 12, flex: 1, color: "text.primary", "& input": { py: 0.5 } }} />
        </Box>
        {!search && (
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
            {CATEGORIES_ORDER_A11Y.map((c) => {
              const count = ACCESSIBILITY_FEATURES.filter((f) => f.category === c && values[f.id] !== false && values[f.id] !== f.defaultValue).length;
              return (
                <Chip key={c} label={count ? `${c} (${count})` : c} size="small"
                  onClick={() => setCat(c)}
                  variant={cat === c ? "filled" : "outlined"}
                  color={cat === c ? "primary" : "default"}
                  sx={{ height: 20, fontSize: 10, cursor: "pointer" }} />
              );
            })}
          </Box>
        )}
      </Box>

      {/* Feature list */}
      <Box sx={{ overflowY: "auto", flex: 1, px: 1.5, py: 1,
        "&::-webkit-scrollbar": { width: 4 },
        "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,0.12)", borderRadius: 2 },
      }}>
        {features.length === 0 && (
          <Typography color="text.disabled" fontSize={12} textAlign="center" py={3}>No features match</Typography>
        )}
        {features.map((f) => <FeatureRow key={f.id} feature={f} value={values[f.id]} onChange={(v) => set(f.id, v)} />)}
      </Box>

      <Box sx={{ px: 2, py: 1, borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <Typography fontSize={10} color="text.disabled" textAlign="center">
          {ACCESSIBILITY_FEATURES.length} features — changes apply instantly
        </Typography>
      </Box>
    </Box>
  );
}

function FeatureRow({ feature: f, value, onChange }: {
  feature: AccessibilityFeature;
  value: boolean | number | string;
  onChange: (v: boolean | number | string) => void;
}) {
  const isActive = value !== false && value !== f.defaultValue;
  return (
    <Box sx={{
      py: 1, px: 1, borderRadius: 1.5, mb: 0.25,
      bgcolor: isActive ? "rgba(108,99,255,0.08)" : "transparent",
      border: isActive ? "1px solid rgba(108,99,255,0.2)" : "1px solid transparent",
      transition: "background 0.2s",
    }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontSize={12} fontWeight={600} lineHeight={1.2} sx={{ color: isActive ? "primary.main" : "text.primary" }}>
            {f.label}
          </Typography>
          <Typography fontSize={10} color="text.disabled" lineHeight={1.3} mt={0.2}>{f.description}</Typography>
        </Box>
        {f.type === "toggle" && (
          <Switch
            size="small"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            sx={{ ml: 0.5, flexShrink: 0 }}
          />
        )}
        {f.type === "select" && (
          <Select size="small" value={value as string} onChange={(e) => onChange(e.target.value)}
            sx={{ fontSize: 11, height: 26, minWidth: 90, flexShrink: 0, ".MuiSelect-select": { py: "2px !important" } }}>
            {f.options?.map((o) => <MenuItem key={o.value} value={o.value} sx={{ fontSize: 11 }}>{o.label}</MenuItem>)}
          </Select>
        )}
      </Box>
      {f.type === "range" && (
        <Box sx={{ mt: 0.75, px: 0.5 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
            <Typography fontSize={10} color="text.disabled">{f.min}{f.unit}</Typography>
            <Typography fontSize={10} fontWeight={700} color={isActive ? "primary.main" : "text.secondary"}>
              {value}{f.unit}
            </Typography>
            <Typography fontSize={10} color="text.disabled">{f.max}{f.unit}</Typography>
          </Box>
          <Slider
            size="small" value={value as number}
            min={f.min} max={f.max} step={f.step}
            onChange={(_, v) => onChange(v as number)}
            sx={{ py: "4px", color: isActive ? "primary.main" : "rgba(255,255,255,0.25)" }}
          />
        </Box>
      )}
    </Box>
  );
}

// ── Scroll Progress Tracker ──────────────────────────────────────────────────
function useScrollProgress() {
  const [prog, setProg] = useState(0);
  const [showUp, setShowUp] = useState(false);
  const [showDown, setShowDown] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      const p = total > 0 ? scrolled / total : 0;
      setProg(p * 100);
      setShowUp(scrolled > 200);
      setShowDown(scrolled < total - 200 && total > 400);
      el.style.setProperty("--scroll-progress", String(Math.round(p * 100)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return { prog, showUp, showDown };
}

// ── Main FloatingToolbar ─────────────────────────────────────────────────────
export default function FloatingToolbar() {
  const [panel, setPanel] = useState<"theme" | "a11y" | null>(null);
  const { showUp, showDown } = useScrollProgress();
  const { values } = useAccessibility();
  const muted = !!values.mute_sounds;
  const a11yActiveCount = ACCESSIBILITY_FEATURES.filter((f) => {
    const v = values[f.id];
    return v !== false && v !== f.defaultValue;
  }).length;

  const scrollTo = (dir: "top" | "bottom") => {
    window.scrollTo({ top: dir === "top" ? 0 : document.documentElement.scrollHeight, behavior: "smooth" });
  };

  const toggle = (p: "theme" | "a11y") => setPanel((cur) => cur === p ? null : p);

  return (
    <>
      {/* Panel overlay */}
      {panel && (
        <Box
          onClick={() => setPanel(null)}
          sx={{ position: "fixed", inset: 0, zIndex: 1299 }}
        />
      )}

      {/* Toolbar stack */}
      <Box sx={{
        position: "fixed", bottom: 24, right: 20, zIndex: 1300,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1,
      }}>
        {/* Panel (above buttons) */}
        {panel === "theme" && (
          <Box sx={{ mb: 0.5 }} onClick={(e) => e.stopPropagation()}>
            <ThemePanel onClose={() => setPanel(null)} />
          </Box>
        )}
        {panel === "a11y" && (
          <Box sx={{ mb: 0.5 }} onClick={(e) => e.stopPropagation()}>
            <AccessibilityPanel onClose={() => setPanel(null)} />
          </Box>
        )}

        {/* WhatsApp — pulsing */}
        {WHATSAPP_NUMBER && (
          <Box sx={{ position: "relative" }}>
            <Box sx={{
              position: "absolute", inset: -5, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(37,211,102,0.35) 0%, transparent 70%)",
              animation: "waPulse 2.5s ease-out infinite",
              "@keyframes waPulse": {
                "0%": { transform: "scale(0.9)", opacity: 0.7 },
                "50%": { transform: "scale(1.3)", opacity: 0 },
                "100%": { transform: "scale(0.9)", opacity: 0 },
              },
            }} />
            <Tooltip title="Chat Support on WhatsApp" placement="left" arrow>
              <Fab
                component="a"
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hi%2C%20I%20need%20help%20with%20MiloBolo`}
                target="_blank" rel="noopener noreferrer"
                aria-label="WhatsApp Support"
                size="medium"
                sx={{
                  bgcolor: "#25D366", color: "#fff", width: 46, height: 46,
                  boxShadow: "0 4px 20px rgba(37,211,102,0.5)",
                  "&:hover": { bgcolor: "#128C7E", transform: "scale(1.1)" },
                  transition: "transform 0.18s, background-color 0.18s",
                }}
              >
                <WhatsAppIcon sx={{ fontSize: 22 }} />
              </Fab>
            </Tooltip>
          </Box>
        )}

        {/* Accessibility */}
        <ToolFab
          icon={<AccessibilityNewIcon sx={{ fontSize: 18 }} />}
          label="Accessibility"
          onClick={() => toggle("a11y")}
          color={panel === "a11y" ? "#6C63FF" : "#1E1E2E"}
          badge={a11yActiveCount || undefined}
        />

        {/* Theme selector */}
        <ToolFab
          icon={<PaletteIcon sx={{ fontSize: 18 }} />}
          label="Change Theme"
          onClick={() => toggle("theme")}
          color={panel === "theme" ? "#6C63FF" : "#1E1E2E"}
        />

        {/* Scroll Down */}
        {showDown && (
          <Tooltip title="Scroll to bottom" placement="left" arrow>
            <Fab size="small" onClick={() => scrollTo("bottom")} aria-label="Scroll to bottom"
              sx={{
                width: 36, height: 36, bgcolor: "rgba(255,255,255,0.07)",
                color: "text.secondary", boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
              }}>
              <KeyboardArrowDownIcon fontSize="small" />
            </Fab>
          </Tooltip>
        )}

        {/* Scroll Up */}
        {showUp && (
          <Tooltip title="Scroll to top" placement="left" arrow>
            <Fab size="small" onClick={() => scrollTo("top")} aria-label="Scroll to top"
              sx={{
                width: 36, height: 36, bgcolor: "rgba(255,255,255,0.07)",
                color: "text.secondary", boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
              }}>
              <KeyboardArrowUpIcon fontSize="small" />
            </Fab>
          </Tooltip>
        )}
      </Box>
    </>
  );
}

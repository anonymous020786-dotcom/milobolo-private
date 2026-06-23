import {
  createContext, useContext, useState, useCallback,
  ReactNode, useMemo, useEffect,
} from "react";
import { createTheme, Theme } from "@mui/material/styles";

export interface ThemeDescriptor {
  id: string;
  name: string;
  emoji: string;
  category: string;
  mode: "dark" | "light";
  primary: string;
  secondary: string;
  bg: string;
  paper: string;
  textPrimary?: string;
  textSecondary?: string;
  gradient?: string; // for brand gradient
}

export const THEMES: ThemeDescriptor[] = [
  // ── Dark Defaults ──────────────────────────────────────────
  { id: "milobolo",   name: "MiloBolo",       emoji: "🎭", category: "Brand",    mode: "dark",  primary: "#6C63FF", secondary: "#FF6584", bg: "#0A0A0F", paper: "#13131A" },
  { id: "midnight",   name: "Midnight",        emoji: "🌙", category: "Dark",     mode: "dark",  primary: "#7C8CF8", secondary: "#F472B6", bg: "#030712", paper: "#0F172A" },
  { id: "carbon",     name: "Carbon",          emoji: "⚫", category: "Dark",     mode: "dark",  primary: "#64748B", secondary: "#94A3B8", bg: "#0D0D0D", paper: "#1A1A1A" },
  { id: "obsidian",   name: "Obsidian",        emoji: "🪨", category: "Dark",     mode: "dark",  primary: "#818CF8", secondary: "#C084FC", bg: "#09090B", paper: "#18181B" },
  { id: "charcoal",   name: "Charcoal",        emoji: "🌫️", category: "Dark",     mode: "dark",  primary: "#9CA3AF", secondary: "#6B7280", bg: "#111111", paper: "#1C1C1C" },
  { id: "void",       name: "Void",            emoji: "🕳️", category: "Dark",     mode: "dark",  primary: "#A78BFA", secondary: "#EC4899", bg: "#000000", paper: "#0D0D0D" },
  { id: "slate",      name: "Slate",           emoji: "🩶", category: "Dark",     mode: "dark",  primary: "#60A5FA", secondary: "#34D399", bg: "#0F172A", paper: "#1E293B" },
  { id: "abyss",      name: "Abyss",           emoji: "🌊", category: "Dark",     mode: "dark",  primary: "#38BDF8", secondary: "#818CF8", bg: "#01080F", paper: "#071322" },
  { id: "eclipse",    name: "Eclipse",         emoji: "🌘", category: "Dark",     mode: "dark",  primary: "#F59E0B", secondary: "#EF4444", bg: "#0C0A00", paper: "#1A1600" },
  { id: "noir",       name: "Film Noir",       emoji: "🎬", category: "Dark",     mode: "dark",  primary: "#D1D5DB", secondary: "#9CA3AF", bg: "#000000", paper: "#111111" },

  // ── Purple / Violet ────────────────────────────────────────
  { id: "ultraviolet",name: "Ultraviolet",     emoji: "💜", category: "Purple",   mode: "dark",  primary: "#A855F7", secondary: "#EC4899", bg: "#09050F", paper: "#160D24" },
  { id: "lavender",   name: "Lavender Night",  emoji: "🪻", category: "Purple",   mode: "dark",  primary: "#C4B5FD", secondary: "#DDD6FE", bg: "#0D0A1A", paper: "#1A1432" },
  { id: "grape",      name: "Grape",           emoji: "🍇", category: "Purple",   mode: "dark",  primary: "#8B5CF6", secondary: "#A78BFA", bg: "#0A0510", paper: "#150C22" },
  { id: "plum",       name: "Plum",            emoji: "🫐", category: "Purple",   mode: "dark",  primary: "#9333EA", secondary: "#7C3AED", bg: "#08050D", paper: "#140B1F" },
  { id: "mauve",      name: "Mauve",           emoji: "🌸", category: "Purple",   mode: "dark",  primary: "#D8B4FE", secondary: "#E879F9", bg: "#0E0A14", paper: "#1C1526" },
  { id: "amethyst",   name: "Amethyst",        emoji: "💎", category: "Purple",   mode: "dark",  primary: "#BF5AF2", secondary: "#DA77FF", bg: "#0B0511", paper: "#16091F" },

  // ── Blue / Cyan ────────────────────────────────────────────
  { id: "ocean",      name: "Deep Ocean",      emoji: "🌊", category: "Blue",     mode: "dark",  primary: "#0EA5E9", secondary: "#38BDF8", bg: "#020B18", paper: "#071E30" },
  { id: "navy",       name: "Navy",            emoji: "⚓", category: "Blue",     mode: "dark",  primary: "#3B82F6", secondary: "#60A5FA", bg: "#020617", paper: "#0E1733" },
  { id: "cobalt",     name: "Cobalt",          emoji: "🔵", category: "Blue",     mode: "dark",  primary: "#2563EB", secondary: "#1D4ED8", bg: "#030B1D", paper: "#0A1830" },
  { id: "sapphire",   name: "Sapphire",        emoji: "💎", category: "Blue",     mode: "dark",  primary: "#1D4ED8", secondary: "#6366F1", bg: "#020916", paper: "#071529" },
  { id: "azure",      name: "Azure",           emoji: "🌤️", category: "Blue",     mode: "dark",  primary: "#0284C7", secondary: "#0EA5E9", bg: "#010D18", paper: "#041D2E" },
  { id: "arctic",     name: "Arctic",          emoji: "🧊", category: "Blue",     mode: "dark",  primary: "#67E8F9", secondary: "#A5F3FC", bg: "#020C14", paper: "#071A25" },
  { id: "steel",      name: "Steel",           emoji: "🔩", category: "Blue",     mode: "dark",  primary: "#64748B", secondary: "#94A3B8", bg: "#0C1520", paper: "#182233" },
  { id: "neon_blue",  name: "Neon Blue",       emoji: "⚡", category: "Blue",     mode: "dark",  primary: "#00D4FF", secondary: "#0099CC", bg: "#000D14", paper: "#001A25" },

  // ── Green / Teal ───────────────────────────────────────────
  { id: "forest",     name: "Dark Forest",     emoji: "🌲", category: "Green",    mode: "dark",  primary: "#16A34A", secondary: "#15803D", bg: "#030A04", paper: "#08150A" },
  { id: "emerald",    name: "Emerald",         emoji: "💚", category: "Green",    mode: "dark",  primary: "#10B981", secondary: "#34D399", bg: "#031009", paper: "#071D10" },
  { id: "jade",       name: "Jade",            emoji: "🪨", category: "Green",    mode: "dark",  primary: "#4ADE80", secondary: "#86EFAC", bg: "#020B04", paper: "#061508" },
  { id: "sage",       name: "Sage",            emoji: "🌿", category: "Green",    mode: "dark",  primary: "#6EE7B7", secondary: "#A7F3D0", bg: "#030E09", paper: "#081C12" },
  { id: "matrix",     name: "Matrix",          emoji: "🖥️", category: "Green",    mode: "dark",  primary: "#00FF41", secondary: "#00CC33", bg: "#000000", paper: "#050F05", textPrimary: "#00FF41" },
  { id: "teal",       name: "Teal",            emoji: "🌊", category: "Green",    mode: "dark",  primary: "#14B8A6", secondary: "#0D9488", bg: "#030E0D", paper: "#061C1A" },
  { id: "mint",       name: "Mint",            emoji: "🍃", category: "Green",    mode: "dark",  primary: "#6EE7B7", secondary: "#34D399", bg: "#030E09", paper: "#071A10" },

  // ── Red / Pink / Orange ────────────────────────────────────
  { id: "crimson",    name: "Crimson",         emoji: "🔴", category: "Red",      mode: "dark",  primary: "#DC2626", secondary: "#EF4444", bg: "#0D0101", paper: "#1A0404" },
  { id: "cherry",     name: "Cherry",          emoji: "🍒", category: "Red",      mode: "dark",  primary: "#E11D48", secondary: "#FB7185", bg: "#0D0108", paper: "#1A0311" },
  { id: "rose",       name: "Rose Gold",       emoji: "🌹", category: "Red",      mode: "dark",  primary: "#FB7185", secondary: "#FDA4AF", bg: "#0D060A", paper: "#1A0C12" },
  { id: "flamingo",   name: "Flamingo",        emoji: "🦩", category: "Red",      mode: "dark",  primary: "#F472B6", secondary: "#EC4899", bg: "#0D030C", paper: "#1A0718" },
  { id: "coral",      name: "Coral",           emoji: "🪸", category: "Red",      mode: "dark",  primary: "#F97316", secondary: "#FB923C", bg: "#0D0600", paper: "#1A0D00" },
  { id: "sunset",     name: "Sunset",          emoji: "🌅", category: "Warm",     mode: "dark",  primary: "#F59E0B", secondary: "#EF4444", bg: "#0D0800", paper: "#1A1000" },

  // ── Warm / Gold ────────────────────────────────────────────
  { id: "amber",      name: "Amber",           emoji: "🟡", category: "Warm",     mode: "dark",  primary: "#F59E0B", secondary: "#FBBF24", bg: "#0D0900", paper: "#1A1200" },
  { id: "copper",     name: "Copper",          emoji: "🥉", category: "Warm",     mode: "dark",  primary: "#D97706", secondary: "#B45309", bg: "#0A0600", paper: "#160E00" },
  { id: "gold",       name: "Gold",            emoji: "🏆", category: "Warm",     mode: "dark",  primary: "#EAB308", secondary: "#CA8A04", bg: "#0A0800", paper: "#161100" },
  { id: "autumn",     name: "Autumn",          emoji: "🍂", category: "Warm",     mode: "dark",  primary: "#EA580C", secondary: "#D97706", bg: "#0D0600", paper: "#1A0E00" },
  { id: "bronze",     name: "Bronze",          emoji: "🥈", category: "Warm",     mode: "dark",  primary: "#A16207", secondary: "#CA8A04", bg: "#090600", paper: "#140D00" },

  // ── Special / Hacker ──────────────────────────────────────
  { id: "cyberpunk",  name: "Cyberpunk",       emoji: "🤖", category: "Special",  mode: "dark",  primary: "#FFFF00", secondary: "#FF00FF", bg: "#050005", paper: "#0A000A", textPrimary: "#FFFF00" },
  { id: "dracula",    name: "Dracula",         emoji: "🧛", category: "Special",  mode: "dark",  primary: "#BD93F9", secondary: "#FF79C6", bg: "#282A36", paper: "#383A4A", textPrimary: "#F8F8F2" },
  { id: "nord",       name: "Nord",            emoji: "❄️", category: "Special",  mode: "dark",  primary: "#88C0D0", secondary: "#81A1C1", bg: "#2E3440", paper: "#3B4252", textPrimary: "#ECEFF4" },
  { id: "monokai",    name: "Monokai",         emoji: "🖊️", category: "Special",  mode: "dark",  primary: "#A6E22E", secondary: "#F92672", bg: "#272822", paper: "#3E3D32", textPrimary: "#F8F8F2" },
  { id: "solarized",  name: "Solarized Dark",  emoji: "☀️", category: "Special",  mode: "dark",  primary: "#2AA198", secondary: "#859900", bg: "#002B36", paper: "#073642", textPrimary: "#839496" },
  { id: "tokyo",      name: "Tokyo Night",     emoji: "🗼", category: "Special",  mode: "dark",  primary: "#7AA2F7", secondary: "#BB9AF7", bg: "#1A1B26", paper: "#24283B", textPrimary: "#C0CAF5" },
  { id: "gruvbox",    name: "Gruvbox",         emoji: "📦", category: "Special",  mode: "dark",  primary: "#FABD2F", secondary: "#B8BB26", bg: "#282828", paper: "#3C3836", textPrimary: "#EBDBB2" },
  { id: "one_dark",   name: "One Dark",        emoji: "🌑", category: "Special",  mode: "dark",  primary: "#61AFEF", secondary: "#C678DD", bg: "#282C34", paper: "#31353F", textPrimary: "#ABB2BF" },
  { id: "catppuccin", name: "Catppuccin",      emoji: "☕", category: "Special",  mode: "dark",  primary: "#CBA6F7", secondary: "#F38BA8", bg: "#1E1E2E", paper: "#313244", textPrimary: "#CDD6F4" },
  { id: "everforest", name: "Everforest",      emoji: "🌳", category: "Special",  mode: "dark",  primary: "#A7C080", secondary: "#E69875", bg: "#2D353B", paper: "#3D484D", textPrimary: "#D3C6AA" },
  { id: "kanagawa",   name: "Kanagawa",        emoji: "🌊", category: "Special",  mode: "dark",  primary: "#7E9CD8", secondary: "#DCA561", bg: "#1F1F28", paper: "#2A2A37", textPrimary: "#C8C093" },
  { id: "rosepine",   name: "Rosé Pine",       emoji: "🌹", category: "Special",  mode: "dark",  primary: "#C4A7E7", secondary: "#EB6F92", bg: "#191724", paper: "#26233A", textPrimary: "#E0DEF4" },
  { id: "palenight",  name: "Palenight",       emoji: "🌌", category: "Special",  mode: "dark",  primary: "#82AAFF", secondary: "#C792EA", bg: "#292D3E", paper: "#333747", textPrimary: "#A6ACCD" },

  // ── Galaxy / Space ────────────────────────────────────────
  { id: "aurora",     name: "Aurora",          emoji: "🌌", category: "Galaxy",   mode: "dark",  primary: "#00FFCC", secondary: "#FF0099", bg: "#000A14", paper: "#001525" },
  { id: "nebula",     name: "Nebula",          emoji: "🌠", category: "Galaxy",   mode: "dark",  primary: "#C084FC", secondary: "#38BDF8", bg: "#04020D", paper: "#09051A" },
  { id: "galaxy",     name: "Galaxy",          emoji: "🔭", category: "Galaxy",   mode: "dark",  primary: "#818CF8", secondary: "#F472B6", bg: "#02020A", paper: "#07071A" },
  { id: "stardust",   name: "Stardust",        emoji: "✨", category: "Galaxy",   mode: "dark",  primary: "#FDE68A", secondary: "#DDD6FE", bg: "#050310", paper: "#0D091F" },
  { id: "cosmos",     name: "Cosmos",          emoji: "🪐", category: "Galaxy",   mode: "dark",  primary: "#E879F9", secondary: "#22D3EE", bg: "#030014", paper: "#08002A" },

  // ── Light Themes ──────────────────────────────────────────
  { id: "clean",      name: "Clean White",     emoji: "🤍", category: "Light",    mode: "light", primary: "#6C63FF", secondary: "#FF6584", bg: "#FFFFFF", paper: "#F8F9FA", textPrimary: "#111111", textSecondary: "#666677" },
  { id: "cream",      name: "Cream",           emoji: "🍦", category: "Light",    mode: "light", primary: "#7C3AED", secondary: "#DB2777", bg: "#FFFDF7", paper: "#FFF9EC", textPrimary: "#1A1A1A", textSecondary: "#666655" },
  { id: "paper",      name: "Paper",           emoji: "📄", category: "Light",    mode: "light", primary: "#2563EB", secondary: "#9333EA", bg: "#F9FAFB", paper: "#FFFFFF", textPrimary: "#111827", textSecondary: "#6B7280" },
  { id: "mint_light", name: "Mint Fresh",      emoji: "🍃", category: "Light",    mode: "light", primary: "#059669", secondary: "#2563EB", bg: "#F0FDF4", paper: "#FFFFFF", textPrimary: "#111827", textSecondary: "#4B5563" },
  { id: "sky",        name: "Sky Blue",        emoji: "🌤️", category: "Light",    mode: "light", primary: "#0284C7", secondary: "#7C3AED", bg: "#F0F9FF", paper: "#FFFFFF", textPrimary: "#0C4A6E", textSecondary: "#0369A1" },
  { id: "rose_light", name: "Rose",            emoji: "🌺", category: "Light",    mode: "light", primary: "#E11D48", secondary: "#9333EA", bg: "#FFF1F2", paper: "#FFFFFF", textPrimary: "#881337", textSecondary: "#9F1239" },
  { id: "solarized_l",name: "Solarized Light", emoji: "🌞", category: "Light",    mode: "light", primary: "#268BD2", secondary: "#2AA198", bg: "#FDF6E3", paper: "#EEE8D5", textPrimary: "#657B83", textSecondary: "#839496" },
];

interface ThemeCtxValue {
  themeId: string;
  setThemeId: (id: string) => void;
  currentDescriptor: ThemeDescriptor;
  buildMuiTheme: (d: ThemeDescriptor) => Theme;
}

const ThemeCtx = createContext<ThemeCtxValue>({
  themeId: "milobolo",
  setThemeId: () => {},
  currentDescriptor: THEMES[0],
  buildMuiTheme: () => createTheme(),
});

const STORAGE_KEY = "mb_theme";

export function buildMuiTheme(d: ThemeDescriptor): Theme {
  return createTheme({
    palette: {
      mode: d.mode,
      primary: { main: d.primary },
      secondary: { main: d.secondary },
      background: { default: d.bg, paper: d.paper },
      text: {
        primary: d.textPrimary ?? (d.mode === "dark" ? "#FFFFFF" : "#111111"),
        secondary: d.textSecondary ?? (d.mode === "dark" ? "#B0B0C3" : "#555566"),
      },
      success: { main: "#4CAF50" },
      warning: { main: "#FF9800" },
      error: { main: "#F44336" },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontWeight: 800 }, h2: { fontWeight: 700 },
      h3: { fontWeight: 700 }, h4: { fontWeight: 600 },
      h5: { fontWeight: 600 }, h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: "none", fontWeight: 600, borderRadius: 8, padding: "10px 24px" },
          containedPrimary: {
            background: `linear-gradient(135deg, ${d.primary} 0%, ${d.secondary} 100%)`,
            "&:hover": { background: `linear-gradient(135deg, ${d.secondary} 0%, ${d.primary} 100%)` },
          },
        },
      },
      MuiCard: { styleOverrides: { root: { backgroundImage: "none", border: `1px solid ${d.primary}1F` } } },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: 8,
              "& fieldset": { borderColor: `${d.primary}4D` },
              "&:hover fieldset": { borderColor: `${d.primary}99` },
              "&.Mui-focused fieldset": { borderColor: d.primary },
            },
          },
        },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: 6 } } },
    },
  });
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) || "milobolo";
    }
    return "milobolo";
  });

  const setThemeId = useCallback((id: string) => {
    setThemeIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const currentDescriptor = useMemo(
    () => THEMES.find((t) => t.id === themeId) || THEMES[0],
    [themeId]
  );

  useEffect(() => {
    // Apply matrix/special overrides via CSS var on root
    document.documentElement.setAttribute("data-theme", themeId);
  }, [themeId]);

  return (
    <ThemeCtx.Provider value={{ themeId, setThemeId, currentDescriptor, buildMuiTheme }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useAppTheme = () => useContext(ThemeCtx);

import {
  createContext, useContext, useState, useCallback,
  useEffect, ReactNode,
} from "react";

export interface AccessibilityFeature {
  id: string;
  label: string;
  description: string;
  category: string;
  type: "toggle" | "range" | "select";
  defaultValue: boolean | number | string;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  cssVar?: string;
  cssClass?: string;
  bodyAttr?: string;
}

export const ACCESSIBILITY_FEATURES: AccessibilityFeature[] = [
  // ── Vision ────────────────────────────────────────────────
  { id: "high_contrast",       label: "High Contrast",          description: "Maximise colour contrast for readability", category: "Vision",    type: "toggle", defaultValue: false, cssClass: "a11y-high-contrast" },
  { id: "invert_colors",       label: "Invert Colors",          description: "Invert all page colours",                  category: "Vision",    type: "toggle", defaultValue: false, cssClass: "a11y-invert" },
  { id: "grayscale",           label: "Grayscale",              description: "Convert page to black & white",            category: "Vision",    type: "toggle", defaultValue: false, cssClass: "a11y-grayscale" },
  { id: "protanopia",          label: "Protanopia",             description: "Simulate red-weak colour vision",          category: "Vision",    type: "toggle", defaultValue: false, cssClass: "a11y-protanopia" },
  { id: "deuteranopia",        label: "Deuteranopia",           description: "Simulate green-weak colour vision",        category: "Vision",    type: "toggle", defaultValue: false, cssClass: "a11y-deuteranopia" },
  { id: "tritanopia",          label: "Tritanopia",             description: "Simulate blue-weak colour vision",         category: "Vision",    type: "toggle", defaultValue: false, cssClass: "a11y-tritanopia" },
  { id: "brightness",          label: "Brightness",             description: "Adjust page brightness level",             category: "Vision",    type: "range",  defaultValue: 100, min: 50, max: 150, step: 5, unit: "%", cssVar: "--a11y-brightness" },
  { id: "contrast",            label: "Contrast",               description: "Adjust text/background contrast",          category: "Vision",    type: "range",  defaultValue: 100, min: 50, max: 200, step: 5, unit: "%", cssVar: "--a11y-contrast" },
  { id: "saturation",          label: "Saturation",             description: "Reduce or boost colour saturation",        category: "Vision",    type: "range",  defaultValue: 100, min: 0,  max: 200, step: 5, unit: "%", cssVar: "--a11y-saturation" },
  { id: "blue_light",          label: "Blue Light Filter",      description: "Warm the screen to reduce eye strain",     category: "Vision",    type: "range",  defaultValue: 0, min: 0, max: 80, step: 5, unit: "%", cssVar: "--a11y-sepia" },
  { id: "zoom",                label: "Page Zoom",              description: "Scale all page content",                   category: "Vision",    type: "range",  defaultValue: 100, min: 75, max: 200, step: 5, unit: "%", cssVar: "--a11y-zoom" },
  { id: "focus_highlight",     label: "Focus Highlight",        description: "Bold highlight on focused elements",       category: "Vision",    type: "toggle", defaultValue: false, cssClass: "a11y-focus-highlight" },
  { id: "hide_images",         label: "Hide Images",            description: "Remove images for distraction-free reading",category: "Vision",  type: "toggle", defaultValue: false, cssClass: "a11y-hide-images" },
  { id: "reading_guide",       label: "Reading Guide",          description: "Horizontal highlight follows mouse",       category: "Vision",    type: "toggle", defaultValue: false, cssClass: "a11y-reading-guide" },

  // ── Text / Typography ─────────────────────────────────────
  { id: "font_size",           label: "Font Size",              description: "Increase or decrease base text size",      category: "Text",      type: "range",  defaultValue: 16, min: 10, max: 28, step: 1, unit: "px", cssVar: "--a11y-font-size" },
  { id: "line_height",         label: "Line Height",            description: "Adjust space between lines",               category: "Text",      type: "range",  defaultValue: 1.6, min: 1.0, max: 3.0, step: 0.1, cssVar: "--a11y-line-height" },
  { id: "word_spacing",        label: "Word Spacing",           description: "Add space between words",                  category: "Text",      type: "range",  defaultValue: 0, min: 0, max: 10, step: 1, unit: "px", cssVar: "--a11y-word-spacing" },
  { id: "letter_spacing",      label: "Letter Spacing",         description: "Add space between individual characters",  category: "Text",      type: "range",  defaultValue: 0, min: 0, max: 8, step: 0.5, unit: "px", cssVar: "--a11y-letter-spacing" },
  { id: "paragraph_spacing",   label: "Paragraph Spacing",      description: "Extra space below paragraphs",             category: "Text",      type: "range",  defaultValue: 0, min: 0, max: 20, step: 2, unit: "px", cssVar: "--a11y-paragraph-spacing" },
  { id: "dyslexia_font",       label: "Dyslexia Font",          description: "Use OpenDyslexic font for easier reading", category: "Text",      type: "toggle", defaultValue: false, cssClass: "a11y-dyslexia" },
  { id: "bold_text",           label: "Bold Text",              description: "Make all body text bold",                  category: "Text",      type: "toggle", defaultValue: false, cssClass: "a11y-bold" },
  { id: "monospace",           label: "Monospace Font",         description: "Use a monospace font for all text",        category: "Text",      type: "toggle", defaultValue: false, cssClass: "a11y-monospace" },
  { id: "text_align",          label: "Text Alignment",         description: "Override text alignment site-wide",        category: "Text",      type: "select", defaultValue: "default",
    options: [{ label: "Default", value: "default" }, { label: "Left", value: "left" }, { label: "Center", value: "center" }, { label: "Right", value: "right" }, { label: "Justify", value: "justify" }],
    bodyAttr: "data-a11y-align" },
  { id: "column_width",        label: "Reading Width",          description: "Narrow columns are easier to read",        category: "Text",      type: "range",  defaultValue: 100, min: 40, max: 100, step: 5, unit: "%", cssVar: "--a11y-max-width" },
  { id: "emphasize_headings",  label: "Emphasise Headings",     description: "Add underline + extra weight to headings", category: "Text",      type: "toggle", defaultValue: false, cssClass: "a11y-emph-headings" },
  { id: "underline_links",     label: "Underline Links",        description: "Always underline hyperlinks",              category: "Text",      type: "toggle", defaultValue: false, cssClass: "a11y-underline-links" },
  { id: "highlight_links",     label: "Highlight Links",        description: "Colour-highlight all clickable links",     category: "Text",      type: "toggle", defaultValue: false, cssClass: "a11y-highlight-links" },
  { id: "text_shadow",         label: "Text Shadow",            description: "Add soft shadow to improve legibility",    category: "Text",      type: "toggle", defaultValue: false, cssClass: "a11y-text-shadow" },

  // ── Motion / Animation ────────────────────────────────────
  { id: "reduce_motion",       label: "Reduce Motion",          description: "Remove or slow all CSS animations",        category: "Motion",    type: "toggle", defaultValue: false, cssClass: "a11y-reduce-motion" },
  { id: "pause_animations",    label: "Pause Animations",       description: "Freeze all running animations",            category: "Motion",    type: "toggle", defaultValue: false, cssClass: "a11y-pause-anims" },
  { id: "no_transitions",      label: "No Transitions",         description: "Disable CSS transition effects",           category: "Motion",    type: "toggle", defaultValue: false, cssClass: "a11y-no-transitions" },
  { id: "slow_scroll",         label: "Smooth Slow Scroll",     description: "Slow down scroll speed for comfort",       category: "Motion",    type: "toggle", defaultValue: false, cssClass: "a11y-slow-scroll" },

  // ── Audio ─────────────────────────────────────────────────
  { id: "mute_sounds",         label: "Mute UI Sounds",         description: "Disable match/disconnect audio tones",     category: "Audio",     type: "toggle", defaultValue: false, bodyAttr: "data-a11y-mute" },
  { id: "captions",            label: "Caption Hints",          description: "Show text labels on all icon buttons",     category: "Audio",     type: "toggle", defaultValue: false, cssClass: "a11y-captions" },
  { id: "audio_desc",          label: "Audio Description Hints",description: "Show descriptive tooltips on media",       category: "Audio",     type: "toggle", defaultValue: false, cssClass: "a11y-audio-desc" },

  // ── Navigation / Motor ────────────────────────────────────
  { id: "keyboard_nav",        label: "Enhanced Keyboard Nav",  description: "Larger focus rings for keyboard users",    category: "Navigation",type: "toggle", defaultValue: false, cssClass: "a11y-keyboard-nav" },
  { id: "big_cursor",          label: "Large Cursor",           description: "Enlarge the mouse pointer",                category: "Navigation",type: "toggle", defaultValue: false, cssClass: "a11y-big-cursor" },
  { id: "big_buttons",         label: "Larger Buttons",         description: "Scale up all button targets",              category: "Navigation",type: "toggle", defaultValue: false, cssClass: "a11y-big-buttons" },
  { id: "reading_progress",    label: "Reading Progress Bar",   description: "Show page scroll progress at top",         category: "Navigation",type: "toggle", defaultValue: false, cssClass: "a11y-progress-bar" },
  { id: "sticky_nav",          label: "Sticky Navigation",      description: "Keep navbar always visible while scrolling",category: "Navigation",type: "toggle", defaultValue: false, cssClass: "a11y-sticky-nav" },
  { id: "skip_to_content",     label: "Skip to Content",        description: "Show skip link at top of page",            category: "Navigation",type: "toggle", defaultValue: false, cssClass: "a11y-skip-link" },
  { id: "single_column",       label: "Single Column Layout",   description: "Force all content into one column",        category: "Navigation",type: "toggle", defaultValue: false, cssClass: "a11y-single-col" },
  { id: "tab_size",            label: "Tab Size Override",       description: "Set tab indentation width (for code blocks)",category: "Navigation",type: "range",  defaultValue: 4, min: 2, max: 8, step: 2, cssVar: "--a11y-tab-size" },

  // ── Cognitive / Focus ─────────────────────────────────────
  { id: "dark_overlay",        label: "Dark Reading Overlay",   description: "Dim periphery to focus on text",           category: "Cognitive", type: "toggle", defaultValue: false, cssClass: "a11y-dark-overlay" },
  { id: "highlight_para",      label: "Paragraph Highlight",    description: "Highlight paragraph on mouse hover",       category: "Cognitive", type: "toggle", defaultValue: false, cssClass: "a11y-highlight-para" },
  { id: "remove_backgrounds",  label: "Remove Decorations",     description: "Strip background images & gradients",      category: "Cognitive", type: "toggle", defaultValue: false, cssClass: "a11y-no-bg" },
  { id: "highlight_headings",  label: "Highlight Headings",     description: "Add coloured left border to headings",     category: "Cognitive", type: "toggle", defaultValue: false, cssClass: "a11y-heading-border" },
  { id: "mute_colors",         label: "Muted Colors",           description: "Desaturate vivid UI elements",             category: "Cognitive", type: "toggle", defaultValue: false, cssClass: "a11y-mute-colors" },
  { id: "print_mode",          label: "Print-Friendly",         description: "High contrast white background layout",    category: "Cognitive", type: "toggle", defaultValue: false, cssClass: "a11y-print" },
  { id: "tooltip_delay",       label: "Instant Tooltips",       description: "Remove tooltip hover delay",               category: "Cognitive", type: "toggle", defaultValue: false, cssClass: "a11y-instant-tooltip" },
  { id: "no_distractions",     label: "No Distractions",        description: "Hide decorative non-essential elements",   category: "Cognitive", type: "toggle", defaultValue: false, cssClass: "a11y-no-distractions" },
  { id: "sentence_spacing",    label: "Sentence Spacing",       description: "Double space after full stops",            category: "Cognitive", type: "toggle", defaultValue: false, cssClass: "a11y-sentence-spacing" },
  { id: "break_words",         label: "Break Long Words",        description: "Prevent text overflow on long words",      category: "Cognitive", type: "toggle", defaultValue: false, cssClass: "a11y-break-words" },
];

export type A11yValues = Record<string, boolean | number | string>;

interface A11yCtxValue {
  values: A11yValues;
  set: (id: string, value: boolean | number | string) => void;
  reset: () => void;
  get: (id: string) => boolean | number | string;
}

const defaults = (): A11yValues => {
  const d: A11yValues = {};
  ACCESSIBILITY_FEATURES.forEach((f) => { d[f.id] = f.defaultValue; });
  return d;
};

const AccessibilityCtx = createContext<A11yCtxValue>({
  values: defaults(), set: () => {}, reset: () => {}, get: () => false,
});

const STORAGE_KEY = "mb_a11y";

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<A11yValues>(() => {
    const base = defaults();
    if (typeof window !== "undefined") {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        return { ...base, ...saved };
      } catch {}
    }
    return base;
  });

  const set = useCallback((id: string, value: boolean | number | string) => {
    setValues((prev) => {
      const next = { ...prev, [id]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const d = defaults();
    setValues(d);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  }, []);

  const get = useCallback((id: string): boolean | number | string => values[id] ?? false, [values]);

  // Apply all settings to DOM
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const classesToApply: string[] = [];
    const classesToRemove: string[] = [];

    ACCESSIBILITY_FEATURES.forEach((f) => {
      const val = values[f.id];
      if (f.cssClass) {
        if (val === true) classesToApply.push(f.cssClass);
        else classesToRemove.push(f.cssClass);
      }
      if (f.cssVar && typeof val === "number") {
        root.style.setProperty(f.cssVar, `${val}${f.unit || ""}`);
      }
      if (f.bodyAttr && typeof val === "string" && val !== "default") {
        body.setAttribute(f.bodyAttr, val);
      } else if (f.bodyAttr && (val === "default" || val === false)) {
        body.removeAttribute(f.bodyAttr);
      }
    });

    body.classList.add(...classesToApply);
    classesToRemove.forEach((c) => body.classList.remove(c));

    // Composite CSS filter
    const brightness = values.brightness as number ?? 100;
    const contrast = values.contrast as number ?? 100;
    const sat = values.saturation as number ?? 100;
    const sepia = values.blue_light as number ?? 0;
    const grayscale = values.grayscale ? "grayscale(1)" : "";
    const invert = values.invert_colors ? "invert(1)" : "";
    const proto = values.protanopia ? "url(#protanopia)" : "";
    const deut = values.deuteranopia ? "url(#deuteranopia)" : "";
    const trit = values.tritanopia ? "url(#tritanopia)" : "";
    const filterParts = [
      `brightness(${brightness / 100})`,
      `contrast(${contrast / 100})`,
      `saturate(${sat / 100})`,
      sepia > 0 ? `sepia(${sepia / 100})` : "",
      grayscale, invert,
    ].filter(Boolean).join(" ");
    root.style.filter = filterParts || "";

    // SVG filter references need to be on body
    body.style.filter = [proto, deut, trit].filter(Boolean).join(" ") || "";

    // Zoom
    const zoom = values.zoom as number ?? 100;
    root.style.fontSize = zoom !== 100 ? `${zoom}%` : "";

    // Font size CSS var
    const fontSize = values.font_size as number ?? 16;
    root.style.setProperty("--a11y-font-size", `${fontSize}px`);
  }, [values]);

  return (
    <AccessibilityCtx.Provider value={{ values, set, reset, get }}>
      {/* SVG colour-blindness filters — hidden */}
      <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden>
        <defs>
          <filter id="protanopia">
            <feColorMatrix type="matrix" values="0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0"/>
          </filter>
          <filter id="deuteranopia">
            <feColorMatrix type="matrix" values="0.625,0.375,0,0,0 0.7,0.3,0,0,0 0,0.3,0.7,0,0 0,0,0,1,0"/>
          </filter>
          <filter id="tritanopia">
            <feColorMatrix type="matrix" values="0.95,0.05,0,0,0 0,0.433,0.567,0,0 0,0.475,0.525,0,0 0,0,0,1,0"/>
          </filter>
        </defs>
      </svg>
      {children}
    </AccessibilityCtx.Provider>
  );
}

export const useAccessibility = () => useContext(AccessibilityCtx);

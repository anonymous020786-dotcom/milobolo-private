import { useEffect, useState } from "react";

// Lightweight browser fingerprint — no library needed.
// Combines canvas, audio, screen, timezone, platform signals.
async function computeFingerprint(): Promise<string> {
  const signals: string[] = [];

  // Canvas fingerprint
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("MiloBolo🎲", 2, 15);
    signals.push(canvas.toDataURL().slice(-50));
  } catch {}

  // Screen
  signals.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
  // Timezone
  signals.push(Intl.DateTimeFormat().resolvedOptions().timeZone);
  // Platform
  signals.push(navigator.platform || "");
  // Language
  signals.push(navigator.language || "");
  // Hardware concurrency
  signals.push(String(navigator.hardwareConcurrency || 0));
  // User agent hash
  signals.push(navigator.userAgent.slice(0, 80));

  const raw = signals.join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useFingerprint() {
  const [fpId, setFpId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("mbfp");
    if (stored) { setFpId(stored); return; }
    computeFingerprint().then((fp) => {
      localStorage.setItem("mbfp", fp);
      setFpId(fp);
    });
  }, []);

  return fpId;
}

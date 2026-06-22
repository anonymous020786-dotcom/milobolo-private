import { useRef, useState, useCallback } from "react";

export type BgMode = "none" | "blur" | "color";

export function useVirtualBackground(videoRef: React.RefObject<HTMLVideoElement>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [mode, setMode] = useState<BgMode>("none");

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const applyBlur = useCallback((bgMode: BgMode, color = "#1a1a2e") => {
    const video = videoRef.current;
    if (!video) return null;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d")!;

    stop();

    const draw = () => {
      if (!video || video.paused || video.ended) return;
      ctx.save();

      if (bgMode === "blur") {
        // Draw blurred version as background
        ctx.filter = "blur(20px) brightness(0.6)";
        ctx.drawImage(video, -30, -30, canvas.width + 60, canvas.height + 60);
        // Draw sharp centre crop on top (simulates portrait mode)
        ctx.filter = "none";
        const cw = canvas.width * 0.55;
        const ch = canvas.height * 0.9;
        const cx = (canvas.width - cw) / 2;
        const cy = (canvas.height - ch) / 2;
        ctx.drawImage(video, cx, cy, cw, ch);
      } else if (bgMode === "color") {
        ctx.filter = "none";
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const cw = canvas.width * 0.55;
        const ch = canvas.height * 0.9;
        ctx.drawImage(video, (canvas.width - cw) / 2, (canvas.height - ch) / 2, cw, ch);
      } else {
        ctx.filter = "none";
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    // Return the canvas stream to replace the video track
    return (canvas as any).captureStream?.(30) as MediaStream | null;
  }, [videoRef, stop]);

  const activate = useCallback((bgMode: BgMode, originalStream: MediaStream | null): MediaStream | null => {
    setMode(bgMode);
    if (bgMode === "none") { stop(); return originalStream; }
    return applyBlur(bgMode);
  }, [applyBlur, stop]);

  return { mode, activate, stop };
}

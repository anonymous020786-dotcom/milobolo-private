import { useRef, useState, useCallback, useEffect } from "react";

export type BgMode = "none" | "blur" | "color";

// MediaPipe Selfie Segmentation loaded lazily from CDN
let segmenterPromise: Promise<unknown> | null = null;
let SelfieSegmentation: unknown = null;

async function loadSegmenter(): Promise<unknown> {
  if (SelfieSegmentation) return SelfieSegmentation;
  if (segmenterPromise) return segmenterPromise;

  segmenterPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") { reject(new Error("SSR")); return; }

    const existing = document.getElementById("mp-selfie-seg");
    if (existing) {
      // Script already loading — wait for it
      existing.addEventListener("load", () => {
        SelfieSegmentation = (window as Record<string, unknown>)["SelfieSegmentation"];
        resolve(SelfieSegmentation);
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "mp-selfie-seg";
    script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js";
    script.crossOrigin = "anonymous";
    script.onload = () => {
      SelfieSegmentation = (window as Record<string, unknown>)["SelfieSegmentation"];
      resolve(SelfieSegmentation);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return segmenterPromise;
}

export function useVirtualBackground(videoRef: React.RefObject<HTMLVideoElement>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const segRef = useRef<{ send: (opts: { image: HTMLVideoElement }) => Promise<void>; onResults: (cb: unknown) => void } | null>(null);
  const [mode, setMode] = useState<BgMode>("none");
  const bgColorRef = useRef("#1a1a2e");
  const modeRef = useRef<BgMode>("none");

  // Keep modeRef in sync so the draw loop can read it without stale closure
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  // ── Canvas fallback (no ML) ──────────────────────────────────────────────
  const applyCanvasBlur = useCallback((bgMode: BgMode, color: string) => {
    const video = videoRef.current;
    if (!video) return null;
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;
    canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext("2d")!;
    stop();

    const draw = () => {
      if (!video || video.paused || video.ended) { rafRef.current = requestAnimationFrame(draw); return; }
      ctx.save();
      if (bgMode === "blur") {
        ctx.filter = "blur(20px) brightness(0.6)";
        ctx.drawImage(video, -30, -30, canvas.width + 60, canvas.height + 60);
        ctx.filter = "none";
        const cw = canvas.width * 0.55, ch = canvas.height * 0.9;
        ctx.drawImage(video, (canvas.width - cw) / 2, (canvas.height - ch) / 2, cw, ch);
      } else if (bgMode === "color") {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const cw = canvas.width * 0.55, ch = canvas.height * 0.9;
        ctx.drawImage(video, (canvas.width - cw) / 2, (canvas.height - ch) / 2, cw, ch);
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      ctx.restore();
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream?.(30) ?? null;
  }, [videoRef, stop]);

  // ── MediaPipe segmentation ───────────────────────────────────────────────
  const startSegmentation = useCallback(async (bgMode: BgMode, color: string): Promise<MediaStream | null> => {
    const video = videoRef.current;
    if (!video) return null;
    if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d")!;
    stop();

    let Seg: new (opts: { locateFile: (f: string) => string }) => { send: (o: { image: HTMLVideoElement }) => Promise<void>; onResults: (cb: (r: { segmentationMask: HTMLCanvasElement; image: HTMLCanvasElement }) => void) => void; initialize: () => Promise<void> };
    try {
      Seg = await loadSegmenter() as typeof Seg;
    } catch {
      // MediaPipe failed to load (offline/CSP) — fall back to canvas blur
      return applyCanvasBlur(bgMode, color);
    }

    if (!segRef.current) {
      const seg = new Seg({
        locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${f}`,
      });
      seg.onResults((results: { segmentationMask: HTMLCanvasElement; image: HTMLCanvasElement }) => {
        if (!results.segmentationMask) return;
        const { width: w, height: h } = canvas;
        ctx.clearRect(0, 0, w, h);

        if (modeRef.current === "blur") {
          // Draw blurred full frame
          ctx.filter = "blur(16px)";
          ctx.drawImage(results.image, 0, 0, w, h);
          ctx.filter = "none";
          // Composite sharp person on top using mask
          ctx.save();
          ctx.globalCompositeOperation = "destination-out";
          ctx.drawImage(results.segmentationMask, 0, 0, w, h);
          ctx.restore();
          // Draw person sharp
          ctx.save();
          ctx.globalCompositeOperation = "destination-atop";
          ctx.drawImage(results.image, 0, 0, w, h);
          ctx.restore();
        } else if (modeRef.current === "color") {
          ctx.fillStyle = bgColorRef.current;
          ctx.fillRect(0, 0, w, h);
          ctx.save();
          ctx.globalCompositeOperation = "destination-out";
          ctx.drawImage(results.segmentationMask, 0, 0, w, h);
          ctx.restore();
          ctx.save();
          ctx.globalCompositeOperation = "destination-atop";
          ctx.drawImage(results.image, 0, 0, w, h);
          ctx.restore();
        } else {
          ctx.drawImage(results.image, 0, 0, w, h);
        }
      });
      await seg.initialize();
      segRef.current = seg;
    }

    const sendFrame = async () => {
      if (!video || video.paused || video.ended || modeRef.current === "none") {
        rafRef.current = requestAnimationFrame(sendFrame);
        return;
      }
      await segRef.current!.send({ image: video });
      rafRef.current = requestAnimationFrame(sendFrame);
    };
    sendFrame();

    return (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream?.(30) ?? null;
  }, [videoRef, stop, applyCanvasBlur]);

  const activate = useCallback(async (bgMode: BgMode, originalStream: MediaStream | null, color = "#1a1a2e"): Promise<MediaStream | null> => {
    bgColorRef.current = color;
    setMode(bgMode);
    if (bgMode === "none") { stop(); return originalStream; }

    // Try MediaPipe first; falls back to canvas blur automatically
    const stream = await startSegmentation(bgMode, color);
    return stream;
  }, [startSegmentation, stop]);

  return { mode, activate, stop };
}

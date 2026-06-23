import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Typography, Button, Paper, Stack, Chip, Alert,
  CircularProgress, Select, MenuItem, FormControl, InputLabel,
  FormControlLabel, Switch, Divider,
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import MicIcon from "@mui/icons-material/Mic";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import TuneIcon from "@mui/icons-material/Tune";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import styles from "@/styles/chat.module.css";

interface DeviceInfo { deviceId: string; label: string; }

const RESOLUTIONS = [
  { label: "4K (2160p)", width: 3840, height: 2160 },
  { label: "1080p Full HD", width: 1920, height: 1080 },
  { label: "720p HD (default)", width: 1280, height: 720 },
  { label: "480p SD", width: 854, height: 480 },
  { label: "360p Low", width: 640, height: 360 },
];

export default function CameraTest() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number | null>(null);

  const [camStatus, setCamStatus] = useState<"idle" | "ok" | "error">("idle");
  const [micStatus, setMicStatus] = useState<"idle" | "ok" | "error">("idle");
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [mics, setMics] = useState<DeviceInfo[]>([]);
  const [selectedCam, setSelectedCam] = useState("");
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedRes, setSelectedRes] = useState(2); // index into RESOLUTIONS — 720p default
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [actualRes, setActualRes] = useState<{ w: number; h: number } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
  };

  useEffect(() => () => stopStream(), []);

  const startTest = async () => {
    stopStream();
    setLoading(true); setError(""); setActualRes(null);
    const res = RESOLUTIONS[selectedRes];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCam
          ? { deviceId: { exact: selectedCam }, width: { ideal: res.width }, height: { ideal: res.height } }
          : { width: { ideal: res.width }, height: { ideal: res.height }, facingMode: "user" },
        audio: selectedMic
          ? { deviceId: { exact: selectedMic }, echoCancellation, noiseSuppression, autoGainControl: true }
          : { echoCancellation, noiseSuppression, autoGainControl: true },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamStatus("ok");
      setMicStatus("ok");

      // Actual resolution from track settings
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack) {
        const s = vTrack.getSettings();
        if (s.width && s.height) setActualRes({ w: s.width, h: s.height });
      }

      // Enumerate devices after permission granted
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter((d) => d.kind === "videoinput").map((d) => ({ deviceId: d.deviceId, label: d.label || "Camera" })));
      setMics(devices.filter((d) => d.kind === "audioinput").map((d) => ({ deviceId: d.deviceId, label: d.label || "Microphone" })));

      // Mic level visualiser
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyserRef.current = analyser;

      const tick = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLevel(Math.min(100, avg * 2));
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e: any) {
      setCamStatus("error"); setMicStatus("error");
      setError(e.message || "Camera/mic access denied. Please allow permissions in your browser and try again.");
    } finally {
      setLoading(false);
    }
  };

  const proceed = () => {
    stopStream();
    const mode = (router.query.mode as string) || "video";
    const interests = (router.query.interests as string) || "";
    router.push(`/chat?mode=${mode}${interests ? `&interests=${interests}` : ""}`);
  };

  const allOk = camStatus === "ok" && micStatus === "ok";

  return (
    <Layout title="Camera Test">
      <SeoHead title="Camera & Mic Test" description="Test your camera and microphone before joining MiloBolo video chat." path="/camera-test" />
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Typography variant="h5" fontWeight={800} mb={0.5}>Camera & Mic Test</Typography>
        <Typography color="text.secondary" mb={3}>Make sure your camera and microphone work before joining.</Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Video preview */}
        <Paper sx={{ bgcolor: "#0a0a0a", borderRadius: 2, overflow: "hidden", mb: 2, aspectRatio: "16/9", position: "relative" }}>
          <video ref={videoRef} autoPlay playsInline muted className={styles.localVideo} />
          {camStatus === "idle" && (
            <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <VideocamIcon sx={{ fontSize: 48, color: "rgba(255,255,255,0.2)" }} />
            </Box>
          )}
          {actualRes && (
            <Box sx={{ position: "absolute", bottom: 8, right: 8 }}>
              <Chip label={`${actualRes.w}×${actualRes.h}`} size="small"
                sx={{ bgcolor: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, height: 20 }} />
            </Box>
          )}
        </Paper>

        {/* Mic level */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Microphone level</Typography>
          <Box sx={{ height: 8, bgcolor: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
            <Box sx={{
              height: "100%", borderRadius: 4,
              bgcolor: micLevel > 60 ? "success.main" : micLevel > 20 ? "warning.main" : "rgba(255,255,255,0.2)",
              width: `${micLevel}%`, transition: "width 0.1s",
            }} />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {micStatus === "ok"
              ? (micLevel > 10 ? "🎤 Mic working — speak to test" : "Mic connected, no audio detected yet")
              : "Not tested yet"}
          </Typography>
        </Box>

        {/* Status chips */}
        <Stack direction="row" spacing={1} mb={2.5}>
          <Chip icon={camStatus === "ok" ? <CheckCircleIcon /> : camStatus === "error" ? <ErrorIcon /> : <VideocamIcon />}
            label={`Camera: ${camStatus === "ok" ? "OK" : camStatus === "error" ? "Error" : "Not tested"}`}
            color={camStatus === "ok" ? "success" : camStatus === "error" ? "error" : "default"} size="small" />
          <Chip icon={micStatus === "ok" ? <CheckCircleIcon /> : micStatus === "error" ? <ErrorIcon /> : <MicIcon />}
            label={`Mic: ${micStatus === "ok" ? "OK" : micStatus === "error" ? "Error" : "Not tested"}`}
            color={micStatus === "ok" ? "success" : micStatus === "error" ? "error" : "default"} size="small" />
        </Stack>

        {/* Device selectors */}
        {cameras.length > 1 && (
          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel>Camera</InputLabel>
            <Select value={selectedCam} label="Camera" onChange={(e) => setSelectedCam(e.target.value)}>
              {cameras.map((c) => <MenuItem key={c.deviceId} value={c.deviceId}>{c.label}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        {mics.length > 1 && (
          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel>Microphone</InputLabel>
            <Select value={selectedMic} label="Microphone" onChange={(e) => setSelectedMic(e.target.value)}>
              {mics.map((m) => <MenuItem key={m.deviceId} value={m.deviceId}>{m.label}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        {/* Advanced settings toggle */}
        <Button
          size="small" variant="text" color="inherit"
          startIcon={<TuneIcon fontSize="small" />}
          onClick={() => setShowAdvanced((v) => !v)}
          sx={{ mb: 1, color: "text.disabled", fontSize: 12 }}
        >
          {showAdvanced ? "Hide" : "Show"} advanced settings
        </Button>

        {showAdvanced && (
          <Paper sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Typography variant="caption" color="text.disabled" fontWeight={600} display="block" mb={1.5} sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
              Advanced
            </Typography>

            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
              <InputLabel>Video Resolution</InputLabel>
              <Select value={selectedRes} label="Video Resolution" onChange={(e) => setSelectedRes(Number(e.target.value))}>
                {RESOLUTIONS.map((r, i) => (
                  <MenuItem key={r.label} value={i}>{r.label} ({r.width}×{r.height})</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider sx={{ opacity: 0.1, my: 1.5 }} />

            <FormControlLabel
              control={<Switch checked={noiseSuppression} onChange={(e) => setNoiseSuppression(e.target.checked)} size="small" />}
              label={<Typography variant="body2">Noise suppression</Typography>}
              sx={{ mb: 0.5 }}
            />
            <FormControlLabel
              control={<Switch checked={echoCancellation} onChange={(e) => setEchoCancellation(e.target.checked)} size="small" />}
              label={<Typography variant="body2">Echo cancellation</Typography>}
            />
            <Typography variant="caption" color="text.disabled" display="block" mt={1}>
              Changes apply on next test. Retest after adjusting.
            </Typography>
          </Paper>
        )}

        <Stack spacing={1.5} mt={1}>
          <Button fullWidth variant={allOk ? "outlined" : "contained"} size="large"
            onClick={startTest} disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <VideocamIcon />}
            sx={{ borderRadius: 2, py: 1.4 }}>
            {camStatus === "idle" ? "Test Camera & Mic" : "Retest"}
          </Button>
          {allOk && (
            <Button fullWidth variant="contained" size="large" onClick={proceed}
              startIcon={<CheckCircleIcon />}
              sx={{ borderRadius: 2, py: 1.4, bgcolor: "success.main", "&:hover": { bgcolor: "success.dark" } }}>
              Looks good — Start Video Chat
            </Button>
          )}
          <Button fullWidth variant="text" color="inherit" onClick={proceed} sx={{ borderRadius: 2 }}>
            Skip test and start anyway
          </Button>
        </Stack>
      </Container>
    </Layout>
  );
}

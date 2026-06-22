import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Typography, Button, Paper, Stack, Chip, Alert,
  CircularProgress, Select, MenuItem, FormControl, InputLabel,
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import MicIcon from "@mui/icons-material/Mic";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import Layout from "@/components/Layout";
import styles from "@/styles/chat.module.css";

interface DeviceInfo { deviceId: string; label: string; }

export default function CameraTest() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [camStatus, setCamStatus] = useState<"idle"|"ok"|"error">("idle");
  const [micStatus, setMicStatus] = useState<"idle"|"ok"|"error">("idle");
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [mics, setMics] = useState<DeviceInfo[]>([]);
  const [selectedCam, setSelectedCam] = useState("");
  const [selectedMic, setSelectedMic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [micLevel, setMicLevel] = useState(0);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    audioCtxRef.current?.close();
  };

  useEffect(() => () => stopStream(), []);

  const startTest = async () => {
    stopStream();
    setLoading(true); setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedCam ? { deviceId: { exact: selectedCam } } : { width: 1280, height: 720, facingMode: "user" },
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamStatus("ok");
      setMicStatus("ok");

      // Enumerate devices after permission
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
      setError(e.message || "Camera/mic access denied.");
    } finally {
      setLoading(false);
    }
  };

  const proceed = () => {
    stopStream();
    const mode = (router.query.mode as string) || "video";
    const interests = router.query.interests as string || "";
    router.push(`/chat?mode=${mode}${interests ? `&interests=${interests}` : ""}`);
  };

  const allOk = camStatus === "ok" && micStatus === "ok";

  return (
    <Layout title="Camera Test">
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
            {micStatus === "ok" ? (micLevel > 10 ? "Mic working — speak to test" : "Mic connected, no audio detected") : "Not tested"}
          </Typography>
        </Box>

        {/* Status chips */}
        <Stack direction="row" spacing={1} mb={2}>
          <Chip icon={camStatus === "ok" ? <CheckCircleIcon /> : camStatus === "error" ? <ErrorIcon /> : <VideocamIcon />}
            label={`Camera: ${camStatus === "ok" ? "OK" : camStatus === "error" ? "Error" : "Not tested"}`}
            color={camStatus === "ok" ? "success" : camStatus === "error" ? "error" : "default"} size="small" />
          <Chip icon={micStatus === "ok" ? <CheckCircleIcon /> : micStatus === "error" ? <ErrorIcon /> : <MicIcon />}
            label={`Mic: ${micStatus === "ok" ? "OK" : micStatus === "error" ? "Error" : "Not tested"}`}
            color={micStatus === "ok" ? "success" : micStatus === "error" ? "error" : "default"} size="small" />
        </Stack>

        {/* Device selectors (shown after permission) */}
        {cameras.length > 1 && (
          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel>Camera</InputLabel>
            <Select value={selectedCam} label="Camera" onChange={(e) => { setSelectedCam(e.target.value); }}>
              {cameras.map((c) => <MenuItem key={c.deviceId} value={c.deviceId}>{c.label}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        {mics.length > 1 && (
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Microphone</InputLabel>
            <Select value={selectedMic} label="Microphone" onChange={(e) => setSelectedMic(e.target.value)}>
              {mics.map((m) => <MenuItem key={m.deviceId} value={m.deviceId}>{m.label}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        <Stack spacing={1.5}>
          <Button fullWidth variant={allOk ? "outlined" : "contained"} size="large"
            onClick={startTest} disabled={loading} startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <VideocamIcon />}
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

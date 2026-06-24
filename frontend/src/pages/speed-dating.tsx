import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Typography, Button, Stack, Chip, LinearProgress,
  CircularProgress, Paper, IconButton, Tooltip, Snackbar,
  ToggleButton, ToggleButtonGroup, Dialog, DialogTitle,
  DialogContent, DialogActions, Rating,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import FavoriteIcon from "@mui/icons-material/Favorite";
import { io, Socket } from "socket.io-client";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import AgeGate from "@/components/AgeGate";

type SDState = "idle" | "waiting" | "connected" | "rating" | "ended";

const DURATIONS = [
  { label: "3 min", value: 180 },
  { label: "5 min", value: 300 },
  { label: "10 min", value: 600 },
];

interface SessionResult {
  peerId: string;
  liked: boolean | null;
  duration: number;
}

export default function SpeedDating() {
  const router = useRouter();
  const [state, setState] = useState<SDState>("idle");
  const [duration, setDuration] = useState(300);
  const [timeLeft, setTimeLeft] = useState(300);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [snack, setSnack] = useState("");
  const [results, setResults] = useState<SessionResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [currentPeerId, setCurrentPeerId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [mutualLikes, setMutualLikes] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(0);
  const peerIdRef = useRef("");
  const roomIdRef = useRef("");

  const ICE = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: process.env.NEXT_PUBLIC_TURN_URL || "turn:chat.videodownloaders.cloud:3478",
      username: process.env.NEXT_PUBLIC_TURN_USERNAME || "milobolo",
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "",
    },
  ];

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    pcRef.current?.close(); pcRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const stopStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }, []);

  const createPC = useCallback((isInitiator: boolean) => {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pcRef.current = pc;
    localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));

    pc.ontrack = (e) => { if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; };
    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current?.emit("signal", { to: peerIdRef.current, signal: { type: "candidate", candidate: e.candidate } });
    };

    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then((o) => pc.setLocalDescription(o))
        .then(() => socketRef.current?.emit("signal", { to: peerIdRef.current, signal: { type: "offer", sdp: pc.localDescription } }));
    }
    return pc;
  }, []);

  const startTimer = useCallback((secs: number) => {
    setTimeLeft(secs);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setState("rating");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000", {
      transports: ["websocket"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("match_found", async ({ roomId: rid, isInitiator, peer }) => {
      setRoomId(rid); roomIdRef.current = rid;
      setCurrentPeerId(peer); peerIdRef.current = peer;
      setState("connected");
      sessionStartRef.current = Date.now();
      startTimer(duration);

      // Get media if not already
      if (!localStreamRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          localStreamRef.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        } catch {}
      }
      createPC(isInitiator);
    });

    socket.on("signal", async ({ from, signal }) => {
      if (!pcRef.current) return;
      if (signal.type === "offer") {
        await pcRef.current.setRemoteDescription(signal.sdp);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit("signal", { to: from, signal: { type: "answer", sdp: pcRef.current.localDescription } });
      } else if (signal.type === "answer") {
        await pcRef.current.setRemoteDescription(signal.sdp);
      } else if (signal.type === "candidate") {
        pcRef.current.addIceCandidate(signal.candidate).catch(() => {});
      }
    });

    socket.on("peer_left", () => {
      cleanup();
      setState("rating");
    });

    socket.on("sd_mutual_like", () => {
      setMutualLikes((n) => n + 1);
      setSnack("💕 It's a match! You both liked each other.");
    });

    socket.on("waiting", () => setState("waiting"));

    return () => { cleanup(); socket.disconnect(); };
  }, [cleanup, createPC, duration, startTimer]);

  const startSearch = useCallback(async () => {
    setState("waiting");
    if (!localStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch {
        setSnack("Camera/mic required for Speed Dating.");
        setState("idle");
        return;
      }
    }
    socketRef.current?.emit("find_match", { mode: "speed_dating", interests: [], userId: null });
  }, []);

  const submitRating = useCallback((liked: boolean) => {
    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    setResults((prev) => [...prev, { peerId: currentPeerId, liked, duration: elapsed }]);
    socketRef.current?.emit("sd_rating", { roomId: roomIdRef.current, liked });
    cleanup();
    if (results.length + 1 >= 10) {
      setState("ended");
      setShowResults(true);
    } else {
      setState("idle");
    }
  }, [cleanup, currentPeerId, results.length]);

  const timerPct = (timeLeft / duration) * 100;
  const timerColor = timerPct > 50 ? "#4caf50" : timerPct > 20 ? "#ff9800" : "#f44336";

  const liked = results.filter((r) => r.liked).length;
  const passed = results.filter((r) => !r.liked).length;

  return (
    <>
      <SeoHead
        title="Speed Dating — MiloBolo"
        description="Try MiloBolo Speed Dating: timed 3–10 minute video sessions with random strangers. Like or pass — find out when it's mutual."
        path="/speed-dating"
      />
      <AgeGate />
      <Layout title="Speed Dating">
          <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>

            {/* Header */}
            <Box sx={{ textAlign: "center", mb: 4 }}>
              <Chip icon={<FavoriteIcon />} label="Speed Dating" color="error" sx={{ mb: 2 }} />
              <Typography variant="h4" fontWeight={900} mb={1}>
                Speed Dating Mode
              </Typography>
              <Typography color="text.secondary">
                Timed video sessions. Like or pass. Find out when it&apos;s mutual.
              </Typography>
            </Box>

            {/* Main chat area */}
            <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", md: "row" } }}>

              {/* Video panel */}
              <Box sx={{ flex: 1 }}>
                <Paper elevation={0} sx={{
                  position: "relative", borderRadius: 3, overflow: "hidden",
                  bgcolor: "#0a0a0f", border: "1px solid rgba(255,255,255,0.08)",
                  aspectRatio: "16/9",
                }}>
                  <Box component="video" ref={remoteVideoRef} autoPlay playsInline
                    sx={{ width: "100%", height: "100%", objectFit: "cover", display: state === "connected" ? "block" : "none" }} />

                  {state !== "connected" && (
                    <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", gap: 2 }}>
                      {state === "waiting" && (
                        <>
                          <CircularProgress color="primary" />
                          <Typography color="text.secondary">Finding your next date…</Typography>
                        </>
                      )}
                      {state === "rating" && (
                        <Box sx={{ textAlign: "center", p: 4 }}>
                          <Typography variant="h5" fontWeight={700} mb={1}>Time&apos;s up!</Typography>
                          <Typography color="text.secondary" mb={3}>Did you like this person?</Typography>
                          <Stack direction="row" spacing={3} justifyContent="center">
                            <Box sx={{ textAlign: "center" }}>
                              <IconButton
                                onClick={() => submitRating(false)}
                                sx={{ bgcolor: "rgba(244,67,54,0.15)", width: 72, height: 72,
                                  border: "2px solid #f44336", "&:hover": { bgcolor: "rgba(244,67,54,0.3)" } }}>
                                <ThumbDownIcon sx={{ color: "#f44336", fontSize: 32 }} />
                              </IconButton>
                              <Typography variant="caption" display="block" mt={0.5} color="text.secondary">Pass</Typography>
                            </Box>
                            <Box sx={{ textAlign: "center" }}>
                              <IconButton
                                onClick={() => submitRating(true)}
                                sx={{ bgcolor: "rgba(233,30,99,0.15)", width: 72, height: 72,
                                  border: "2px solid #e91e63", "&:hover": { bgcolor: "rgba(233,30,99,0.3)" } }}>
                                <FavoriteIcon sx={{ color: "#e91e63", fontSize: 32 }} />
                              </IconButton>
                              <Typography variant="caption" display="block" mt={0.5} color="text.secondary">Like</Typography>
                            </Box>
                          </Stack>
                        </Box>
                      )}
                      {(state === "idle" || state === "ended") && (
                        <Box sx={{ textAlign: "center" }}>
                          <FavoriteIcon sx={{ fontSize: 64, color: "rgba(255,255,255,0.1)", mb: 2 }} />
                          <Typography color="text.disabled">Start speed dating to meet someone</Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Timer bar */}
                  {state === "connected" && (
                    <Box sx={{ position: "absolute", top: 0, left: 0, right: 0 }}>
                      <LinearProgress variant="determinate" value={timerPct}
                        sx={{ height: 4, "& .MuiLinearProgress-bar": { bgcolor: timerColor }, bgcolor: "rgba(0,0,0,0.4)" }} />
                    </Box>
                  )}

                  {/* Timer display */}
                  {state === "connected" && (
                    <Box sx={{ position: "absolute", top: 12, right: 12, display: "flex", alignItems: "center", gap: 0.5,
                      bgcolor: "rgba(0,0,0,0.6)", borderRadius: 2, px: 1, py: 0.3 }}>
                      <AccessTimeIcon sx={{ fontSize: 14, color: timerColor }} />
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: timerColor, fontVariantNumeric: "tabular-nums" }}>
                        {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:{String(timeLeft % 60).padStart(2, "0")}
                      </Typography>
                    </Box>
                  )}

                  {/* Local preview */}
                  <Box component="video" ref={localVideoRef} autoPlay playsInline muted
                    sx={{ position: "absolute", bottom: 12, right: 12, width: 100, height: 75,
                      objectFit: "cover", borderRadius: 2, transform: "scaleX(-1)",
                      border: "2px solid rgba(255,255,255,0.2)",
                      display: localStreamRef.current ? "block" : "none" }} />
                </Paper>

                {/* Controls */}
                <Stack direction="row" spacing={1} justifyContent="center" mt={2}>
                  <Tooltip title={micOn ? "Mute" : "Unmute"}>
                    <IconButton onClick={() => {
                      localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !micOn; });
                      setMicOn((v) => !v);
                    }} sx={{ bgcolor: micOn ? "rgba(255,255,255,0.06)" : "rgba(244,67,54,0.2)", borderRadius: 2 }}>
                      {micOn ? <MicIcon /> : <MicOffIcon sx={{ color: "#f44336" }} />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={camOn ? "Turn off camera" : "Turn on camera"}>
                    <IconButton onClick={() => {
                      localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !camOn; });
                      setCamOn((v) => !v);
                    }} sx={{ bgcolor: camOn ? "rgba(255,255,255,0.06)" : "rgba(244,67,54,0.2)", borderRadius: 2 }}>
                      {camOn ? <VideocamIcon /> : <VideocamOffIcon sx={{ color: "#f44336" }} />}
                    </IconButton>
                  </Tooltip>
                  {state === "connected" && (
                    <Tooltip title="Skip this person">
                      <IconButton onClick={() => setState("rating")}
                        sx={{ bgcolor: "rgba(255,152,0,0.15)", borderRadius: 2 }}>
                        <SkipNextIcon sx={{ color: "#ff9800" }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Box>

              {/* Side panel */}
              <Box sx={{ width: { xs: "100%", md: 280 }, display: "flex", flexDirection: "column", gap: 2 }}>

                {/* Session config */}
                {(state === "idle" || state === "ended") && (
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)" }}>
                    <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Session Length</Typography>
                    <ToggleButtonGroup value={duration} exclusive size="small" fullWidth
                      onChange={(_, v) => { if (v) setDuration(v); }}>
                      {DURATIONS.map((d) => (
                        <ToggleButton key={d.value} value={d.value} sx={{ fontSize: 13 }}>{d.label}</ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                    <Button fullWidth variant="contained" size="large" onClick={startSearch}
                      sx={{ mt: 2, borderRadius: 2, py: 1.4, fontWeight: 700,
                        background: "linear-gradient(135deg, #e91e63, #ff5722)",
                        boxShadow: "0 4px 20px rgba(233,30,99,0.35)" }}>
                      {state === "ended" ? "Play Again" : "Start Dating"}
                    </Button>
                  </Paper>
                )}

                {state === "waiting" && (
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
                    <CircularProgress size={32} color="primary" sx={{ mb: 1.5 }} />
                    <Typography fontWeight={600}>Finding your next date…</Typography>
                    <Typography variant="caption" color="text.disabled">Usually under 30 seconds</Typography>
                    <Button fullWidth variant="text" color="error" size="small" sx={{ mt: 2 }}
                      onClick={() => { socketRef.current?.emit("cancel_search"); setState("idle"); stopStream(); }}>
                      Cancel
                    </Button>
                  </Paper>
                )}

                {/* Session stats */}
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Typography variant="subtitle2" fontWeight={700} mb={2}>Session Stats</Typography>
                  <Stack spacing={1.5}>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2" color="text.secondary">People met</Typography>
                      <Typography fontWeight={700}>{results.length}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2" color="text.secondary">Liked</Typography>
                      <Typography fontWeight={700} color="#e91e63">{liked} 💕</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2" color="text.secondary">Passed</Typography>
                      <Typography fontWeight={700}>{passed}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2" color="text.secondary">Mutual likes</Typography>
                      <Typography fontWeight={700} color="success.main">{mutualLikes} 🎉</Typography>
                    </Box>
                  </Stack>
                  {results.length > 0 && (
                    <Button fullWidth variant="outlined" size="small" sx={{ mt: 2 }}
                      startIcon={<EmojiEventsIcon />}
                      onClick={() => setShowResults(true)}>
                      View Results
                    </Button>
                  )}
                </Paper>

                {/* Tips */}
                <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: "1px solid rgba(255,255,255,0.05)",
                  bgcolor: "rgba(108,99,255,0.04)" }}>
                  <Typography variant="caption" color="text.disabled" fontWeight={700} display="block" mb={1}>Tips</Typography>
                  {["Sessions are timed — make every second count!", "Mutual likes are revealed instantly.", "Be yourself — authenticity wins.", "If the timer runs out it auto-rates."].map((t) => (
                    <Typography key={t} variant="caption" color="text.disabled" display="block" sx={{ mb: 0.5, pl: 1, borderLeft: "2px solid rgba(108,99,255,0.3)" }}>
                      {t}
                    </Typography>
                  ))}
                </Paper>
              </Box>
            </Box>
          </Container>

          {/* Results dialog */}
          <Dialog open={showResults} onClose={() => setShowResults(false)} maxWidth="xs" fullWidth
            PaperProps={{ sx: { bgcolor: "background.paper", borderRadius: 3 } }}>
            <DialogTitle>
              <Stack direction="row" spacing={1} alignItems="center">
                <EmojiEventsIcon color="primary" />
                <Typography fontWeight={700}>Your Results</Typography>
              </Stack>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={1.5}>
                <Box sx={{ display: "flex", gap: 4, justifyContent: "center", py: 2 }}>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="h3" fontWeight={900} color="#e91e63">{liked}</Typography>
                    <Typography variant="caption" color="text.secondary">Liked</Typography>
                  </Box>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="h3" fontWeight={900} color="success.main">{mutualLikes}</Typography>
                    <Typography variant="caption" color="text.secondary">Mutual</Typography>
                  </Box>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography variant="h3" fontWeight={900}>{results.length}</Typography>
                    <Typography variant="caption" color="text.secondary">Total</Typography>
                  </Box>
                </Box>
                {mutualLikes > 0 && (
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(233,30,99,0.08)", textAlign: "center" }}>
                    <FavoriteIcon sx={{ color: "#e91e63", mb: 0.5 }} />
                    <Typography fontWeight={600} color="#e91e63">
                      {mutualLikes} mutual match{mutualLikes > 1 ? "es" : ""}!
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      They liked you back. Try connecting via the Friends feature.
                    </Typography>
                  </Box>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => { setShowResults(false); setResults([]); setMutualLikes(0); setState("idle"); }}>
                Play Again
              </Button>
              <Button variant="contained" onClick={() => setShowResults(false)}>Close</Button>
            </DialogActions>
          </Dialog>

          <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack("")}
            message={snack} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
      </Layout>
    </>
  );
}

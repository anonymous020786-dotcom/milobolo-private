import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Grid, Paper, Typography, Button, TextField, IconButton,
  Chip, Tooltip, CircularProgress, Alert, Snackbar, Divider, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, Select,
  useMediaQuery, useTheme,
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import StopIcon from "@mui/icons-material/Stop";
import FlagIcon from "@mui/icons-material/Flag";
import SendIcon from "@mui/icons-material/Send";
import { io, Socket } from "socket.io-client";
import Layout from "@/components/Layout";
import AdSlot from "@/components/AdSlot";
import { useFeatureFlags } from "@/context/FeatureFlagContext";
import { useAuth } from "@/context/AuthContext";

type ChatState = "idle" | "waiting" | "connected" | "ended";

interface Message { from: string; text: string; ts: number; self: boolean; }

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: process.env.NEXT_PUBLIC_TURN_URL || "turn:chat.videodownloaders.cloud:3478",
    username: process.env.NEXT_PUBLIC_TURN_USERNAME || "milobolo",
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "",
  },
];

export default function Chat() {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { isEnabled } = useFeatureFlags();
  const { user } = useAuth();

  const mode = (router.query.mode as string) || "video";
  const [state, setState] = useState<ChatState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [roomId, setRoomId] = useState("");
  const [peerId, setPeerId] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [reportDialog, setReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("inappropriate");
  const [snack, setSnack] = useState("");

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }, []);

  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: mode === "video" ? { width: 1280, height: 720 } : false,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch {
      setSnack("Camera/mic access denied. Check browser permissions.");
      return null;
    }
  }, [mode]);

  const createPeerConnection = useCallback((isInitiator: boolean) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };

    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current && peerId) {
        socketRef.current.emit("signal", { to: peerId, signal: { type: "candidate", candidate: e.candidate } });
      }
    };

    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: mode === "video" })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          socketRef.current?.emit("signal", {
            to: peerId,
            signal: { type: "offer", sdp: pc.localDescription },
          });
        });
    }

    return pc;
  }, [mode, peerId]);

  const startSearch = useCallback(async () => {
    if (mode === "video") {
      const stream = await getLocalStream();
      if (!stream) return;
    }
    setState("waiting");
    setMessages([]);
    socketRef.current?.emit("find_match", { mode, userId: user?.id });
  }, [mode, getLocalStream, user]);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SIGNALING_URL || "", { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("waiting", () => setState("waiting"));

    socket.on("match_found", async ({ roomId: rid, isInitiator, peer }) => {
      setRoomId(rid);
      setPeerId(peer);
      setState("connected");
      setMessages([{ from: "system", text: "Connected! Say hi 👋", ts: Date.now(), self: false }]);
      if (mode === "video") createPeerConnection(isInitiator);
    });

    socket.on("signal", async ({ from, signal }) => {
      if (!pcRef.current) return;
      if (signal.type === "offer") {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socket.emit("signal", { to: from, signal: { type: "answer", sdp: pcRef.current.localDescription } });
      } else if (signal.type === "answer") {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === "candidate") {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    });

    socket.on("message", ({ from, text, ts }) => {
      setMessages((prev) => [...prev, { from, text, ts, self: false }]);
    });

    socket.on("peer_left", () => {
      setState("ended");
      setMessages((prev) => [...prev, { from: "system", text: "Stranger disconnected.", ts: Date.now(), self: false }]);
      cleanup();
    });

    socket.on("report_received", () => setSnack("Report submitted. Thank you."));

    return () => {
      socket.disconnect();
      cleanup();
    };
  }, []);

  const handleNext = () => {
    cleanup();
    setState("idle");
    setMessages([]);
    setRoomId("");
    setPeerId("");
    socketRef.current?.emit("next", { mode });
    setTimeout(() => startSearch(), 300);
  };

  const handleStop = () => {
    cleanup();
    setState("idle");
    setMessages([]);
    socketRef.current?.emit("cancel_search", { mode });
    if (roomId) socketRef.current?.emit("next", { mode });
  };

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !micOn; });
    setMicOn(!micOn);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !camOn; });
    setCamOn(!camOn);
  };

  const sendMessage = () => {
    if (!text.trim() || !roomId) return;
    socketRef.current?.emit("message", { roomId, text: text.trim() });
    setMessages((prev) => [...prev, { from: "me", text: text.trim(), ts: Date.now(), self: true }]);
    setText("");
  };

  const submitReport = () => {
    socketRef.current?.emit("report", { reportedId: peerId, reason: reportReason });
    setReportDialog(false);
  };

  return (
    <Layout title="Chat">
      <Container maxWidth="xl" sx={{ py: 2, height: "calc(100vh - 64px)", display: "flex", flexDirection: "column" }}>
        <Grid container spacing={2} sx={{ flex: 1, minHeight: 0 }}>
          {/* Video area */}
          {mode === "video" && (
            <Grid item xs={12} md={8} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Paper sx={{ flex: 1, bgcolor: "#000", borderRadius: 2, overflow: "hidden", position: "relative", minHeight: 300 }}>
                <video ref={remoteVideoRef} autoPlay playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {state !== "connected" && (
                  <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", bgcolor: "rgba(0,0,0,0.85)" }}>
                    {state === "idle" && (
                      <>
                        <Typography variant="h5" fontWeight={700} mb={2}>Ready to chat?</Typography>
                        <Button variant="contained" size="large" startIcon={<VideocamIcon />}
                          onClick={startSearch} sx={{ py: 1.5, px: 4 }}>Start</Button>
                      </>
                    )}
                    {state === "waiting" && (
                      <>
                        <CircularProgress color="primary" sx={{ mb: 2 }} />
                        <Typography color="text.secondary">Finding someone to chat with...</Typography>
                      </>
                    )}
                    {state === "ended" && (
                      <>
                        <Typography variant="h6" mb={2}>Chat ended</Typography>
                        <Button variant="contained" onClick={startSearch} sx={{ mr: 1 }}>New Chat</Button>
                      </>
                    )}
                  </Box>
                )}
                {/* Local preview */}
                <Box sx={{ position: "absolute", bottom: 12, right: 12, width: 140, height: 90,
                  borderRadius: 1, overflow: "hidden", border: "2px solid rgba(108,99,255,0.5)" }}>
                  <video ref={localVideoRef} autoPlay playsInline muted
                    style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                </Box>
              </Paper>

              {/* Controls */}
              <Paper sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1, borderRadius: 2 }}>
                <Tooltip title={micOn ? "Mute" : "Unmute"}>
                  <IconButton onClick={toggleMic} color={micOn ? "default" : "error"}>
                    {micOn ? <MicIcon /> : <MicOffIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={camOn ? "Turn off camera" : "Turn on camera"}>
                  <IconButton onClick={toggleCam} color={camOn ? "default" : "error"}>
                    {camOn ? <VideocamIcon /> : <VideocamOffIcon />}
                  </IconButton>
                </Tooltip>
                <Box sx={{ flex: 1 }} />
                {state === "connected" && (
                  <Tooltip title="Report user">
                    <IconButton onClick={() => setReportDialog(true)} color="warning"><FlagIcon /></IconButton>
                  </Tooltip>
                )}
                {(state === "connected" || state === "ended") && (
                  <Button variant="outlined" startIcon={<SkipNextIcon />} onClick={handleNext} sx={{ mr: 1 }}>Next</Button>
                )}
                <Button variant={state === "idle" || state === "ended" ? "contained" : "outlined"}
                  color={state === "idle" || state === "ended" ? "primary" : "error"}
                  startIcon={state === "idle" || state === "ended" ? <VideocamIcon /> : <StopIcon />}
                  onClick={state === "idle" || state === "ended" ? startSearch : handleStop}>
                  {state === "idle" || state === "ended" ? "Start" : "Stop"}
                </Button>
              </Paper>
            </Grid>
          )}

          {/* Chat panel */}
          <Grid item xs={12} md={mode === "video" ? 4 : 12} sx={{ display: "flex", flexDirection: "column" }}>
            {/* Ad */}
            {isEnabled("google_ads") && (
              <Box sx={{ mb: 1 }}>
                <AdSlot slotId="chat-sidebar" format="rectangle" />
              </Box>
            )}

            <Paper sx={{ flex: 1, display: "flex", flexDirection: "column", borderRadius: 2, overflow: "hidden" }}>
              <Box sx={{ p: 2, borderBottom: "1px solid rgba(108,99,255,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography fontWeight={600}>Chat</Typography>
                <Chip label={state === "connected" ? "Live" : state === "waiting" ? "Waiting..." : "Offline"}
                  color={state === "connected" ? "success" : state === "waiting" ? "warning" : "default"}
                  size="small" />
              </Box>

              <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                {mode === "text" && state === "idle" && (
                  <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <Typography variant="h6" fontWeight={700} mb={2}>Text Chat</Typography>
                    <Button variant="contained" size="large" onClick={startSearch}>Start Chatting</Button>
                  </Box>
                )}
                {messages.map((m, i) => (
                  <Box key={i} sx={{
                    alignSelf: m.from === "system" ? "center" : m.self ? "flex-end" : "flex-start",
                    maxWidth: "80%",
                  }}>
                    {m.from === "system" ? (
                      <Typography variant="caption" color="text.secondary" sx={{
                        bgcolor: "rgba(108,99,255,0.1)", px: 2, py: 0.5, borderRadius: 10 }}>
                        {m.text}
                      </Typography>
                    ) : (
                      <Box sx={{
                        bgcolor: m.self ? "primary.main" : "background.paper",
                        px: 2, py: 1, borderRadius: m.self ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        border: m.self ? "none" : "1px solid rgba(108,99,255,0.2)",
                      }}>
                        <Typography variant="body2">{m.text}</Typography>
                      </Box>
                    )}
                  </Box>
                ))}
                <div ref={chatEndRef} />
              </Box>

              <Box sx={{ p: 1.5, borderTop: "1px solid rgba(108,99,255,0.15)", display: "flex", gap: 1 }}>
                <TextField size="small" fullWidth placeholder="Type a message..."
                  value={text} onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  disabled={state !== "connected"} />
                <IconButton color="primary" onClick={sendMessage} disabled={state !== "connected" || !text.trim()}>
                  <SendIcon />
                </IconButton>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* Report Dialog */}
      <Dialog open={reportDialog} onClose={() => setReportDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "background.paper" } }}>
        <DialogTitle>Report User</DialogTitle>
        <DialogContent>
          <Select fullWidth value={reportReason} onChange={(e) => setReportReason(e.target.value)} sx={{ mt: 1 }}>
            <MenuItem value="inappropriate">Inappropriate content</MenuItem>
            <MenuItem value="nudity">Nudity/Sexual content</MenuItem>
            <MenuItem value="harassment">Harassment/Bullying</MenuItem>
            <MenuItem value="spam">Spam/Bot</MenuItem>
            <MenuItem value="minor">Possible minor</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialog(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={submitReport}>Submit Report</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack("")}
        message={snack} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Layout>
  );
}

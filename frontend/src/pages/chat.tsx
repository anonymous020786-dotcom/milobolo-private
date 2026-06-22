import {
  useState, useEffect, useRef, useCallback,
} from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Grid, Paper, Typography, Button, TextField,
  IconButton, Chip, Tooltip, CircularProgress, Snackbar, Stack,
  Dialog, DialogTitle, DialogContent, DialogActions, MenuItem,
  Select, Collapse, Divider, useMediaQuery, useTheme, Badge,
  Drawer,
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import StopIcon from "@mui/icons-material/Stop";
import FlagIcon from "@mui/icons-material/Flag";
import SendIcon from "@mui/icons-material/Send";
import LockIcon from "@mui/icons-material/Lock";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import BlurOffIcon from "@mui/icons-material/BlurOff";
import TuneIcon from "@mui/icons-material/Tune";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import { io, Socket } from "socket.io-client";
import Layout from "@/components/Layout";
import styles from "@/styles/chat.module.css";
import AdSlot from "@/components/AdSlot";
import AgeGate from "@/components/AgeGate";
import OnlineCounter from "@/components/OnlineCounter";
import InterestPicker from "@/components/chat/InterestPicker";
import FriendRequestDialog from "@/components/chat/FriendRequestDialog";
import { useFeatureFlags } from "@/context/FeatureFlagContext";
import { useAuth } from "@/context/AuthContext";
import { useFingerprint } from "@/hooks/useFingerprint";
import { useVirtualBackground, BgMode } from "@/hooks/useVirtualBackground";
import {
  generateKeyPair, deriveSharedKey,
  encryptMessage, decryptMessage, E2ESession,
} from "@/lib/e2e";
import { supabase } from "@/lib/supabase";

type ChatState = "idle" | "waiting" | "connected" | "ended";
interface Message {
  id: string;
  from: string;
  text: string;
  ts: number;
  self: boolean;
  encrypted: boolean;
  reactions: string[];
}

const ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  {
    urls: process.env.NEXT_PUBLIC_TURN_URL || "turn:chat.videodownloaders.cloud:3478",
    username: process.env.NEXT_PUBLIC_TURN_USERNAME || "milobolo",
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "",
  },
];

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "💯"];

export default function Chat() {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { isEnabled } = useFeatureFlags();
  const { user, profile } = useAuth();
  const fpId = useFingerprint();

  const mode = (router.query.mode as string) || "video";

  // ── State ─────────────────────────────────────────────────
  const [state, setState] = useState<ChatState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [roomId, setRoomId] = useState("");
  const [peerId, setPeerId] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [peerSharingScreen, setPeerSharingScreen] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [matchedInterest, setMatchedInterest] = useState<string | null>(null);
  const [peerInterests, setPeerInterests] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [showInterests, setShowInterests] = useState(false);
  const [reportDialog, setReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("inappropriate");
  const [showReactions, setShowReactions] = useState(false);
  const [peerReaction, setPeerReaction] = useState<string | null>(null);
  const [friendReq, setFriendReq] = useState<{ open: boolean; from: string; fromUserId: string; fromName: string }>
    ({ open: false, from: "", fromUserId: "", fromName: "" });
  const [e2eReady, setE2eReady] = useState(false);
  const [snack, setSnack] = useState("");
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [msgCount, setMsgCount] = useState(0);
  const [bgMode, setBgMode] = useState<BgMode>("none");
  const [showBgMenu, setShowBgMenu] = useState(false);

  // ── Refs ───────────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const e2eRef = useRef<E2ESession | null>(null);
  const sharedKeyRef = useRef<CryptoKey | null>(null);
  const peerIdRef = useRef<string>("");
  const roomIdRef = useRef<string>("");

  const { activate: activateBg } = useVirtualBackground(localVideoRef);

  // ── Scroll to bottom ───────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping]);

  // ── Fingerprint ban check ──────────────────────────────────
  useEffect(() => {
    if (fpId && socketRef.current) {
      socketRef.current.emit("fingerprint", { fpId });
    }
  }, [fpId]);

  // ── PWA service worker ─────────────────────────────────────
  useEffect(() => {
    if ("serviceWorker" in navigator && isEnabled("pwa")) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, [isEnabled]);

  // ── Cleanup ────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    e2eRef.current = null;
    sharedKeyRef.current = null;
    setE2eReady(false);
    setSharingScreen(false);
    setPeerSharingScreen(false);
    setPeerTyping(false);
    setMatchedInterest(null);
    setPeerInterests([]);
  }, []);

  // ── Save chat history ──────────────────────────────────────
  const saveHistory = useCallback(async (rid: string, mc: number, mi: string | null) => {
    if (!user || !isEnabled("chat_history")) return;
    const duration = sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0;
    await supabase.from("chat_history").insert({
      user_id: user.id,
      mode,
      room_id: rid,
      duration_seconds: duration,
      message_count: mc,
      matched_interest: mi,
      started_at: new Date(sessionStart || Date.now()).toISOString(),
      ended_at: new Date().toISOString(),
    });
  }, [user, mode, sessionStart, isEnabled]);

  // ── Get local media ────────────────────────────────────────
  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: mode === "video" ? { width: 1280, height: 720, facingMode: "user" } : false,
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch {
      setSnack("Camera/mic access denied. Check browser permissions.");
      return null;
    }
  }, [mode]);

  // ── WebRTC peer connection ─────────────────────────────────
  const createPeerConnection = useCallback((isInitiator: boolean) => {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pcRef.current = pc;
    localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current && peerIdRef.current) {
        socketRef.current.emit("signal", {
          to: peerIdRef.current,
          signal: { type: "candidate", candidate: e.candidate },
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") setSnack("Connection failed. Try next.");
    };

    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: mode === "video" })
        .then((o) => pc.setLocalDescription(o))
        .then(() => {
          socketRef.current?.emit("signal", {
            to: peerIdRef.current,
            signal: { type: "offer", sdp: pc.localDescription },
          });
        });
    }
    return pc;
  }, [mode]);

  // ── E2E handshake ──────────────────────────────────────────
  const startE2E = useCallback(async (isInitiator: boolean) => {
    if (!isEnabled("e2e_encryption")) return;
    const session = await generateKeyPair();
    e2eRef.current = session;
    socketRef.current?.emit("e2e_pubkey", {
      to: peerIdRef.current,
      publicKey: session.publicKeyB64,
    });
  }, [isEnabled]);

  // ── Main socket setup ──────────────────────────────────────
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SIGNALING_URL || "", {
      transports: ["websocket"],
    });
    socketRef.current = socket;

    if (fpId) socket.emit("fingerprint", { fpId });

    socket.on("banned", ({ reason }) => {
      setSnack(reason);
      setTimeout(() => router.push("/"), 3000);
    });

    socket.on("waiting", () => setState("waiting"));

    socket.on("match_found", async ({ roomId: rid, isInitiator, peer, matchedInterest: mi, peerInterests: pi }) => {
      setRoomId(rid);
      setPeerId(peer);
      peerIdRef.current = peer;
      roomIdRef.current = rid;
      setState("connected");
      setSessionStart(Date.now());
      setMsgCount(0);
      setMatchedInterest(mi);
      setPeerInterests(pi || []);
      setMessages([{
        id: "sys-0", from: "system",
        text: mi ? `✨ Matched on "${mi}"! Say hi 👋` : "Connected! Say hi 👋",
        ts: Date.now(), self: false, encrypted: false, reactions: [],
      }]);
      if (mode === "video") createPeerConnection(isInitiator);
      await startE2E(isInitiator);
    });

    socket.on("e2e_pubkey", async ({ from, publicKey }) => {
      if (!e2eRef.current) return;
      const shared = await deriveSharedKey(e2eRef.current.keyPair, publicKey);
      sharedKeyRef.current = shared;
      setE2eReady(true);
      setSnack("🔒 End-to-end encryption active");
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
        await pcRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
      }
    });

    socket.on("message", async ({ from, ciphertext, text: plain, ts, encrypted }) => {
      let decoded = plain || "";
      if (encrypted && sharedKeyRef.current && ciphertext) {
        try { decoded = await decryptMessage(sharedKeyRef.current, ciphertext); }
        catch { decoded = "[could not decrypt]"; }
      }
      setMessages((prev) => [
        ...prev,
        { id: `${ts}-${Math.random()}`, from, text: decoded, ts, self: false, encrypted: !!encrypted, reactions: [] },
      ]);
      setMsgCount((c) => c + 1);
    });

    socket.on("typing", ({ typing }) => {
      setPeerTyping(typing);
    });

    socket.on("reaction", ({ emoji }) => {
      setPeerReaction(emoji);
      setTimeout(() => setPeerReaction(null), 2500);
    });

    socket.on("peer_screen_share", ({ active }) => setPeerSharingScreen(active));

    socket.on("friend_request", ({ from, fromUserId, fromName }) => {
      if (isEnabled("friend_requests")) {
        setFriendReq({ open: true, from, fromUserId, fromName });
      }
    });

    socket.on("friend_response", async ({ accepted, fromUserId, toUserId }) => {
      if (accepted && fromUserId && toUserId) {
        await supabase.from("connections").insert({
          requester_id: fromUserId,
          receiver_id: toUserId,
          status: "accepted",
        }).catch(() => {});
        setSnack("🎉 Connected! You can find this person in your profile.");
      } else {
        setSnack("Friend request declined.");
      }
    });

    socket.on("peer_left", async () => {
      const curRoomId = roomIdRef.current;
      const curMsgCount = msgCount;
      const curMatchedInterest = matchedInterest;
      setState("ended");
      setMessages((prev) => [
        ...prev,
        { id: "sys-end", from: "system", text: "Stranger disconnected.", ts: Date.now(), self: false, encrypted: false, reactions: [] },
      ]);
      await saveHistory(curRoomId, curMsgCount, curMatchedInterest);
      cleanup();
    });

    socket.on("report_received", () => setSnack("Report submitted. Thank you."));
    socket.on("error", ({ message }) => setSnack(message));

    return () => {
      socket.disconnect();
      cleanup();
    };
  }, [fpId, mode]);

  // ── Search ─────────────────────────────────────────────────
  const startSearch = useCallback(async () => {
    if (mode === "video") {
      const stream = await getLocalStream();
      if (!stream) return;
    }
    setState("waiting");
    setMessages([]);
    setRoomId(""); setPeerId(""); peerIdRef.current = ""; roomIdRef.current = "";
    socketRef.current?.emit("find_match", {
      mode,
      userId: user?.id || null,
      interests: isEnabled("interest_matching") ? interests : [],
    });
  }, [mode, user, interests, isEnabled, getLocalStream]);

  const handleNext = useCallback(async () => {
    await saveHistory(roomIdRef.current, msgCount, matchedInterest);
    cleanup();
    setState("idle");
    setMessages([]);
    socketRef.current?.emit("next");
    setTimeout(() => startSearch(), 300);
  }, [cleanup, startSearch, saveHistory, msgCount, matchedInterest]);

  const handleStop = useCallback(async () => {
    await saveHistory(roomIdRef.current, msgCount, matchedInterest);
    cleanup();
    setState("idle");
    setMessages([]);
    socketRef.current?.emit("cancel_search");
    socketRef.current?.emit("next");
  }, [cleanup, saveHistory, msgCount, matchedInterest]);

  // ── Controls ───────────────────────────────────────────────
  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !micOn; });
    setMicOn((v) => !v);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !camOn; });
    setCamOn((v) => !v);
  };

  const toggleBackground = (newMode: BgMode) => {
    setBgMode(newMode);
    setShowBgMenu(false);
    const newStream = activateBg(newMode, localStreamRef.current);
    if (newStream && pcRef.current && newMode !== "none") {
      const videoTrack = newStream.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
      sender?.replaceTrack(videoTrack).catch(() => {});
    }
  };

  const toggleScreenShare = async () => {
    if (sharingScreen) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack && pcRef.current) {
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
        await sender?.replaceTrack(camTrack).catch(() => {});
      }
      setSharingScreen(false);
      socketRef.current?.emit("screen_share_stop", { roomId });
    } else {
      try {
        const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        const screenTrack = stream.getVideoTracks()[0];
        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === "video");
        await sender?.replaceTrack(screenTrack).catch(() => {});
        screenTrack.onended = () => toggleScreenShare();
        setSharingScreen(true);
        socketRef.current?.emit("screen_share_start", { roomId });
      } catch { setSnack("Screen share cancelled."); }
    }
  };

  // ── Messaging ──────────────────────────────────────────────
  const handleTyping = (val: string) => {
    setText(val);
    if (!isTyping) {
      setIsTyping(true);
      socketRef.current?.emit("typing", { roomId, typing: true });
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      setIsTyping(false);
      socketRef.current?.emit("typing", { roomId, typing: false });
    }, 1500);
  };

  const sendMessage = useCallback(async () => {
    if (!text.trim() || !roomId) return;
    const plain = text.trim();
    setText("");
    setIsTyping(false);
    socketRef.current?.emit("typing", { roomId, typing: false });

    let payload: any = { roomId };
    if (isEnabled("e2e_encryption") && sharedKeyRef.current) {
      const ciphertext = await encryptMessage(sharedKeyRef.current, plain);
      payload = { ...payload, ciphertext, encrypted: true };
    } else {
      payload = { ...payload, plain, encrypted: false };
    }
    socketRef.current?.emit("message", payload);

    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-me`, from: "me", text: plain, ts: Date.now(), self: true, encrypted: isEnabled("e2e_encryption"), reactions: [] },
    ]);
    setMsgCount((c) => c + 1);
  }, [text, roomId, isEnabled]);

  const sendReaction = (emoji: string) => {
    socketRef.current?.emit("reaction", { roomId, emoji });
    setShowReactions(false);
  };

  const addReactionToMsg = (msgId: string, emoji: string) => {
    setMessages((prev) => prev.map((m) =>
      m.id === msgId ? { ...m, reactions: [...m.reactions.filter((r) => r !== emoji), emoji] } : m
    ));
  };

  // ── Friend request ─────────────────────────────────────────
  const sendFriendRequest = () => {
    if (!user || !peerId) return setSnack("Sign in to send connection requests.");
    socketRef.current?.emit("friend_request", {
      to: peerId,
      fromUserId: user.id,
      fromName: profile?.display_name || "Anonymous",
    });
    setSnack("Connection request sent!");
  };

  const respondFriendRequest = async (accepted: boolean) => {
    setFriendReq((prev) => ({ ...prev, open: false }));
    socketRef.current?.emit("friend_response", {
      to: friendReq.from,
      accepted,
      fromUserId: friendReq.fromUserId,
      toUserId: user?.id,
    });
    if (accepted && friendReq.fromUserId && user?.id) {
      await supabase.from("connections").insert({
        requester_id: friendReq.fromUserId,
        receiver_id: user.id,
        status: "accepted",
      }).catch(() => {});
    }
  };

  // ── Report with screenshot ─────────────────────────────────
  const submitReport = () => {
    let screenshotB64: string | null = null;
    try {
      const canvas = document.createElement("canvas");
      const video = remoteVideoRef.current;
      if (video) {
        canvas.width = 320; canvas.height = 240;
        canvas.getContext("2d")?.drawImage(video, 0, 0, 320, 240);
        screenshotB64 = canvas.toDataURL("image/jpeg", 0.5);
      }
    } catch {}
    socketRef.current?.emit("report", { reportedId: peerId, reason: reportReason, screenshotB64 });
    setReportDialog(false);
  };

  // ─── Render ──────────────────────────────────────────────
  return (
    <Layout title="Chat">
      <AgeGate />

      <Container maxWidth="xl" sx={{ py: { xs: 1, md: 2 }, height: { md: "calc(100vh - 64px)" }, display: "flex", flexDirection: "column" }}>

        {/* Top bar */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <OnlineCounter />
          {e2eReady && (
            <Chip icon={<LockIcon sx={{ fontSize: "14px !important" }} />}
              label="E2E Encrypted" size="small"
              sx={{ bgcolor: "rgba(76,175,80,0.1)", color: "success.main", border: "1px solid rgba(76,175,80,0.3)" }} />
          )}
          {matchedInterest && (
            <Chip label={`✨ ${matchedInterest}`} size="small" color="primary" variant="outlined" />
          )}
          {peerSharingScreen && (
            <Chip label="Peer sharing screen" size="small" color="warning" />
          )}
          <Box sx={{ flex: 1 }} />
          {isEnabled("interest_matching") && (
            <Tooltip title="Set interests">
              <IconButton size="small" onClick={() => setShowInterests((v) => !v)} color={interests.length > 0 ? "primary" : "default"}>
                <Badge badgeContent={interests.length || undefined} color="primary">
                  <TuneIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {/* Interest picker (collapsible) */}
        <Collapse in={showInterests}>
          <Paper sx={{ p: 2, mb: 1, borderRadius: 2 }}>
            <InterestPicker interests={interests} onChange={setInterests} />
          </Paper>
        </Collapse>

        <Grid container spacing={{ xs: 1, md: 2 }} sx={{ flex: 1, minHeight: 0 }}>

          {/* ── Video area ─────────────────────────────────── */}
          {mode === "video" && (
            <Grid item xs={12} md={8} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Paper sx={{ flex: 1, bgcolor: "#000", borderRadius: 2, overflow: "hidden", position: "relative", minHeight: { xs: 220, md: 360 } }}>
                <video ref={remoteVideoRef} autoPlay playsInline className={styles.remoteVideo} />

                {/* Peer reaction float */}
                {peerReaction && (
                  <Box sx={{
                    position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)",
                    fontSize: 72, animation: "fadeUp 2.5s ease forwards",
                    "@keyframes fadeUp": { "0%": { opacity: 1, transform: "translate(-50%,-50%) scale(1)" }, "100%": { opacity: 0, transform: "translate(-50%,-120%) scale(1.8)" } },
                  }}>{peerReaction}</Box>
                )}

                {state !== "connected" && (
                  <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", bgcolor: "rgba(0,0,0,0.85)" }}>
                    {state === "idle" && (
                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h5" fontWeight={700} mb={3}>Ready to chat?</Typography>
                        <Button variant="contained" size="large" startIcon={<VideocamIcon />}
                          onClick={startSearch} sx={{ py: 1.5, px: 5, fontSize: 16 }}>
                          Start Video Chat
                        </Button>
                      </Box>
                    )}
                    {state === "waiting" && (
                      <>
                        <CircularProgress color="primary" sx={{ mb: 2 }} />
                        <Typography color="text.secondary">Finding someone{interests.length ? ` into ${interests[0]}` : ""}…</Typography>
                      </>
                    )}
                    {state === "ended" && (
                      <Box sx={{ textAlign: "center" }}>
                        <Typography variant="h6" mb={3}>Chat ended</Typography>
                        <Button variant="contained" onClick={startSearch}>New Chat</Button>
                      </Box>
                    )}
                  </Box>
                )}

                {/* Local preview */}
                <Box sx={{ position: "absolute", bottom: 12, right: 12, width: { xs: 100, md: 140 }, height: { xs: 70, md: 90 },
                  borderRadius: 1.5, overflow: "hidden", border: "2px solid rgba(108,99,255,0.6)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
                  <video ref={localVideoRef} autoPlay playsInline muted className={styles.localVideo} />
                </Box>
              </Paper>

              {/* Video controls */}
              <Paper sx={{ p: 1, display: "flex", alignItems: "center", gap: 0.5, borderRadius: 2, flexWrap: "wrap" }}>
                <Tooltip title={micOn ? "Mute" : "Unmute"}>
                  <IconButton onClick={toggleMic} color={micOn ? "default" : "error"} size="small">
                    {micOn ? <MicIcon /> : <MicOffIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={camOn ? "Camera off" : "Camera on"}>
                  <IconButton onClick={toggleCam} color={camOn ? "default" : "error"} size="small">
                    {camOn ? <VideocamIcon /> : <VideocamOffIcon />}
                  </IconButton>
                </Tooltip>

                {isEnabled("screen_sharing") && state === "connected" && (
                  <Tooltip title={sharingScreen ? "Stop sharing" : "Share screen"}>
                    <IconButton onClick={toggleScreenShare} color={sharingScreen ? "primary" : "default"} size="small">
                      {sharingScreen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                    </IconButton>
                  </Tooltip>
                )}

                {isEnabled("virtual_bg") && (
                  <Box sx={{ position: "relative" }}>
                    <Tooltip title="Background">
                      <IconButton onClick={() => setShowBgMenu((v) => !v)}
                        color={bgMode !== "none" ? "primary" : "default"} size="small">
                        {bgMode !== "none" ? <BlurOnIcon /> : <BlurOffIcon />}
                      </IconButton>
                    </Tooltip>
                    {showBgMenu && (
                      <Paper sx={{ position: "absolute", bottom: 44, left: 0, p: 1, zIndex: 10, minWidth: 130 }}>
                        {(["none", "blur", "color"] as BgMode[]).map((m) => (
                          <MenuItem key={m} onClick={() => toggleBackground(m)} selected={bgMode === m}
                            sx={{ borderRadius: 1, fontSize: 14 }}>
                            {m === "none" ? "No effect" : m === "blur" ? "Blur background" : "Dark background"}
                          </MenuItem>
                        ))}
                      </Paper>
                    )}
                  </Box>
                )}

                <Box sx={{ flex: 1 }} />

                {state === "connected" && (
                  <>
                    {isEnabled("friend_requests") && (
                      <Tooltip title="Send connection request">
                        <IconButton onClick={sendFriendRequest} size="small"><PersonAddIcon /></IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Report user">
                      <IconButton onClick={() => setReportDialog(true)} color="warning" size="small"><FlagIcon /></IconButton>
                    </Tooltip>
                    <Button variant="outlined" size="small" startIcon={<SkipNextIcon />} onClick={handleNext}>Next</Button>
                  </>
                )}

                <Button
                  variant={state === "idle" || state === "ended" ? "contained" : "outlined"}
                  color={state === "connected" || state === "waiting" ? "error" : "primary"}
                  size="small"
                  startIcon={state === "idle" || state === "ended" ? <VideocamIcon /> : <StopIcon />}
                  onClick={state === "idle" || state === "ended" ? startSearch : handleStop}>
                  {state === "idle" || state === "ended" ? "Start" : "Stop"}
                </Button>
              </Paper>
            </Grid>
          )}

          {/* ── Chat panel ─────────────────────────────────── */}
          <Grid item xs={12} md={mode === "video" ? 4 : 12}
            sx={{ display: "flex", flexDirection: "column", minHeight: { xs: 400, md: 0 } }}>

            {isEnabled("google_ads") && mode !== "video" && (
              <Box sx={{ mb: 1 }}>
                <AdSlot slotId="chat-top" format="horizontal" />
              </Box>
            )}

            <Paper sx={{ flex: 1, display: "flex", flexDirection: "column", borderRadius: 2, overflow: "hidden" }}>
              {/* Chat header */}
              <Box sx={{ p: 1.5, borderBottom: "1px solid rgba(108,99,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography fontWeight={600} variant="body2">Chat</Typography>
                  <Chip
                    label={state === "connected" ? "Live" : state === "waiting" ? "Waiting…" : "Offline"}
                    color={state === "connected" ? "success" : state === "waiting" ? "warning" : "default"}
                    size="small" />
                </Stack>
                {peerInterests.length > 0 && (
                  <Stack direction="row" spacing={0.5}>
                    {peerInterests.slice(0, 2).map((i) => (
                      <Chip key={i} label={i} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                    ))}
                  </Stack>
                )}
              </Box>

              {/* Text mode controls */}
              {mode === "text" && (
                <Box sx={{ p: 1, borderBottom: "1px solid rgba(108,99,255,0.1)", display: "flex", gap: 1 }}>
                  {state === "idle" || state === "ended" ? (
                    <Button fullWidth variant="contained" size="small" onClick={startSearch}>
                      {state === "ended" ? "New Chat" : "Start Text Chat"}
                    </Button>
                  ) : state === "waiting" ? (
                    <Button fullWidth variant="outlined" color="error" size="small" onClick={handleStop}>Cancel</Button>
                  ) : (
                    <>
                      <Button variant="outlined" size="small" startIcon={<SkipNextIcon />} onClick={handleNext}>Next</Button>
                      <Button variant="outlined" color="error" size="small" startIcon={<StopIcon />} onClick={handleStop}>Stop</Button>
                      {isEnabled("friend_requests") && (
                        <IconButton size="small" onClick={sendFriendRequest}><PersonAddIcon /></IconButton>
                      )}
                    </>
                  )}
                </Box>
              )}

              {/* Messages */}
              <Box sx={{ flex: 1, overflowY: "auto", p: 1.5, display: "flex", flexDirection: "column", gap: 0.75 }}>
                {mode === "text" && state === "waiting" && (
                  <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <CircularProgress size={32} sx={{ mb: 1.5 }} />
                    <Typography variant="body2" color="text.secondary">
                      Finding someone{interests.length ? ` into ${interests[0]}` : ""}…
                    </Typography>
                  </Box>
                )}

                {messages.map((m) => (
                  <Box key={m.id}
                    sx={{ alignSelf: m.from === "system" ? "center" : m.self ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                    {m.from === "system" ? (
                      <Typography variant="caption" color="text.secondary"
                        sx={{ bgcolor: "rgba(108,99,255,0.1)", px: 2, py: 0.5, borderRadius: 10, display: "block" }}>
                        {m.text}
                      </Typography>
                    ) : (
                      <Box>
                        <Box
                          sx={{
                            bgcolor: m.self ? "primary.main" : "background.paper",
                            px: 2, py: 1,
                            borderRadius: m.self ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                            border: m.self ? "none" : "1px solid rgba(108,99,255,0.2)",
                            cursor: "pointer",
                          }}
                          onDoubleClick={() => addReactionToMsg(m.id, "❤️")}
                        >
                          <Typography variant="body2">{m.text}</Typography>
                          {m.encrypted && (
                            <LockIcon sx={{ fontSize: 9, opacity: 0.5, ml: 0.5, verticalAlign: "middle" }} />
                          )}
                        </Box>
                        {m.reactions.length > 0 && (
                          <Box sx={{ mt: 0.25, display: "flex", gap: 0.25, justifyContent: m.self ? "flex-end" : "flex-start" }}>
                            {m.reactions.map((r, i) => (
                              <Typography key={i} variant="caption"
                                sx={{ bgcolor: "background.paper", px: 0.75, py: 0.25, borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)" }}>
                                {r}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                ))}

                {peerTyping && (
                  <Box sx={{ alignSelf: "flex-start" }}>
                    <Box sx={{ bgcolor: "background.paper", px: 2, py: 1, borderRadius: "16px 16px 16px 4px",
                      border: "1px solid rgba(108,99,255,0.2)", display: "inline-flex", gap: 0.5, alignItems: "center" }}>
                      {[0, 1, 2].map((i) => (
                        <Box key={i} sx={{
                          width: 6, height: 6, borderRadius: "50%", bgcolor: "text.secondary",
                          animation: "bounce 1.2s infinite",
                          animationDelay: `${i * 0.2}s`,
                          "@keyframes bounce": {
                            "0%,80%,100%": { transform: "translateY(0)" },
                            "40%": { transform: "translateY(-6px)" },
                          },
                        }} />
                      ))}
                    </Box>
                  </Box>
                )}
                <div ref={chatEndRef} />
              </Box>

              {/* Input */}
              <Box sx={{ p: 1, borderTop: "1px solid rgba(108,99,255,0.15)" }}>
                {/* Reaction bar */}
                <Collapse in={showReactions}>
                  <Stack direction="row" spacing={0.5} sx={{ mb: 1, justifyContent: "center" }}>
                    {REACTIONS.map((e) => (
                      <IconButton key={e} size="small" onClick={() => sendReaction(e)}
                        sx={{ fontSize: 20, p: 0.5 }}>{e}</IconButton>
                    ))}
                  </Stack>
                </Collapse>

                <Stack direction="row" spacing={0.5}>
                  <IconButton size="small" color={showReactions ? "primary" : "default"}
                    onClick={() => setShowReactions((v) => !v)}
                    disabled={state !== "connected"}>
                    <EmojiEmotionsIcon fontSize="small" />
                  </IconButton>
                  <TextField
                    size="small" fullWidth
                    placeholder={state === "connected" ? (e2eReady ? "🔒 Encrypted message…" : "Type a message…") : "Not connected"}
                    value={text}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    disabled={state !== "connected"}
                    multiline maxRows={3}
                  />
                  <IconButton color="primary" onClick={sendMessage}
                    disabled={state !== "connected" || !text.trim()}>
                    <SendIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            </Paper>

            {isEnabled("google_ads") && mode === "video" && (
              <Box sx={{ mt: 1 }}>
                <AdSlot slotId="chat-sidebar" format="rectangle" />
              </Box>
            )}
          </Grid>
        </Grid>
      </Container>

      {/* Report dialog */}
      <Dialog open={reportDialog} onClose={() => setReportDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "background.paper" } }}>
        <DialogTitle>Report User</DialogTitle>
        <DialogContent>
          <Select fullWidth value={reportReason} onChange={(e) => setReportReason(e.target.value)} sx={{ mt: 1 }}>
            <MenuItem value="inappropriate">Inappropriate content</MenuItem>
            <MenuItem value="nudity">Nudity / Sexual content</MenuItem>
            <MenuItem value="harassment">Harassment / Bullying</MenuItem>
            <MenuItem value="spam">Spam / Bot</MenuItem>
            <MenuItem value="minor">Possible minor</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialog(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={submitReport}>Submit Report</Button>
        </DialogActions>
      </Dialog>

      {/* Friend request dialog */}
      <FriendRequestDialog
        open={friendReq.open}
        fromName={friendReq.fromName}
        fromUserId={friendReq.fromUserId}
        onAccept={() => respondFriendRequest(true)}
        onDecline={() => respondFriendRequest(false)}
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack("")}
        message={snack} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Layout>
  );
}

import {
  useState, useEffect, useRef, useCallback,
} from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  Box, Typography, Button, TextField, IconButton, Chip,
  Tooltip, CircularProgress, Snackbar, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, MenuItem, Select, Paper, Divider,
} from "@mui/material";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import FlagIcon from "@mui/icons-material/Flag";
import SendIcon from "@mui/icons-material/Send";
import LockIcon from "@mui/icons-material/Lock";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import BlurOffIcon from "@mui/icons-material/BlurOff";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import CallIcon from "@mui/icons-material/Call";
import CallEndIcon from "@mui/icons-material/CallEnd";
import { io, Socket } from "socket.io-client";
import styles from "@/styles/chat.module.css";
import AgeGate from "@/components/AgeGate";
import OnlineCounter from "@/components/OnlineCounter";
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

interface GeoInfo {
  country: string;
  countryName: string;
  flag: string;
}

interface Message {
  id: string;
  from: "me" | "peer" | "system";
  text: string;
  ts: number;
  encrypted: boolean;
}

const ICE = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  {
    urls: process.env.NEXT_PUBLIC_TURN_URL || "turn:chat.videodownloaders.cloud:3478",
    username: process.env.NEXT_PUBLIC_TURN_USERNAME || "milobolo",
    credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || "",
  },
];

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "💯"];

export default function Chat() {
  const router = useRouter();
  const { isEnabled } = useFeatureFlags();
  const { user, profile } = useAuth();
  const fpId = useFingerprint();

  const mode = (router.query.mode as string) || "text";
  const initialInterests = router.query.interests
    ? (router.query.interests as string).split(",").filter(Boolean)
    : [];

  const [state, setState] = useState<ChatState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [roomId, setRoomId] = useState("");
  const [peerId, setPeerId] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [peerSharingScreen, setPeerSharingScreen] = useState(false);
  const [interests] = useState<string[]>(initialInterests);
  const [matchedInterest, setMatchedInterest] = useState<string | null>(null);
  const [peerCountry, setPeerCountry] = useState<GeoInfo | null>(null);
  const [myGeo, setMyGeo] = useState<GeoInfo | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [reportDialog, setReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState("inappropriate");
  const [showReactions, setShowReactions] = useState(false);
  const [peerReaction, setPeerReaction] = useState<string | null>(null);
  const [friendReq, setFriendReq] = useState({ open: false, from: "", fromUserId: "", fromName: "" });
  const [e2eReady, setE2eReady] = useState(false);
  const [snack, setSnack] = useState("");
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [bgMode, setBgMode] = useState<BgMode>("none");
  const [showBgMenu, setShowBgMenu] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [strangerLabel, setStrangerLabel] = useState("Stranger");

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
  const msgCountRef = useRef(0);
  const matchedInterestRef = useRef<string | null>(null);

  const { activate: activateBg } = useVirtualBackground(localVideoRef);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, peerTyping]);

  useEffect(() => {
    if (fpId && socketRef.current) socketRef.current.emit("fingerprint", { fpId });
  }, [fpId]);

  useEffect(() => {
    if ("serviceWorker" in navigator && isEnabled("pwa")) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, [isEnabled]);

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
    matchedInterestRef.current = null;
    setPeerCountry(null);
    setStrangerLabel("Stranger");
    setVoiceActive(false);
  }, []);

  const saveHistory = useCallback(async (rid: string, mc: number, mi: string | null) => {
    if (!user || !isEnabled("chat_history")) return;
    const duration = sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0;
    await supabase.from("chat_history").insert({
      user_id: user.id, mode, room_id: rid,
      duration_seconds: duration, message_count: mc,
      matched_interest: mi,
      started_at: new Date(sessionStart || Date.now()).toISOString(),
      ended_at: new Date().toISOString(),
    });
  }, [user, mode, sessionStart, isEnabled]);

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
      if (pc.connectionState === "failed") setSnack("Connection failed. Click New to try again.");
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

  const startE2E = useCallback(async () => {
    if (!isEnabled("e2e_encryption")) return;
    const session = await generateKeyPair();
    e2eRef.current = session;
    socketRef.current?.emit("e2e_pubkey", { to: peerIdRef.current, publicKey: session.publicKeyB64 });
  }, [isEnabled]);

  const playMatchSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

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

    socket.on("waiting", ({ country }) => {
      setState("waiting");
      if (country) setMyGeo(country);
    });

    socket.on("match_found", async ({ roomId: rid, isInitiator, peer, matchedInterest: mi, peerCountry: pc, myCountry: mc }) => {
      setRoomId(rid);
      setPeerId(peer);
      peerIdRef.current = peer;
      roomIdRef.current = rid;
      setState("connected");
      playMatchSound();
      setSessionStart(Date.now());
      msgCountRef.current = 0;
      matchedInterestRef.current = mi;
      setMatchedInterest(mi);
      if (pc) {
        setPeerCountry(pc);
        setStrangerLabel(`Stranger ${pc.flag}`);
      }
      if (mc) setMyGeo(mc);

      const sysMsg = mi
        ? `You're now chatting with a random stranger. You both like ${mi}. Say hi!`
        : `You're now chatting with a random stranger${pc ? ` from ${pc.flag} ${pc.countryName}` : ""}. Say hi!`;
      setMessages([{ id: "sys-0", from: "system", text: sysMsg, ts: Date.now(), encrypted: false }]);

      if (mode === "video") createPeerConnection(isInitiator);
      await startE2E();
    });

    socket.on("e2e_pubkey", async ({ publicKey }) => {
      if (!e2eRef.current) return;
      const shared = await deriveSharedKey(e2eRef.current.keyPair, publicKey);
      sharedKeyRef.current = shared;
      setE2eReady(true);
    });

    socket.on("signal", async ({ from, signal }) => {
      if (!pcRef.current) {
        // Incoming call on text mode (voice toggle)
        if (signal.type === "offer") {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }).catch(() => null);
          if (!stream) return;
          localStreamRef.current = stream;
          const pc = createPeerConnection(false);
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("signal", { to: from, signal: { type: "answer", sdp: pc.localDescription } });
          setVoiceActive(true);
          setSnack("📞 Incoming voice call accepted.");
        }
        return;
      }
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

    socket.on("message", async ({ ciphertext, text: plain, ts, encrypted }) => {
      let decoded = plain || "";
      if (encrypted && sharedKeyRef.current && ciphertext) {
        try { decoded = await decryptMessage(sharedKeyRef.current, ciphertext); }
        catch { decoded = "[could not decrypt]"; }
      }
      setMessages((prev) => [
        ...prev,
        { id: `${ts}-${Math.random()}`, from: "peer", text: decoded, ts, encrypted: !!encrypted },
      ]);
      msgCountRef.current += 1;
    });

    socket.on("typing", ({ typing }) => setPeerTyping(typing));

    socket.on("reaction", ({ emoji }) => {
      setPeerReaction(emoji);
      setTimeout(() => setPeerReaction(null), 2500);
    });

    socket.on("peer_screen_share", ({ active }) => setPeerSharingScreen(active));

    socket.on("friend_request", ({ from, fromUserId, fromName }) => {
      if (isEnabled("friend_requests")) setFriendReq({ open: true, from, fromUserId, fromName });
    });

    socket.on("friend_response", async ({ accepted, fromUserId, toUserId }) => {
      if (accepted) {
        try { await supabase.from("connections").insert({ requester_id: fromUserId, receiver_id: toUserId, status: "accepted" }); } catch {}
        setSnack("🎉 Connected! Find them in your profile.");
      } else {
        setSnack("Request declined.");
      }
    });

    socket.on("peer_left", async () => {
      setState("ended");
      setMessages((prev) => [...prev, {
        id: "sys-end", from: "system",
        text: "Your conversational partner has disconnected.",
        ts: Date.now(), encrypted: false,
      }]);
      await saveHistory(roomIdRef.current, msgCountRef.current, matchedInterestRef.current);
      cleanup();
    });

    socket.on("report_received", () => setSnack("Report submitted. Thank you."));
    socket.on("error", ({ message }) => setSnack(message));

    return () => { socket.disconnect(); cleanup(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fpId, mode]);

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
    await saveHistory(roomIdRef.current, msgCountRef.current, matchedInterestRef.current);
    cleanup();
    setState("idle");
    setMessages([]);
    socketRef.current?.emit("next");
    setTimeout(() => startSearch(), 300);
  }, [cleanup, startSearch, saveHistory]);

  const handleStop = useCallback(async () => {
    await saveHistory(roomIdRef.current, msgCountRef.current, matchedInterestRef.current);
    cleanup();
    setState("idle");
    setMessages([]);
    socketRef.current?.emit("cancel_search");
    socketRef.current?.emit("next");
  }, [cleanup, saveHistory]);

  // Keyboard shortcuts — after handleStop/handleNext to avoid TDZ
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "Escape") { handleStop(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { handleNext(); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleStop, handleNext]);

  // Auto-start on page load
  useEffect(() => {
    if (router.isReady) {
      setTimeout(() => startSearch(), 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !micOn; });
    setMicOn((v) => !v);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !camOn; });
    setCamOn((v) => !v);
  };

  const toggleVoice = useCallback(async () => {
    if (voiceActive) {
      localStreamRef.current?.getAudioTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      pcRef.current = null;
      localStreamRef.current = null;
      setVoiceActive(false);
      setSnack("Voice call ended.");
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        localStreamRef.current = stream;
        createPeerConnection(true);
        setVoiceActive(true);
        setSnack("🎙️ Voice call starting…");
      } catch {
        setSnack("Mic access denied.");
      }
    }
  }, [voiceActive, createPeerConnection]);

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

    let payload: Record<string, unknown> = { roomId };
    if (isEnabled("e2e_encryption") && sharedKeyRef.current) {
      const ciphertext = await encryptMessage(sharedKeyRef.current, plain);
      payload = { ...payload, ciphertext, encrypted: true };
    } else {
      payload = { ...payload, plain, encrypted: false };
    }
    socketRef.current?.emit("message", payload);

    setMessages((prev) => [...prev, {
      id: `${Date.now()}-me`, from: "me", text: plain, ts: Date.now(),
      encrypted: isEnabled("e2e_encryption"),
    }]);
    msgCountRef.current += 1;
  }, [text, roomId, isEnabled]);

  const sendReaction = (emoji: string) => {
    socketRef.current?.emit("reaction", { roomId, emoji });
    setShowReactions(false);
  };

  const sendFriendRequest = () => {
    if (!user) return setSnack("Sign in to send connection requests.");
    socketRef.current?.emit("friend_request", { to: peerId, fromUserId: user.id, fromName: profile?.display_name || "Anonymous" });
    setSnack("Connection request sent!");
  };

  const respondFriendRequest = async (accepted: boolean) => {
    setFriendReq((prev) => ({ ...prev, open: false }));
    socketRef.current?.emit("friend_response", { to: friendReq.from, accepted, fromUserId: friendReq.fromUserId, toUserId: user?.id });
    if (accepted && friendReq.fromUserId && user?.id) {
      try { await supabase.from("connections").insert({ requester_id: friendReq.fromUserId, receiver_id: user.id, status: "accepted" }); } catch {}
    }
  };

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
    setSnack("Report submitted. Thank you.");
  };

  const isConnected = state === "connected";
  const isWaiting = state === "waiting";

  // ─── Render ────────────────────────────────────────────────
  return (
    <>
      <Head><title>MiloBolo — {mode === "video" ? "Video" : "Text"} Chat</title></Head>
      <AgeGate />

      <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default", overflow: "hidden" }}>

        {/* ── Top bar (Omegle-style) ── */}
        <Box sx={{
          flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          bgcolor: "background.paper",
          px: 2, py: 0,
          display: "flex", alignItems: "stretch",
        }}>
          {/* Logo */}
          <Typography
            fontWeight={900} fontSize={18}
            onClick={() => router.push("/")}
            sx={{
              cursor: "pointer", pr: 3, mr: 1,
              display: "flex", alignItems: "center",
              background: "linear-gradient(135deg,#6C63FF,#FF6584)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              borderRight: "1px solid rgba(255,255,255,0.08)",
            }}>
            MiloBolo
          </Typography>

          {/* Mode tabs */}
          {[
            { label: "Video", val: "video", path: "/camera-test?mode=video" },
            { label: "Text", val: "text", path: "/chat?mode=text" },
            { label: "Spy (beta)", val: "spy", path: "/spy" },
          ].map((tab) => (
            <Box
              key={tab.val}
              onClick={() => router.push(tab.path)}
              sx={{
                px: 2.5, py: 1.5, cursor: "pointer", fontSize: 14, fontWeight: 500,
                color: mode === tab.val ? "primary.main" : "text.secondary",
                borderBottom: mode === tab.val ? "2px solid #6C63FF" : "2px solid transparent",
                mb: "-1px",
                "&:hover": { color: "text.primary" },
                transition: "color 0.15s",
              }}>
              {tab.label}
            </Box>
          ))}

          <Box sx={{ flex: 1 }} />

          {/* Online count */}
          <Box sx={{ display: "flex", alignItems: "center", pr: 1 }}>
            <OnlineCounter />
          </Box>

          {/* E2E badge */}
          {e2eReady && (
            <Box sx={{ display: "flex", alignItems: "center", px: 1 }}>
              <Chip icon={<LockIcon sx={{ fontSize: "11px !important" }} />}
                label="E2E" size="small"
                sx={{ bgcolor: "rgba(76,175,80,0.1)", color: "success.main", border: "1px solid rgba(76,175,80,0.3)", height: 20, fontSize: 10 }} />
            </Box>
          )}
        </Box>

        {/* ── Main chat area ── */}
        <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── Left: Video panel (video mode only) ── */}
          {mode === "video" && (
            <Box sx={{ flex: "0 0 65%", display: "flex", flexDirection: "column", borderRight: "1px solid rgba(255,255,255,0.07)" }}>

              {/* Remote video */}
              <Box sx={{ flex: 1, position: "relative", bgcolor: "#050508", overflow: "hidden" }}>
                <video ref={remoteVideoRef} autoPlay playsInline className={styles.remoteVideo} />

                {/* Stranger label */}
                {isConnected && (
                  <Box sx={{ position: "absolute", top: 10, left: 10 }}>
                    <Chip label={strangerLabel} size="small"
                      sx={{ bgcolor: "rgba(0,0,0,0.65)", color: "#fff", backdropFilter: "blur(6px)", fontSize: 12, fontWeight: 600 }} />
                  </Box>
                )}

                {/* Peer reaction float */}
                {peerReaction && (
                  <Box sx={{
                    position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)",
                    fontSize: 64, pointerEvents: "none",
                    animation: "fadeUp 2.5s ease forwards",
                    "@keyframes fadeUp": {
                      "0%": { opacity: 1, transform: "translate(-50%,-50%) scale(1)" },
                      "100%": { opacity: 0, transform: "translate(-50%,-130%) scale(1.8)" },
                    },
                  }}>{peerReaction}</Box>
                )}

                {/* Screen share badge */}
                {peerSharingScreen && (
                  <Box sx={{ position: "absolute", top: 10, right: 10 }}>
                    <Chip label="Sharing screen" size="small" color="warning" sx={{ fontSize: 11 }} />
                  </Box>
                )}

                {/* Overlay when not connected */}
                {!isConnected && (
                  <Box sx={{
                    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    bgcolor: "rgba(5,5,8,0.92)",
                  }}>
                    {isWaiting ? (
                      <>
                        <CircularProgress color="primary" sx={{ mb: 2 }} />
                        <Typography color="text.secondary" fontSize={14}>
                          Looking for someone to chat with{interests.length ? ` (${interests[0]})` : ""}…
                        </Typography>
                      </>
                    ) : state === "ended" ? (
                      <Box textAlign="center">
                        <Typography color="text.secondary" mb={2}>Stranger disconnected.</Typography>
                        <Button variant="contained" onClick={startSearch} sx={{ borderRadius: 2 }}>New Conversation</Button>
                      </Box>
                    ) : null}
                  </Box>
                )}

                {/* Local PiP */}
                <Box sx={{
                  position: "absolute", bottom: 10, right: 10,
                  width: { xs: 90, md: 130 }, height: { xs: 64, md: 88 },
                  borderRadius: 1.5, overflow: "hidden",
                  border: "2px solid rgba(108,99,255,0.4)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.7)",
                }}>
                  <video ref={localVideoRef} autoPlay playsInline muted className={styles.localVideo} />
                </Box>
              </Box>

              {/* Video controls bar */}
              <Box sx={{
                flexShrink: 0, px: 1.5, py: 1,
                bgcolor: "background.paper",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", gap: 0.5,
              }}>
                <Tooltip title={micOn ? "Mute" : "Unmute"}>
                  <IconButton onClick={toggleMic} size="small" color={micOn ? "default" : "error"}><MicIcon fontSize="small" /></IconButton>
                </Tooltip>
                <Tooltip title={camOn ? "Camera off" : "Camera on"}>
                  <IconButton onClick={toggleCam} size="small" color={camOn ? "default" : "error"}>
                    {camOn ? <VideocamIcon fontSize="small" /> : <VideocamOffIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                {isEnabled("screen_sharing") && isConnected && (
                  <Tooltip title={sharingScreen ? "Stop sharing" : "Share screen"}>
                    <IconButton onClick={toggleScreenShare} size="small" color={sharingScreen ? "primary" : "default"}>
                      {sharingScreen ? <StopScreenShareIcon fontSize="small" /> : <ScreenShareIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                )}
                {isEnabled("virtual_bg") && (
                  <Box sx={{ position: "relative" }}>
                    <Tooltip title="Background">
                      <IconButton onClick={() => setShowBgMenu((v) => !v)} size="small" color={bgMode !== "none" ? "primary" : "default"}>
                        {bgMode !== "none" ? <BlurOnIcon fontSize="small" /> : <BlurOffIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    {showBgMenu && (
                      <Paper sx={{ position: "absolute", bottom: 40, left: 0, p: 0.5, zIndex: 10, minWidth: 160 }}>
                        {(["none", "blur", "color"] as BgMode[]).map((m) => (
                          <MenuItem key={m} onClick={() => toggleBackground(m)} selected={bgMode === m} sx={{ borderRadius: 1, fontSize: 13 }}>
                            {m === "none" ? "No effect" : m === "blur" ? "Blur background" : "Dark background"}
                          </MenuItem>
                        ))}
                      </Paper>
                    )}
                  </Box>
                )}
                <Box sx={{ flex: 1 }} />
                {isConnected && isEnabled("friend_requests") && (
                  <Tooltip title="Connect with stranger">
                    <IconButton size="small" onClick={sendFriendRequest}><PersonAddIcon fontSize="small" /></IconButton>
                  </Tooltip>
                )}
                {isConnected && (
                  <Tooltip title="Report">
                    <IconButton size="small" color="warning" onClick={() => setReportDialog(true)}><FlagIcon fontSize="small" /></IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          )}

          {/* ── Right: Chat panel ── */}
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Stop / New bar — Omegle style */}
            <Box sx={{
              flexShrink: 0, px: 2, py: 1,
              bgcolor: "background.paper",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              display: "flex", alignItems: "center", gap: 1,
            }}>
              {matchedInterest && (
                <Chip label={`You both like: ${matchedInterest}`} size="small" color="primary" variant="outlined"
                  sx={{ height: 22, fontSize: 11, mr: "auto" }} />
              )}
              {!matchedInterest && myGeo && isConnected && (
                <Typography variant="caption" color="text.disabled" sx={{ mr: "auto" }}>
                  You {myGeo.flag} → {strangerLabel}
                </Typography>
              )}
              {!matchedInterest && !myGeo && <Box sx={{ flex: 1 }} />}

              {/* Voice toggle (text mode only) */}
              {mode === "text" && isConnected && (
                <Tooltip title={voiceActive ? "End voice call" : "Voice call"}>
                  <IconButton size="small" color={voiceActive ? "error" : "default"} onClick={toggleVoice}>
                    {voiceActive ? <CallEndIcon fontSize="small" /> : <CallIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              )}
              {isConnected && (
                <Tooltip title="Report"><IconButton size="small" color="warning" onClick={() => setReportDialog(true)}><FlagIcon fontSize="small" /></IconButton></Tooltip>
              )}
              {isConnected && isEnabled("friend_requests") && (
                <Tooltip title="Connect"><IconButton size="small" onClick={sendFriendRequest}><PersonAddIcon fontSize="small" /></IconButton></Tooltip>
              )}

              {isConnected || isWaiting ? (
                <>
                  <Button
                    variant="contained" size="small"
                    onClick={handleNext}
                    sx={{ borderRadius: 1.5, minWidth: 56, bgcolor: "#6C63FF", "&:hover": { bgcolor: "#5a52e0" } }}>
                    New
                  </Button>
                  <Button
                    variant="outlined" color="error" size="small"
                    onClick={handleStop}
                    sx={{ borderRadius: 1.5, minWidth: 56 }}>
                    Stop
                  </Button>
                </>
              ) : (
                <Button
                  variant="contained" size="small"
                  onClick={startSearch}
                  sx={{ borderRadius: 1.5, bgcolor: "#6C63FF", "&:hover": { bgcolor: "#5a52e0" } }}>
                  {state === "ended" ? "New Conversation" : "Start"}
                </Button>
              )}
            </Box>

            {/* Message log — Omegle IRC style */}
            <Box sx={{ flex: 1, overflowY: "auto", p: 2, fontFamily: "monospace", fontSize: 13.5, lineHeight: 1.7 }}>

              {isWaiting && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, color: "text.disabled", mb: 1 }}>
                  <CircularProgress size={14} />
                  <Typography fontSize={13} color="text.disabled">
                    Looking for someone to chat with…
                  </Typography>
                </Box>
              )}

              {messages.map((m) => (
                <Box key={m.id} sx={{ mb: 0.5 }}>
                  {m.from === "system" ? (
                    <Typography component="div" sx={{ color: "text.disabled", fontStyle: "italic", fontSize: 13 }}>
                      {m.text}
                    </Typography>
                  ) : (
                    <Box sx={{ display: "flex", gap: 0.75 }}>
                      <Typography component="span" sx={{
                        fontWeight: 700, flexShrink: 0, fontSize: 13.5,
                        color: m.from === "me" ? "#6C63FF" : "#FF6584",
                      }}>
                        {m.from === "me" ? "You" : strangerLabel}:
                      </Typography>
                      <Typography component="span" sx={{ wordBreak: "break-word", color: "text.primary", fontSize: 13.5 }}>
                        {m.text}
                        {m.encrypted && <LockIcon sx={{ fontSize: 9, opacity: 0.4, ml: 0.5, verticalAlign: "middle" }} />}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ))}

              {peerTyping && (
                <Typography sx={{ color: "text.disabled", fontStyle: "italic", fontSize: 13 }}>
                  Stranger is typing…
                </Typography>
              )}
              <div ref={chatEndRef} />
            </Box>

            {/* Reaction bar */}
            {showReactions && isConnected && (
              <Box sx={{ px: 2, py: 0.75, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                {REACTIONS.map((e) => (
                  <IconButton key={e} size="small" onClick={() => sendReaction(e)} sx={{ fontSize: 18, p: 0.4 }}>{e}</IconButton>
                ))}
              </Box>
            )}

            {/* Input row */}
            <Box sx={{
              flexShrink: 0, px: 1.5, py: 1,
              borderTop: "1px solid rgba(255,255,255,0.07)",
              bgcolor: "background.paper",
              display: "flex", alignItems: "flex-end", gap: 0.5,
            }}>
              <Tooltip title="Reactions">
                <IconButton size="small" color={showReactions ? "primary" : "default"}
                  onClick={() => setShowReactions((v) => !v)} disabled={!isConnected}>
                  <EmojiEmotionsIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <TextField
                size="small" fullWidth multiline maxRows={5}
                placeholder={
                  !isConnected ? "Connecting…"
                  : e2eReady ? "🔒 Type a message (encrypted)…"
                  : "Type a message…"
                }
                value={text}
                onChange={(e) => handleTyping(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                disabled={!isConnected}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2, fontSize: 13.5,
                    bgcolor: "rgba(255,255,255,0.03)",
                  },
                }}
              />
              <Button
                variant="contained" size="small"
                onClick={sendMessage}
                disabled={!isConnected || !text.trim()}
                endIcon={<SendIcon sx={{ fontSize: "14px !important" }} />}
                sx={{ borderRadius: 2, minWidth: 70, py: 1, bgcolor: "#6C63FF", "&:hover": { bgcolor: "#5a52e0" } }}>
                Send
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Report dialog */}
      <Dialog open={reportDialog} onClose={() => setReportDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Report Stranger</DialogTitle>
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
          <Button onClick={submitReport} color="error" variant="contained">Report</Button>
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
    </>
  );
}

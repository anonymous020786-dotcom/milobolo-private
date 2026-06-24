import {
  useState, useEffect, useRef, useCallback,
} from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  Box, Typography, Button, TextField, IconButton, Chip,
  Tooltip, CircularProgress, Snackbar, Stack, Dialog, DialogTitle,
  DialogContent, DialogActions, MenuItem, Select, Paper, Fade,
  useMediaQuery, useTheme, LinearProgress,
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
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ImageIcon from "@mui/icons-material/Image";
import DownloadIcon from "@mui/icons-material/Download";
import LinkIcon from "@mui/icons-material/Link";
import SignalCellularAltIcon from "@mui/icons-material/SignalCellularAlt";
import SignalCellular2BarIcon from "@mui/icons-material/SignalCellular2Bar";
import SignalCellular0BarIcon from "@mui/icons-material/SignalCellular0Bar";
import { io, Socket } from "socket.io-client";
import styles from "@/styles/chat.module.css";
import AgeGate from "@/components/AgeGate";
import FloatingToolbar from "@/components/FloatingToolbar";
import OnlineCounter from "@/components/OnlineCounter";
import FriendRequestDialog from "@/components/chat/FriendRequestDialog";
import { useFeatureFlags } from "@/context/FeatureFlagContext";
import { useAuth } from "@/context/AuthContext";
import { useFingerprint } from "@/hooks/useFingerprint";
import { useSettings } from "@/hooks/useSettings";
import { useVirtualBackground, BgMode } from "@/hooks/useVirtualBackground";
import {
  generateKeyPair, deriveSharedKey,
  encryptMessage, decryptMessage, E2ESession,
} from "@/lib/e2e";
import { supabase } from "@/lib/supabase";

type ChatState = "idle" | "waiting" | "connected" | "ended";
type Quality = "good" | "fair" | "poor" | null;

interface GeoInfo { country: string; countryName: string; flag: string; }
interface Message {
  id: string;
  from: "me" | "peer" | "system";
  text: string;
  ts: number;
  encrypted: boolean;
  imageUrl?: string;
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
const MAX_MSG = 500;

function fmtDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function Chat() {
  const router = useRouter();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));
  const { isEnabled } = useFeatureFlags();
  const { user, profile } = useAuth();
  const fpId = useFingerprint();
  const settings = useSettings();

  const mode = (router.query.mode as string) || "text";
  const initialInterests = router.query.interests
    ? (router.query.interests as string).split(",").filter(Boolean)
    : [];

  // ── state ────────────────────────────────────────────────
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
  const [reportDetails, setReportDetails] = useState("");
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
  const [chatDuration, setChatDuration] = useState(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [nextCooldown, setNextCooldown] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [quality, setQuality] = useState<Quality>(null);
  const [connected, setConnected] = useState(false); // socket connected
  const [showMobileChat, setShowMobileChat] = useState(false); // mobile: show text panel
  const [imgUploading, setImgUploading] = useState(false);
  const [peerGender, setPeerGender] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"next" | "stop" | null>(null);

  // ── refs ─────────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const reconnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startSearchRef = useRef<(() => void) | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const messagesBoxRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const e2eRef = useRef<E2ESession | null>(null);
  const sharedKeyRef = useRef<CryptoKey | null>(null);
  const peerIdRef = useRef<string>("");
  const roomIdRef = useRef<string>("");
  const msgCountRef = useRef(0);
  const matchedInterestRef = useRef<string | null>(null);
  const qualityTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { activate: activateBg } = useVirtualBackground(localVideoRef);
  const isConnected = state === "connected";
  const isWaiting = state === "waiting";

  // ── scroll handler ───────────────────────────────────────
  const handleMsgScroll = () => {
    const el = messagesBoxRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
  };

  useEffect(() => {
    if (!showScrollBtn) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, peerTyping, showScrollBtn]);

  // ── chat timer ───────────────────────────────────────────
  useEffect(() => {
    if (!isConnected) { setChatDuration(0); return; }
    const id = setInterval(() => setChatDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [isConnected]);

  // ── fullscreen change listener ───────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── WebRTC quality stats ─────────────────────────────────
  useEffect(() => {
    if (!isConnected || mode !== "video") { setQuality(null); return; }
    qualityTimer.current = setInterval(async () => {
      if (!pcRef.current) return;
      try {
        const stats = await pcRef.current.getStats();
        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            const lost = (report as any).packetsLost || 0;
            const received = (report as any).packetsReceived || 1;
            const loss = lost / (lost + received);
            setQuality(loss < 0.02 ? "good" : loss < 0.1 ? "fair" : "poor");
          }
        });
      } catch {}
    }, 5000);
    return () => { if (qualityTimer.current) clearInterval(qualityTimer.current); };
  }, [isConnected, mode]);

  // ── notification permission ──────────────────────────────
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // ── fingerprint ──────────────────────────────────────────
  useEffect(() => {
    if (fpId && socketRef.current) socketRef.current.emit("fingerprint", { fpId });
  }, [fpId]);

  // ── PWA service worker ───────────────────────────────────
  useEffect(() => {
    if ("serviceWorker" in navigator && isEnabled("pwa")) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, [isEnabled]);

  // ── disconnect sound ─────────────────────────────────────
  const playDisconnectSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }, []);

  const playMatchSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

  // ── Save transcript ──────────────────────────────────────
  const saveTranscript = useCallback(() => {
    const lines = messages
      .filter((m) => m.from !== "system")
      .map((m) => {
        const d = new Date(m.ts).toLocaleTimeString();
        const who = m.from === "me" ? "You" : strangerLabel;
        return m.imageUrl ? `[${d}] ${who}: [Image] ${m.imageUrl}` : `[${d}] ${who}: ${m.text}`;
      });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `milobolo-chat-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, strangerLabel]);

  // ── Send image ───────────────────────────────────────────
  const sendImage = useCallback(async (file: File) => {
    if (!file || !isConnected) return;
    setImgUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/upload-chat-image", { method: "POST", body: form });
      const { url, error } = await res.json();
      if (error || !url) { setSnack(error || "Image upload failed."); return; }
      socketRef.current?.emit("image_message", { roomId, imageUrl: url, senderRole: null });
      setMessages((prev) => [...prev, {
        id: `img-me-${Date.now()}`, from: "me", text: "", ts: Date.now(), encrypted: false, imageUrl: url,
      }]);
    } catch {
      setSnack("Image upload failed.");
    } finally {
      setImgUploading(false);
    }
  }, [isConnected, roomId]);

  // ── cleanup ──────────────────────────────────────────────
  const cleanup = useCallback(() => {
    pcRef.current?.close(); pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    e2eRef.current = null; sharedKeyRef.current = null;
    setE2eReady(false); setSharingScreen(false); setPeerSharingScreen(false);
    setPeerTyping(false); setMatchedInterest(null); matchedInterestRef.current = null;
    setPeerCountry(null); setStrangerLabel("Stranger"); setVoiceActive(false);
    setQuality(null); setShowReactions(false);
  }, []);

  const saveHistory = useCallback(async (rid: string, mc: number, mi: string | null) => {
    if (!user || !isEnabled("chat_history")) return;
    const duration = sessionStart ? Math.floor((Date.now() - sessionStart) / 1000) : 0;
    await supabase.from("chat_history").insert({
      user_id: user.id, mode, room_id: rid,
      duration_seconds: duration, message_count: mc, matched_interest: mi,
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
      setSnack("Camera/mic access denied. Check browser permissions and try again.");
      return null;
    }
  }, [mode]);

  const createPeerConnection = useCallback((isInitiator: boolean) => {
    const pc = new RTCPeerConnection({ iceServers: ICE, iceTransportPolicy: "all" });
    pcRef.current = pc;
    localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));

    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };
    pc.onicecandidate = (e) => {
      if (e.candidate && socketRef.current && peerIdRef.current) {
        socketRef.current.emit("signal", { to: peerIdRef.current, signal: { type: "candidate", candidate: e.candidate } });
      }
    };
    pc.onconnectionstatechange = () => {
      const cs = pc.connectionState;
      if (cs === "connected") {
        setIsReconnecting(false);
        if (reconnTimerRef.current) { clearTimeout(reconnTimerRef.current); reconnTimerRef.current = null; }
      }
      if (cs === "disconnected" || cs === "failed") {
        setIsReconnecting(true);
        pc.restartIce();
        if (reconnTimerRef.current) clearTimeout(reconnTimerRef.current);
        reconnTimerRef.current = setTimeout(() => {
          if (pcRef.current?.connectionState !== "connected") {
            setIsReconnecting(false);
            setSnack("Connection lost. Finding new match…");
            cleanup();
            setState("idle");
            setMessages([]);
            socketRef.current?.emit("cancel_search");
            socketRef.current?.emit("next");
            setTimeout(() => startSearchRef.current?.(), 300);
          }
        }, 12000);
      }
    };

    if (isInitiator) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: mode === "video" })
        .then((o) => pc.setLocalDescription(o))
        .then(() => {
          socketRef.current?.emit("signal", { to: peerIdRef.current, signal: { type: "offer", sdp: pc.localDescription } });
        });
    }
    return pc;
  }, [mode, voiceActive, cleanup]);

  const startE2E = useCallback(async () => {
    if (!isEnabled("e2e_encryption")) return;
    const session = await generateKeyPair();
    e2eRef.current = session;
    socketRef.current?.emit("e2e_pubkey", { to: peerIdRef.current, publicKey: session.publicKeyB64 });
  }, [isEnabled]);

  // ── socket setup ─────────────────────────────────────────
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      if (fpId) socket.emit("fingerprint", { fpId });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("reconnect", () => {
      setConnected(true);
      setSnack("Reconnected to server.");
      // Re-emit fingerprint so the server recognises us again
      if (fpId) socket.emit("fingerprint", { fpId });
      // If we were waiting for a match, re-queue automatically
      setState((prev) => {
        if (prev === "waiting") {
          const interests = (typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("interests")
            : null) || "";
          socket.emit("find_peer", {
            mode,
            interests: interests ? interests.split(",") : [],
            userId: null,
          });
        }
        return prev;
      });
    });

    socket.on("banned", ({ reason }) => {
      setSnack(reason);
      setTimeout(() => router.push("/"), 3000);
    });

    socket.on("waiting", ({ country }) => {
      setState("waiting");
      if (country) setMyGeo(country);
    });

    socket.on("match_found", async ({ roomId: rid, isInitiator, peer, matchedInterest: mi, peerCountry: pc, myCountry: mc, peerGender: pg }) => {
      setRoomId(rid);
      setPeerId(peer);
      peerIdRef.current = peer;
      roomIdRef.current = rid;
      setState("connected");
      setPeerGender(pg || null);
      if (settings.playMessageSound) playMatchSound();
      setSessionStart(Date.now());
      msgCountRef.current = 0;
      matchedInterestRef.current = mi;
      setMatchedInterest(mi);
      if (isMobile) setShowMobileChat(false); // show video first on mobile

      if (pc) {
        setPeerCountry(pc);
        const genderLabel = pg === "male" ? " ♂" : pg === "female" ? " ♀" : "";
        setStrangerLabel(`Stranger ${pc.flag}${genderLabel}`);
      }
      if (mc) setMyGeo(mc);

      // Browser notification if tab is hidden
      if (typeof document !== "undefined" && document.hidden) {
        try {
          if (Notification.permission === "granted") {
            new Notification("MiloBolo — Stranger connected!", {
              body: mi ? `You both like ${mi}. Say hi!` : "You are now chatting with a random stranger.",
              icon: "/icons/icon-192.png",
            });
          }
        } catch {}
      }

      const sysText = mi
        ? `You're now chatting with a random stranger. You both like ${mi}. Say hi!`
        : `You're now chatting with a random stranger${pc ? ` from ${pc.flag} ${pc.countryName}` : ""}. Say hi!`;
      setMessages([{ id: "sys-0", from: "system", text: sysText, ts: Date.now(), encrypted: false }]);

      if (mode === "video" || mode === "voice") createPeerConnection(isInitiator);
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
          setSnack("📞 Voice call accepted.");
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
      setMessages((prev) => [...prev,
        { id: `${ts}-${Math.random()}`, from: "peer", text: decoded, ts, encrypted: !!encrypted },
      ]);
      msgCountRef.current += 1;
    });

    socket.on("typing", ({ typing }) => { if (settings.showTypingIndicator) setPeerTyping(typing); });
    socket.on("image_message", ({ imageUrl, ts }) => {
      setMessages((prev) => [...prev, {
        id: `img-peer-${ts}`, from: "peer", text: "", ts, encrypted: false, imageUrl,
      }]);
    });
    socket.on("reaction", ({ emoji }) => { setPeerReaction(emoji); setTimeout(() => setPeerReaction(null), 2500); });
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
      if (settings.playMessageSound) playDisconnectSound();
      setState("ended");
      window.dispatchEvent(new Event("milobolo:chat_ended"));
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
    if (mode === "video" || mode === "voice") {
      const stream = await getLocalStream();
      if (!stream) return;
    }
    setState("waiting");
    setMessages([]);
    setRoomId(""); setPeerId(""); peerIdRef.current = ""; roomIdRef.current = "";
    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const myGenderParam = urlParams?.get("gender") || "any";
    const wantGenderParam = urlParams?.get("wantGender") || "any";
    const collegeParam = urlParams?.get("college") === "1";
    const inviteParam = urlParams?.get("invite") || null;
    socketRef.current?.emit("find_match", {
      mode, userId: user?.id || null,
      interests: isEnabled("interest_matching") ? interests : [],
      gender: myGenderParam,
      wantGender: wantGenderParam,
      college: collegeParam,
      language: settings.defaultLanguage || null,
      invite: inviteParam,
    });
  }, [mode, user, interests, isEnabled, getLocalStream]);

  // Keep ref in sync so ICE reconnect timer can call startSearch without stale closure
  useEffect(() => { startSearchRef.current = startSearch; }, [startSearch]);

  const execNext = useCallback(async () => {
    if (nextCooldown) return;
    setNextCooldown(true);
    setTimeout(() => setNextCooldown(false), 2000);
    await saveHistory(roomIdRef.current, msgCountRef.current, matchedInterestRef.current);
    cleanup();
    setState("idle");
    setMessages([]);
    socketRef.current?.emit("next");
    setTimeout(() => startSearch(), 300);
  }, [nextCooldown, cleanup, startSearch, saveHistory]);

  const execStop = useCallback(async () => {
    await saveHistory(roomIdRef.current, msgCountRef.current, matchedInterestRef.current);
    cleanup();
    setState("idle");
    setMessages([]);
    socketRef.current?.emit("cancel_search");
    socketRef.current?.emit("next");
  }, [cleanup, saveHistory]);

  const handleNext = useCallback(async () => {
    if (state === "connected") { setConfirmAction("next"); return; }
    await execNext();
  }, [state, execNext]);

  const handleStop = useCallback(async () => {
    if (state === "connected") { setConfirmAction("stop"); return; }
    await execStop();
  }, [state, execStop]);

  // Keyboard shortcuts — after handleStop/handleNext
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

  // Auto-start
  useEffect(() => {
    if (router.isReady) setTimeout(() => startSearch(), 300);
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

  const toggleFullscreen = async () => {
    const el = remoteVideoRef.current?.closest(".video-container") as HTMLElement || remoteVideoRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

  const toggleVoice = useCallback(async () => {
    if (voiceActive) {
      localStreamRef.current?.getAudioTracks().forEach((t) => t.stop());
      pcRef.current?.close(); pcRef.current = null;
      localStreamRef.current = null;
      setVoiceActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        localStreamRef.current = stream;
        createPeerConnection(true);
        setVoiceActive(true);
        setSnack("🎙️ Voice call starting…");
      } catch { setSnack("Mic access denied."); }
    }
  }, [voiceActive, createPeerConnection]);

  const toggleBackground = async (newMode: BgMode) => {
    setBgMode(newMode);
    setShowBgMenu(false);
    const newStream = await activateBg(newMode, localStreamRef.current);
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
    if (val.length > MAX_MSG) return;
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

  // ── Flood protection (max 5 messages per 3 s) ────────────
  const msgTimestamps = useRef<number[]>([]);
  const FLOOD_WINDOW = 3000;
  const FLOOD_LIMIT = 5;

  const sendMessage = useCallback(async () => {
    if (!text.trim() || !roomId) return;

    // Client-side rate limit
    const now = Date.now();
    msgTimestamps.current = msgTimestamps.current.filter((t) => now - t < FLOOD_WINDOW);
    if (msgTimestamps.current.length >= FLOOD_LIMIT) {
      setSnack("You're sending messages too fast. Please slow down.");
      return;
    }
    msgTimestamps.current.push(now);

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
    setMessages((prev) => [...prev,
      { id: `${Date.now()}-me`, from: "me", text: plain, ts: Date.now(), encrypted: isEnabled("e2e_encryption") },
    ]);
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
    socketRef.current?.emit("report", { reportedId: peerId, reason: reportReason, details: reportDetails, screenshotB64 });
    setReportDialog(false);
    setReportDetails("");
    setSnack("Report submitted. Thank you.");
  };

  const copyTranscript = () => {
    const lines = messages.map((m) => {
      if (m.from === "system") return `--- ${m.text} ---`;
      return `${m.from === "me" ? "You" : strangerLabel}: ${m.text}`;
    }).join("\n");
    navigator.clipboard.writeText(lines).then(() => setSnack("Chat copied to clipboard.")).catch(() => {});
  };

  // ── Quality icon ─────────────────────────────────────────
  const QualityIcon = () => {
    if (!quality) return null;
    const color = quality === "good" ? "#4CAF50" : quality === "fair" ? "#FF9800" : "#f44336";
    const Icon = quality === "good" ? SignalCellularAltIcon : quality === "fair" ? SignalCellular2BarIcon : SignalCellular0BarIcon;
    return <Tooltip title={`Connection: ${quality}`}><Icon sx={{ fontSize: 16, color }} /></Tooltip>;
  };

  // ─── Render ────────────────────────────────────────────────
  return (
    <>
      <Head><title>MiloBolo — {mode === "video" ? "Video" : mode === "voice" ? "Voice" : "Text"} Chat</title></Head>
      <AgeGate />

      <Box sx={{
        height: "100dvh",
        display: "flex", flexDirection: "column",
        bgcolor: "background.default", overflow: "hidden",
      }}>

        {/* ── Top bar ── */}
        <Box sx={{
          flexShrink: 0,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          bgcolor: "background.paper",
          px: { xs: 1, md: 2 }, py: 0,
          display: "flex", alignItems: "stretch",
        }}>
          <Typography
            fontWeight={900} fontSize={17}
            onClick={() => router.push("/")}
            sx={{
              cursor: "pointer", pr: { xs: 1.5, md: 3 }, mr: 0.5,
              display: "flex", alignItems: "center", flexShrink: 0,
              background: "linear-gradient(135deg,#6C63FF,#FF6584)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              borderRight: "1px solid rgba(255,255,255,0.08)",
            }}>
            MiloBolo
          </Typography>

          {/* Mode tabs */}
          {[
            { label: "Video", val: "video", path: "/camera-test?mode=video" },
            { label: "Voice", val: "voice", path: "/chat?mode=voice" },
            { label: "Text", val: "text", path: "/chat?mode=text" },
            { label: "Spy", val: "spy", path: "/spy" },
          ].map((tab) => (
            <Box key={tab.val} onClick={() => router.push(tab.path)} sx={{
              px: { xs: 1.5, md: 2.5 }, py: 1.5, cursor: "pointer",
              fontSize: { xs: 12, md: 14 }, fontWeight: 500,
              color: mode === tab.val ? "primary.main" : "text.secondary",
              borderBottom: mode === tab.val ? "2px solid #6C63FF" : "2px solid transparent",
              mb: "-1px", "&:hover": { color: "text.primary" }, transition: "color 0.15s",
            }}>{tab.label}</Box>
          ))}

          <Box sx={{ flex: 1 }} />

          {/* Timer */}
          {isConnected && (
            <Box sx={{ display: "flex", alignItems: "center", px: 1 }}>
              <Typography variant="caption" sx={{ fontFamily: "monospace", color: "text.secondary", fontSize: 12 }}>
                {fmtDuration(chatDuration)}
              </Typography>
            </Box>
          )}

          {/* Quality */}
          {mode === "video" && (
            <Box sx={{ display: "flex", alignItems: "center", px: 0.5 }}>
              <QualityIcon />
            </Box>
          )}

          {/* E2E badge */}
          {e2eReady && (
            <Box sx={{ display: "flex", alignItems: "center", px: 1 }}>
              <Chip icon={<LockIcon sx={{ fontSize: "11px !important" }} />}
                label="E2E" size="small"
                sx={{ bgcolor: "rgba(76,175,80,0.1)", color: "success.main", border: "1px solid rgba(76,175,80,0.3)", height: 20, fontSize: 10 }} />
            </Box>
          )}

          {/* Connection indicator */}
          {!connected && (
            <Box sx={{ display: "flex", alignItems: "center", px: 1 }}>
              <Chip label="Reconnecting…" size="small" color="warning" sx={{ height: 20, fontSize: 10 }} />
            </Box>
          )}

          {/* Online count */}
          <Box sx={{ display: "flex", alignItems: "center", pr: 1 }}>
            <OnlineCounter />
          </Box>
        </Box>

        {/* ── Main area — responsive layout ── */}
        <Box sx={{
          flex: 1, overflow: "hidden",
          display: "flex",
          flexDirection: (mode === "video" || mode === "voice")
            ? (isMobile ? "column" : "row")
            : "row",
        }}>

          {/* ── VIDEO PANEL ── */}
          {mode === "video" && (!isMobile || !showMobileChat) && (
            <Box className="video-container" sx={{
              flexShrink: 0,
              width: isMobile ? "100%" : "65%",
              height: isMobile ? "55%" : "100%",
              display: "flex", flexDirection: "column",
              borderRight: isMobile ? "none" : "1px solid rgba(255,255,255,0.07)",
              borderBottom: isMobile ? "1px solid rgba(255,255,255,0.07)" : "none",
            }}>
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
                    position: "absolute", top: "40%", left: "50%",
                    transform: "translate(-50%,-50%)", fontSize: 64, pointerEvents: "none",
                    animation: "fadeUp 2.5s ease forwards",
                    "@keyframes fadeUp": {
                      "0%": { opacity: 1, transform: "translate(-50%,-50%) scale(1)" },
                      "100%": { opacity: 0, transform: "translate(-50%,-130%) scale(1.8)" },
                    },
                  }}>{peerReaction}</Box>
                )}

                {/* Screen share badge */}
                {peerSharingScreen && (
                  <Box sx={{ position: "absolute", top: 10, right: 50 }}>
                    <Chip label="Sharing screen" size="small" color="warning" sx={{ fontSize: 11 }} />
                  </Box>
                )}

                {/* Fullscreen button */}
                <Box sx={{ position: "absolute", top: 10, right: 10 }}>
                  <IconButton size="small" onClick={toggleFullscreen}
                    sx={{ bgcolor: "rgba(0,0,0,0.5)", color: "#fff", "&:hover": { bgcolor: "rgba(0,0,0,0.75)" } }}>
                    {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
                  </IconButton>
                </Box>

                {/* Reconnecting banner */}
                {isReconnecting && (
                  <Box sx={{
                    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
                    bgcolor: "rgba(255,152,0,0.15)", backdropFilter: "blur(4px)",
                    borderBottom: "1px solid rgba(255,152,0,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 1, py: 0.75,
                  }}>
                    <CircularProgress size={14} color="warning" />
                    <Typography fontSize={13} color="warning.main">Reconnecting… please wait</Typography>
                  </Box>
                )}

                {/* Overlay: waiting / ended */}
                {!isConnected && !isReconnecting && (
                  <Box sx={{
                    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", bgcolor: "rgba(5,5,8,0.92)",
                  }}>
                    {isWaiting ? (
                      <>
                        <CircularProgress color="primary" sx={{ mb: 2 }} />
                        <Typography color="text.secondary" fontSize={14}>
                          Looking for someone{interests.length ? ` into ${interests[0]}` : ""}…
                        </Typography>
                        <Button variant="outlined" color="error" size="small"
                          onClick={execStop}
                          sx={{ mt: 2, borderRadius: 2, fontSize: 12 }}>
                          Stop Searching
                        </Button>
                      </>
                    ) : state === "ended" ? (
                      <Box textAlign="center" px={2}>
                        <Typography color="text.secondary" mb={2}>Stranger disconnected.</Typography>
                        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
                          <Button variant="contained" onClick={startSearch} sx={{ borderRadius: 2 }}>New Conversation</Button>
                          <Button variant="outlined" startIcon={<LinkIcon />} sx={{ borderRadius: 2 }}
                            onClick={async () => {
                              const r = await fetch("/api/room?create=1");
                              const { url } = await r.json();
                              navigator.clipboard.writeText(url);
                            }}>
                            Invite Friend
                          </Button>
                        </Stack>
                      </Box>
                    ) : null}
                  </Box>
                )}

                {/* Local PiP */}
                <Box sx={{
                  position: "absolute", bottom: 10, right: 10,
                  width: { xs: 80, md: 130 }, height: { xs: 56, md: 88 },
                  borderRadius: 1.5, overflow: "hidden",
                  border: "2px solid rgba(108,99,255,0.4)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.7)",
                }}>
                  <video ref={localVideoRef} autoPlay playsInline muted className={styles.localVideo} />
                </Box>
              </Box>

              {/* Video controls */}
              <Box sx={{
                flexShrink: 0, px: 1, py: 0.75,
                bgcolor: "background.paper",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", gap: 0.25, flexWrap: "wrap",
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
                      <Paper sx={{ position: "absolute", bottom: 40, left: 0, p: 0.5, zIndex: 20, minWidth: 160 }}>
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
                  <Tooltip title="Connect"><IconButton size="small" onClick={sendFriendRequest}><PersonAddIcon fontSize="small" /></IconButton></Tooltip>
                )}
                {isConnected && (
                  <Tooltip title="Report"><IconButton size="small" color="warning" onClick={() => setReportDialog(true)}><FlagIcon fontSize="small" /></IconButton></Tooltip>
                )}

                {/* Mobile: toggle chat panel */}
                {isMobile && (
                  <Button size="small" variant="outlined" onClick={() => setShowMobileChat(true)}
                    sx={{ borderRadius: 1.5, fontSize: 11, py: 0.3, ml: 0.5 }}>
                    Chat
                  </Button>
                )}
              </Box>
            </Box>
          )}

          {/* ── VOICE MODE AUDIO PANEL ── */}
          {mode === "voice" && (!isMobile || !showMobileChat) && (
            <Box sx={{
              flexShrink: 0, width: { xs: "100%", md: 260 },
              height: isMobile ? 200 : "100%",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              borderRight: { md: "1px solid rgba(255,255,255,0.07)" },
              borderBottom: { xs: "1px solid rgba(255,255,255,0.07)", md: "none" },
              bgcolor: "rgba(0,0,0,0.25)", gap: 2, py: 4, px: 2,
            }}>
              <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isConnected && (
                  <>
                    <Box sx={{
                      position: "absolute", width: 110, height: 110, borderRadius: "50%",
                      border: "2px solid rgba(108,99,255,0.35)",
                      animation: "vPulse 2s ease-in-out infinite",
                      "@keyframes vPulse": { "0%,100%": { transform: "scale(1)", opacity: 0.6 }, "50%": { transform: "scale(1.08)", opacity: 0.25 } },
                    }} />
                    <Box sx={{
                      position: "absolute", width: 130, height: 130, borderRadius: "50%",
                      border: "2px solid rgba(108,99,255,0.18)",
                      animation: "vPulse 2s 0.6s ease-in-out infinite",
                    }} />
                  </>
                )}
                <Box sx={{
                  width: 80, height: 80, borderRadius: "50%",
                  bgcolor: isConnected ? "rgba(108,99,255,0.25)" : isWaiting ? "rgba(108,99,255,0.1)" : "rgba(255,255,255,0.04)",
                  border: `2px solid ${isConnected ? "rgba(108,99,255,0.6)" : "rgba(255,255,255,0.1)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.4s",
                }}>
                  <MicIcon sx={{ fontSize: 36, color: isConnected ? "primary.main" : "text.disabled" }} />
                </Box>
              </Box>
              <Typography fontWeight={600} fontSize={15} color={isConnected ? "text.primary" : "text.secondary"}>
                {isWaiting ? "Finding someone…" : isConnected ? strangerLabel : state === "ended" ? "Call ended" : "Voice Chat"}
              </Typography>
              {isConnected && (
                <Typography variant="caption" color="text.disabled">{fmtDuration(chatDuration)}</Typography>
              )}
              {isWaiting && (
                <>
                  <CircularProgress size={18} color="primary" sx={{ mt: 0.5 }} />
                  <Button variant="outlined" color="error" size="small" onClick={execStop}
                    sx={{ mt: 1, borderRadius: 2, fontSize: 12 }}>
                    Cancel
                  </Button>
                </>
              )}
              <Stack direction="row" spacing={1} mt={1}>
                <Tooltip title={micOn ? "Mute" : "Unmute"}>
                  <IconButton onClick={toggleMic} size="small" color={micOn ? "inherit" : "error"}
                    sx={{ bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}>
                    <MicIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {isMobile && isConnected && (
                  <Button size="small" variant="outlined" onClick={() => setShowMobileChat(true)}
                    sx={{ borderRadius: 1.5, fontSize: 11, py: 0.3 }}>
                    Chat
                  </Button>
                )}
              </Stack>
            </Box>
          )}

          {/* ── CHAT PANEL ── */}
          {(!isMobile || mode === "text" || mode === "voice" || showMobileChat) && (
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

              {/* Stop / New bar */}
              <Box sx={{
                flexShrink: 0, px: { xs: 1, md: 2 }, py: 0.75,
                bgcolor: "background.paper",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap",
              }}>
                {/* Mobile back button (video mode) */}
                {isMobile && mode === "video" && showMobileChat && (
                  <Button size="small" variant="text" color="inherit"
                    onClick={() => setShowMobileChat(false)}
                    sx={{ fontSize: 12, minWidth: 0, px: 0.75 }}>
                    ← Video
                  </Button>
                )}

                {matchedInterest && (
                  <Chip label={`You both like: ${matchedInterest}`} size="small" color="primary" variant="outlined"
                    sx={{ height: 22, fontSize: 11 }} />
                )}
                {!matchedInterest && myGeo && isConnected && (
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
                    {myGeo.flag} You → {strangerLabel}
                  </Typography>
                )}

                <Box sx={{ flex: 1 }} />

                {/* Copy transcript */}
                {messages.length > 1 && (
                  <Tooltip title="Copy chat">
                    <IconButton size="small" onClick={copyTranscript}><ContentCopyIcon sx={{ fontSize: 14 }} /></IconButton>
                  </Tooltip>
                )}

                {/* Voice toggle (text mode) */}
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
                    <Button variant="contained" size="small" onClick={handleNext}
                      disabled={nextCooldown}
                      sx={{
                        borderRadius: 1.5, minWidth: 50, fontSize: 13, py: 0.4,
                        bgcolor: "#6C63FF", "&:hover": { bgcolor: "#5a52e0" },
                        "&.Mui-disabled": { bgcolor: "rgba(108,99,255,0.3)" },
                      }}>
                      New
                    </Button>
                    <Button variant="outlined" color="error" size="small" onClick={handleStop}
                      sx={{ borderRadius: 1.5, minWidth: 50, fontSize: 13, py: 0.4 }}>
                      Stop
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="contained" size="small" onClick={startSearch}
                      sx={{ borderRadius: 1.5, bgcolor: "#6C63FF", "&:hover": { bgcolor: "#5a52e0" }, fontSize: 13, py: 0.4 }}>
                      {state === "ended" ? "New Chat" : "Start"}
                    </Button>
                    {state === "ended" && messages.filter((m) => m.from !== "system").length > 0 && (
                      <Tooltip title="Download chat transcript">
                        <IconButton size="small" onClick={saveTranscript} sx={{ ml: 0.5 }}>
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </>
                )}
              </Box>

              {/* Progress bar when waiting */}
              {isWaiting && <LinearProgress color="primary" sx={{ height: 2 }} />}

              {/* Messages */}
              <Box
                ref={messagesBoxRef}
                onScroll={handleMsgScroll}
                sx={{
                  flex: 1, overflowY: "auto", px: { xs: 1.5, md: 2 }, py: settings.compactChat ? 0.75 : 1.5,
                  fontFamily: "monospace", fontSize: settings.compactChat ? 12 : { xs: 13, md: 13.5 }, lineHeight: settings.compactChat ? 1.4 : 1.75,
                  "&::-webkit-scrollbar": { width: 4 },
                  "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,0.1)", borderRadius: 2 },
                }}>

                {state === "idle" && messages.length === 0 && (
                  <Box sx={{ color: "text.disabled", fontStyle: "italic", fontSize: 13 }}>
                    <Typography variant="caption" display="block">What is MiloBolo?</Typography>
                    <Typography variant="caption" display="block">MiloBolo allows you to talk to strangers!</Typography>
                    <Typography variant="caption" display="block" mt={0.5}>Press <strong>Start</strong> to begin chatting anonymously.</Typography>
                    {interests.length > 0 && (
                      <Typography variant="caption" display="block" mt={0.5}>
                        Interests: {interests.join(", ")}
                      </Typography>
                    )}
                  </Box>
                )}

                {isWaiting && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.disabled", mb: 1 }}>
                    <CircularProgress size={12} />
                    <Typography fontSize={13} color="text.disabled">
                      Looking for someone to chat with{interests.length ? ` (${interests[0]})` : ""}…
                    </Typography>
                  </Box>
                )}

                {messages.map((m, i) => {
                  const ts = new Date(m.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
                  const prevMsg = messages[i - 1];
                  const showTs = !prevMsg || m.ts - prevMsg.ts > 60_000; // show time gap > 1 min
                  return (
                    <Box key={m.id}>
                      {showTs && m.from !== "system" && (
                        <Typography sx={{ color: "text.disabled", fontSize: 11, textAlign: "center", my: 0.75, userSelect: "none" }}>
                          {ts}
                        </Typography>
                      )}
                      <Box sx={{ mb: settings.compactChat ? 0 : 0.25, "&:hover .msg-actions": { opacity: 1 }, "&:hover .msg-ts": { opacity: 1 } }}>
                        {m.from === "system" ? (
                          <Typography sx={{ color: "text.disabled", fontStyle: "italic", fontSize: 13, userSelect: "text" }}>
                            {m.text}
                          </Typography>
                        ) : (
                          <Box sx={{ display: "flex", gap: 0.75, userSelect: "text", alignItems: "flex-start" }}>
                            <Typography component="span" sx={{
                              fontWeight: 700, flexShrink: 0, fontSize: "inherit",
                              color: m.from === "me" ? "#6C63FF" : "#FF6584",
                            }}>
                              {m.from === "me" ? "You" : strangerLabel}:
                            </Typography>
                            {m.imageUrl ? (
                              <Box component="a" href={m.imageUrl} target="_blank" rel="noopener noreferrer"
                                sx={{ flex: 1, display: "block" }}>
                                <Box component="img" src={m.imageUrl} alt="shared image"
                                  sx={{ maxWidth: 220, maxHeight: 220, borderRadius: 2, display: "block", cursor: "pointer",
                                    border: "1px solid rgba(255,255,255,0.1)", mt: 0.25 }} />
                              </Box>
                            ) : (
                            <Typography component="span" sx={{ wordBreak: "break-word", color: "text.primary", fontSize: "inherit", flex: 1 }}>
                              {m.text}
                              {m.encrypted && <LockIcon sx={{ fontSize: 9, opacity: 0.4, ml: 0.5, verticalAlign: "middle" }} />}
                            </Typography>
                            )}
                            <Typography className="msg-ts" component="span"
                              sx={{ fontSize: 10, color: "text.disabled", flexShrink: 0, alignSelf: "flex-end", opacity: 0, transition: "opacity 0.15s", pb: 0.1 }}>
                              {ts}
                            </Typography>
                            <Tooltip title="Translate message">
                              <IconButton
                                className="msg-actions"
                                size="small"
                                sx={{ opacity: 0, transition: "opacity 0.15s", flexShrink: 0, p: 0.2 }}
                                onClick={() => window.open(
                                  `https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(m.text)}&op=translate`,
                                  "_blank", "noopener,noreferrer"
                                )}
                              >
                                <Typography sx={{ fontSize: 11 }}>🌐</Typography>
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  );
                })}

                {peerTyping && (
                  <Typography sx={{ color: "text.disabled", fontStyle: "italic", fontSize: 13 }}>
                    {strangerLabel} is typing…
                  </Typography>
                )}
                <div ref={chatEndRef} />
              </Box>

              {/* Scroll-to-bottom button */}
              <Fade in={showScrollBtn}>
                <Box sx={{ position: "relative" }}>
                  <Box sx={{ position: "absolute", bottom: 8, right: 8, zIndex: 5 }}>
                    <IconButton size="small" onClick={scrollToBottom}
                      sx={{ bgcolor: "primary.main", color: "#fff", boxShadow: 3, "&:hover": { bgcolor: "primary.dark" } }}>
                      <KeyboardArrowDownIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </Fade>

              {/* Reaction bar */}
              {showReactions && isConnected && (
                <Box sx={{ px: 1.5, py: 0.75, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 0.5 }}>
                  {REACTIONS.map((e) => (
                    <IconButton key={e} size="small" onClick={() => sendReaction(e)} sx={{ fontSize: 18, p: 0.4 }}>{e}</IconButton>
                  ))}
                </Box>
              )}

              {/* Input */}
              <Box sx={{
                flexShrink: 0, px: 1, py: 0.75,
                borderTop: "1px solid rgba(255,255,255,0.07)",
                bgcolor: "background.paper",
                display: "flex", alignItems: "flex-end", gap: 0.5,
              }}>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  aria-label="Upload image"
                  className={styles.visuallyHidden}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) sendImage(f); e.target.value = ""; }}
                />
                <Tooltip title="Reactions">
                  <IconButton size="small" color={showReactions ? "primary" : "default"}
                    onClick={() => setShowReactions((v) => !v)} disabled={!isConnected}>
                    <EmojiEmotionsIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={imgUploading ? "Uploading…" : "Send image"}>
                  <span>
                    <IconButton size="small" disabled={!isConnected || imgUploading}
                      onClick={() => fileInputRef.current?.click()}>
                      {imgUploading ? <CircularProgress size={16} /> : <ImageIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
                <Box sx={{ flex: 1, position: "relative" }}>
                  <TextField
                    size="small" fullWidth multiline maxRows={isMobile ? 3 : 5}
                    placeholder={
                      !isConnected ? "Connecting…"
                      : e2eReady ? "🔒 Encrypted message…"
                      : "Type a message…"
                    }
                    value={text}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    disabled={!isConnected}
                    inputProps={{ maxLength: MAX_MSG }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: 13.5, bgcolor: "rgba(255,255,255,0.03)" } }}
                  />
                  {text.length > MAX_MSG * 0.8 && (
                    <Typography variant="caption"
                      sx={{ position: "absolute", bottom: 4, right: 10, color: text.length >= MAX_MSG ? "error.main" : "text.disabled", fontSize: 10 }}>
                      {text.length}/{MAX_MSG}
                    </Typography>
                  )}
                </Box>
                <Button variant="contained" size="small" onClick={sendMessage}
                  disabled={!isConnected || !text.trim()}
                  sx={{ borderRadius: 2, minWidth: 60, py: 0.9, bgcolor: "#6C63FF", "&:hover": { bgcolor: "#5a52e0" }, flexShrink: 0 }}>
                  <SendIcon sx={{ fontSize: 16 }} />
                </Button>
              </Box>

              {/* Keyboard hint */}
              {!isMobile && (
                <Box sx={{ px: 2, pb: 0.5, display: "flex", gap: 2 }}>
                  {[["Esc", "Stop"], ["Ctrl+↵", "New chat"]].map(([k, v]) => (
                    <Typography key={k} variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
                      <Box component="kbd" sx={{ px: 0.5, py: 0.1, borderRadius: 0.5, bgcolor: "rgba(255,255,255,0.06)", fontFamily: "monospace" }}>{k}</Box> {v}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Report dialog */}
      <Dialog open={reportDialog} onClose={() => { setReportDialog(false); setReportDetails(""); }} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "background.paper", borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <FlagIcon color="warning" fontSize="small" />
            <Typography fontWeight={700}>Report this user</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
          <Typography variant="body2" color="text.secondary">
            Reports are reviewed by our moderation team. Abusive reports may result in your account being flagged.
          </Typography>
          <Select fullWidth size="small" value={reportReason} onChange={(e) => setReportReason(e.target.value)}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}>
            <MenuItem value="inappropriate">Inappropriate content</MenuItem>
            <MenuItem value="nudity">Nudity / Sexual content</MenuItem>
            <MenuItem value="harassment">Harassment or bullying</MenuItem>
            <MenuItem value="hate_speech">Hate speech or slurs</MenuItem>
            <MenuItem value="spam">Spam or bot behavior</MenuItem>
            <MenuItem value="minor">Appears to be under 18</MenuItem>
            <MenuItem value="self_harm">Self-harm or threats</MenuItem>
            <MenuItem value="other">Other</MenuItem>
          </Select>
          <TextField
            fullWidth multiline rows={3}
            label="Additional details (optional)"
            placeholder="Describe what happened..."
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value)}
            inputProps={{ maxLength: 500 }}
            helperText={`${reportDetails.length}/500`}
            size="small"
            InputProps={{ sx: { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => { setReportDialog(false); setReportDetails(""); }}>Cancel</Button>
          <Button onClick={submitReport} color="error" variant="contained" sx={{ borderRadius: 2 }}>Submit Report</Button>
        </DialogActions>
      </Dialog>

      {/* Disconnect confirmation dialog */}
      <Dialog open={!!confirmAction} onClose={() => setConfirmAction(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: "background.paper", borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1, fontSize: 17, fontWeight: 700 }}>
          {confirmAction === "next" ? "Skip to next stranger?" : "End this conversation?"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {confirmAction === "next"
              ? "This will disconnect your current chat and find a new match."
              : "This will end the chat and return you to the home screen."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setConfirmAction(null)} sx={{ borderRadius: 2 }}>Stay</Button>
          <Button
            variant="contained" color={confirmAction === "next" ? "primary" : "error"}
            sx={{ borderRadius: 2 }}
            onClick={async () => {
              const action = confirmAction;
              setConfirmAction(null);
              if (action === "next") await execNext();
              else await execStop();
            }}>
            {confirmAction === "next" ? "Next" : "Stop"}
          </Button>
        </DialogActions>
      </Dialog>

      <FriendRequestDialog
        open={friendReq.open}
        fromName={friendReq.fromName}
        fromUserId={friendReq.fromUserId}
        onAccept={() => respondFriendRequest(true)}
        onDecline={() => respondFriendRequest(false)}
      />

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack("")}
        message={snack} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />

      <FloatingToolbar />
    </>
  );
}

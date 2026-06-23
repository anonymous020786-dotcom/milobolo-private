import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Paper, Typography, Button, TextField, Stack,
  Chip, CircularProgress, Snackbar, IconButton, Collapse,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ChatIcon from "@mui/icons-material/Chat";
import { io, Socket } from "socket.io-client";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";

type SpyState = "idle" | "waiting" | "active" | "ended";
type SpyRole = "spy" | "chatter_a" | "chatter_b" | null;

interface Message {
  id: string;
  sender: "spy" | "stranger_1" | "stranger_2" | "system";
  text: string;
  ts: number;
}

const QUESTION_CATEGORIES: Record<string, string[]> = {
  "Philosophy": [
    "Is it ever okay to lie to protect someone's feelings?",
    "Does free will actually exist?",
    "Is it better to be feared or respected?",
    "What is more important — intelligence or kindness?",
    "Is morality objective or subjective?",
    "Can a truly evil person ever become good?",
  ],
  "Society": [
    "Is social media making people more lonely or more connected?",
    "Should college education be free?",
    "Is cancel culture good or bad for society?",
    "Do we rely too much on technology?",
    "Should voting be mandatory?",
    "Is nationalism a force for good or bad?",
  ],
  "Life & Values": [
    "Would you rather be rich and unhappy or poor and happy?",
    "Does money buy happiness?",
    "Is technology making humans less creative?",
    "What defines a successful life?",
    "Is it selfish to prioritise yourself over others?",
    "Should you follow your passion or follow the money?",
  ],
  "Relationships": [
    "Can men and women just be friends?",
    "Is jealousy a sign of love or insecurity?",
    "Should couples share all passwords?",
    "Is online friendship as real as in-person friendship?",
    "Can you truly love someone you've never met in person?",
    "Is it better to be honest or kind when giving feedback?",
  ],
  "Fun & Hypothetical": [
    "If you could live anywhere in the world, where would it be?",
    "Would you rather be able to fly or be invisible?",
    "If you could have dinner with anyone in history, who would it be?",
    "Would you rather know when you'll die or how you'll die?",
    "If money was no object, what would you do all day?",
    "What superpower would be most useful in everyday life?",
  ],
};

const ALL_QUESTIONS = Object.values(QUESTION_CATEGORIES).flat();
const SAMPLE_QUESTIONS = ALL_QUESTIONS.slice(0, 8);

export default function SpyPage() {
  const router = useRouter();
  const [role, setRole] = useState<"spy" | "chatter" | null>(null);
  const [questionCat, setQuestionCat] = useState<string>("Philosophy");
  const [question, setQuestion] = useState("");
  const [spyState, setSpyState] = useState<SpyState>("idle");
  const [spyRole, setSpyRole] = useState<SpyRole>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [roomId, setRoomId] = useState("");
  const [peerTyping, setPeerTyping] = useState<string | null>(null);
  const [snack, setSnack] = useState("");

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const roomIdRef = useRef("");

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SIGNALING_URL || "", { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("waiting", () => setSpyState("waiting"));

    socket.on("spy_match_found", ({ roomId: rid, question: q, role: r }) => {
      setRoomId(rid);
      roomIdRef.current = rid;
      setSpyRole(r);
      setSpyState("active");
      setMessages([{
        id: "sys-0", sender: "system", ts: Date.now(),
        text: r === "spy"
          ? `You are watching two strangers discuss: "${q}"`
          : `A spy wants you to discuss: "${q}"`,
      }]);
    });

    socket.on("message", ({ from, text: t, ts, senderRole }) => {
      setMessages((prev) => [...prev, {
        id: `${ts}-${Math.random()}`,
        sender: senderRole || "stranger_1",
        text: t, ts,
      }]);
    });

    socket.on("typing", ({ typing, senderRole }) => {
      setPeerTyping(typing ? (senderRole === "chatter_a" ? "Stranger 1" : "Stranger 2") : null);
    });

    socket.on("peer_left", () => {
      setSpyState("ended");
      setMessages((prev) => [...prev, {
        id: "sys-end", sender: "system", ts: Date.now(),
        text: spyRole === "spy" ? "A stranger disconnected. The discussion has ended." : "The other stranger disconnected.",
      }]);
    });

    socket.on("spy_ended", () => {
      setSpyState("ended");
      setMessages((prev) => [...prev, {
        id: "sys-spy", sender: "system", ts: Date.now(),
        text: "The spy has left.",
      }]);
    });

    return () => { socket.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startAsSpy = () => {
    if (!question.trim()) return setSnack("Enter a question first.");
    setRole("spy");
    setSpyState("waiting");
    socketRef.current?.emit("find_spy_match", { role: "spy", question: question.trim() });
  };

  const startAsChatter = () => {
    setRole("chatter");
    setSpyState("waiting");
    socketRef.current?.emit("find_spy_match", { role: "chatter" });
  };

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTypingChange = useCallback((val: string) => {
    setText(val);
    if (spyRole === "spy" || !roomId) return;
    socketRef.current?.emit("typing", { roomId, typing: true, senderRole: spyRole });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit("typing", { roomId, typing: false, senderRole: spyRole });
    }, 1500);
  }, [roomId, spyRole]);

  const sendMessage = useCallback(() => {
    if (!text.trim() || !roomId || spyRole === "spy") return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    socketRef.current?.emit("typing", { roomId, typing: false, senderRole: spyRole });
    socketRef.current?.emit("message", {
      roomId,
      plain: text.trim(),
      encrypted: false,
      senderRole: spyRole,
    });
    setMessages((prev): Message[] => [...prev, {
      id: `${Date.now()}-me`, sender: (spyRole ?? "chatter_a") as Message["sender"],
      text: text.trim(), ts: Date.now(),
    }]);
    setText("");
  }, [text, roomId, spyRole]);

  const handleNext = () => {
    socketRef.current?.emit("next");
    setSpyState("idle");
    setRole(null);
    setMessages([]);
    setRoomId(""); roomIdRef.current = "";
    setSpyRole(null);
  };

  const getSenderLabel = (sender: string) => {
    if (sender === "system") return null;
    if (sender === "spy") return "Spy (question asker)";
    if (sender === "chatter_a") return "Stranger 1";
    if (sender === "chatter_b") return "Stranger 2";
    return "Stranger";
  };

  const getSenderColor = (sender: string) => {
    if (sender === "chatter_a") return "#6C63FF";
    if (sender === "chatter_b") return "#FF6584";
    return "#888";
  };

  const myRole = spyRole;
  const isMyMessage = (sender: string) => sender === myRole;

  return (
    <Layout title="Spy Mode">
      <SeoHead title="Spy / Question Mode" description="Ask a question and watch two strangers debate it — or join as a stranger and discuss a question live. Free, anonymous spy mode on MiloBolo." path="/spy" />
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
        {/* Header */}
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Chip icon={<VisibilityIcon />} label="Spy / Question Mode" color="primary" sx={{ mb: 2 }} />
          <Typography variant="h4" fontWeight={800} mb={1}>Question Mode</Typography>
          <Typography color="text.secondary" maxWidth={480} mx="auto">
            Ask a question and watch two strangers debate it — or join as a stranger and discuss someone's question live.
          </Typography>
        </Box>

        {/* Role selector */}
        {spyState === "idle" && (
          <Stack spacing={3}>
            <Paper sx={{ p: 3, borderRadius: 3, border: "1px solid rgba(108,99,255,0.2)" }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                <VisibilityIcon color="primary" />
                <Typography fontWeight={700} fontSize={17}>Ask a Question — Be the Spy</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Type a question and watch two random strangers discuss it. You can read everything but you cannot type.
              </Typography>
              <TextField
                fullWidth multiline rows={2}
                placeholder="Enter your question…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
              {/* Category + sample questions */}
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" gap={0.75} mb={1.5}>
                  {Object.keys(QUESTION_CATEGORIES).map((cat) => (
                    <Chip
                      key={cat} label={cat} size="small"
                      onClick={() => setQuestionCat(cat)}
                      color={questionCat === cat ? "primary" : "default"}
                      variant={questionCat === cat ? "filled" : "outlined"}
                      sx={{ cursor: "pointer", fontSize: 11 }}
                    />
                  ))}
                </Stack>
                <Collapse in={!!questionCat}>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                    {(QUESTION_CATEGORIES[questionCat] || []).map((q) => (
                      <Chip
                        key={q} label={q} size="small" variant="outlined"
                        onClick={() => setQuestion(q)}
                        sx={{
                          fontSize: 11, cursor: "pointer", maxWidth: "100%",
                          height: "auto", "& .MuiChip-label": { whiteSpace: "normal", py: 0.5 },
                          "&:hover": { bgcolor: "rgba(108,99,255,0.1)" },
                          borderColor: question === q ? "primary.main" : undefined,
                          bgcolor: question === q ? "rgba(108,99,255,0.15)" : undefined,
                        }}
                      />
                    ))}
                  </Box>
                </Collapse>
              </Box>
              <Button fullWidth variant="contained" size="large" startIcon={<VisibilityIcon />}
                onClick={startAsSpy} sx={{ borderRadius: 2, py: 1.4 }}>
                Spy on Two Strangers
              </Button>
            </Paper>

            <Paper sx={{ p: 3, borderRadius: 3, border: "1px solid rgba(255,101,132,0.2)" }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={1}>
                <ChatIcon sx={{ color: "#FF6584" }} />
                <Typography fontWeight={700} fontSize={17}>Join as a Stranger — Have a Discussion</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Get paired with another stranger and discuss a question submitted by a spy. They watch but can't type.
              </Typography>
              <Button fullWidth variant="outlined" size="large" startIcon={<ChatIcon />}
                onClick={startAsChatter}
                sx={{ borderRadius: 2, py: 1.4, borderColor: "rgba(255,101,132,0.4)",
                  "&:hover": { borderColor: "#FF6584", bgcolor: "rgba(255,101,132,0.06)" } }}>
                Join as a Stranger
              </Button>
            </Paper>

            <Button variant="text" color="inherit" onClick={() => router.push("/")} sx={{ alignSelf: "center" }}>
              ← Back to Home
            </Button>
          </Stack>
        )}

        {/* Waiting */}
        {spyState === "waiting" && (
          <Box sx={{ textAlign: "center", py: 10 }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography color="text.secondary">
              {role === "spy" ? "Waiting for two strangers to discuss your question…" : "Waiting to be matched with another stranger…"}
            </Typography>
            <Button variant="outlined" color="error" sx={{ mt: 3 }} onClick={handleNext}>Cancel</Button>
          </Box>
        )}

        {/* Active chat */}
        {(spyState === "active" || spyState === "ended") && (
          <Paper sx={{ borderRadius: 3, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 500 }}>
            {/* Header */}
            <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid rgba(255,255,255,0.07)",
              display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: "50%",
                bgcolor: spyState === "active" ? "success.main" : "text.disabled" }} />
              <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                {spyRole === "spy" ? "👁️ Watching live discussion" : "💬 Discussion in progress"}
              </Typography>
              {spyState === "active" && (
                <Chip label={spyRole === "spy" ? "Spy" : spyRole === "chatter_a" ? "Stranger 1" : "Stranger 2"}
                  size="small" color="primary" />
              )}
            </Box>

            {/* Messages */}
            <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
              {messages.map((m) => (
                <Box key={m.id} sx={{
                  alignSelf: m.sender === "system" ? "center"
                    : isMyMessage(m.sender) ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                }}>
                  {m.sender === "system" ? (
                    <Typography variant="caption" color="text.secondary"
                      sx={{ bgcolor: "rgba(108,99,255,0.08)", px: 2, py: 0.75, borderRadius: 10, display: "block", textAlign: "center" }}>
                      {m.text}
                    </Typography>
                  ) : (
                    <Box>
                      {!isMyMessage(m.sender) && (
                        <Typography variant="caption" sx={{ pl: 1, mb: 0.25, display: "block", color: getSenderColor(m.sender) }}>
                          {getSenderLabel(m.sender)}
                        </Typography>
                      )}
                      <Box sx={{
                        bgcolor: isMyMessage(m.sender) ? "primary.main" : "rgba(255,255,255,0.07)",
                        px: 1.5, py: 1,
                        borderRadius: isMyMessage(m.sender) ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        border: isMyMessage(m.sender) ? "none" : `1px solid ${getSenderColor(m.sender)}33`,
                      }}>
                        <Typography variant="body2" sx={{ wordBreak: "break-word" }}>{m.text}</Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              ))}

              {peerTyping && (
                <Typography variant="caption" color="text.disabled" sx={{ pl: 1 }}>
                  {peerTyping} is typing…
                </Typography>
              )}
              <div ref={chatEndRef} />
            </Box>

            {/* Input — only chatters can type */}
            <Box sx={{ p: 1.5, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              {spyRole === "spy" ? (
                <Typography variant="body2" color="text.disabled" textAlign="center" py={0.5}>
                  👁️ You are watching. Spies cannot send messages.
                </Typography>
              ) : spyState === "ended" ? (
                <Button fullWidth variant="contained" startIcon={<SkipNextIcon />} onClick={handleNext}
                  sx={{ borderRadius: 2 }}>
                  Start New Discussion
                </Button>
              ) : (
                <Stack direction="row" spacing={0.5} alignItems="flex-end">
                  <TextField
                    fullWidth size="small" multiline maxRows={3}
                    placeholder="Type your response…"
                    value={text}
                    onChange={(e) => handleTypingChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3 } }}
                  />
                  <IconButton color="primary" onClick={sendMessage} disabled={!text.trim()}>
                    <SendIcon />
                  </IconButton>
                </Stack>
              )}
            </Box>
          </Paper>
        )}
      </Container>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack("")}
        message={snack} anchorOrigin={{ vertical: "bottom", horizontal: "center" }} />
    </Layout>
  );
}

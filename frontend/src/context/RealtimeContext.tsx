import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useRouter } from "next/router";
import {
  Avatar, Button, Dialog, DialogActions, DialogContent, Snackbar, Stack, Typography,
} from "@mui/material";
import { Socket } from "socket.io-client";
import { useAuth } from "@/context/AuthContext";
import { createSignalSocket } from "@/lib/socket";
import { supabase } from "@/lib/supabase";

interface PublicUser { id: string; name: string; avatar: string | null }
interface IncomingCall { token: string; mode: "video" | "voice"; from: PublicUser }

interface RealtimeValue {
  socket: Socket | null;
  connected: boolean;
  onlineFriends: Set<string>;
  unreadNotifications: number;
  refreshNotifications: () => void;
  refreshPresence: () => void;
  callFriend: (friendId: string, mode?: "video" | "voice") => Promise<void>;
}

const RealtimeContext = createContext<RealtimeValue>({
  socket: null, connected: false, onlineFriends: new Set(), unreadNotifications: 0,
  refreshNotifications: () => {}, refreshPresence: () => {}, callFriend: async () => {},
});

// Keeps a lightweight "presence" socket open for signed-in users on every page:
// friends online, incoming friend calls, DM toasts and the notification badge.
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineFriends, setOnlineFriends] = useState<Set<string>>(new Set());
  const [unread, setUnread] = useState(0);
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const [toast, setToast] = useState<{ text: string; href?: string } | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;

  const refreshNotifications = useCallback(async () => {
    if (!user) { setUnread(0); return; }
    const { count } = await supabase.from("notifications")
      .select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("read", false);
    setUnread(count || 0);
  }, [user]);

  const refreshPresence = useCallback(() => {
    socket?.emit("presence_query", {}, ({ online }: { online: string[] }) => setOnlineFriends(new Set(online)));
  }, [socket]);

  useEffect(() => {
    if (!user) { setSocket(null); setOnlineFriends(new Set()); return; }
    const s = createSignalSocket({ presence: true });
    setSocket(s);

    s.on("connect", () => {
      setConnected(true);
      s.emit("presence_query", {}, ({ online }: { online: string[] }) => setOnlineFriends(new Set(online)));
    });
    s.on("disconnect", () => setConnected(false));
    s.on("presence_update", ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineFriends((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId); else next.delete(userId);
        return next;
      });
    });
    s.on("incoming_call", (call: IncomingCall) => setIncoming(call));
    s.on("call_response", ({ accepted, by }: { accepted: boolean; by: PublicUser }) => {
      if (!accepted) setToast({ text: `${by.name} declined the call.` });
    });
    s.on("dm", ({ message, from }: { message: { sender_id: string; body: string }; from: PublicUser }) => {
      if (message.sender_id === user.id) return;
      const onThread = routerRef.current.pathname === "/messages" && routerRef.current.query.with === message.sender_id;
      if (!onThread) setToast({ text: `💬 ${from.name}: ${message.body.slice(0, 80)}`, href: `/messages?with=${message.sender_id}` });
      setUnread((n) => n + (onThread ? 0 : 1));
    });
    s.on("announcement", ({ message }: { message: string }) => setToast({ text: `📣 ${message}` }));

    return () => { s.disconnect(); setSocket(null); setConnected(false); };
  }, [user]);

  useEffect(() => {
    refreshNotifications();
    if (!user) return;
    const id = setInterval(refreshNotifications, 60_000);
    window.addEventListener("focus", refreshNotifications);
    return () => { clearInterval(id); window.removeEventListener("focus", refreshNotifications); };
  }, [user, refreshNotifications]);

  // Auto-dismiss an unanswered call after 45 s
  useEffect(() => {
    if (!incoming) return;
    const t = setTimeout(() => setIncoming(null), 45_000);
    return () => clearTimeout(t);
  }, [incoming]);

  const callFriend = useCallback(async (friendId: string, mode: "video" | "voice" = "video") => {
    if (!socket) throw new Error("Not connected");
    const res: { token?: string; mode?: string; error?: string } =
      await new Promise((resolve) => socket.emit("friend_call", { to: friendId, mode }, resolve));
    if (res.error || !res.token) throw new Error(res.error || "Call failed");
    router.push(`/chat?mode=${res.mode}&invite=${res.token}`);
  }, [socket, router]);

  const answer = (accepted: boolean) => {
    if (!incoming || !socket) return;
    socket.emit("call_response", { to: incoming.from.id, token: incoming.token, accepted });
    const call = incoming;
    setIncoming(null);
    if (accepted) router.push(`/chat?mode=${call.mode}&invite=${call.token}`);
  };

  return (
    <RealtimeContext.Provider value={{
      socket, connected, onlineFriends, unreadNotifications: unread,
      refreshNotifications, refreshPresence, callFriend,
    }}>
      {children}

      <Dialog open={!!incoming} onClose={() => answer(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, textAlign: "center" } }}>
        <DialogContent sx={{ pt: 4 }}>
          <Stack alignItems="center" spacing={1.5}>
            <Avatar src={incoming?.from.avatar || undefined} sx={{ width: 72, height: 72, fontSize: 28 }}>
              {incoming?.from.name?.[0]?.toUpperCase()}
            </Avatar>
            <Typography fontWeight={700} fontSize={18}>{incoming?.from.name}</Typography>
            <Typography color="text.secondary" fontSize={14}>
              is {incoming?.mode === "voice" ? "voice" : "video"} calling you…
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 3, gap: 1 }}>
          <Button variant="outlined" color="error" onClick={() => answer(false)} sx={{ borderRadius: 2 }}>Decline</Button>
          <Button variant="contained" color="success" onClick={() => answer(true)} sx={{ borderRadius: 2 }}>Accept</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        message={toast?.text}
        action={toast?.href ? (
          <Button size="small" color="primary" onClick={() => { router.push(toast.href!); setToast(null); }}>Open</Button>
        ) : undefined} />
    </RealtimeContext.Provider>
  );
}

export const useRealtime = () => useContext(RealtimeContext);

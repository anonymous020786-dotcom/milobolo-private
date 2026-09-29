import { useState } from "react";
import { useRouter } from "next/router";
import {
  Badge, Box, Button, CircularProgress, Divider, IconButton, List, ListItemButton,
  ListItemText, Popover, Stack, Tooltip, Typography,
} from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useRealtime } from "@/context/RealtimeContext";

interface Notification {
  id: string;
  type: "friend_request" | "friend_accepted" | "dm" | "system";
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

const ICON: Record<Notification["type"], string> = { friend_request: "👋", friend_accepted: "🤝", dm: "💬", system: "📣" };

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const { unreadNotifications, refreshNotifications } = useRealtime();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const open = async (el: HTMLElement) => {
    setAnchor(el);
    setLoading(true);
    const { data } = await supabase.from("notifications")
      .select("id, type, title, body, link, read, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    setItems((data as Notification[]) || []);
    setLoading(false);
  };

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    refreshNotifications();
  };

  const openItem = async (n: Notification) => {
    if (!n.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
      refreshNotifications();
    }
    setAnchor(null);
    if (n.link && n.link.startsWith("/")) router.push(n.link);
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton onClick={(e) => open(e.currentTarget)} color="inherit" aria-label={`Notifications (${unreadNotifications} unread)`}>
          <Badge badgeContent={unreadNotifications || undefined} color="error" max={9}>
            <NotificationsIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }} transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { width: 340, maxWidth: "calc(100vw - 32px)", borderRadius: 2 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" px={2} py={1.25}>
          <Typography fontWeight={700}>Notifications</Typography>
          {items.some((n) => !n.read) && <Button size="small" onClick={markAllRead}>Mark all read</Button>}
        </Stack>
        <Divider />
        {loading ? (
          <Box textAlign="center" py={3}><CircularProgress size={20} /></Box>
        ) : items.length === 0 ? (
          <Typography color="text.secondary" fontSize={14} textAlign="center" py={4}>You're all caught up.</Typography>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 400, overflowY: "auto" }}>
            {items.map((n) => (
              <ListItemButton key={n.id} onClick={() => openItem(n)}
                sx={{ alignItems: "flex-start", bgcolor: n.read ? undefined : "rgba(108,99,255,0.08)", gap: 1.25 }}>
                <Typography fontSize={18} lineHeight={1.4}>{ICON[n.type]}</Typography>
                <ListItemText
                  primary={n.title}
                  secondary={<>{n.body ? `${n.body} · ` : ""}{timeAgo(n.created_at)}</>}
                  primaryTypographyProps={{ fontSize: 13.5, fontWeight: n.read ? 400 : 600 }}
                  secondaryTypographyProps={{ fontSize: 12, noWrap: true }} />
              </ListItemButton>
            ))}
          </List>
        )}
      </Popover>
    </>
  );
}

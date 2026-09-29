import { memo, useState } from "react";
import { Box, Typography, IconButton, Tooltip, Popover } from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import ReplyIcon from "@mui/icons-material/Reply";
import AddReactionOutlinedIcon from "@mui/icons-material/AddReactionOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DoneIcon from "@mui/icons-material/Done";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import { renderRichText } from "@/lib/richText";

export const MESSAGE_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
export const UNSEND_WINDOW_MS = 2 * 60_000;

export interface ReplyRef { id: string; text: string; from: "me" | "peer" }

export interface ChatMsg {
  id: string;
  from: "me" | "peer" | "system";
  text: string;
  ts: number;
  encrypted: boolean;
  imageUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  replyTo?: ReplyRef | null;
  deleted?: boolean;
  seen?: boolean;
  reactions?: { me?: string | null; peer?: string | null };
}

interface Props {
  m: ChatMsg;
  strangerLabel: string;
  hideLinks: boolean;
  showTime: boolean;
  compact: boolean;
  canInteract: boolean;
  onReply: (m: ChatMsg) => void;
  onReact: (m: ChatMsg, emoji: string | null) => void;
  onUnsend: (m: ChatMsg) => void;
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function ChatMessageInner({ m, strangerLabel, hideLinks, showTime, compact, canInteract, onReply, onReact, onUnsend }: Props) {
  const [reactAnchor, setReactAnchor] = useState<HTMLElement | null>(null);
  const mine = m.from === "me";
  const ts = fmtTime(m.ts);

  if (m.from === "system") {
    return (
      <Typography sx={{ color: "text.disabled", fontStyle: "italic", fontSize: 13, userSelect: "text", my: 0.25 }}>
        {m.text}
      </Typography>
    );
  }

  const canUnsend = mine && !m.deleted && canInteract && Date.now() - m.ts < UNSEND_WINDOW_MS;
  const reactionChips = [m.reactions?.peer, m.reactions?.me].filter(Boolean) as string[];

  return (
    <Box>
      {showTime && (
        <Typography sx={{ color: "text.disabled", fontSize: 11, textAlign: "center", my: 0.75, userSelect: "none" }}>{ts}</Typography>
      )}
      <Box sx={{ mb: compact ? 0 : 0.25, "&:hover .msg-actions": { opacity: 1 }, "&:hover .msg-ts": { opacity: 1 } }}>
        {m.replyTo && !m.deleted && (
          <Box sx={{ ml: 2, pl: 1, borderLeft: "2px solid rgba(108,99,255,0.5)", color: "text.disabled", fontSize: 12, mb: 0.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            ↪ {m.replyTo.from === "me" ? "You" : strangerLabel}: {m.replyTo.text || "[media]"}
          </Box>
        )}
        <Box sx={{ display: "flex", gap: 0.75, userSelect: "text", alignItems: "flex-start" }}>
          <Typography component="span" sx={{ fontWeight: 700, flexShrink: 0, fontSize: "inherit", color: mine ? "#6C63FF" : "#FF6584" }}>
            {mine ? "You" : strangerLabel}:
          </Typography>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {m.deleted ? (
              <Typography component="span" sx={{ fontStyle: "italic", color: "text.disabled", fontSize: "inherit" }}>
                {mine ? "You unsent a message" : "Message unsent"}
              </Typography>
            ) : m.imageUrl ? (
              <Box component="a" href={m.imageUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "block" }}>
                <Box component="img" src={m.imageUrl} alt="shared image"
                  sx={{ maxWidth: 220, maxHeight: 220, borderRadius: 2, display: "block", cursor: "pointer", border: "1px solid rgba(255,255,255,0.1)", mt: 0.25 }} />
              </Box>
            ) : m.audioUrl ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box component="audio" controls src={m.audioUrl} preload="metadata" sx={{ height: 32, maxWidth: 240 }} />
                {m.audioDuration ? <Typography variant="caption" color="text.disabled">{Math.round(m.audioDuration)}s</Typography> : null}
              </Box>
            ) : (
              <Typography component="span" sx={{ wordBreak: "break-word", color: "text.primary", fontSize: "inherit", whiteSpace: "pre-wrap" }}>
                {renderRichText(m.text, { hideLinks: hideLinks && !mine })}
                {m.encrypted && <LockIcon sx={{ fontSize: 9, opacity: 0.4, ml: 0.5, verticalAlign: "middle" }} />}
              </Typography>
            )}
            {reactionChips.length > 0 && !m.deleted && (
              <Box sx={{ display: "inline-flex", gap: 0.25, ml: 0.5, px: 0.5, borderRadius: 2, bgcolor: "rgba(255,255,255,0.06)", fontSize: 13, verticalAlign: "middle" }}>
                {reactionChips.map((e, i) => <span key={i}>{e}</span>)}
              </Box>
            )}
          </Box>

          {mine && !m.deleted && (
            <Tooltip title={m.seen ? "Seen" : "Delivered"}>
              {m.seen
                ? <DoneAllIcon sx={{ fontSize: 13, color: "primary.light", flexShrink: 0, mt: 0.4 }} />
                : <DoneIcon sx={{ fontSize: 13, color: "text.disabled", flexShrink: 0, mt: 0.4 }} />}
            </Tooltip>
          )}

          <Typography className="msg-ts" component="span"
            sx={{ fontSize: 10, color: "text.disabled", flexShrink: 0, alignSelf: "flex-end", opacity: 0, transition: "opacity 0.15s", pb: 0.1 }}>
            {ts}
          </Typography>

          {!m.deleted && canInteract && (
            <Box className="msg-actions" sx={{ display: "flex", opacity: 0, transition: "opacity 0.15s", flexShrink: 0 }}>
              <Tooltip title="Reply">
                <IconButton size="small" sx={{ p: 0.2 }} onClick={() => onReply(m)} aria-label="Reply">
                  <ReplyIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="React">
                <IconButton size="small" sx={{ p: 0.2 }} onClick={(e) => setReactAnchor(e.currentTarget)} aria-label="React">
                  <AddReactionOutlinedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              {canUnsend && (
                <Tooltip title="Unsend (within 2 minutes)">
                  <IconButton size="small" sx={{ p: 0.2 }} onClick={() => onUnsend(m)} aria-label="Unsend">
                    <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              )}
              {!mine && m.text && (
                <Tooltip title="Translate message">
                  <IconButton size="small" sx={{ p: 0.2 }} aria-label="Translate"
                    onClick={() => window.open(`https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(m.text)}&op=translate`, "_blank", "noopener,noreferrer")}>
                    <Typography sx={{ fontSize: 11 }}>🌐</Typography>
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>
      </Box>

      <Popover open={!!reactAnchor} anchorEl={reactAnchor} onClose={() => setReactAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }} transformOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Box sx={{ display: "flex", p: 0.5 }}>
          {MESSAGE_REACTIONS.map((e) => (
            <IconButton key={e} size="small" sx={{ fontSize: 18, bgcolor: m.reactions?.me === e ? "rgba(108,99,255,0.2)" : undefined }}
              onClick={() => { onReact(m, m.reactions?.me === e ? null : e); setReactAnchor(null); }}>
              {e}
            </IconButton>
          ))}
        </Box>
      </Popover>
    </Box>
  );
}

const ChatMessage = memo(ChatMessageInner);
export default ChatMessage;

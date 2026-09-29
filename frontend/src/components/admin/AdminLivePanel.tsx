import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, Grid, MenuItem, Select, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import { signalFetch } from "@/lib/socket";
import { supabase } from "@/lib/supabase";

interface LiveStats {
  online: number;
  signedIn: number;
  connections: number;
  waitingByMode: Record<string, number>;
  activeRooms: number;
  roomsByMode: Record<string, number>;
  matchesLastHour: number;
  matchesLast5Min: number;
  avgWaitByMode: Record<string, number | null>;
  bannedFingerprints: number;
  uptimeSeconds: number;
  redis: string;
}

interface DailyStat {
  date: string;
  total_sessions: number;
  video_sessions: number;
  text_sessions: number;
  voice_sessions: number | null;
  total_duration_seconds: number | null;
  unique_users: number;
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminLivePanel({ canBroadcast, adminId }: { canBroadcast: boolean; adminId: string }) {
  const [live, setLive] = useState<LiveStats | null>(null);
  const [error, setError] = useState("");
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [message, setMessage] = useState("");
  const [level, setLevel] = useState("info");
  const [sent, setSent] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await signalFetch("/api/admin/live");
        if (alive) { setLive(data); setError(""); }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Signaling server unreachable");
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  useEffect(() => {
    supabase.from("chat_stats").select("*").order("date", { ascending: false }).limit(14)
      .then(({ data }) => setDaily((data as DailyStat[]) || []));
  }, []);

  const broadcast = async () => {
    setSent("");
    try {
      const res = await signalFetch("/api/admin/broadcast", { method: "POST", body: JSON.stringify({ message: message.trim(), level }) });
      setSent(`Delivered to ${res.delivered} connected client${res.delivered === 1 ? "" : "s"}.`);
      setMessage("");
      await supabase.from("admin_logs").insert({ admin_id: adminId, action: "broadcast_ui", target_type: "all", metadata: { message, level } });
    } catch (e) {
      setSent(e instanceof Error ? `Failed: ${e.message}` : "Failed");
    }
  };

  const tiles = live ? [
    { label: "Online now", value: live.online, sub: `${live.signedIn} signed in` },
    { label: "Active chats", value: live.activeRooms, sub: Object.entries(live.roomsByMode).map(([k, v]) => `${k} ${v}`).join(" · ") || "—" },
    { label: "Matches (1h)", value: live.matchesLastHour, sub: `${live.matchesLast5Min} in last 5 min` },
    { label: "Server uptime", value: fmtUptime(live.uptimeSeconds), sub: `Redis ${live.redis}` },
  ] : [];

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>Live stats unavailable: {error}</Alert>}

      <Grid container spacing={2} mb={3}>
        {tiles.map((t) => (
          <Grid item xs={6} md={3} key={t.label}>
            <Card><CardContent>
              <Typography fontSize={28} fontWeight={800} sx={{ fontVariantNumeric: "tabular-nums" }}>{t.value}</Typography>
              <Typography fontSize={13} color="text.secondary">{t.label}</Typography>
              <Typography fontSize={11.5} color="text.disabled" noWrap>{t.sub}</Typography>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>

      {live && (
        <Card sx={{ mb: 3 }}><CardContent>
          <Typography fontWeight={700} mb={1.5}>Queues</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Object.entries(live.waitingByMode).map(([mode, n]) => (
              <Chip key={mode} variant="outlined" color={n > 0 ? "primary" : "default"}
                label={`${mode}: ${n} waiting${live.avgWaitByMode[mode] != null ? ` · ~${live.avgWaitByMode[mode]}s` : ""}`} />
            ))}
          </Stack>
          <Typography fontSize={12} color="text.disabled" mt={1.5}>
            {live.bannedFingerprints} fingerprint bans active · refreshes every 5 s
          </Typography>
        </CardContent></Card>
      )}

      {canBroadcast && (
        <Card sx={{ mb: 3 }}><CardContent>
          <Typography fontWeight={700} mb={1.5} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CampaignIcon fontSize="small" /> Broadcast announcement
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField size="small" fullWidth placeholder="e.g. Scheduled maintenance at 2 AM IST for 10 minutes"
              value={message} onChange={(e) => setMessage(e.target.value.slice(0, 300))} />
            <Select size="small" value={level} onChange={(e) => setLevel(e.target.value)} sx={{ minWidth: 120 }}>
              <MenuItem value="info">Info</MenuItem>
              <MenuItem value="warning">Warning</MenuItem>
              <MenuItem value="success">Success</MenuItem>
            </Select>
            <Button variant="contained" disabled={!message.trim()} onClick={broadcast}>Send</Button>
          </Stack>
          <Typography fontSize={12} color="text.disabled" mt={1}>
            Shown instantly to everyone currently connected (chat pages show a banner, other pages a toast).
          </Typography>
          {sent && <Typography fontSize={13} mt={1} color={sent.startsWith("Failed") ? "error.main" : "success.main"}>{sent}</Typography>}
        </CardContent></Card>
      )}

      <Card><CardContent>
        <Typography fontWeight={700} mb={1.5}>Last 14 days</Typography>
        {daily.length === 0 ? (
          <Typography fontSize={13} color="text.secondary">No daily stats recorded yet — they are written by the signaling server every minute.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>Date</TableCell><TableCell align="right">Chats</TableCell><TableCell align="right">Video</TableCell>
                <TableCell align="right">Text</TableCell><TableCell align="right">Voice</TableCell><TableCell align="right">Avg length</TableCell>
                <TableCell align="right">Peak signed-in</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {daily.map((d) => (
                  <TableRow key={d.date}>
                    <TableCell>{d.date}</TableCell>
                    <TableCell align="right">{d.total_sessions}</TableCell>
                    <TableCell align="right">{d.video_sessions}</TableCell>
                    <TableCell align="right">{d.text_sessions}</TableCell>
                    <TableCell align="right">{d.voice_sessions ?? 0}</TableCell>
                    <TableCell align="right">{d.total_sessions ? `${Math.round((d.total_duration_seconds || 0) / d.total_sessions / 60 * 10) / 10}m` : "—"}</TableCell>
                    <TableCell align="right">{d.unique_users}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </CardContent></Card>
    </Box>
  );
}

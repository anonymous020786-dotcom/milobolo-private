import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import {
  Box, Container, Typography, Card, CardContent, Chip, Stack,
  CircularProgress, IconButton, Tooltip, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  TextField, InputAdornment, ToggleButton, ToggleButtonGroup,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ChatIcon from "@mui/icons-material/Chat";
import VideocamIcon from "@mui/icons-material/Videocam";
import SearchIcon from "@mui/icons-material/Search";
import Layout from "@/components/Layout";
import SeoHead from "@/components/SeoHead";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

interface ChatRecord {
  id: string;
  mode: string;
  duration_seconds: number;
  message_count: number;
  matched_interest: string | null;
  started_at: string;
  ended_at: string | null;
}

export default function ChatHistory() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [records, setRecords] = useState<ChatRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, totalTime: 0, videoChats: 0, textChats: 0 });
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "video" | "text">("all");

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login?next=/history");
  }, [user, authLoading]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("chat_history")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (data) {
          setRecords(data);
          setStats({
            total: data.length,
            totalTime: data.reduce((a, r) => a + (r.duration_seconds || 0), 0),
            videoChats: data.filter((r) => r.mode === "video").length,
            textChats: data.filter((r) => r.mode === "text").length,
          });
        }
        setLoading(false);
      });
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter((r) => {
      const matchMode = modeFilter === "all" || r.mode === modeFilter;
      const matchSearch = !q || (r.matched_interest || "").toLowerCase().includes(q);
      return matchMode && matchSearch;
    });
  }, [records, search, modeFilter]);

  const deleteRecord = async (id: string) => {
    await supabase.from("chat_history").delete().eq("id", id).eq("user_id", user!.id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  const clearAll = async () => {
    if (!confirm("Delete ALL chat history? This cannot be undone.")) return;
    await supabase.from("chat_history").delete().eq("user_id", user!.id);
    setRecords([]);
    setStats({ total: 0, totalTime: 0, videoChats: 0, textChats: 0 });
  };

  const exportCsv = () => {
    const header = "Mode,Duration (s),Messages,Matched Interest,Date";
    const rows = filtered.map((r) =>
      [r.mode, r.duration_seconds, r.message_count, r.matched_interest || "", r.started_at].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "milobolo-history.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  };

  if (authLoading || !user) return null;

  return (
    <Layout title="Chat History">
      <SeoHead title="Chat History" description="View your past chats on MiloBolo." path="/history" noIndex />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4} flexWrap="wrap" gap={1}>
          <Typography variant="h4" fontWeight={800}>Chat History</Typography>
          {records.length > 0 && (
            <Stack direction="row" spacing={1}>
              <Tooltip title="Export filtered rows as CSV">
                <IconButton onClick={exportCsv} size="small"><FileDownloadIcon /></IconButton>
              </Tooltip>
              <Tooltip title="Clear all history">
                <IconButton onClick={clearAll} size="small" color="error"><DeleteSweepIcon /></IconButton>
              </Tooltip>
            </Stack>
          )}
        </Stack>

        {/* Stats */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={4}>
          {[
            { label: "Total Chats", value: stats.total },
            { label: "Total Time", value: formatDuration(stats.totalTime) },
            { label: "Video Chats", value: stats.videoChats },
            { label: "Text Chats", value: stats.textChats },
          ].map((s) => (
            <Card key={s.label} sx={{ flex: 1 }}>
              <CardContent sx={{ textAlign: "center", py: 2 }}>
                <Typography variant="h4" fontWeight={800} color="primary.main">{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>

        <Alert severity="info" sx={{ mb: 3 }}>
          Chat messages are end-to-end encrypted and never stored. Only session metadata is saved here.
        </Alert>

        {/* Search + mode filter */}
        {records.length > 0 && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2} alignItems={{ sm: "center" }}>
            <TextField
              size="small"
              placeholder="Search by interest…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1, maxWidth: 320, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: "text.disabled" }} /></InputAdornment>,
              }}
            />
            <ToggleButtonGroup
              value={modeFilter}
              exclusive
              onChange={(_, v) => { if (v) setModeFilter(v); }}
              size="small"
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="video"><VideocamIcon sx={{ fontSize: 16, mr: 0.5 }} />Video</ToggleButton>
              <ToggleButton value="text"><ChatIcon sx={{ fontSize: 16, mr: 0.5 }} />Text</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.disabled" sx={{ alignSelf: "center" }}>
              {filtered.length} of {records.length} records
            </Typography>
          </Stack>
        )}

        {loading ? (
          <Box sx={{ textAlign: "center", py: 8 }}><CircularProgress /></Box>
        ) : records.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <ChatIcon sx={{ fontSize: 64, color: "text.secondary", mb: 2 }} />
            <Typography color="text.secondary">No chat history yet. Start chatting!</Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <Typography color="text.secondary">No records match your filters.</Typography>
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Mode</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Messages</TableCell>
                  <TableCell>Matched Interest</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Chip
                        icon={r.mode === "video" ? <VideocamIcon /> : <ChatIcon />}
                        label={r.mode === "video" ? "Video" : r.mode === "text" ? "Text" : r.mode}
                        size="small"
                        color={r.mode === "video" ? "primary" : "default"}
                      />
                    </TableCell>
                    <TableCell>{formatDuration(r.duration_seconds || 0)}</TableCell>
                    <TableCell>{r.message_count || 0}</TableCell>
                    <TableCell>
                      {r.matched_interest
                        ? <Chip label={r.matched_interest} size="small" variant="outlined" />
                        : <Typography variant="caption" color="text.secondary">—</Typography>}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13 }}>
                      {new Date(r.started_at).toLocaleString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete record">
                        <IconButton size="small" onClick={() => deleteRecord(r.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>
    </Layout>
  );
}

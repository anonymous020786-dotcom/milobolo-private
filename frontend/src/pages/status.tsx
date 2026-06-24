import { useState, useEffect } from "react";
import Head from "next/head";
import {
  Box, Container, Typography, Grid, Card, CardContent,
  Chip, Stack, CircularProgress, Divider, LinearProgress,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import Layout from "@/components/Layout";
import { io } from "socket.io-client";

type ServiceStatus = "operational" | "degraded" | "outage" | "checking";

interface Service {
  name: string;
  description: string;
  status: ServiceStatus;
  latency?: number;
}

const STATUS_COLOR: Record<ServiceStatus, string> = {
  operational: "success",
  degraded: "warning",
  outage: "error",
  checking: "default",
};

const STATUS_LABEL: Record<ServiceStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Outage",
  checking: "Checking…",
};

function StatusIcon({ status }: { status: ServiceStatus }) {
  if (status === "checking") return <CircularProgress size={18} />;
  if (status === "operational") return <CheckCircleIcon sx={{ color: "success.main", fontSize: 20 }} />;
  if (status === "degraded") return <WarningIcon sx={{ color: "warning.main", fontSize: 20 }} />;
  return <ErrorIcon sx={{ color: "error.main", fontSize: 20 }} />;
}

export default function StatusPage() {
  const [services, setServices] = useState<Service[]>([
    { name: "Video Chat", description: "WebRTC peer-to-peer video connections", status: "checking" },
    { name: "Text Chat", description: "Real-time text messaging via Socket.IO", status: "checking" },
    { name: "Signaling Server", description: "WebSocket matchmaking server", status: "checking" },
    { name: "Authentication", description: "User accounts and session management via Supabase", status: "checking" },
    { name: "Database", description: "Profiles, chat history, and connections (Supabase Postgres)", status: "checking" },
    { name: "CDN / Static Files", description: "Frontend delivery and static assets", status: "checking" },
  ]);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const updateService = (name: string, status: ServiceStatus, latency?: number) => {
    setServices((prev) =>
      prev.map((s) => s.name === name ? { ...s, status, latency } : s)
    );
  };

  useEffect(() => {
    const run = async () => {
      // Check signaling server + online count
      const sigUrl = process.env.NEXT_PUBLIC_SIGNALING_URL || "";
      const t0 = Date.now();
      try {
        const res = await fetch(`${sigUrl}/health`, { signal: AbortSignal.timeout(5000) });
        const latency = Date.now() - t0;
        if (res.ok) {
          updateService("Signaling Server", latency < 300 ? "operational" : "degraded", latency);
          updateService("Text Chat", latency < 400 ? "operational" : "degraded", latency);
          updateService("Video Chat", latency < 400 ? "operational" : "degraded", latency);
        } else {
          updateService("Signaling Server", "outage");
          updateService("Text Chat", "outage");
          updateService("Video Chat", "outage");
        }
      } catch {
        updateService("Signaling Server", "outage");
        updateService("Text Chat", "outage");
        updateService("Video Chat", "outage");
      }

      // Check online count via socket briefly
      try {
        const socket = io(sigUrl, { transports: ["websocket"], timeout: 4000 });
        socket.on("online_count", (n: number) => { setOnlineCount(n); socket.disconnect(); });
        setTimeout(() => socket.disconnect(), 5000);
      } catch { /* silent */ }

      // Check Supabase / auth (just the Next.js page load implies CDN is fine)
      updateService("CDN / Static Files", "operational");

      // Check Supabase via a simple ping — treat success as operational
      const t1 = Date.now();
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        if (supabaseUrl) {
          const r = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "" },
            signal: AbortSignal.timeout(5000),
          });
          const lat = Date.now() - t1;
          updateService("Authentication", r.status < 500 ? "operational" : "outage", lat);
          updateService("Database", r.status < 500 ? "operational" : "outage", lat);
        } else {
          updateService("Authentication", "operational");
          updateService("Database", "operational");
        }
      } catch {
        updateService("Authentication", "degraded");
        updateService("Database", "degraded");
      }

      setLastChecked(new Date());
    };

    run();
    const interval = setInterval(run, 60_000);
    return () => clearInterval(interval);
  }, []);

  const overallStatus: ServiceStatus = services.every((s) => s.status === "checking")
    ? "checking"
    : services.some((s) => s.status === "outage") ? "outage"
    : services.some((s) => s.status === "degraded") ? "degraded"
    : "operational";

  const overallMessages: Record<ServiceStatus, string> = {
    operational: "All systems operational",
    degraded: "Some services experiencing delays",
    outage: "One or more services are down",
    checking: "Checking service health…",
  };

  const operationalCount = services.filter((s) => s.status === "operational").length;
  const signalingOk = services.find((s) => s.name === "Signaling Server")?.status === "operational";
  const supabaseOk = services.find((s) => s.name === "Authentication")?.status === "operational";

  return (
    <Layout title="System Status — MiloBolo">
      <Head>
        <title>System Status — MiloBolo</title>
        <meta name="description" content="Real-time status of MiloBolo services: video chat, text chat, signaling server, and more." />
      </Head>

      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
        {/* Hero status banner */}
        <Box sx={{
          p: 4, mb: 4, borderRadius: 3, textAlign: "center",
          bgcolor: overallStatus === "operational" ? "rgba(34,197,94,0.08)"
            : overallStatus === "degraded" ? "rgba(245,158,11,0.08)"
            : overallStatus === "outage" ? "rgba(239,68,68,0.08)"
            : "rgba(255,255,255,0.03)",
          border: "1px solid",
          borderColor: overallStatus === "operational" ? "rgba(34,197,94,0.25)"
            : overallStatus === "degraded" ? "rgba(245,158,11,0.25)"
            : overallStatus === "outage" ? "rgba(239,68,68,0.25)"
            : "rgba(255,255,255,0.08)",
        }}>
          <StatusIcon status={overallStatus} />
          <Typography variant="h4" fontWeight={800} mt={1.5} mb={0.5}>
            {overallMessages[overallStatus]}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {operationalCount} of {services.length} services operational
            {onlineCount !== null && ` · ${onlineCount.toLocaleString()} users online now`}
          </Typography>
          {lastChecked && (
            <Typography variant="caption" color="text.disabled" display="block" mt={1}>
              Last checked: {lastChecked.toLocaleTimeString()}
              {" · "}Auto-refreshes every minute
            </Typography>
          )}

          {overallStatus === "checking" && (
            <LinearProgress sx={{ mt: 2, borderRadius: 2, bgcolor: "rgba(255,255,255,0.06)" }} />
          )}
        </Box>

        {/* Service grid */}
        <Typography variant="overline" color="text.disabled" fontWeight={700} letterSpacing={1.5} display="block" mb={2}>
          Services
        </Typography>
        <Grid container spacing={2} mb={5}>
          {services.map((s) => (
            <Grid item xs={12} sm={6} key={s.name}>
              <Card sx={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 2.5 }}>
                <CardContent>
                  <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                    <Box pt={0.25}><StatusIcon status={s.status} /></Box>
                    <Box flex={1}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography fontWeight={600} fontSize={14}>{s.name}</Typography>
                        <Chip
                          label={STATUS_LABEL[s.status]}
                          size="small"
                          color={STATUS_COLOR[s.status] as any}
                          variant="outlined"
                          sx={{ height: 20, fontSize: 10 }}
                        />
                      </Stack>
                      <Typography variant="caption" color="text.disabled" lineHeight={1.5} display="block" mt={0.25}>
                        {s.description}
                      </Typography>
                      {s.latency !== undefined && (
                        <Typography variant="caption" color="text.disabled" mt={0.5} display="block">
                          Latency: <Box component="span" fontWeight={700} color={s.latency < 200 ? "success.main" : s.latency < 500 ? "warning.main" : "error.main"}>{s.latency}ms</Box>
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ opacity: 0.1, mb: 4 }} />

        {/* Uptime history (static display — placeholder) */}
        <Typography variant="overline" color="text.disabled" fontWeight={700} letterSpacing={1.5} display="block" mb={2}>
          Service Status (live checks)
        </Typography>
        {[
          { name: "Video Chat", key: "signaling" },
          { name: "Text Chat", key: "signaling" },
          { name: "Signaling Server", key: "signaling" },
          { name: "Authentication", key: "supabase" },
        ].map(({ name, key }) => {
          const alive = key === "signaling" ? signalingOk : supabaseOk;
          const uptime = alive ? 100 : 0;
          return (
          <Box key={name} mb={2}>
            <Stack direction="row" justifyContent="space-between" mb={0.75}>
              <Typography variant="body2">{name}</Typography>
              <Typography variant="body2" fontWeight={700} color={alive ? "success.main" : "error.main"}>
                {alive ? "Operational" : "Down"}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={uptime}
              sx={{
                height: 6, borderRadius: 3,
                bgcolor: "rgba(255,255,255,0.06)",
                "& .MuiLinearProgress-bar": {
                  bgcolor: alive ? "success.main" : "error.main",
                  borderRadius: 3,
                },
              }}
            />
          </Box>
          );
        })}

        <Box sx={{ mt: 4, p: 2.5, bgcolor: "rgba(255,255,255,0.02)", borderRadius: 2, border: "1px solid rgba(255,255,255,0.06)" }}>
          <Typography variant="body2" color="text.secondary" lineHeight={1.8}>
            Having trouble connecting? Try refreshing the page or clearing your browser cache.
            If an issue persists, <Box component="a" href="/contact" sx={{ color: "primary.main", textDecoration: "none" }}>contact us</Box> and we'll investigate right away.
          </Typography>
        </Box>
      </Container>
    </Layout>
  );
}

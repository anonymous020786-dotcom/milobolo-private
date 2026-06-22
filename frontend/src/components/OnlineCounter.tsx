import { useEffect, useState } from "react";
import { Chip } from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

// Uses REST polling so it doesn't open a WebSocket on every page.
// The chat page gets live updates via its own socket's online_count event.
export default function OnlineCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const url = `${process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000"}/api/online-count`;

    const poll = () => {
      fetch(url)
        .then((r) => r.json())
        .then((d) => setCount(d.count ?? null))
        .catch(() => {});
    };

    poll();
    const id = setInterval(poll, 10000); // refresh every 10s
    return () => clearInterval(id);
  }, []);

  if (count === null) return null;

  return (
    <Chip
      icon={<FiberManualRecordIcon sx={{ fontSize: "10px !important", color: "#4CAF50 !important" }} />}
      label={`${count.toLocaleString("en-IN")} online`}
      size="small"
      sx={{
        bgcolor: "rgba(76,175,80,0.1)",
        color: "success.main",
        border: "1px solid rgba(76,175,80,0.3)",
        fontWeight: 600,
      }}
    />
  );
}

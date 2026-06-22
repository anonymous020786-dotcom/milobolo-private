import { useEffect, useState } from "react";
import { Chip } from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { io } from "socket.io-client";

export default function OnlineCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SIGNALING_URL || "", {
      transports: ["websocket"],
    });
    socket.on("online_count", ({ count }) => setCount(count));
    return () => { socket.disconnect(); };
  }, []);

  if (count === null) return null;

  return (
    <Chip
      icon={<FiberManualRecordIcon sx={{ fontSize: "10px !important", color: "#4CAF50 !important" }} />}
      label={`${count.toLocaleString("en-IN")} online`}
      size="small"
      sx={{ bgcolor: "rgba(76,175,80,0.1)", color: "success.main", border: "1px solid rgba(76,175,80,0.3)", fontWeight: 600 }}
    />
  );
}

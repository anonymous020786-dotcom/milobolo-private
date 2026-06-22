import { useEffect, useRef } from "react";
import { Box } from "@mui/material";

interface AdSlotProps {
  slotId: string;
  format?: "horizontal" | "rectangle" | "vertical";
  clientId?: string;
}

declare global {
  interface Window { adsbygoogle: unknown[] }
}

export default function AdSlot({ slotId, format = "rectangle", clientId }: AdSlotProps) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        initialized.current = true;
      } catch {}
    }
  }, []);

  const formatMap = {
    horizontal: { minHeight: 90, display: "block" },
    rectangle: { minHeight: 250, display: "block" },
    vertical: { minHeight: 600, display: "block" },
  };

  return (
    <Box sx={{ textAlign: "center", my: 1 }}>
      <ins
        className="adsbygoogle"
        style={formatMap[format]}
        data-ad-client={clientId || process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || "ca-pub-XXXXXXXXXX"}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </Box>
  );
}

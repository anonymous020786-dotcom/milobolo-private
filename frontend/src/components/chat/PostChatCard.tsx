import { useState } from "react";
import { Box, Button, Stack, Typography, Tooltip } from "@mui/material";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import BlockIcon from "@mui/icons-material/Block";
import FlagIcon from "@mui/icons-material/Flag";

interface Props {
  canRate: boolean;
  onRate: (score: 1 | -1) => Promise<void>;
  onBlock: () => Promise<void>;
  onReport: () => void;
}

// Shown after a chat ends: rate the stranger (karma), block, or report.
export default function PostChatCard({ canRate, onRate, onBlock, onReport }: Props) {
  const [rated, setRated] = useState<1 | -1 | null>(null);
  const [blocked, setBlocked] = useState(false);

  return (
    <Box sx={{ my: 1, p: 1.25, borderRadius: 2, border: "1px solid rgba(255,255,255,0.08)", bgcolor: "rgba(255,255,255,0.02)" }}>
      <Typography fontSize={12.5} color="text.secondary" mb={0.75}>How was that chat?</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Tooltip title={canRate ? "" : "Both of you need accounts for ratings to count toward karma"}>
          <span>
            <Button size="small" variant={rated === 1 ? "contained" : "outlined"} color="success" disabled={rated !== null}
              startIcon={<ThumbUpAltOutlinedIcon />} onClick={async () => { setRated(1); await onRate(1); }}>
              Good
            </Button>
          </span>
        </Tooltip>
        <span>
          <Button size="small" variant={rated === -1 ? "contained" : "outlined"} color="warning" disabled={rated !== null}
            startIcon={<ThumbDownAltOutlinedIcon />} onClick={async () => { setRated(-1); await onRate(-1); }}>
            Bad
          </Button>
        </span>
        <Button size="small" color="inherit" disabled={blocked} startIcon={<BlockIcon />}
          onClick={async () => { setBlocked(true); await onBlock(); }}>
          {blocked ? "Blocked" : "Don't match again"}
        </Button>
        <Button size="small" color="error" startIcon={<FlagIcon />} onClick={onReport}>Report</Button>
      </Stack>
      {rated !== null && (
        <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>
          Thanks! {canRate ? "Your rating counts toward their karma." : "Sign-in on both sides is needed for karma to count."}
        </Typography>
      )}
    </Box>
  );
}

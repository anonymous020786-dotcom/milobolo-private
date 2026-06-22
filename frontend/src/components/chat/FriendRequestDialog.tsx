import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Button, Avatar, Box,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";

interface Props {
  open: boolean;
  fromName: string;
  fromUserId: string;
  onAccept: () => void;
  onDecline: () => void;
}

export default function FriendRequestDialog({ open, fromName, fromUserId, onAccept, onDecline }: Props) {
  return (
    <Dialog open={open} maxWidth="xs" fullWidth
      PaperProps={{ sx: { bgcolor: "background.paper", borderRadius: 3 } }}>
      <DialogTitle sx={{ textAlign: "center", pt: 3 }}>
        <PersonAddIcon sx={{ fontSize: 40, color: "primary.main", display: "block", mx: "auto", mb: 1 }} />
        Connection Request
      </DialogTitle>
      <DialogContent>
        <Box sx={{ textAlign: "center" }}>
          <Avatar sx={{ mx: "auto", mb: 1.5, width: 56, height: 56, bgcolor: "primary.main", fontSize: 24 }}>
            {fromName?.[0]?.toUpperCase() || "?"}
          </Avatar>
          <Typography fontWeight={600}>{fromName || "Anonymous"}</Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            wants to connect with you. Accept to share profiles.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button fullWidth variant="outlined" onClick={onDecline}>Decline</Button>
        <Button fullWidth variant="contained" onClick={onAccept}>Accept</Button>
      </DialogActions>
    </Dialog>
  );
}

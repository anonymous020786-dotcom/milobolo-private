import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, Box, Typography, Button, Checkbox,
  FormControlLabel, Stack,
} from "@mui/material";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";

export default function AgeGate() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const confirmed = localStorage.getItem("age_confirmed");
    if (!confirmed) setOpen(true);
  }, []);

  const handleConfirm = () => {
    localStorage.setItem("age_confirmed", "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} maxWidth="xs" fullWidth disableEscapeKeyDown
      PaperProps={{ sx: { bgcolor: "background.paper", borderRadius: 3, border: "1px solid rgba(108,99,255,0.3)" } }}>
      <DialogContent>
        <Box sx={{ textAlign: "center", py: 2 }}>
          <VerifiedUserIcon sx={{ fontSize: 56, color: "primary.main", mb: 2 }} />
          <Typography variant="h5" fontWeight={800} mb={1}>Age Verification</Typography>
          <Typography variant="body2" color="text.secondary" mb={3} lineHeight={1.7}>
            MiloBolo is a platform for adults. You must be <b>18 years or older</b> to use this service.
            By continuing you confirm you meet this requirement and agree to our community guidelines.
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} color="primary" />}
            label={<Typography variant="body2">I am 18 years or older and agree to the Terms of Service</Typography>}
            sx={{ mb: 3, textAlign: "left" }}
          />
          <Stack spacing={1}>
            <Button fullWidth variant="contained" disabled={!checked} onClick={handleConfirm} sx={{ py: 1.3 }}>
              Enter MiloBolo
            </Button>
            <Button fullWidth variant="text" color="inherit"
              onClick={() => { window.location.href = "https://google.com"; }}>
              I'm under 18 — Exit
            </Button>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

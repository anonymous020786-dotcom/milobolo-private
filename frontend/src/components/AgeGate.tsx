import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Dialog, DialogContent, Box, Typography, Button, Checkbox,
  FormControlLabel, Stack,
} from "@mui/material";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";

export default function AgeGate() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("age_confirmed")) setOpen(true);
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
          <VerifiedUserIcon sx={{ fontSize: 52, color: "primary.main", mb: 2 }} />
          <Typography variant="h5" fontWeight={800} mb={1}>Age Verification</Typography>
          <Typography variant="body2" color="text.secondary" mb={3} lineHeight={1.7}>
            MiloBolo is for adults only. You must be <strong>18 years or older</strong> to use this service.
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} color="primary" />}
            label={
              <Typography variant="body2">
                I am 18+ and agree to the{" "}
                <Link href="/terms" target="_blank" style={{ color: "#6C63FF" }}>Terms of Service</Link>
                {" & "}
                <Link href="/privacy" target="_blank" style={{ color: "#6C63FF" }}>Privacy Policy</Link>
              </Typography>
            }
            sx={{ mb: 3, textAlign: "left" }}
          />
          <Stack spacing={1}>
            <Button fullWidth variant="contained" disabled={!checked} onClick={handleConfirm} sx={{ py: 1.3, borderRadius: 2 }}>
              Enter MiloBolo
            </Button>
            <Button fullWidth variant="text" color="inherit" sx={{ fontSize: 12 }}
              onClick={() => { window.location.href = "https://google.com"; }}>
              I&apos;m under 18 — Exit
            </Button>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

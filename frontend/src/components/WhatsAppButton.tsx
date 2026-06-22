import { Fab, Tooltip } from "@mui/material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";

const number = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";

export default function WhatsAppButton() {
  return (
    <Tooltip title="Chat Support on WhatsApp" placement="left">
      <Fab
        component="a"
        href={`https://wa.me/${number}?text=Hi%2C%20I%20need%20help%20with%20MiloBolo`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp Support"
        sx={{
          position: "fixed", bottom: 24, right: 24, zIndex: 1200,
          bgcolor: "#25D366", color: "#fff",
          "&:hover": { bgcolor: "#128C7E" },
          boxShadow: "0 4px 20px rgba(37,211,102,0.4)",
        }}
      >
        <WhatsAppIcon />
      </Fab>
    </Tooltip>
  );
}

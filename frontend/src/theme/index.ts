import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#6C63FF", light: "#9C95FF", dark: "#4B43CC" },
    secondary: { main: "#FF6584", light: "#FF91A4", dark: "#CC4267" },
    background: { default: "#0A0A0F", paper: "#13131A" },
    success: { main: "#4CAF50" },
    warning: { main: "#FF9800" },
    error: { main: "#F44336" },
    text: { primary: "#FFFFFF", secondary: "#B0B0C3" },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 700 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 8,
          padding: "10px 24px",
        },
        containedPrimary: {
          background: "linear-gradient(135deg, #6C63FF 0%, #9C95FF 100%)",
          "&:hover": {
            background: "linear-gradient(135deg, #4B43CC 0%, #6C63FF 100%)",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(108, 99, 255, 0.12)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
            "& fieldset": { borderColor: "rgba(108, 99, 255, 0.3)" },
            "&:hover fieldset": { borderColor: "rgba(108, 99, 255, 0.6)" },
            "&.Mui-focused fieldset": { borderColor: "#6C63FF" },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 6 } },
    },
  },
});

export default theme;

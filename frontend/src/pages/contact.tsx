import { useState } from "react";
import Layout from "@/components/Layout";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Container, Grid, Snackbar, Stack, TextField, Typography, useTheme,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import SendIcon from "@mui/icons-material/Send";
import SecurityIcon from "@mui/icons-material/Security";
import { GoogleReCaptchaProvider, useGoogleReCaptcha } from "react-google-recaptcha-v3";

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
const IS_DEV_RECAPTCHA = !SITE_KEY || SITE_KEY.includes("PLACEHOLDER") || SITE_KEY === "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MmuKj8bi";

function ContactFormInner({ getToken }: { getToken: () => Promise<string> }) {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: "success" | "error" }>({
    open: false, msg: "", severity: "success",
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setLoading(true);

    let token = "dev-skip";
    try { token = await getToken(); } catch {}


    try {
      const apiBase = process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000";
      const res = await fetch(`${apiBase}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, recaptchaToken: token }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSnack({ open: true, msg: "Message sent! We'll get back to you within 48 hours.", severity: "success" });
        setForm({ name: "", email: "", subject: "", message: "" });
      } else {
        throw new Error(data.error || "Send failed");
      }
    } catch (err: any) {
      setSnack({ open: true, msg: err.message || "Something went wrong. Please try again.", severity: "error" });
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={2.5}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Your Name"
              fullWidth
              required
              value={form.name}
              onChange={handleChange("name")}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Email Address"
              type="email"
              fullWidth
              required
              value={form.email}
              onChange={handleChange("email")}
            />
          </Grid>
        </Grid>
        <TextField
          label="Subject"
          fullWidth
          value={form.subject}
          onChange={handleChange("subject")}
          placeholder="How can we help?"
        />
        <TextField
          label="Message"
          fullWidth
          required
          multiline
          rows={5}
          value={form.message}
          onChange={handleChange("message")}
          placeholder="Describe your question or issue in detail..."
          inputProps={{ maxLength: 2000 }}
          helperText={`${form.message.length}/2000`}
        />
        {IS_DEV_RECAPTCHA && (
          <Alert severity="info" sx={{ py: 0.5 }}>
            reCAPTCHA is disabled in development mode.
          </Alert>
        )}
        <Button
          type="submit"
          variant="contained"
          size="large"
          endIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
          disabled={loading}
          sx={{ alignSelf: "flex-start", px: 4, fontWeight: 700 }}
        >
          {loading ? "Sending…" : "Send Message"}
        </Button>
      </Stack>

      <Snackbar
        open={snack.open}
        autoHideDuration={6000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </form>
  );
}

function ContactFormWithCaptcha() {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const getToken = async () => (executeRecaptcha ? await executeRecaptcha("contact_form") : "dev-skip");
  return <ContactFormInner getToken={getToken} />;
}

function ContactForm() {
  if (IS_DEV_RECAPTCHA) {
    return <ContactFormInner getToken={async () => "dev-skip"} />;
  }
  return (
    <GoogleReCaptchaProvider reCaptchaKey={SITE_KEY}>
      <ContactFormWithCaptcha />
    </GoogleReCaptchaProvider>
  );
}

const CONTACT_ITEMS = [
  {
    icon: <EmailIcon sx={{ fontSize: 32 }} />,
    label: "Email Support",
    value: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@milobolo.com",
    sub: "Response within 48 hours on business days",
    color: "#2196f3",
    href: `mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL || "support@milobolo.com"}`,
  },
  {
    icon: <WhatsAppIcon sx={{ fontSize: 32 }} />,
    label: "WhatsApp Support",
    value: "Chat with us on WhatsApp",
    sub: "For urgent help — tap to open",
    color: "#25d366",
    href: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "917492068998"}`,
  },
];

export default function ContactPage() {
  const theme = useTheme();
  return (
    <Layout
      title="Contact Us"
      description="Get in touch with the MiloBolo team — email, WhatsApp support, and a contact form for any questions or feedback."
    >
      {/* Hero */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main}18, transparent)`,
          py: { xs: 7, md: 10 },
          textAlign: "center",
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Container maxWidth="sm">
          <Chip label="Contact" color="primary" sx={{ mb: 2 }} />
          <Typography variant="h3" fontWeight={900} gutterBottom>
            Get in Touch
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Have a question, found a bug, or want to report something? We're here to help.
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: 7 }}>
        <Grid container spacing={5}>
          {/* Contact Info */}
          <Grid item xs={12} md={4}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Contact Details
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Choose the most convenient way to reach us.
            </Typography>

            <Stack spacing={2}>
              {CONTACT_ITEMS.map((item) => (
                <Card
                  key={item.label}
                  component="a"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    textDecoration: "none",
                    borderRadius: 3,
                    borderLeft: `4px solid ${item.color}`,
                    transition: "transform 0.2s",
                    "&:hover": { transform: "translateX(4px)" },
                  }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Box sx={{ color: item.color }}>{item.icon}</Box>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {item.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.value}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {item.sub}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>

            <Box mt={3} p={2} sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                <SecurityIcon fontSize="small" color="success" />
                <Typography variant="caption" fontWeight={600}>
                  Privacy Protected
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Your contact form submission is processed securely via SMTP. We never sell or share your information.
              </Typography>
            </Box>
          </Grid>

          {/* Form */}
          <Grid item xs={12} md={8}>
            <Typography variant="h6" fontWeight={700} gutterBottom>
              Send a Message
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>
              Fill in the form and we'll get back to you within 48 hours.
            </Typography>
            <ContactForm />
          </Grid>
        </Grid>
      </Container>
    </Layout>
  );
}


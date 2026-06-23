import Layout from "@/components/Layout";
import {
  Box, Chip, Container, Divider, Stack, Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";

const LAST_UPDATED = "20 June 2025";

export default function PrivacyPage() {
  return (
    <Layout
      title="Privacy Policy"
      description="MiloBolo Privacy Policy — how we collect, use, and protect your data on our free anonymous random chat platform."
    >
      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
          <LockIcon color="success" sx={{ fontSize: 32 }} />
          <Typography variant="h3" fontWeight={900}>
            Privacy Policy
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={4}>
          Last updated: {LAST_UPDATED}
        </Typography>

        <Typography variant="body1" color="text.secondary" mb={5} lineHeight={1.9}>
          MiloBolo is built on a privacy-first foundation. This Privacy Policy explains what information we collect, how we use it, and the choices you have. If you have questions, contact us via the Contact page.
        </Typography>

        <Section title="1. Information We Collect">
          <strong>1.1 Anonymous Users (No Account)</strong>{"\n"}
          When you use MiloBolo without registering:{"\n\n"}
          • Browser fingerprint hash — a one-way hash used solely for ban enforcement. The raw components are never stored.{"\n"}
          • Country code — derived from your IP address for matching purposes. Your IP itself is not stored after the session.{"\n"}
          • Session metadata — duration, message count, chat mode (no message content).{"\n"}
          • Cookie consent preferences — stored in your browser's localStorage.{"\n\n"}
          <strong>1.2 Registered Users</strong>{"\n"}
          If you create an account, we additionally collect:{"\n\n"}
          • Email address — used for OTP authentication and account management.{"\n"}
          • Display name — shown to connections you accept.{"\n"}
          • Profile avatar — stored on Cloudflare R2 (optional).{"\n"}
          • Session history metadata — if you enable this feature (no message content).
        </Section>

        <Section title="2. What We Do NOT Collect">
          We explicitly do NOT collect:{"\n\n"}
          • Chat message content — all text messages are end-to-end encrypted; our servers only relay ciphertext and cannot read it.{"\n"}
          • Video or audio recordings — WebRTC media flows directly browser-to-browser. Our servers never receive your video or audio.{"\n"}
          • Real name, phone number, or government ID — we do not require or request these.{"\n"}
          • Browsing history outside MiloBolo.{"\n"}
          • Precise geolocation — only your country is inferred from IP.
        </Section>

        <Section title="3. How We Use Your Information">
          • Fingerprint hash — ban enforcement only. Never shared.{"\n"}
          • Country code — matching you with compatible strangers.{"\n"}
          • Session metadata — aggregate analytics to improve the service.{"\n"}
          • Email — OTP delivery and essential account communications.{"\n"}
          • Reports — moderation review and safety enforcement.
        </Section>

        <Section title="4. Legal Basis for Processing (GDPR)">
          For EU/UK users, we process your data under the following legal bases:{"\n\n"}
          • Contract performance — processing necessary to provide the Service you requested.{"\n"}
          • Legitimate interests — ban enforcement, fraud prevention, and service improvement.{"\n"}
          • Consent — analytics and marketing cookies (where accepted by you).{"\n"}
          • Legal obligation — compliance with law enforcement requests and CSAM reporting.
        </Section>

        <Section title="5. Cookies and Local Storage">
          MiloBolo uses localStorage for preferences (theme, accessibility, consent choices) and essential session cookies for authenticated users. Optional analytics (Google Analytics) and advertising (Google AdSense) cookies are used only if you accept them in the cookie consent dialog. See our Cookie Policy for complete details.
        </Section>

        <Section title="6. Third-Party Services">
          We use the following third-party services:{"\n\n"}
          • Supabase — authentication and database (EU-hosted, GDPR compliant){"\n"}
          • Cloudflare R2 — avatar image storage{"\n"}
          • Google Analytics — aggregate usage analytics (optional){"\n"}
          • Google AdSense — advertising (optional){"\n"}
          • Google reCAPTCHA v3 — spam and bot prevention{"\n"}
          • Hostinger — web hosting and email (SMTP){"\n\n"}
          Each service operates under its own privacy policy.
        </Section>

        <Section title="7. Data Retention">
          • Session metadata — 90 days, then automatically deleted.{"\n"}
          • Moderation reports — 1 year for enforcement purposes.{"\n"}
          • Account data — until you delete your account.{"\n"}
          • Fingerprint hashes of banned users — 1 year, then deleted.{"\n"}
          • Chat messages — not stored at all.
        </Section>

        <Section title="8. Data Transfers">
          MiloBolo's infrastructure is primarily hosted in the European Union (Supabase) and India (Hostinger VPS). If you use MiloBolo from another region, your data may be transferred to these locations. We implement appropriate safeguards for international transfers.
        </Section>

        <Section title="9. Your Rights">
          Depending on your location, you may have the following rights:{"\n\n"}
          • Access — request a copy of your personal data.{"\n"}
          • Correction — request correction of inaccurate data.{"\n"}
          • Erasure — request deletion of your data.{"\n"}
          • Portability — receive your data in a machine-readable format.{"\n"}
          • Objection — object to processing based on legitimate interests.{"\n"}
          • Withdrawal of consent — withdraw any previously given consent at any time.{"\n\n"}
          To exercise these rights, contact us via the Contact page or delete your account directly from profile settings.
        </Section>

        <Section title="10. Children's Privacy">
          MiloBolo is strictly for users 18 and older. We do not knowingly collect personal information from anyone under 18. If we become aware that a minor has used MiloBolo, we will delete all associated data immediately and report any relevant content to appropriate authorities.
        </Section>

        <Section title="11. Security">
          We implement appropriate technical and organisational security measures including:{"\n\n"}
          • AES-GCM-256 end-to-end encryption for messages{"\n"}
          • HTTPS for all data in transit{"\n"}
          • Row-Level Security in Supabase (database access controls){"\n"}
          • Content Security Policy headers{"\n"}
          • Regular security reviews
        </Section>

        <Section title="12. Changes to This Policy">
          We may update this Privacy Policy from time to time. Material changes will be communicated via a notice on the platform. Your continued use of MiloBolo after changes take effect constitutes acceptance of the updated policy.
        </Section>

        <Section title="13. Contact and Complaints">
          For privacy questions or to exercise your rights, contact us via the Contact page. EU/UK users may also lodge a complaint with their local data protection authority (e.g., ICO in the UK, or your national DPA in the EU).
        </Section>
      </Container>
    </Layout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box mb={4}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" lineHeight={1.9} sx={{ whiteSpace: "pre-line" }}>
        {children}
      </Typography>
      <Divider sx={{ mt: 3 }} />
    </Box>
  );
}

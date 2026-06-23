import Layout from "@/components/Layout";
import {
  Box, Chip, Container, Divider, Stack, Typography,
} from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";

const LAST_UPDATED = "20 June 2025";

export default function TermsPage() {
  return (
    <Layout
      title="Terms of Service"
      description="MiloBolo Terms of Service — your rights and responsibilities as a user of our free random chat platform."
    >
      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
          <GavelIcon color="primary" sx={{ fontSize: 32 }} />
          <Typography variant="h3" fontWeight={900}>
            Terms of Service
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={4}>
          Last updated: {LAST_UPDATED}
        </Typography>

        <Typography variant="body1" color="text.secondary" mb={5} lineHeight={1.9}>
          Please read these Terms of Service ("Terms") carefully before using MiloBolo ("Service", "Platform", "we", "us"). By accessing or using MiloBolo, you agree to be bound by these Terms. If you do not agree, do not use the Service.
        </Typography>

        <Section title="1. Eligibility — You Must Be 18 or Older">
          MiloBolo is strictly for users aged 18 and above. By clicking "I am 18 or older" and using MiloBolo, you represent and warrant that you are at least 18 years of age. If you are under 18, you are not permitted to use this Service. Parents or guardians who discover that a minor has used MiloBolo should contact us immediately.
        </Section>

        <Section title="2. Community Standards">
          You agree to follow our Community Guidelines at all times while using MiloBolo. Specifically, you agree NOT to:
          {"\n\n"}• Share, produce, or solicit any sexual content involving minors — this is illegal and will be immediately reported to relevant authorities
          {"\n"}• Harass, threaten, intimidate, or bully other users
          {"\n"}• Share hate speech targeting any group based on race, ethnicity, religion, gender, sexuality, disability, or nationality
          {"\n"}• Use automated scripts, bots, or other non-human methods to connect with users
          {"\n"}• Impersonate MiloBolo staff, moderators, or other users
          {"\n"}• Solicit personal information through pressure or deception
          {"\n"}• Share malware, phishing links, or malicious content
          {"\n"}• Engage in sextortion, blackmail, or other coercive behaviour
        </Section>

        <Section title="3. Privacy and Data">
          MiloBolo is designed for minimal data collection. We do not store chat messages, video, or audio from sessions. End-to-end encryption is applied to all text messages by default. We collect only the minimum metadata necessary for service operation and safety enforcement. Full details are in our Privacy Policy.
        </Section>

        <Section title="4. End-to-End Encryption">
          MiloBolo implements AES-GCM-256 end-to-end encryption for text messages. This means we cannot read your messages. However, encryption does not protect you from your conversation partner saving or sharing your messages. Use your judgment about what you share.
        </Section>

        <Section title="5. Service Availability">
          MiloBolo is provided free of charge, as-is, without any warranty of uptime, match quality, or service continuity. We may modify, suspend, or discontinue any part of the Service at any time with or without notice. We are not liable for any service interruptions.
        </Section>

        <Section title="6. Intellectual Property">
          MiloBolo and its original content, features, and functionality are owned by MiloBolo and protected by intellectual property laws. You may not copy, modify, distribute, or create derivative works based on MiloBolo's proprietary technology without express written permission.
        </Section>

        <Section title="7. User-Generated Content">
          You are solely responsible for all content you share during MiloBolo sessions. You represent that you have the right to share any content you share, and that doing so does not violate any third-party rights. Because we do not store session content, we cannot review or moderate content post-session.
        </Section>

        <Section title="8. Ban and Enforcement">
          We may suspend or permanently ban users (by browser fingerprint, IP address, or account) who violate these Terms without prior notice. Bans are enforced at our sole discretion. Serious violations involving illegal content are reported to relevant law enforcement authorities.
        </Section>

        <Section title="9. Limitation of Liability">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, MILOBOLO AND ITS OPERATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE, OR FROM THE CONDUCT OF OTHER USERS. Our total liability to you for any claim shall not exceed INR 1,000 (one thousand Indian rupees).
        </Section>

        <Section title="10. Indemnification">
          You agree to indemnify and hold harmless MiloBolo and its operators from any claims, damages, losses, liabilities, costs, and expenses (including legal fees) arising from your use of the Service or your violation of these Terms.
        </Section>

        <Section title="11. Third-Party Services">
          MiloBolo uses third-party services including Supabase (authentication), Google Analytics (analytics), Google AdSense (advertising), and Google reCAPTCHA (spam prevention). Use of these services is subject to their respective terms and privacy policies.
        </Section>

        <Section title="12. Changes to Terms">
          We reserve the right to modify these Terms at any time. Material changes will be communicated via a notice on the platform. Continued use of MiloBolo after changes take effect constitutes acceptance of the revised Terms.
        </Section>

        <Section title="13. Governing Law">
          These Terms shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in India.
        </Section>

        <Section title="14. Contact">
          Questions about these Terms? Reach us via the Contact page.
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

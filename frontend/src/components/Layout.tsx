import { ReactNode } from "react";
import { Box } from "@mui/material";
import Navbar from "./Navbar";
import WhatsAppButton from "./WhatsAppButton";
import { DefaultSeo } from "next-seo";
import { useFeatureFlags } from "@/context/FeatureFlagContext";

interface LayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  noNav?: boolean;
}

export default function Layout({ children, title, description, noNav }: LayoutProps) {
  const { isEnabled } = useFeatureFlags();

  return (
    <>
      <DefaultSeo
        title={title ? `${title} | MiloBolo` : "MiloBolo — Meet & Speak"}
        description={description || "MiloBolo — Chat with random strangers via video or text. Safe, fun, anonymous."}
        openGraph={{
          type: "website",
          locale: "en_IN",
          url: process.env.NEXT_PUBLIC_SITE_URL,
          siteName: "MiloBolo",
        }}
        additionalMetaTags={[
          { name: "keywords", content: "random chat, video chat, stranger chat, milobolo, omegle india, baat karo" },
        ]}
      />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
        {!noNav && <Navbar />}
        <Box component="main" sx={{ flex: 1 }}>
          {children}
        </Box>
        {isEnabled("whatsapp_button") && <WhatsAppButton />}
      </Box>
    </>
  );
}

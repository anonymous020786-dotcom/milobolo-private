import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import Head from "next/head";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { AuthProvider } from "@/context/AuthContext";
import { FeatureFlagProvider } from "@/context/FeatureFlagContext";
import { AppThemeProvider, useAppTheme, buildMuiTheme } from "@/context/ThemeContext";
import { AccessibilityProvider } from "@/context/AccessibilityContext";
import Script from "next/script";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import "@/styles/accessibility.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const ADSENSE_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const RECAPTCHA_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

declare global {
  interface Window { gtag: (...args: unknown[]) => void; dataLayer: unknown[]; }
}

function ThemedApp({ Component, pageProps }: AppProps) {
  const { currentDescriptor } = useAppTheme();
  const muiTheme = buildMuiTheme(currentDescriptor);
  const router = useRouter();

  useEffect(() => {
    if (!GA_ID) return;
    const handleRouteChange = (url: string) => {
      window.gtag?.("config", GA_ID, { page_path: url });
    };
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
  }, [router.events]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_KEY}>
        <AuthProvider>
          <FeatureFlagProvider>
            <Component {...pageProps} />
            <PWAInstallBanner />
          </FeatureFlagProvider>
        </AuthProvider>
      </GoogleReCaptchaProvider>
    </ThemeProvider>
  );
}

export default function App(props: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      {/* Google Analytics */}
      {GA_ID && GA_ID !== "G-PLACEHOLDER" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { page_path: window.location.pathname, anonymize_ip: true });
          `}</Script>
        </>
      )}

      {/* Google AdSense */}
      {ADSENSE_ID && !ADSENSE_ID.includes("PLACEHOLDER") && (
        <Script
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}`}
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      )}

      <AccessibilityProvider>
        <AppThemeProvider>
          <ThemedApp {...props} />
        </AppThemeProvider>
      </AccessibilityProvider>
    </>
  );
}

import type { AppProps } from "next/app";
import Head from "next/head";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { AuthProvider } from "@/context/AuthContext";
import { FeatureFlagProvider } from "@/context/FeatureFlagContext";
import theme from "@/theme";
import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const RECAPTCHA_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { page_path: window.location.pathname });
          `}</Script>
        </>
      )}

      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_KEY}>
          <AuthProvider>
            <FeatureFlagProvider>
              <Component {...pageProps} />
            </FeatureFlagProvider>
          </AuthProvider>
        </GoogleReCaptchaProvider>
      </ThemeProvider>
    </>
  );
}

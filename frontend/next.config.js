/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.videodownloaders.cloud" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      // Scripts: self + Next.js inline + AdSense + Google Analytics + reCAPTCHA
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://partner.googleadservices.com https://tpc.googlesyndication.com https://www.googletagmanager.com https://www.google-analytics.com https://www.google.com https://www.gstatic.com",
      // Styles: self + MUI inline styles
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts
      "font-src 'self' https://fonts.gstatic.com data:",
      // Images: self + data URIs + Google/AdSense CDNs + Supabase storage
      "img-src 'self' data: blob: https://*.googlesyndication.com https://*.google.com https://*.googleusercontent.com https://*.supabase.co https://assets.videodownloaders.cloud",
      // Media: self + blob (local camera/mic streams)
      "media-src 'self' blob:",
      // WebSockets: signaling server + Supabase realtime
      "connect-src 'self' wss: ws: https://*.supabase.co https://www.google-analytics.com https://chat.videodownloaders.cloud https://pagead2.googlesyndication.com",
      // Worker (service worker)
      "worker-src 'self' blob:",
      // Frames: AdSense iframes
      "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com",
      // Disallow object/embed
      "object-src 'none'",
      // Base URI restricted to self
      "base-uri 'self'",
      // Form actions restricted
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self)" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

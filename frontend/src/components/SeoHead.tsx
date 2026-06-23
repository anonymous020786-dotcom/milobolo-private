import Head from "next/head";

const BASE_URL = "https://chat.videodownloaders.cloud";
const DEFAULT_OG_IMAGE = `${BASE_URL}/icons/icon-512.png`;
const SITE_NAME = "MiloBolo";
const DEFAULT_DESCRIPTION = "Free, anonymous, end-to-end encrypted random video and text chat. Connect with strangers worldwide instantly. No registration required. Always free.";

interface SeoHeadProps {
  title?: string;
  description?: string;
  path?: string;
  ogImage?: string;
  noIndex?: boolean;
  jsonLd?: object;
}

export default function SeoHead({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "",
  ogImage = DEFAULT_OG_IMAGE,
  noIndex = false,
  jsonLd,
}: SeoHeadProps) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Free Random Video & Text Chat`;
  const canonical = `${BASE_URL}${path}`;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="512" />
      <meta property="og:image:height" content="512" />
      <meta property="og:locale" content="en_US" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </Head>
  );
}

import type { NextApiRequest, NextApiResponse } from "next";
import { BLOG_POSTS } from "@/data/blogPosts";

const BASE = "https://chat.videodownloaders.cloud";

const STATIC_PAGES = [
  { url: "/", priority: "1.0", changefreq: "daily" },
  { url: "/about", priority: "0.8", changefreq: "monthly" },
  { url: "/blog", priority: "0.9", changefreq: "weekly" },
  { url: "/contact", priority: "0.7", changefreq: "monthly" },
  { url: "/terms", priority: "0.5", changefreq: "yearly" },
  { url: "/privacy", priority: "0.5", changefreq: "yearly" },
  { url: "/cookies", priority: "0.5", changefreq: "yearly" },
  { url: "/guidelines", priority: "0.6", changefreq: "yearly" },
  { url: "/spy", priority: "0.8", changefreq: "weekly" },
  { url: "/topics", priority: "0.8", changefreq: "monthly" },
  { url: "/friends", priority: "0.5", changefreq: "weekly" },
  { url: "/status", priority: "0.4", changefreq: "hourly" },
];

export default function sitemap(_req: NextApiRequest, res: NextApiResponse) {
  const now = new Date().toISOString().split("T")[0];

  const urlSet = [
    ...STATIC_PAGES.map(
      (p) => `
  <url>
    <loc>${BASE}${p.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    ),
    ...BLOG_POSTS.map(
      (p) => `
  <url>
    <loc>${BASE}/blog/${p.slug}</loc>
    <lastmod>${p.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
    ),
  ].join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlSet}
</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate");
  res.status(200).send(xml);
}

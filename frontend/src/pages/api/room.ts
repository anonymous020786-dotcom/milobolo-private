import type { NextApiRequest, NextApiResponse } from "next";
import { v4 as uuidv4 } from "uuid";

// Generates a short-lived invite token stored in Redis via the signaling server.
// GET /api/room?create=1  → { token, url }
// The token is passed as ?invite=<token> on the /chat page; the signaling server
// reserves that roomId so both sides land in the same room.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  if (req.query.create !== "1") return res.status(400).json({ error: "Missing create=1" });

  const token = uuidv4();
  const signalingUrl = process.env.SIGNALING_INTERNAL_URL || "http://signaling:4000";

  try {
    // Store invite token in signaling server (TTL 10 min)
    await fetch(`${signalingUrl}/api/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Signaling unavailable — return token anyway; worst case it won't pre-reserve
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://chat.videodownloaders.cloud";
  res.json({ token, url: `${siteUrl}/chat?invite=${token}` });
}

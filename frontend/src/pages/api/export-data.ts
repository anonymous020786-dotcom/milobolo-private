import type { NextApiRequest, NextApiResponse } from "next";
import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

// GET /api/export-data → a JSON file with everything MiloBolo stores about you (GDPR / DPDP access request)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false },
  });

  // Accept either a bearer token or the auth-helpers session cookie
  let userId: string | null = null;
  const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  if (bearer) {
    const { data } = await admin.auth.getUser(bearer);
    userId = data.user?.id || null;
  } else {
    const supabase = createServerSupabaseClient({ req, res });
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id || null;
  }
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [authUser, profile, history, connections, sent, received, notifications, ratings, blocks, reports] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").select("*").eq("id", userId).single(),
    admin.from("chat_history").select("*").eq("user_id", userId).order("started_at", { ascending: false }),
    admin.from("connections").select("*").or(`requester_id.eq.${userId},receiver_id.eq.${userId}`),
    admin.from("direct_messages").select("*").eq("sender_id", userId).order("created_at"),
    admin.from("direct_messages").select("*").eq("receiver_id", userId).order("created_at"),
    admin.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("chat_ratings").select("rated_id, room_id, score, created_at").eq("rater_id", userId),
    admin.from("user_blocks").select("blocked_id, created_at").eq("blocker_id", userId),
    admin.from("reports").select("id, reason, details, status, created_at").eq("reporter_id", userId),
  ]);

  const u = authUser.data.user;
  const payload = {
    exported_at: new Date().toISOString(),
    note: "Random-chat message content is never stored by MiloBolo; only session metadata is kept.",
    account: u ? { id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, providers: u.app_metadata?.providers } : null,
    profile: profile.data,
    chat_history: history.data || [],
    connections: connections.data || [],
    direct_messages: { sent: sent.data || [], received: received.data || [] },
    notifications: notifications.data || [],
    ratings_given: ratings.data || [],
    blocked_users: blocks.data || [],
    reports_filed: reports.data || [],
  };

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="milobolo-data-${new Date().toISOString().slice(0, 10)}.json"`);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(JSON.stringify(payload, null, 2));
}

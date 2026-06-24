import type { NextApiRequest, NextApiResponse } from "next";
import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs";
import { createClient } from "@supabase/supabase-js";

// Settings stored as a JSONB column `settings` on the profiles table.
// Falls back gracefully if the column doesn't exist yet.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createServerSupabaseClient({ req, res });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  if (req.method === "GET") {
    const { data } = await admin
      .from("profiles")
      .select("settings, allow_friend_requests")
      .eq("id", user.id)
      .single();
    return res.json({ settings: data?.settings || null, allowFriendRequests: data?.allow_friend_requests ?? true });
  }

  if (req.method === "POST") {
    const { settings } = req.body || {};
    if (!settings || typeof settings !== "object") return res.status(400).json({ error: "Invalid payload" });

    const { error } = await admin.from("profiles").update({
      settings,
      allow_friend_requests: settings.allowFriendRequests ?? true,
    }).eq("id", user.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
}

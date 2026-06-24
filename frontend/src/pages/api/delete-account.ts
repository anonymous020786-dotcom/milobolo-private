import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@supabase/auth-helpers-nextjs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  // Identify the calling user from their session cookie
  const supabaseUser = createServerSupabaseClient({ req, res });
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  // Use service-role client to hard-delete the auth user
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ ok: true });
}

import { createClient } from "@supabase/supabase-js";
import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createPagesBrowserClient({
  supabaseUrl,
  supabaseKey: supabaseAnonKey,
});

export const supabaseAdmin = () =>
  createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  gender: string | null;
  country: string | null;
  is_banned: boolean;
  is_verified: boolean;
  role: "user" | "moderator" | "admin" | "superadmin";
  total_chats: number;
  report_count: number;
  created_at: string;
};

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  label: string;
  description: string;
};

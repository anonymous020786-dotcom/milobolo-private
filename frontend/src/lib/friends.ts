import { supabase } from "@/lib/supabase";

export interface Connection {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "declined" | "blocked";
  created_at: string;
  other_id: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  incoming: boolean; // true when the other person sent the request
}

type ProfileBits = { display_name: string | null; username: string | null; avatar_url: string | null } | null;

export async function loadConnections(userId: string): Promise<Connection[]> {
  const { data, error } = await supabase
    .from("connections")
    .select(`
      id, requester_id, receiver_id, status, created_at,
      requester:profiles!connections_requester_id_fkey(display_name, username, avatar_url),
      receiver:profiles!connections_receiver_id_fkey(display_name, username, avatar_url)
    `)
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return data.map((c: Record<string, unknown>) => {
    const incoming = c.receiver_id === userId;
    const other = (incoming ? c.requester : c.receiver) as ProfileBits;
    return {
      id: c.id as string,
      requester_id: c.requester_id as string,
      receiver_id: c.receiver_id as string,
      status: c.status as Connection["status"],
      created_at: c.created_at as string,
      other_id: (incoming ? c.requester_id : c.receiver_id) as string,
      display_name: other?.display_name || other?.username || "Anonymous",
      username: other?.username || null,
      avatar_url: other?.avatar_url || null,
      incoming,
    };
  });
}

// Sends a friend request to a username. Returns an error message or null.
export async function requestByUsername(userId: string, username: string): Promise<string | null> {
  const handle = username.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) return "Usernames are 3–20 letters, numbers or underscores.";
  const { data: target } = await supabase.from("profiles")
    .select("id, allow_friend_requests").eq("username", handle).maybeSingle();
  if (!target) return `No user named @${handle}.`;
  if (target.id === userId) return "That's you!";
  return sendRequest(userId, target.id, target.allow_friend_requests);
}

export async function sendRequest(userId: string, targetId: string, allowed = true): Promise<string | null> {
  if (!allowed) return "This user isn't accepting friend requests.";
  const { data: existing } = await supabase.from("connections").select("id, status, requester_id")
    .or(`and(requester_id.eq.${userId},receiver_id.eq.${targetId}),and(requester_id.eq.${targetId},receiver_id.eq.${userId})`)
    .maybeSingle();
  if (existing) {
    if (existing.status === "accepted") return "You're already friends.";
    if (existing.status === "blocked") return "You can't send a request to this user.";
    // They already asked you — accepting is the friendly thing to do
    if (existing.status === "pending" && existing.requester_id === targetId) {
      const { error } = await supabase.from("connections").update({ status: "accepted" }).eq("id", existing.id);
      return error ? "Couldn't accept their request." : null;
    }
    return "Request already sent.";
  }
  const { error } = await supabase.from("connections").insert({ requester_id: userId, receiver_id: targetId, status: "pending" });
  return error ? "Couldn't send the request." : null;
}

export async function blockUser(userId: string, connection: Connection) {
  await supabase.from("connections").update({ status: "blocked" }).eq("id", connection.id);
  // Also keeps you out of each other's random matches
  await supabase.from("user_blocks").upsert({ blocker_id: userId, blocked_id: connection.other_id });
}

import { io, Socket } from "socket.io-client";
import { supabase } from "@/lib/supabase";

// Random id for this browser (not a fingerprint): used for "don't match me with them again"
export function getBrowserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem("mb_bid");
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("mb_bid", id);
    }
    return id;
  } catch {
    return null;
  }
}

export const SIGNALING_URL = process.env.NEXT_PUBLIC_SIGNALING_URL || "http://localhost:4000";

// Every socket authenticates with the current Supabase access token (if signed in),
// so the server knows who you are without trusting anything the page sends later.
export function createSignalSocket(opts: { presence?: boolean } = {}): Socket {
  return io(SIGNALING_URL, {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    // Evaluated on every (re)connect, so refreshed tokens are picked up
    auth: (cb) => {
      supabase.auth.getSession()
        .then(({ data }) => cb({ token: data.session?.access_token || null, presence: !!opts.presence, browserId: getBrowserId() }))
        .catch(() => cb({ token: null, presence: !!opts.presence, browserId: getBrowserId() }));
    },
  });
}

export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function signalFetch(path: string, init: RequestInit = {}) {
  const headers = { "Content-Type": "application/json", ...(await authHeaders()), ...(init.headers || {}) };
  const res = await fetch(`${SIGNALING_URL}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

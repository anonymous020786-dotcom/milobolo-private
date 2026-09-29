// Achievements are derived from real data (server-written chat history + profile),
// so they can't be unlocked by editing anything client-side.

export interface HistoryRow {
  mode: string;
  duration_seconds: number | null;
  message_count: number | null;
  started_at: string;
}

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress?: { current: number; target: number };
}

function localDay(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Consecutive days (ending today or yesterday) with at least one chat
export function currentStreak(rows: HistoryRow[], now = new Date()): number {
  const days = new Set(rows.map((r) => localDay(new Date(r.started_at))));
  const cursor = new Date(now);
  if (!days.has(localDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (days.has(localDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function longestStreak(rows: HistoryRow[]): number {
  const days = Array.from(new Set(rows.map((r) => {
    const d = new Date(r.started_at);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }))).sort((a, b) => a - b);
  let best = 0, run = 0, prev = 0;
  for (const t of days) {
    run = prev && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

function count(target: number, current: number) {
  return { unlocked: current >= target, progress: { current: Math.min(current, target), target } };
}

export function computeAchievements(
  rows: HistoryRow[],
  extra: { karma?: number; collegeVerified?: boolean; friends?: number; totalChats?: number } = {},
): Achievement[] {
  const total = Math.max(rows.length, extra.totalChats || 0);
  const byMode = (m: string) => rows.filter((r) => r.mode === m).length;
  const totalSeconds = rows.reduce((a, r) => a + (r.duration_seconds || 0), 0);
  const longest = rows.reduce((a, r) => Math.max(a, r.duration_seconds || 0), 0);
  const nightOwl = rows.some((r) => new Date(r.started_at).getHours() < 4);
  const chatty = rows.filter((r) => (r.message_count || 0) >= 30).length;
  const streak = longestStreak(rows);

  return [
    { id: "first", emoji: "👋", title: "First Hello", description: "Complete your first chat", ...count(1, total) },
    { id: "regular", emoji: "💬", title: "Regular", description: "Complete 25 chats", ...count(25, total) },
    { id: "centurion", emoji: "💯", title: "Centurion", description: "Complete 100 chats", ...count(100, total) },
    { id: "video", emoji: "🎥", title: "On Camera", description: "Complete 10 video chats", ...count(10, byMode("video")) },
    { id: "voice", emoji: "🎙️", title: "Voice Talent", description: "Complete 10 voice chats", ...count(10, byMode("voice")) },
    { id: "chatty", emoji: "🗣️", title: "Deep Talker", description: "Exchange 30+ messages in 5 chats", ...count(5, chatty) },
    { id: "marathon", emoji: "⏱️", title: "Marathon", description: "Stay in one chat for 30 minutes", ...count(30, Math.floor(longest / 60)) },
    { id: "hours", emoji: "⌛", title: "Dedicated", description: "Spend 10 hours chatting in total", ...count(10, Math.floor(totalSeconds / 3600)) },
    { id: "streak7", emoji: "🔥", title: "On Fire", description: "Chat 7 days in a row", ...count(7, streak) },
    { id: "night", emoji: "🦉", title: "Night Owl", description: "Start a chat between midnight and 4 AM", unlocked: nightOwl },
    { id: "trusted", emoji: "⭐", title: "Trusted", description: "Reach 10 karma from good ratings", ...count(10, Math.max(0, extra.karma || 0)) },
    { id: "friends", emoji: "🤝", title: "Friend Maker", description: "Make 5 friends", ...count(5, extra.friends || 0) },
    { id: "student", emoji: "🎓", title: "Verified Student", description: "Verify your college email", unlocked: !!extra.collegeVerified },
  ];
}

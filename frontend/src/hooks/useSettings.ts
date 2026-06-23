import { useMemo } from "react";

const STORAGE_KEY = "mb_settings";

export interface AppSettings {
  defaultMode: "video" | "text";
  defaultLanguage: string;
  showTypingIndicator: boolean;
  playMessageSound: boolean;
  pushEnabled: boolean;
  allowFriendRequests: boolean;
  saveHistory: boolean;
  compactChat: boolean;
}

const DEFAULTS: AppSettings = {
  defaultMode: "video",
  defaultLanguage: "",
  showTypingIndicator: true,
  playMessageSound: false,
  pushEnabled: false,
  allowFriendRequests: true,
  saveHistory: true,
  compactChat: false,
};

export function useSettings(): AppSettings {
  return useMemo(() => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
      return DEFAULTS;
    }
  }, []);
}

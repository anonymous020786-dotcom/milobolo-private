import { useMemo } from "react";

export const SETTINGS_STORAGE_KEY = "mb_settings";

export interface AppSettings {
  defaultMode: "video" | "text";
  defaultLanguage: string;
  showTypingIndicator: boolean;
  playMessageSound: boolean;
  pushEnabled: boolean;
  allowFriendRequests: boolean;
  saveHistory: boolean;
  compactChat: boolean;
  autoNext: boolean;
  sameCountryOnly: boolean;
  hideStrangerLinks: boolean;
  sendReadReceipts: boolean;
}

export const SETTINGS_DEFAULTS: AppSettings = {
  defaultMode: "video",
  defaultLanguage: "",
  showTypingIndicator: true,
  playMessageSound: false,
  pushEnabled: false,
  allowFriendRequests: true,
  saveHistory: true,
  compactChat: false,
  autoNext: false,
  sameCountryOnly: false,
  hideStrangerLinks: true,
  sendReadReceipts: true,
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return SETTINGS_DEFAULTS;
  try {
    return { ...SETTINGS_DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}") };
  } catch {
    return SETTINGS_DEFAULTS;
  }
}

export function useSettings(): AppSettings {
  return useMemo(() => loadSettings(), []);
}

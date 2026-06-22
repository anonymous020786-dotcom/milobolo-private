import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase, FeatureFlag } from "@/lib/supabase";

type FlagMap = Record<string, boolean>;

interface FeatureFlagContextValue {
  flags: FlagMap;
  isEnabled: (key: string) => boolean;
  loading: boolean;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue>({
  flags: {}, isEnabled: () => true, loading: true,
});

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FlagMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("feature_flags").select("key, enabled").then(({ data }) => {
      if (data) {
        const map: FlagMap = {};
        data.forEach((f: { key: string; enabled: boolean }) => { map[f.key] = f.enabled; });
        setFlags(map);
      }
      setLoading(false);
    });
  }, []);

  const isEnabled = (key: string) => flags[key] !== false;

  return (
    <FeatureFlagContext.Provider value={{ flags, isEnabled, loading }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export const useFeatureFlags = () => useContext(FeatureFlagContext);

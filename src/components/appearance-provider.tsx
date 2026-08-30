import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_APPEARANCE,
  applyAppearance,
  loadAppearance,
  saveAppearance,
  type Appearance,
} from "@/lib/appearance";

const AppearanceContext = createContext<{
  appearance: Appearance;
  setAppearance: (next: Appearance) => void;
}>({
  appearance: DEFAULT_APPEARANCE,
  setAppearance: () => {},
});

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setState] = useState<Appearance>(DEFAULT_APPEARANCE);

  useEffect(() => {
    const loaded = loadAppearance();
    setState(loaded);
    applyAppearance(loaded);
  }, []);

  const value = useMemo(
    () => ({
      appearance,
      setAppearance: (next: Appearance) => {
        setState(next);
        saveAppearance(next);
      },
    }),
    [appearance],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
  dynamicAccent: string | null;
  setDynamicAccent: (hex: string | null) => void;
}>({
  appearance: DEFAULT_APPEARANCE,
  setAppearance: () => {},
  dynamicAccent: null,
  setDynamicAccent: () => {},
});

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setState] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [dynamicAccent, setDynamicAccent] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadAppearance();
    setState(loaded);
    applyAppearance(loaded);
  }, []);

  useEffect(() => {
    applyAppearance(
      appearance,
      undefined,
      appearance.dynamic ? dynamicAccent : null,
    );
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () =>
      applyAppearance(
        appearance,
        media.matches,
        appearance.dynamic ? dynamicAccent : null,
      );
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [appearance, dynamicAccent]);

  const setAppearance = useCallback((next: Appearance) => {
    setState(next);
    saveAppearance(next);
  }, []);

  const value = useMemo(
    () => ({
      appearance,
      setAppearance,
      dynamicAccent,
      setDynamicAccent,
    }),
    [appearance, setAppearance, dynamicAccent],
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

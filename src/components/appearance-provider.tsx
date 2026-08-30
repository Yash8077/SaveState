import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { brandFaviconSvg } from "@/lib/brand";
import {
  DEFAULT_APPEARANCE,
  applyAppearance,
  isDarkAppearance,
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
    syncThemedFavicon(appearance);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      applyAppearance(
        appearance,
        media.matches,
        appearance.dynamic ? dynamicAccent : null,
      );
      syncThemedFavicon(appearance, media.matches);
    };
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

function syncThemedFavicon(next: Appearance, systemDark?: boolean) {
  if (typeof document === "undefined") return;
  const dark = isDarkAppearance(next, systemDark);
  const accent =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--color-accent")
      .trim() || "#4fd8c4";
  const href = `data:image/svg+xml,${encodeURIComponent(brandFaviconSvg(accent, dark))}`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/svg+xml";
  link.href = href;
}

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
  loadDiscoverLayout,
  loadHeroAutoplay,
  loadHomeLayout,
  mergeDiscoverLayout,
  mergeHomeLayout,
  moveHomeSection,
  reorderHomeSection,
  saveDiscoverLayout,
  saveHeroAutoplay,
  saveHomeLayout,
  toggleHomeSection,
  type HomeSectionPref,
} from "@/lib/home-layout";

export type LayoutSurface = "home" | "discover";

const HomeLayoutContext = createContext<{
  homeSections: HomeSectionPref[];
  discoverSections: HomeSectionPref[];
  autoplay: boolean;
  setHomeSections: (next: HomeSectionPref[]) => void;
  setDiscoverSections: (next: HomeSectionPref[]) => void;
  setAutoplay: (on: boolean) => void;
  move: (surface: LayoutSurface, id: string, dir: -1 | 1) => void;
  toggle: (surface: LayoutSurface, id: string, enabled: boolean) => void;
  reorder: (surface: LayoutSurface, from: number, to: number) => void;
  reset: (surface: LayoutSurface) => void;
  sections: HomeSectionPref[];
}>({
  homeSections: mergeHomeLayout(null),
  discoverSections: mergeDiscoverLayout(null),
  autoplay: true,
  setHomeSections: () => {},
  setDiscoverSections: () => {},
  setAutoplay: () => {},
  move: () => {},
  toggle: () => {},
  reorder: () => {},
  reset: () => {},
  sections: mergeHomeLayout(null),
});

export function HomeLayoutProvider({ children }: { children: ReactNode }) {
  const [homeSections, setHomeState] = useState<HomeSectionPref[]>(() =>
    mergeHomeLayout(null),
  );
  const [discoverSections, setDiscoverState] = useState<HomeSectionPref[]>(() =>
    mergeDiscoverLayout(null),
  );
  const [autoplay, setAutoplayState] = useState(true);

  useEffect(() => {
    setHomeState(loadHomeLayout());
    setDiscoverState(loadDiscoverLayout());
    setAutoplayState(loadHeroAutoplay());
  }, []);

  const setHomeSections = useCallback((next: HomeSectionPref[]) => {
    const merged = mergeHomeLayout(next);
    setHomeState(merged);
    saveHomeLayout(merged);
  }, []);

  const setDiscoverSections = useCallback((next: HomeSectionPref[]) => {
    const merged = mergeDiscoverLayout(next);
    setDiscoverState(merged);
    saveDiscoverLayout(merged);
  }, []);

  const setAutoplay = useCallback((on: boolean) => {
    setAutoplayState(on);
    saveHeroAutoplay(on);
  }, []);

  const value = useMemo(
    () => ({
      homeSections,
      discoverSections,
      autoplay,
      setHomeSections,
      setDiscoverSections,
      setAutoplay,
      move: (surface: LayoutSurface, id: string, dir: -1 | 1) => {
        if (surface === "home") {
          setHomeSections(moveHomeSection(homeSections, id, dir));
        } else {
          setDiscoverSections(moveHomeSection(discoverSections, id, dir));
        }
      },
      toggle: (surface: LayoutSurface, id: string, enabled: boolean) => {
        if (surface === "home") {
          setHomeSections(toggleHomeSection(homeSections, id, enabled));
        } else {
          setDiscoverSections(toggleHomeSection(discoverSections, id, enabled));
        }
      },
      reorder: (surface: LayoutSurface, from: number, to: number) => {
        if (surface === "home") {
          setHomeSections(reorderHomeSection(homeSections, from, to));
        } else {
          setDiscoverSections(reorderHomeSection(discoverSections, from, to));
        }
      },
      reset: (surface: LayoutSurface) => {
        if (surface === "home") setHomeSections(mergeHomeLayout(null));
        else {
          setDiscoverSections(mergeDiscoverLayout(null));
          setAutoplay(true);
        }
      },
      sections: homeSections,
    }),
    [
      homeSections,
      discoverSections,
      autoplay,
      setHomeSections,
      setDiscoverSections,
      setAutoplay,
    ],
  );

  return (
    <HomeLayoutContext.Provider value={value}>
      {children}
    </HomeLayoutContext.Provider>
  );
}

export function useHomeLayout() {
  return useContext(HomeLayoutContext);
}

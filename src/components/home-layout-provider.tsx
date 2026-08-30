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
  loadHeroAutoplay,
  loadHomeLayout,
  mergeHomeLayout,
  moveHomeSection,
  reorderHomeSection,
  saveHeroAutoplay,
  saveHomeLayout,
  toggleHomeSection,
  type HomeSectionPref,
} from "@/lib/home-layout";

const HomeLayoutContext = createContext<{
  sections: HomeSectionPref[];
  autoplay: boolean;
  setSections: (next: HomeSectionPref[]) => void;
  setAutoplay: (on: boolean) => void;
  move: (id: string, dir: -1 | 1) => void;
  toggle: (id: string, enabled: boolean) => void;
  reorder: (from: number, to: number) => void;
  reset: () => void;
}>({
  sections: mergeHomeLayout(null),
  autoplay: true,
  setSections: () => {},
  setAutoplay: () => {},
  move: () => {},
  toggle: () => {},
  reorder: () => {},
  reset: () => {},
});

export function HomeLayoutProvider({ children }: { children: ReactNode }) {
  const [sections, setState] = useState<HomeSectionPref[]>(() =>
    mergeHomeLayout(null),
  );
  const [autoplay, setAutoplayState] = useState(true);

  useEffect(() => {
    setState(loadHomeLayout());
    setAutoplayState(loadHeroAutoplay());
  }, []);

  const setSections = useCallback((next: HomeSectionPref[]) => {
    const merged = mergeHomeLayout(next);
    setState(merged);
    saveHomeLayout(merged);
  }, []);

  const setAutoplay = useCallback((on: boolean) => {
    setAutoplayState(on);
    saveHeroAutoplay(on);
  }, []);

  const value = useMemo(
    () => ({
      sections,
      autoplay,
      setSections,
      setAutoplay,
      move: (id: string, dir: -1 | 1) =>
        setSections(moveHomeSection(sections, id, dir)),
      toggle: (id: string, enabled: boolean) =>
        setSections(toggleHomeSection(sections, id, enabled)),
      reorder: (from: number, to: number) =>
        setSections(reorderHomeSection(sections, from, to)),
      reset: () => {
        setSections(mergeHomeLayout(null));
        setAutoplay(true);
      },
    }),
    [sections, autoplay, setSections, setAutoplay],
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

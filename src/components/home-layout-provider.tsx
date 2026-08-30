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
  loadHomeLayout,
  mergeHomeLayout,
  moveHomeSection,
  reorderHomeSection,
  saveHomeLayout,
  toggleHomeSection,
  type HomeSectionPref,
} from "@/lib/home-layout";

const HomeLayoutContext = createContext<{
  sections: HomeSectionPref[];
  setSections: (next: HomeSectionPref[]) => void;
  move: (id: string, dir: -1 | 1) => void;
  toggle: (id: string, enabled: boolean) => void;
  reorder: (from: number, to: number) => void;
  reset: () => void;
}>({
  sections: mergeHomeLayout(null),
  setSections: () => {},
  move: () => {},
  toggle: () => {},
  reorder: () => {},
  reset: () => {},
});

export function HomeLayoutProvider({ children }: { children: ReactNode }) {
  const [sections, setState] = useState<HomeSectionPref[]>(() =>
    mergeHomeLayout(null),
  );

  useEffect(() => {
    setState(loadHomeLayout());
  }, []);

  const setSections = useCallback((next: HomeSectionPref[]) => {
    const merged = mergeHomeLayout(next);
    setState(merged);
    saveHomeLayout(merged);
  }, []);

  const value = useMemo(
    () => ({
      sections,
      setSections,
      move: (id: string, dir: -1 | 1) =>
        setSections(moveHomeSection(sections, id, dir)),
      toggle: (id: string, enabled: boolean) =>
        setSections(toggleHomeSection(sections, id, enabled)),
      reorder: (from: number, to: number) =>
        setSections(reorderHomeSection(sections, from, to)),
      reset: () => setSections(mergeHomeLayout(null)),
    }),
    [sections, setSections],
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

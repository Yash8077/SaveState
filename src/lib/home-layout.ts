export const HOME_SECTION_IDS = [
  "hero",
  "stats",
  "playing",
  "backlog",
  "popular",
  "new_releases",
  "coming_soon",
  "specials",
  "playstation",
] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number] | string;

export type HomeSectionPref = {
  id: HomeSectionId;
  enabled: boolean;
};

export const HOME_SECTION_META: Record<
  string,
  { title: string; hint: string; catalog?: boolean }
> = {
  hero: { title: "Featured carousel", hint: "Featured games at the top of Home" },
  stats: { title: "Welcome stats", hint: "Playing / beaten / backlog chips" },
  playing: { title: "Continue playing", hint: "Games you marked as playing" },
  backlog: { title: "Planning to play", hint: "Your backlog" },
  popular: { title: "Popular", hint: "Loved old and new, ranked by reviews", catalog: true },
  new_releases: { title: "New releases", hint: "Popular new Steam games", catalog: true },
  coming_soon: { title: "Coming soon", hint: "Most wishlisted upcoming games", catalog: true },
  specials: { title: "On sale", hint: "Steam specials", catalog: true },
  playstation: { title: "PlayStation", hint: "PS5 exclusives and popular titles", catalog: true },
};

export const DEFAULT_HOME_SECTIONS: HomeSectionPref[] = HOME_SECTION_IDS.map(
  (id) => ({ id, enabled: true }),
);

const KEY = "savestate-home-layout";
const AUTOPLAY_KEY = "savestate-hero-autoplay";

export function isCatalogSection(id: string): boolean {
  return Boolean(HOME_SECTION_META[id]?.catalog);
}

export function mergeHomeLayout(
  saved: HomeSectionPref[] | null | undefined,
  extraIds: string[] = [],
): HomeSectionPref[] {
  const known = new Set<string>([
    ...HOME_SECTION_IDS,
    ...extraIds.filter((id) => Boolean(id)),
  ]);
  const out: HomeSectionPref[] = [];
  const seen = new Set<string>();

  const take = (id: string, enabled: boolean) => {
    if (!id || seen.has(id) || !known.has(id)) return;
    seen.add(id);
    out.push({ id, enabled });
  };

  for (const row of saved ?? []) {
    if (!row || typeof row.id !== "string") continue;
    const id = row.id === "top_sellers" ? "popular" : row.id;
    take(id, row.enabled !== false);
  }
  for (const id of HOME_SECTION_IDS) take(id, true);
  for (const id of extraIds) {
    if (id === "top_sellers") continue;
    take(id, true);
  }
  return out;
}

export function parseHomeLayout(raw: unknown): HomeSectionPref[] {
  if (!Array.isArray(raw)) return mergeHomeLayout(null);
  const rows: HomeSectionPref[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = (item as { id?: unknown }).id;
    if (typeof id !== "string" || !id.trim()) continue;
    rows.push({
      id: id.trim(),
      enabled: (item as { enabled?: unknown }).enabled !== false,
    });
  }
  return mergeHomeLayout(rows);
}

export function moveHomeSection(
  sections: HomeSectionPref[],
  id: string,
  dir: -1 | 1,
): HomeSectionPref[] {
  const index = sections.findIndex((row) => row.id === id);
  if (index < 0) return sections;
  const next = index + dir;
  if (next < 0 || next >= sections.length) return sections;
  const copy = sections.slice();
  const [row] = copy.splice(index, 1);
  copy.splice(next, 0, row!);
  return copy;
}

export function reorderHomeSection(
  sections: HomeSectionPref[],
  from: number,
  to: number,
): HomeSectionPref[] {
  if (from === to) return sections;
  if (from < 0 || to < 0 || from >= sections.length || to >= sections.length) {
    return sections;
  }
  const copy = sections.slice();
  const [row] = copy.splice(from, 1);
  copy.splice(to, 0, row!);
  return copy;
}

export function toggleHomeSection(
  sections: HomeSectionPref[],
  id: string,
  enabled: boolean,
): HomeSectionPref[] {
  return sections.map((row) => (row.id === id ? { ...row, enabled } : row));
}

export function loadHomeLayout(): HomeSectionPref[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return mergeHomeLayout(null);
    return parseHomeLayout(JSON.parse(raw) as unknown);
  } catch {
    return mergeHomeLayout(null);
  }
}

export function saveHomeLayout(next: HomeSectionPref[]) {
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function homeSectionTitle(id: string): string {
  return HOME_SECTION_META[id]?.title ?? id.replace(/_/g, " ");
}

export function homeSectionHint(id: string): string {
  return HOME_SECTION_META[id]?.hint ?? "Catalog rail";
}

export function loadHeroAutoplay(): boolean {
  try {
    const raw = localStorage.getItem(AUTOPLAY_KEY);
    if (raw == null) return true;
    return raw !== "0" && raw !== "false";
  } catch {
    return true;
  }
}

export function saveHeroAutoplay(on: boolean) {
  try {
    localStorage.setItem(AUTOPLAY_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

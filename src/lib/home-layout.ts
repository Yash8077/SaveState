export type HomeSectionPref = {
  id: string;
  enabled: boolean;
};

export const HOME_SECTION_IDS = [
  "stats",
  "playing",
  "backlog",
  "wishlist",
  "recommended",
  "playstation",
] as const;

export const DISCOVER_SECTION_IDS = [
  "hero",
  "popular",
  "new_releases",
  "coming_soon",
  "specials",
  "playstation",
] as const;

export const HOME_SECTION_META: Record<
  string,
  { title: string; hint: string; catalog?: boolean; surface: "home" | "discover" }
> = {
  stats: {
    title: "Welcome stats",
    hint: "Playing / beaten / backlog chips",
    surface: "home",
  },
  playing: {
    title: "Continue playing",
    hint: "Games you marked as playing",
    surface: "home",
  },
  backlog: {
    title: "Planning to play",
    hint: "Your backlog",
    surface: "home",
  },
  wishlist: {
    title: "Wishlist",
    hint: "Wanted games, unreleased first",
    surface: "home",
  },
  recommended: {
    title: "Recommended",
    hint: "Because you played — from IGDB",
    surface: "home",
  },
  hero: {
    title: "Featured carousel",
    hint: "Trending games at the top of Discover",
    surface: "discover",
  },
  popular: {
    title: "Popular",
    hint: "Loved old and new, ranked by reviews",
    catalog: true,
    surface: "discover",
  },
  new_releases: {
    title: "New releases",
    hint: "Popular new Steam games",
    catalog: true,
    surface: "discover",
  },
  coming_soon: {
    title: "Coming soon",
    hint: "Most wishlisted upcoming games",
    catalog: true,
    surface: "discover",
  },
  specials: {
    title: "On sale",
    hint: "Steam specials",
    catalog: true,
    surface: "discover",
  },
  playstation: {
    title: "Popular on PlayStation",
    hint: "Popular PlayStation 5 titles",
    catalog: true,
    surface: "home",
  },
};

export const DEFAULT_HOME_SECTIONS: HomeSectionPref[] = HOME_SECTION_IDS.map(
  (id) => ({ id, enabled: true }),
);
export const DEFAULT_DISCOVER_SECTIONS: HomeSectionPref[] =
  DISCOVER_SECTION_IDS.map((id) => ({ id, enabled: true }));

const HOME_KEY = "savestate-home-layout-v2";
const DISCOVER_KEY = "savestate-discover-layout-v1";
const LEGACY_KEY = "savestate-home-layout";
const AUTOPLAY_KEY = "savestate-hero-autoplay";

export function isCatalogSection(id: string): boolean {
  return Boolean(HOME_SECTION_META[id]?.catalog) || id === "playstation";
}

function normalizeId(id: string): string {
  return id === "top_sellers" ? "popular" : id;
}

export function mergeSectionList(
  defaults: readonly string[],
  saved: HomeSectionPref[] | null | undefined,
  extraIds: string[] = [],
): HomeSectionPref[] {
  const known = new Set<string>([
    ...defaults,
    ...extraIds.filter((id) => Boolean(id) && id !== "top_sellers"),
  ]);
  const out: HomeSectionPref[] = [];
  const seen = new Set<string>();
  const take = (id: string, enabled: boolean) => {
    const next = normalizeId(id);
    if (!next || seen.has(next) || !known.has(next)) return;
    seen.add(next);
    out.push({ id: next, enabled });
  };
  for (const row of saved ?? []) {
    if (!row || typeof row.id !== "string") continue;
    take(row.id, row.enabled !== false);
  }
  for (const id of defaults) take(id, true);
  for (const id of extraIds) take(id, true);
  return out;
}

export function mergeHomeLayout(
  saved: HomeSectionPref[] | null | undefined,
  extraIds: string[] = [],
): HomeSectionPref[] {
  return mergeSectionList(HOME_SECTION_IDS, saved, extraIds);
}

export function mergeDiscoverLayout(
  saved: HomeSectionPref[] | null | undefined,
  extraIds: string[] = [],
): HomeSectionPref[] {
  return mergeSectionList(DISCOVER_SECTION_IDS, saved, extraIds);
}

function asRows(raw: unknown): HomeSectionPref[] {
  if (!Array.isArray(raw)) return [];
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
  return rows;
}

export function parseHomeLayout(raw: unknown): HomeSectionPref[] {
  return mergeHomeLayout(asRows(raw));
}

export function parseDiscoverLayout(raw: unknown): HomeSectionPref[] {
  return mergeDiscoverLayout(asRows(raw));
}

function enabledMap(rows: HomeSectionPref[]): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const row of rows) out.set(normalizeId(row.id), row.enabled);
  return out;
}

export function migrateLegacyLayout(raw: unknown): {
  home: HomeSectionPref[];
  discover: HomeSectionPref[];
} {
  const legacy = asRows(raw);
  const enabled = enabledMap(legacy);
  const home = HOME_SECTION_IDS.map((id) => ({
    id,
    enabled: enabled.get(id) ?? true,
  }));
  const discover = DISCOVER_SECTION_IDS.map((id) => ({
    id,
    enabled: enabled.get(id) ?? true,
  }));
  return { home, discover };
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

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function loadHomeLayout(): HomeSectionPref[] {
  const v2 = readJson(HOME_KEY);
  if (v2) return parseHomeLayout(v2);
  const legacy = readJson(LEGACY_KEY);
  if (legacy) return migrateLegacyLayout(legacy).home;
  return mergeHomeLayout(null);
}

export function loadDiscoverLayout(): HomeSectionPref[] {
  const v1 = readJson(DISCOVER_KEY);
  if (v1) return parseDiscoverLayout(v1);
  const legacy = readJson(LEGACY_KEY);
  if (legacy) return migrateLegacyLayout(legacy).discover;
  return mergeDiscoverLayout(null);
}

export function saveHomeLayout(next: HomeSectionPref[]) {
  localStorage.setItem(HOME_KEY, JSON.stringify(next));
}

export function saveDiscoverLayout(next: HomeSectionPref[]) {
  localStorage.setItem(DISCOVER_KEY, JSON.stringify(next));
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

/** @deprecated old combined list — tests still call mergeHomeLayout */
export const DEFAULT_HOME_SECTIONS_LEGACY = DEFAULT_HOME_SECTIONS;
